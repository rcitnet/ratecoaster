import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { Db } from "@ratecoaster/db";
import { flightQuoteCurrent, flightQuoteObservations } from "@ratecoaster/db/schema";
import type { RunStats } from "../framework/types.js";

export interface FlightReading {
  origin: string;
  destination: string;
  departDate: string;
  tripLengthDays: number;
  priceCents: number;
  currency: string;
  airline: string | null;
  transfers: number | null;
  expiresAt: Date | null;
  source: "travelpayouts" | "manual";
}

/**
 * Write-on-change persistence for flight quotes.
 *
 * Same rule as hotel rates, and it earns its keep even harder here: a nightly
 * refresh of 30 origins x 365 dates x 3 trip lengths is ~33,000 quotes a day,
 * and airfares for a Tuesday in September do not move most days. Writing
 * unconditionally would be a million near-identical rows a month.
 *
 * The one addition is `expiresAt`, which is always refreshed even when the
 * price has not moved — the fare is the same, but the window in which it means
 * anything has shifted forward, and that is what the UI reads to decide whether
 * to show the number at all.
 */
export async function persistFlightReadings(
  db: Db,
  readings: FlightReading[],
  stats: RunStats
): Promise<void> {
  for (const r of readings) {
    stats.parsedCount++;

    const [prev] = await db
      .select({
        priceCents: flightQuoteCurrent.priceCents,
        historicalLowCents: flightQuoteCurrent.historicalLowCents,
      })
      .from(flightQuoteCurrent)
      .where(
        and(
          eq(flightQuoteCurrent.origin, r.origin),
          eq(flightQuoteCurrent.destination, r.destination),
          eq(flightQuoteCurrent.departDate, r.departDate),
          eq(flightQuoteCurrent.tripLengthDays, r.tripLengthDays)
        )
      )
      .limit(1);

    const changed = !prev || prev.priceCents !== r.priceCents;
    const newLow =
      prev?.historicalLowCents == null
        ? r.priceCents
        : Math.min(prev.historicalLowCents, r.priceCents);

    if (changed) {
      await db.insert(flightQuoteObservations).values({
        origin: r.origin,
        destination: r.destination,
        departDate: r.departDate,
        tripLengthDays: r.tripLengthDays,
        priceCents: r.priceCents,
        currency: r.currency,
        airline: r.airline,
        transfers: r.transfers,
        source: r.source,
      });
      stats.writtenCount++;
    }

    await db
      .insert(flightQuoteCurrent)
      .values({
        origin: r.origin,
        destination: r.destination,
        departDate: r.departDate,
        tripLengthDays: r.tripLengthDays,
        priceCents: r.priceCents,
        currency: r.currency,
        airline: r.airline,
        transfers: r.transfers,
        expiresAt: r.expiresAt,
        historicalLowCents: newLow,
        previousCents: prev?.priceCents ?? null,
        source: r.source,
        observedAt: new Date(),
        changedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          flightQuoteCurrent.origin,
          flightQuoteCurrent.destination,
          flightQuoteCurrent.departDate,
          flightQuoteCurrent.tripLengthDays,
        ],
        set: {
          priceCents: r.priceCents,
          currency: r.currency,
          airline: r.airline,
          transfers: r.transfers,
          expiresAt: r.expiresAt,
          historicalLowCents: newLow,
          previousCents: changed
            ? (prev?.priceCents ?? null)
            : sql`${flightQuoteCurrent.previousCents}`,
          source: r.source,
          observedAt: new Date(),
          changedAt: changed ? new Date() : sql`${flightQuoteCurrent.changedAt}`,
        },
      });
  }
}
