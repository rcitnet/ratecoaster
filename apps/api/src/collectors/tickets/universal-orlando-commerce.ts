import { parseMoneyToCents } from "@ratecoaster/shared";
import { ticketProducts } from "@ratecoaster/db/schema";
import { dateRange, todayInTimezone } from "../framework/dates.js";
import { politeFetch } from "../framework/http.js";
import type { CollectorContext } from "../framework/types.js";
import { persistTicketPrice } from "./persist.js";

const COMMERCE_BASE = "https://comm-api.universaldestinationsandexperiences.com";
const TOKEN_URL = `${COMMERCE_BASE}/authorizationserver/oauth/token`;
const BASE_SITE = "uor_b2c";
const DEFAULT_CLIENT_ID = "mobile_android";
const CALENDAR_CHUNK_DAYS = 45;

type TicketProductRow = typeof ticketProducts.$inferSelect;
type GuestCategory = "adult" | "child";

interface ProductConfig {
  adult: string;
  child: string;
}

interface CalendarReading {
  partNumber: string;
  validDate: string;
  priceCents: number;
  totalCents: number | null;
  available: boolean;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function objectOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function productConfigOf(product: TicketProductRow): ProductConfig | null {
  const cfg = (product.collectorConfig ?? {}) as Record<string, unknown>;
  if (cfg.adapter !== "universal-orlando-commerce") return null;
  const adult = typeof cfg.adultProductCode === "string" ? cfg.adultProductCode.trim() : "";
  const child = typeof cfg.childProductCode === "string" ? cfg.childProductCode.trim() : "";
  return adult && child ? { adult, child } : null;
}

function credentials(): { clientId: string; clientSecret: string } | null {
  // Both storefronts currently publish the same guest commerce application,
  // so an existing Kids credential remains a safe fallback for deployments
  // that configured it before Orlando ticket collection was added.
  const clientSecret =
    process.env.UNIVERSAL_ORLANDO_COMMERCE_CLIENT_SECRET?.trim() ||
    process.env.UNIVERSAL_KIDS_COMMERCE_CLIENT_SECRET?.trim() ||
    "";
  if (!clientSecret) return null;
  return {
    clientId:
      process.env.UNIVERSAL_ORLANDO_COMMERCE_CLIENT_ID?.trim() || DEFAULT_CLIENT_ID,
    clientSecret,
  };
}

export function hasUniversalOrlandoTicketConfig(product: TicketProductRow): boolean {
  return productConfigOf(product) !== null;
}

export function universalOrlandoTicketCredentialsConfigured(): boolean {
  return credentials() !== null;
}

export function buildUniversalOrlandoCalendarUrl(): string {
  const url = new URL(
    `/occ/v2/${BASE_SITE}/products/fetchCalendarDatesWithPriceAndInventory`,
    COMMERCE_BASE
  );
  url.searchParams.set("lang", "en");
  url.searchParams.set("curr", "USD");
  return url.toString();
}

/** Parse the first-party calendar response without relying on array order. */
export function parseUniversalOrlandoTicketCalendar(payload: unknown): CalendarReading[] {
  const root = objectOf(payload);
  if (!root || !Array.isArray(root.eventAvailability)) {
    throw new Error("Universal Orlando ticket response did not contain eventAvailability");
  }

  const readings: CalendarReading[] = [];
  for (const rawGroup of root.eventAvailability) {
    const group = objectOf(rawGroup);
    const partNumber = typeof group?.partNumber === "string" ? group.partNumber : "";
    if (!partNumber || !Array.isArray(group?.calendarDates)) continue;

    for (const rawDate of group.calendarDates) {
      const date = objectOf(rawDate);
      const validDate = typeof date?.date === "string" ? date.date : "";
      const pricing = Array.isArray(date?.pricing) ? objectOf(date.pricing[0]) : null;
      const priceCents = parseMoneyToCents(pricing?.amount as string | number | null);
      const totalCents = parseMoneyToCents(
        pricing?.fullVariantPrice as string | number | null
      );
      if (!/^\d{4}-\d{2}-\d{2}$/.test(validDate) || priceCents === null || priceCents <= 0) {
        continue;
      }

      const inventory = Array.isArray(date?.inventoryEvents) ? date.inventoryEvents : [];
      const inventoryAvailable =
        inventory.length === 0 ||
        inventory.some((event) => {
          const item = objectOf(event);
          return item?.isAvailable !== false && item?.forceSoldOut !== true;
        });
      readings.push({
        partNumber,
        validDate,
        priceCents,
        totalCents,
        available:
          date?.canBeVisited !== false && date?.forceSoldOut !== true && inventoryAvailable,
      });
    }
  }
  return readings;
}

async function fetchGuestToken(ctx: CollectorContext): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const auth = credentials();
  if (!auth) throw new Error("Universal Orlando commerce credentials are not configured");

