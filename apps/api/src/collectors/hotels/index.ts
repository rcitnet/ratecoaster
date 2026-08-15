import { and, eq } from "drizzle-orm";
import { parseMoneyToCents } from "@ratecoaster/shared";
import { properties, roomTypes } from "@ratecoaster/db/schema";
import { fetchJson } from "../framework/http.js";
import { addDays, dateRange, prioritizeDates, todayInTimezone } from "../framework/dates.js";
import { persistRateReadings, type RateReading } from "../framework/persist.js";
import type { Collector, CollectorContext } from "../framework/types.js";
import {
  extractOne,
  extractPath,
  renderTemplate,
  type EndpointConfig,
} from "./endpoint-config.js";
import { resolveEndpointConfig } from "../../lib/settings.js";

type RateCode = RateReading["rateCode"];

/** Occupancies to probe. Each is a separate request; room types come free. */
const OCCUPANCIES: Array<{ adults: number; children: number }> = [
  { adults: 2, children: 0 },
  { adults: 1, children: 0 },
  { adults: 4, children: 0 },
  { adults: 2, children: 2 },
];

/** Rate codes to probe per destination. */
const RATE_CODES: Record<string, RateCode[]> = {
  "universal-orlando": ["STANDARD", "APH", "FLR"],
  "universal-hollywood": ["STANDARD", "CAR"],
  "universal-kids-frisco": ["STANDARD", "TXR"],
};

const TIMEZONES: Record<string, string> = {
  "universal-orlando": "America/New_York",
  "universal-hollywood": "America/Los_Angeles",
  "universal-kids-frisco": "America/Chicago",
};

export interface HotelCollectorOptions {
  /** Lookahead window. 365 gives the full year the product promises. */
  lookaheadDays?: number;
  /**
   * Fraction of the window to cover in a single run. A 365-day pass is split
   * across runs so each one is short and the crawl stays spread out; near dates
   * are always covered because `prioritizeDates` sorts them first.
   */
  sliceFraction?: number;
  nights?: number;
}

export function createHotelRateCollector(options: HotelCollectorOptions = {}): Collector {
  const lookaheadDays = options.lookaheadDays ?? 365;
  const sliceFraction = options.sliceFraction ?? 0.25;
  const nights = options.nights ?? 1;

  return {
    name: "hotel-rates",
    description: `Hotel rates, ${lookaheadDays}-day lookahead, all room types and occupancies`,
    intervalMinutes: 360,

    async isConfigured({ db }) {
      const rows = await db.select().from(properties).where(eq(properties.active, true));
      if (rows.length === 0) {
        return { ready: false, reason: "no properties seeded — run `npm run db:seed`" };
      }

      const ready: string[] = [];
      for (const p of rows) {
        const cfg = (p.collectorConfig ?? {}) as Record<string, unknown>;
        const adapter = typeof cfg.adapter === "string" ? cfg.adapter : null;
        const hotelCode = cfg.hotelCode ?? cfg.ctyhocn ?? cfg.marshaCode ?? cfg.hotelId;
        if (!adapter || !hotelCode) continue;
        if (await resolveEndpointConfig(adapter)) ready.push(p.slug);
      }

      if (ready.length === 0) {
        return {
          ready: false,
          reason:
            "no property has both a hotel code and an endpoint config — see apps/api/src/collectors/hotels/README.md to capture one",
        };
      }
      return { ready: true };
    },

    async run(ctx: CollectorContext) {
      const { db, stats, logger } = ctx;
      const rows = await db.select().from(properties).where(eq(properties.active, true));

      for (const property of rows) {
        const cfg = (property.collectorConfig ?? {}) as Record<string, unknown>;
        const adapterName = typeof cfg.adapter === "string" ? cfg.adapter : null;
        const hotelCode = String(
          cfg.hotelCode ?? cfg.ctyhocn ?? cfg.marshaCode ?? cfg.hotelId ?? ""
        );

        if (!adapterName || !hotelCode) {
          stats.notes[`${property.slug}.skipped`] = "missing adapter or hotel code";
          continue;
        }

        const endpoint = await resolveEndpointConfig(adapterName);
        if (!endpoint) {
          stats.notes[`${property.slug}.skipped`] = `no endpoint config for ${adapterName}`;
          continue;
        }

        const timezone = TIMEZONES[property.destination] ?? "America/New_York";
        const today = todayInTimezone(timezone);
        const allDates = prioritizeDates(dateRange(today, lookaheadDays));
        const sliceSize = Math.max(1, Math.ceil(allDates.length * sliceFraction));
        const dates = allDates.slice(0, sliceSize);

        const codes = RATE_CODES[property.destination] ?? ["STANDARD"];
        const readings: RateReading[] = [];

        for (const stayDate of dates) {
          for (const occupancy of OCCUPANCIES) {
            for (const rateCode of codes) {
              try {
                stats.requestCount++;
                const parsed = await queryOffers(endpoint, {
                  hotelCode,
                  checkIn: stayDate,
                  checkOut: addDays(stayDate, nights),
                  nights,
                  adults: occupancy.adults,
                  children: occupancy.children,
                  // STANDARD means "send no promo code at all", which the
                  // template renderer expresses by dropping the empty param.
                  rateCode: rateCode === "STANDARD" ? "" : rateCode,
                  currency: "USD",
                });

                if (parsed === null) continue; // dry run

                if (!parsed.rateCodeApplied) {
                  /*
                   * The engine ignored our promo code and quoted the public
                   * rate. Recording that as an APH price would show users a
                   * passholder discount that does not exist. Drop it.
                   */
                  stats.notes[`${property.slug}.rateCodeRejected`] =
                    ((stats.notes[`${property.slug}.rateCodeRejected`] as number) ?? 0) + 1;
                  continue;
                }

                for (const offer of parsed.offers) {
                  const roomTypeId = await upsertRoomType(
                    ctx,
                    property.id,
                    offer.roomCode,
                    offer.roomName,
                    offer.maxOccupancy
                  );
                  readings.push({
                    propertyId: property.id,
                    roomTypeId,
                    rateCode,
                    stayDate,
                    nights,
                    adults: occupancy.adults,
                    children: occupancy.children,
                    nightlyCents: offer.nightlyCents,
                    totalCents: offer.totalCents,
                    currency: "USD",
                    available: offer.available,
                  });
                }
              } catch (err) {
                stats.errorCount++;
                logger.warn(`${property.slug} ${stayDate} ${rateCode}: ${String(err)}`);
              }
            }
          }

          // Flush per date so a long crawl is durable against interruption.
          if (readings.length >= 200) {
            await persistRateReadings(db, readings.splice(0), stats);
          }
        }

        if (readings.length) await persistRateReadings(db, readings, stats);
        logger.info(`${property.slug}: covered ${dates.length} dates`);
      }
    },
  };
}

