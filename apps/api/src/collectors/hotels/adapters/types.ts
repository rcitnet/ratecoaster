import type { RateSource } from "@ratecoaster/shared";
import type { properties } from "@ratecoaster/db/schema";
import type { CollectorContext } from "../../framework/types.js";
import type { RateReading } from "../../framework/persist.js";

/** A property row as selected from the DB. */
export type PropertyRow = typeof properties.$inferSelect;

/** Crawl shape passed down from the collector to each adapter. */
export interface RateAdapterParams {
  lookaheadDays: number;
  sliceFraction: number;
  nights: number;
}

/** Persists a batch of readings. The collector owns the single write path. */
export type ReadingSink = (readings: RateReading[]) => Promise<void>;

/**
 * A rate source behind the hotel collector.
 *
 * The collector interface (name, interval, isConfigured, run) is unchanged; the
 * adapter is the seam under it. Direct observation is the primary source, while
 * a future licensed or affiliate source can be added without touching the
 * runner, persistence, or read paths.
 *
 * `collect` streams via `emit` rather than returning an array so a long crawl
 * stays durable against interruption (the scraper flushes per ~200 readings);
 * feed adapters that fetch a whole calendar at once simply emit once.
 */
export interface RateAdapter {
  /** Stamped onto every reading this adapter produces. */
  readonly source: RateSource;
  readonly name: string;
  /** Whether this property can be collected by this adapter right now. */
  isReady(
    ctx: CollectorContext,
    property: PropertyRow
  ): Promise<{ ready: boolean; reason?: string }>;
  /** Fetch this property's readings and hand them to `emit` in batches. */
  collect(
    ctx: CollectorContext,
    property: PropertyRow,
    params: RateAdapterParams,
    emit: ReadingSink
  ): Promise<void>;
}