  ctx.stats.requestCount++;
  const basic = Buffer.from(`${auth.clientId}:${auth.clientSecret}`).toString("base64");
  const response = await politeFetch(TOKEN_URL, {
    method: "POST",
    rpm: 12,
    headers: {
      accept: "application/json",
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    requestKey: "universal-orlando-tickets:guest-token",
  });
  if (response.skipped) return "dry-run-token";

  const payload = objectOf(JSON.parse(response.body));
  const value = typeof payload?.access_token === "string" ? payload.access_token : "";
  const expiresIn = Number(payload?.expires_in);
  if (!value) throw new Error("Universal Orlando guest token response contained no access token");
  cachedToken = {
    value,
    expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
  };
  return value;
}

/** Collect all configured Orlando products in a small number of batched calls. */
export async function collectUniversalOrlandoTickets(
  ctx: CollectorContext,
  products: TicketProductRow[],
  lookaheadDays: number
): Promise<void> {
  const configured = products
    .map((product) => ({ product, config: productConfigOf(product) }))
    .filter((entry): entry is { product: TicketProductRow; config: ProductConfig } =>
      entry.config !== null
    );
  if (configured.length === 0) return;

  const byPartNumber = new Map<
    string,
    { productId: string; guestCategory: GuestCategory }
  >();
  for (const { product, config } of configured) {
    byPartNumber.set(config.adult, {
      productId: product.id,
      guestCategory: "adult",
    });
    byPartNumber.set(config.child, {
      productId: product.id,
      guestCategory: "child",
    });
  }

  const token = await fetchGuestToken(ctx);
  if (!token) return;
  const dates = dateRange(todayInTimezone("America/New_York"), lookaheadDays);
  const url = buildUniversalOrlandoCalendarUrl();

  for (let offset = 0; offset < dates.length; offset += CALENDAR_CHUNK_DAYS) {
    const chunk = dates.slice(offset, offset + CALENDAR_CHUNK_DAYS);
    const from = chunk[0]!;
    const to = chunk[chunk.length - 1]!;
    const events = [...byPartNumber.keys()].map((partNumber) => ({
      partNumber,
      startDate: from,
      endDate: to,
      quantity: 1,
    }));

    ctx.stats.requestCount++;
    const response = await politeFetch(url, {
      method: "POST",
      rpm: 12,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ currency: "USD", events }),
      requestKey: `universal-orlando-tickets:${from}:${to}`,
    });
    if (response.skipped) continue;

    const readings = parseUniversalOrlandoTicketCalendar(JSON.parse(response.body));
    for (const reading of readings) {
      const target = byPartNumber.get(reading.partNumber);
      if (!target) continue;
      ctx.stats.parsedCount++;
      await persistTicketPrice(ctx, {
        productId: target.productId,
        validDate: reading.validDate,
        guestCategory: target.guestCategory,
        priceCents: reading.priceCents,
        totalCents: reading.totalCents,
        available: reading.available,
      });
    }
  }

  ctx.logger.info(
    `Universal Orlando: covered ${dates.length} dates for ${configured.length} ticket products (adult and child)`
  );
}
