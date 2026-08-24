import { and, eq, inArray, sql } from "drizzle-orm";
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
 * refresh of 30 origins x 365 dates x 5 trip lengths is ~55,000 quotes a day,
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
  if (readings.length === 0) return;
  stats.parsedCount += readings.length;

  const groups = new Map<string, FlightReading[]>();
  for (const reading of readings) {
    const key = `${reading.origin}|${reading.destination}|${reading.tripLengthDays}`;
    const group = groups.get(key) ?? [];
    group.push(reading);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const first = group[0]!;
    const previousRows = await db
      .select({
        departDate: flightQuoteCurrent.departDate,
        priceCents: flightQuoteCurrent.priceCents,
        historicalLowCents: flightQuoteCurrent.historicalLowCents,
      })
      .from(flightQuoteCurrent)
      .where(
        and(
          eq(flightQuoteCurrent.origin, first.origin),
          eq(flightQuoteCurrent.destination, first.destination),
          eq(flightQuoteCurrent.tripLengthDays, first.tripLengthDays),
          inArray(flightQuoteCurrent.departDate, group.map((r) => r.departDate))
        )
      );
    const previous = new Map(previousRows.map((row) => [row.departDate, row]));
    const changed = group.filter((reading) => previous.get(reading.departDate)?.priceCents !== reading.priceCents);
    const observedAt = new Date();

    await db.transaction(async (tx) => {
      if (changed.length > 0) {
        await tx.insert(flightQuoteObservations).values(
          changed.map((r) => ({
            origin: r.origin,
            destination: r.destination,
            departDate: r.departDate,
            tripLengthDays: r.tripLengthDays,
            priceCents: r.priceCents,
            currency: r.currency,
            airline: r.airline,
            transfers: r.transfers,
            source: r.source,
          }))
        );
      }

      await tx
        .insert(flightQuoteCurrent)
        .values(
          group.map((r) => {
            const prev = previous.get(r.departDate);
            return {
              origin: r.origin,
              destination: r.destination,
              departDate: r.departDate,
              tripLengthDays: r.tripLengthDays,
              priceCents: r.priceCents,
              currency: r.currency,
              airline: r.airline,
              transfers: r.transfers,
              expiresAt: r.expiresAt,
              historicalLowCents:
                prev?.historicalLowCents == null
                  ? r.priceCents
                  : Math.min(prev.historicalLowCents, r.priceCents),
              previousCents: prev?.priceCents ?? null,
              source: r.source,
              observedAt,
              changedAt: observedAt,
            };
          })
        )
        .onConflictDoUpdate({
          target: [
            flightQuoteCurrent.origin,
            flightQuoteCurrent.destination,
            flightQuoteCurrent.departDate,
            flightQuoteCurrent.tripLengthDays,
          ],
          set: {
            priceCents: sql`excluded.price_cents`,
            currency: sql`excluded.currency`,
            airline: sql`excluded.airline`,
            transfers: sql`excluded.transfers`,
            expiresAt: sql`excluded.expires_at`,
            historicalLowCents: sql`least(coalesce(${flightQuoteCurrent.historicalLowCents}, excluded.price_cents), excluded.price_cents)`,
            previousCents: sql`case when ${flightQuoteCurrent.priceCents} <> excluded.price_cents then ${flightQuoteCurrent.priceCents} else ${flightQuoteCurrent.previousCents} end`,
            source: sql`excluded.source`,
            observedAt: sql`excluded.observed_at`,
            changedAt: sql`case when ${flightQuoteCurrent.priceCents} <> excluded.price_cents then excluded.changed_at else ${flightQuoteCurrent.changedAt} end`,
          },
        });
    });
    stats.writtenCount += changed.length;
  }
}
