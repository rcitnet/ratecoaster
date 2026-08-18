import { parseMoneyToCents } from "@ratecoaster/shared";
import { and, eq } from "drizzle-orm";
import { rateCurrent } from "@ratecoaster/db/schema";
import { addDays, dateRange, todayInTimezone } from "../../framework/dates.js";
import { politeFetch } from "../../framework/http.js";
import type { RateReading } from "../../framework/persist.js";
import { upsertRoomType } from "../room-types.js";
import { selectRotatingDates } from "../schedule.js";
import type { PropertyRow, RateAdapter } from "./types.js";

const COMMERCE_BASE = "https://comm-api.universaldestinationsandexperiences.com";
const TOKEN_URL = `${COMMERCE_BASE}/authorizationserver/oauth/token`;
const BASE_SITE = "ukrfr_b2c_hotel";
const DEFAULT_CLIENT_ID = "mobile_android";

interface KidsHotelOffer {
  roomCode: string;
  roomName: string;
  nightlyCents: number;
  currency: string;
  available: boolean;
  maxOccupancy: number | null;
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

function configOf(property: PropertyRow): { hotelId: string } | null {
  const cfg = (property.collectorConfig ?? {}) as Record<string, unknown>;
  if (cfg.adapter !== "universal-kids-commerce") return null;
  const hotelId = typeof cfg.hotelId === "string" ? cfg.hotelId.trim() : "";
  return hotelId ? { hotelId } : null;
}

function credentials(): { clientId: string; clientSecret: string } | null {
  const clientSecret = process.env.UNIVERSAL_KIDS_COMMERCE_CLIENT_SECRET?.trim() ?? "";
  if (!clientSecret) return null;
  return {
    clientId:
      process.env.UNIVERSAL_KIDS_COMMERCE_CLIENT_ID?.trim() || DEFAULT_CLIENT_ID,
    clientSecret,
  };
}

export function buildKidsHotelSearchUrl(): string {
  const url = new URL(`/occ/v2/${BASE_SITE}/hotelsWithRoomDetails`, COMMERCE_BASE);
  url.searchParams.set("language", "en");
  url.searchParams.set("country", "us");
  url.searchParams.set("siteId", BASE_SITE);
  return url.toString();
}

/** Convert the public commerce response into observed Standard room offers. */
export function parseKidsHotelResponse(
  payload: unknown,
  expectedHotelId = "UNI012"
): KidsHotelOffer[] {
  const root = objectOf(payload);
  if (!root || !Array.isArray(root.bookingRooms)) {
    throw new Error("Universal Kids response did not contain bookingRooms");
  }

  const offers: KidsHotelOffer[] = [];
  const seen = new Set<string>();

  for (const rawRoom of root.bookingRooms) {
    const room = objectOf(rawRoom);
    if (!room || !Array.isArray(room.products)) continue;

    for (const rawProduct of room.products) {
      const product = objectOf(rawProduct);
      const price = objectOf(product?.hotelPrice);
      const stock = objectOf(product?.stock);
      if (!product || !price) continue;
      if (product.hotelId !== expectedHotelId || price.ratePlanCode !== "RACK") continue;

      const roomCode = typeof product.roomTypeCode === "string" ? product.roomTypeCode : "";
      const roomName = typeof product.name === "string" ? product.name : "";
      const nightlyCents = parseMoneyToCents(
        typeof price.value === "number" || typeof price.value === "string"
          ? price.value
          : null
      );
      if (!roomCode || !roomName || nightlyCents === null || nightlyCents <= 0) continue;
      if (seen.has(roomCode)) continue;
      seen.add(roomCode);

      const maxOccupancy = Number(product.maxOccupancy);
      offers.push({
        roomCode,
        roomName,
        nightlyCents,
        currency: typeof price.currencyIso === "string" ? price.currencyIso : "USD",
        available:
          product.purchasable === true && stock?.stockLevelStatus !== "outOfStock",
        maxOccupancy:
          Number.isInteger(maxOccupancy) && maxOccupancy > 0 ? maxOccupancy : null,
      });
    }
  }

  return offers;
}

async function fetchGuestToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const auth = credentials();
  if (!auth) throw new Error("Universal Kids commerce credentials are not configured");

