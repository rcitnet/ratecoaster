import { and, eq } from "drizzle-orm";
import { properties } from "@ratecoaster/db/schema";
import { persistRateReadings, type RateReading } from "../framework/persist.js";
import type { Collector, CollectorContext } from "../framework/types.js";
import { selectAdapter } from "./adapters/index.js";
import { selectRotatingBatch } from "./schedule.js";

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
  /** Restrict a manual/canary run to one exact property slug. */
  propertySlug?: string;
  /** Number of collectable properties included in each scheduled run. */
  propertiesPerRun?: number;
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
  const propertiesPerRun = Math.max(1, Math.floor(options.propertiesPerRun ?? 3));
  const propertyFilter = options.propertySlug
    ? and(eq(properties.active, true), eq(properties.slug, options.propertySlug))
    : eq(properties.active, true);

  return {
    name: "hotel-rates",
    description: `Hotel rates, ${params.lookaheadDays}-day lookahead, all room types and occupancies${options.propertySlug ? `, property ${options.propertySlug}` : `, ${propertiesPerRun} rotating properties/run`}`,
    intervalMinutes: 360,

    async isConfigured(ctx: CollectorContext) {
      const rows = await ctx.db.select().from(properties).where(propertyFilter);
      if (rows.length === 0) {
        return options.propertySlug
          ? { ready: false, reason: `no active property matches ${options.propertySlug}` }
          : { ready: false, reason: "no properties seeded — run `npm run db:seed`" };
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
      const rows = await db.select().from(properties).where(propertyFilter);
      const emit = (readings: RateReading[]) => persistRateReadings(db, readings, stats);
      const collectable: Array<{
        property: (typeof rows)[number];
        adapter: ReturnType<typeof selectAdapter>;
      }> = [];

      for (const property of rows) {
        const adapter = selectAdapter(property.collectorConfig);
        const readiness = await adapter.isReady(ctx, property);
        if (!readiness.ready) {
          stats.notes[`${property.slug}.skipped`] = readiness.reason ?? "not configured";
          continue;
        }
        collectable.push({ property, adapter });
      }

      collectable.sort((a, b) => a.property.slug.localeCompare(b.property.slug));
      const selected = options.propertySlug
        ? collectable
        : selectRotatingBatch(collectable, propertiesPerRun);

      stats.notes.collectablePropertyCount = collectable.length;
      stats.notes.selectedProperties = selected.map(({ property }) => property.slug);
      ctx.logger.info(
        `selected ${selected.length} of ${collectable.length} collectable properties: ${selected.map(({ property }) => property.slug).join(", ")}`
      );

      for (const { property, adapter } of selected) {
        await adapter.collect(ctx, property, params, emit);
      }
    },
  };
}

export const hotelRateCollector = createHotelRateCollector();
