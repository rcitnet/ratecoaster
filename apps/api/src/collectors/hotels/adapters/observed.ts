import { and, eq } from "drizzle-orm";
import { roomTypes } from "@ratecoaster/db/schema";
import { addDays, dateRange, prioritizeDates, todayInTimezone } from "../../framework/dates.js";
import type { CollectorContext } from "../../framework/types.js";
import type { RateReading } from "../../framework/persist.js";
import { resolveEndpointConfig } from "../../../lib/settings.js";
import { queryOffers } from "../scrape.js";
import type { PropertyRow, RateAdapter } from "./types.js";

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

function hotelCodeOf(cfg: Record<string, unknown>): string {
  return String(cfg.hotelCode ?? cfg.ctyhocn ?? cfg.marshaCode ?? cfg.hotelId ?? "");
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

/**
 * The original booking-engine scraper, as an adapter. Reads live prices through
 * a captured endpoint config and stamps them `observed` / not-estimated. This is
 * the default source, so absent any `source` in a property's collectorConfig the
 * collector behaves exactly as it did before the adapter layer existed.
 */
export const observedAdapter: RateAdapter = {
  source: "observed",
  name: "observed",

  async isReady(_ctx: CollectorContext, property: PropertyRow) {
    const cfg = (property.collectorConfig ?? {}) as Record<string, unknown>;
    const adapter = typeof cfg.adapter === "string" ? cfg.adapter : null;
    if (!adapter || !hotelCodeOf(cfg)) {
      return { ready: false, reason: "missing adapter or hotel code" };
    }
    if (!(await resolveEndpointConfig(adapter))) {
      return { ready: false, reason: `no endpoint config for ${adapter}` };
    }
    return { ready: true };
  },

  async collect(ctx, property, params, emit) {
    const { stats, logger } = ctx;
    const cfg = (property.collectorConfig ?? {}) as Record<string, unknown>;
    const adapterName = typeof cfg.adapter === "string" ? cfg.adapter : null;
    const hotelCode = hotelCodeOf(cfg);
    if (!adapterName || !hotelCode) {
      stats.notes[`${property.slug}.skipped`] = "missing adapter or hotel code";
      return;
    }

    const endpoint = await resolveEndpointConfig(adapterName);
    if (!endpoint) {
      stats.notes[`${property.slug}.skipped`] = `no endpoint config for ${adapterName}`;
      return;
    }

    const timezone = TIMEZONES[property.destination] ?? "America/New_York";
    const today = todayInTimezone(timezone);
    const allDates = prioritizeDates(dateRange(today, params.lookaheadDays));
    const sliceSize = Math.max(1, Math.ceil(allDates.length * params.sliceFraction));
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
              checkOut: addDays(stayDate, params.nights),
              nights: params.nights,
              adults: occupancy.adults,
              children: occupancy.children,
              // STANDARD means "send no promo code at all", which the template
              // renderer expresses by dropping the empty param.
              rateCode: rateCode === "STANDARD" ? "" : rateCode,
              currency: "USD",
            });

            if (parsed === null) continue; // dry run

            if (!parsed.rateCodeApplied) {
              /*
               * The engine ignored our promo code and quoted the public rate.
               * Recording that as an APH price would show users a passholder
               * discount that does not exist. Drop it.
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
                nights: params.nights,
                adults: occupancy.adults,
                children: occupancy.children,
                nightlyCents: offer.nightlyCents,
                totalCents: offer.totalCents,
                currency: "USD",
                available: offer.available,
                source: "observed",
                isEstimated: false,
                merchant: null,
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
        await emit(readings.splice(0));
      }
    }

    if (readings.length) await emit(readings);
    logger.info(`${property.slug}: covered ${dates.length} dates`);
  },
};
