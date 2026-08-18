import { eq } from "drizzle-orm";
import { properties } from "@ratecoaster/db/schema";
import { persistRateReadings, type RateReading } from "../framework/persist.js";
import type { Collector, CollectorContext } from "../framework/types.js";
import { selectAdapter } from "./adapters/index.js";

/*
 * The scraper primitives moved into ./scrape.ts when the collector gained an
 * adapter layer. They are re-exported here so existing importers — the
 * endpoint-verification job, the admin endpoint tester, and the tests — keep
 * resolving them from "./hotels/index.js" unchanged.
 */
export { queryOffers, parseOffers, checkRateCode, type ParsedOffer } from "./scrape.js";

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

/**
 * The hotel rate collector.
 *
 * It owns scheduling, readiness reporting, and the single persistence path; each
 * property's actual price source is a pluggable adapter. Direct observed rates
 * are the primary path; optional external sources remain isolated behind the
 * same interface so they can be added later without changing persistence.
 */
export function createHotelRateCollector(options: HotelCollectorOptions = {}): Collector {
  const params = {
    lookaheadDays: options.lookaheadDays ?? 365,
    sliceFraction: options.sliceFraction ?? 0.25,
    nights: options.nights ?? 1,
  };

  return {
    name: "hotel-rates",
    description: `Hotel rates, ${params.lookaheadDays}-day lookahead, all room types and occupancies`,
    intervalMinutes: 360,

    async isConfigured(ctx: CollectorContext) {
      const rows = await ctx.db.select().from(properties).where(eq(properties.active, true));
      if (rows.length === 0) {
        return { ready: false, reason: "no properties seeded — run `npm run db:seed`" };
      }

      // Ready if at least one property is collectable by its chosen adapter.
      const reasons: string[] = [];
      for (const property of rows) {
        const readiness = await selectAdapter(property.collectorConfig).isReady(ctx, property);
        if (readiness.ready) return { ready: true };
        if (readiness.reason) reasons.push(`${property.slug}: ${readiness.reason}`);
      }

      return {
        ready: false,
        reason:
          reasons.length > 0
            ? `no property is collectable yet — ${reasons.join("; ")}`
            : "no property has a configured rate source",
      };
    },

    async run(ctx: CollectorContext) {
      const { db, stats } = ctx;
      const rows = await db.select().from(properties).where(eq(properties.active, true));
      const emit = (readings: RateReading[]) => persistRateReadings(db, readings, stats);

      for (const property of rows) {
        const adapter = selectAdapter(property.collectorConfig);
        const readiness = await adapter.isReady(ctx, property);
        if (!readiness.ready) {
          stats.notes[`${property.slug}.skipped`] = readiness.reason ?? "not configured";
          continue;
        }
        await adapter.collect(ctx, property, params, emit);
      }
    },
  };
}

export const hotelRateCollector = createHotelRateCollector();