interface ParsedOffer {
  roomCode: string;
  roomName: string;
  nightlyCents: number;
  totalCents: number | null;
  available: boolean;
  maxOccupancy: number | null;
}

/**
 * Issues one booking-engine query and maps the response through the endpoint
 * config. All operator-specific knowledge lives in the JSON; this function is
 * generic across Loews, Hilton, Marriott, and anything else you capture.
 */
export async function queryOffers(
  endpoint: EndpointConfig,
  vars: Record<string, string | number>
): Promise<{ offers: ParsedOffer[]; rateCodeApplied: boolean } | null> {
  const url = renderTemplate(endpoint.request.urlTemplate, vars);
  const body = endpoint.request.bodyTemplate
    ? renderTemplate(endpoint.request.bodyTemplate, vars)
    : undefined;

  const json = await fetchJson(url, {
    method: endpoint.request.method,
    headers: endpoint.request.headers,
    body,
    rpm: endpoint.request.rpm,
  });
  if (json === null) return null;

  return { offers: parseOffers(endpoint, json), rateCodeApplied: checkRateCode(endpoint, json) };
}

export function checkRateCode(endpoint: EndpointConfig, json: unknown): boolean {
  const { rateCodeAppliedPath, rateCodeAppliedEquals } = endpoint.response;
  // No verification configured: trust the engine. Documented as a known gap
  // rather than silently assumed correct.
  if (!rateCodeAppliedPath) return true;
  const actual = extractOne(json, rateCodeAppliedPath);
  if (rateCodeAppliedEquals === undefined) return actual !== null && actual !== false;
  return String(actual) === String(rateCodeAppliedEquals);
}

export function parseOffers(endpoint: EndpointConfig, json: unknown): ParsedOffer[] {
  const { roomsPath, fields, pricesAreCents } = endpoint.response;
  const rooms = extractPath(json, roomsPath);
  const offers: ParsedOffer[] = [];

  for (const room of rooms) {
    const rawNightly = extractOne(room, fields.nightly);
    const nightlyCents = pricesAreCents
      ? typeof rawNightly === "number"
        ? Math.round(rawNightly)
        : null
      : parseMoneyToCents(rawNightly as string | number | null);

    // A room with no parseable price is not a zero-dollar room; it is a parse
    // failure or a sold-out entry. Either way it must not enter the dataset.
    if (nightlyCents === null || nightlyCents <= 0) continue;

    const rawTotal = extractOne(room, fields.total);
    const totalCents = pricesAreCents
      ? typeof rawTotal === "number"
        ? Math.round(rawTotal)
        : null
      : parseMoneyToCents(rawTotal as string | number | null);

    const availableRaw = extractOne(room, fields.available);
    const maxOcc = extractOne(room, fields.maxOccupancy);

    offers.push({
      roomCode: String(extractOne(room, fields.roomCode) ?? "unknown"),
      roomName: String(extractOne(room, fields.roomName) ?? "Room"),
      nightlyCents,
      totalCents,
      available: availableRaw === null ? true : Boolean(availableRaw),
      maxOccupancy: typeof maxOcc === "number" ? maxOcc : null,
    });
  }

  return offers;
}

const roomTypeCache = new Map<string, string>();

async function upsertRoomType(
  ctx: CollectorContext,
  propertyId: string,
  externalCode: string,
  name: string,
  maxOccupancy: number | null
): Promise<string> {
  const key = `${propertyId}:${externalCode}`;
  const cached = roomTypeCache.get(key);
  if (cached) return cached;

  const existing = await ctx.db
    .select({ id: roomTypes.id })
    .from(roomTypes)
    .where(and(eq(roomTypes.propertyId, propertyId), eq(roomTypes.externalCode, externalCode)))
    .limit(1);

  if (existing[0]) {
    roomTypeCache.set(key, existing[0].id);
    return existing[0].id;
  }

  const [created] = await ctx.db
    .insert(roomTypes)
    .values({ propertyId, externalCode, name, maxOccupancy })
    .onConflictDoUpdate({
      target: [roomTypes.propertyId, roomTypes.externalCode],
      set: { name },
    })
    .returning({ id: roomTypes.id });

  const id = created!.id;
  roomTypeCache.set(key, id);
  return id;
}

export const hotelRateCollector = createHotelRateCollector();