  const encoded = Buffer.from(`${auth.clientId}:${auth.clientSecret}`).toString("base64");
  const response = await politeFetch(TOKEN_URL, {
    method: "POST",
    rpm: 12,
    headers: {
      accept: "application/json",
      authorization: `Basic ${encoded}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    requestKey: "universal-kids:guest-token",
  });
  if (response.skipped) return "dry-run-token";

  const payload = objectOf(JSON.parse(response.body));
  const value = typeof payload?.access_token === "string" ? payload.access_token : "";
  const expiresIn = Number(payload?.expires_in);
  if (!value) throw new Error("Universal Kids guest token response contained no access token");

  cachedToken = {
    value,
    expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
  };
  return value;
}

/** Universal Kids Resort Hotel's separate SAP Commerce booking site. */
export const universalKidsCommerceAdapter: RateAdapter = {
  source: "observed",
  name: "universal-kids-commerce",

  async isReady(_ctx, property) {
    if (!configOf(property)) {
      return { ready: false, reason: "missing Universal Kids hotelId" };
    }
    if (!credentials()) {
      return {
        ready: false,
        reason: "UNIVERSAL_KIDS_COMMERCE_CLIENT_SECRET is not configured",
      };
    }
    return { ready: true };
  },

  async collect(ctx, property, params, emit) {
    const config = configOf(property);
    if (!config) return;
    if (params.nights !== 1) {
      throw new Error("Universal Kids collection only supports one-night quotes");
    }

    let token: string | null;
    try {
      ctx.stats.requestCount++;
      token = await fetchGuestToken();
    } catch (error) {
      ctx.stats.errorCount++;
      ctx.logger.warn(`${property.slug} guest token: ${String(error)}`);
      return;
    }
    if (!token) return;

    const dates = selectRotatingDates(
      dateRange(todayInTimezone("America/Chicago"), params.lookaheadDays),
      params.sliceFraction
    );
    const searchUrl = buildKidsHotelSearchUrl();
    const bookingSessionId = crypto.randomUUID();
    const readings: RateReading[] = [];

    for (const stayDate of dates) {
      try {
        ctx.stats.requestCount++;
        const response = await politeFetch(searchUrl, {
          method: "POST",
          rpm: 12,
          headers: {
            accept: "application/json",
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            bookingSessionId,
            hotelId: config.hotelId,
            checkInDate: stayDate,
            checkOutDate: addDays(stayDate, 1),
            includeAccessible: false,
            bookingRooms: [
              {
                bookingRoomSequenceId: 1,
                adultGuestCount: 2,
                childGuestCount: 0,
              },
            ],
          }),
          requestKey: `universal-kids:${stayDate}:STANDARD`,
        });
        if (response.skipped) continue;

        const offers = parseKidsHotelResponse(JSON.parse(response.body), config.hotelId);
        const seenRoomTypeIds = new Set<string>();
        for (const offer of offers) {
          const roomTypeId = await upsertRoomType(
            ctx,
            property.id,
            offer.roomCode,
            offer.roomName,
            offer.maxOccupancy
          );
          seenRoomTypeIds.add(roomTypeId);
          readings.push({
            propertyId: property.id,
            roomTypeId,
            rateCode: "STANDARD",
            stayDate,
            nights: 1,
            adults: 2,
            children: 0,
            nightlyCents: offer.nightlyCents,
            totalCents: null,
            currency: offer.currency,
            available: offer.available,
            source: "observed",
            isEstimated: false,
            merchant: null,
          });
        }

        const previous = await ctx.db
          .select({
            roomTypeId: rateCurrent.roomTypeId,
            nightlyCents: rateCurrent.nightlyCents,
            totalCents: rateCurrent.totalCents,
            currency: rateCurrent.currency,
          })
          .from(rateCurrent)
          .where(
            and(
              eq(rateCurrent.propertyId, property.id),
              eq(rateCurrent.rateCode, "STANDARD"),
              eq(rateCurrent.stayDate, stayDate),
              eq(rateCurrent.nights, 1),
              eq(rateCurrent.adults, 2),
              eq(rateCurrent.children, 0),
              eq(rateCurrent.available, true)
            )
          );

        for (const prior of previous) {
          if (prior.roomTypeId === null || seenRoomTypeIds.has(prior.roomTypeId)) continue;
          readings.push({
            propertyId: property.id,
            roomTypeId: prior.roomTypeId,
            rateCode: "STANDARD",
            stayDate,
            nights: 1,
            adults: 2,
            children: 0,
            nightlyCents: prior.nightlyCents,
            totalCents: prior.totalCents,
            currency: prior.currency,
            available: false,
            source: "observed",
            isEstimated: false,
            merchant: null,
          });
        }
      } catch (error) {
        ctx.stats.errorCount++;
        ctx.logger.warn(`${property.slug} ${stayDate} STANDARD: ${String(error)}`);
      }

      if (readings.length >= 200) await emit(readings.splice(0));
    }

    if (readings.length > 0) await emit(readings);
    ctx.logger.info(
      `${property.slug}: covered ${dates.length} dates for STANDARD (Kids Resort does not expose APH)`
    );
  },
};
