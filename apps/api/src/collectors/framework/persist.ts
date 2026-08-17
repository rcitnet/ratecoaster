import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@ratecoaster/db";
import { rateCurrent, rateObservations } from "@ratecoaster/db/schema";
import type { RateSource } from "@ratecoaster/shared";
import type { RunStats } from "./types.js";

export interface RateReading {
  propertyId: string;
  roomTypeId: string | null;
  rateCode:
    | "STANDARD"
    | "APH"
    | "FLR"
    | "CAR"
    | "TXR"
    | "AAA"
    | "AARP"
    | "GOV"
    | "MIL";
  stayDate: string;
  nights: number;
  adults: number;
  children: number;
  nightlyCents: number;
  totalCents: number | null;
  currency: string;
  available: boolean;
  /** Provenance of this reading. Adapters stamp it; defaults are not assumed. */
  source: RateSource;
  /** True when the price is reconstructed (e.g. a derived APH rate). */
  isEstimated: boolean;
  /** Feed/OTA the price came from; null for observed (scraped) readings. */
  merchant?: string | null;
}

/**
 * Write-on-change persistence.
 *
 * This is the core storage rule for the whole project. `rate_current` always
 * reflects the latest sighting, but `rate_observations` only gains a row when
 * the price or availability actually moved.
 *
 * The arithmetic is the argument: 11 hotels x 365 dates x 4 occupancies x 6
 * room types x 2 rate codes is ~193k combinations. Crawled every 6 hours and
 * written unconditionally, that is ~23 million rows a month, almost all of them
 * byte-identical to the row before. Written on change, it is a few thousand
 * rows that each mean something — and the price-history chart becomes a
 * straight `SELECT ... ORDER BY observed_at` with no deduplication step.
 */
export async function persistRateReadings(
  db: Db,
  readings: RateReading[],
  stats: RunStats
): Promise<void> {
  for (const r of readings) {
    stats.parsedCount++;

    const existing = await db
      .select({
        nightlyCents: rateCurrent.nightlyCents,
        available: rateCurrent.available,
        source: rateCurrent.source,
        historicalLowCents: rateCurrent.historicalLowCents,
      })
      .from(rateCurrent)
      .where(
        and(
          eq(rateCurrent.propertyId, r.propertyId),
          r.roomTypeId === null
            ? sql`${rateCurrent.roomTypeId} is null`
            : eq(rateCurrent.roomTypeId, r.roomTypeId),
          eq(rateCurrent.rateCode, r.rateCode),
          eq(rateCurrent.stayDate, r.stayDate),
          eq(rateCurrent.nights, r.nights),
          eq(rateCurrent.adults, r.adults),
          eq(rateCurrent.children, r.children)
        )
      )
      .limit(1);

    const prev = existing[0];
    // A provenance change (e.g. a date switching from scraped to affiliate at
    // the same price) is a real event worth a history row, not something the
    // write-on-change rule should swallow.
    const changed =
      !prev ||
      prev.nightlyCents !== r.nightlyCents ||
      prev.available !== r.available ||
      prev.source !== r.source;

    const newLow =
      prev?.historicalLowCents == null
        ? r.nightlyCents
        : Math.min(prev.historicalLowCents, r.nightlyCents);

    if (changed) {
      await db.insert(rateObservations).values({
        propertyId: r.propertyId,
        roomTypeId: r.roomTypeId,
        rateCode: r.rateCode,
        stayDate: r.stayDate,
        nights: r.nights,
        adults: r.adults,
        children: r.children,
        nightlyCents: r.nightlyCents,
        totalCents: r.totalCents,
        currency: r.currency,
        available: r.available,
        source: r.source,
        isEstimated: r.isEstimated,
        merchant: r.merchant ?? null,
      });
      stats.writtenCount++;
    }

    await db
      .insert(rateCurrent)
      .values({
        propertyId: r.propertyId,
        roomTypeId: r.roomTypeId,
        rateCode: r.rateCode,
        stayDate: r.stayDate,
        nights: r.nights,
        adults: r.adults,
        children: r.children,
        nightlyCents: r.nightlyCents,
        totalCents: r.totalCents,
        currency: r.currency,
        available: r.available,
        source: r.source,
        isEstimated: r.isEstimated,
        merchant: r.merchant ?? null,
        historicalLowCents: newLow,
        previousCents: prev?.nightlyCents ?? null,
        observedAt: new Date(),
        changedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          rateCurrent.propertyId,
          rateCurrent.roomTypeId,
          rateCurrent.rateCode,
          rateCurrent.stayDate,
          rateCurrent.nights,
          rateCurrent.adults,
          rateCurrent.children,
        ],
        set: {
          nightlyCents: r.nightlyCents,
          totalCents: r.totalCents,
          available: r.available,
          source: r.source,
          isEstimated: r.isEstimated,
          merchant: r.merchant ?? null,
          historicalLowCents: newLow,
          // Only advance `previousCents` and `changedAt` on a real change, so
          // "changed 3 hours ago" stays meaningful instead of always reading
          // "changed at the last crawl".
          previousCents: changed ? (prev?.nightlyCents ?? null) : sql`${rateCurrent.previousCents}`,
          observedAt: new Date(),
          changedAt: changed ? new Date() : sql`${rateCurrent.changedAt}`,
        },
      });
  }
}
