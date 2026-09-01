import { and, eq } from "drizzle-orm";
import { properties } from "@ratecoaster/db/schema";
import {
  DESTINATION_AIRPORTS,
  ORIGINS,
  type DestinationSlug,
} from "@ratecoaster/shared";
import type { Collector, CollectorContext } from "../framework/types.js";
import { todayInTimezone } from "../framework/dates.js";
import { persistFlightReadings, type FlightReading } from "./persist.js";
import { fetchCalendarMonth, readCredentials } from "./travelpayouts.js";

/**
 * Trip lengths to precompute.
 *
 * Each length is a separate request, so this list is a direct multiplier on the
 * whole job. It intentionally matches every duration offered by the planner;
 * exposing an option with no corresponding cache would only produce empty totals.
 */
function tripLengths(): number[] {
  const raw = process.env.FLIGHT_TRIP_LENGTHS ?? "3,4,5,6,7";
  const parsed = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 30);
  return parsed.length > 0 ? parsed : [3, 4, 5, 6, 7];
}

/** How many months ahead to fill. 12 gives the full 365-day catalogue. */
function monthsAhead(): number {
  const n = Number(process.env.FLIGHT_MONTHS_AHEAD ?? "12");
  return Number.isInteger(n) && n > 0 && n <= 24 ? n : 12;
}

/** `["2026-08", "2026-09", ...]` starting from the current month. */
function monthKeys(fromIsoDate: string, count: number): string[] {
  const [y, m] = fromIsoDate.split("-").map(Number);
  const out: string[] = [];
  let year = y!;
  let month = m!;
  for (let i = 0; i < count; i++) {
    out.push(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return out;
}

function parseExpiry(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The flight collector.
 *
 * Deliberately the least clever collector in the project, because it is the
 * only one talking to an API that *wants* our traffic. There is no HAR capture,
 * no endpoint config, no shape guessing — a documented endpoint, a token, and
 * a loop. The interesting engineering all lives downstream, in deciding what a
 * cached fare is allowed to claim.
 */
export const flightPriceCollector: Collector = {
  name: "flight-prices",
  description: "Cheapest round-trip fares by departure date, from the top US origin markets",
  // Daily. The upstream data is a cache that refreshes on its own schedule, so
  // hammering it hourly would return the same numbers and earn us a rate limit.
  intervalMinutes: 60 * 24,

  async isConfigured() {
    if (!readCredentials()) {
      return {
        ready: false,
        reason:
          "AVIASALES_API_TOKEN is not set. Add the Aviasales API token to .env.",
      };
    }
    return { ready: true };
  },

  async run(ctx: CollectorContext) {
    const creds = readCredentials();
    if (!creds) throw new Error("AVIASALES_API_TOKEN is not set");

    /*
     * Only price flights to destinations we actually track hotels for.
     *
     * Otherwise the collector would happily spend a third of its budget filling
     * a Frisco calendar for a resort that has not opened, and the planner would
     * offer a trip it cannot cost.
     */
    const rows = await ctx.db
      .select({ destination: properties.destination })
      .from(properties)
      .where(
        and(
          eq(properties.active, true),
          // The public flight-enabled planner currently prices Orlando only.
          // Do not spend half the daily API budget filling destinations that
          // have no corresponding planner experience yet.
          eq(properties.destination, "universal-orlando")
        )
      );

    const destinations = [...new Set(rows.map((r) => r.destination))] as DestinationSlug[];
    if (destinations.length === 0) {
      ctx.logger.warn("no active properties — nothing to price flights to");
      return;
    }

    const lengths = tripLengths();
    const months = monthKeys(todayInTimezone("America/New_York"), monthsAhead());

    ctx.stats.notes.origins = ORIGINS.length;
    ctx.stats.notes.destinations = destinations;
    ctx.stats.notes.tripLengths = lengths;
    ctx.stats.notes.months = months.length;

    for (const destination of destinations) {
      const airport = DESTINATION_AIRPORTS[destination];

      for (const origin of ORIGINS) {
        // Los Angeles is both a major origin market and the Hollywood gateway.
        // Quoting LAX-LAX would burn a request to learn nothing.
        if (origin.code === airport) continue;

        for (const length of lengths) {
          for (const month of months) {
            ctx.stats.requestCount++;
            try {
              const entries = await fetchCalendarMonth(
                { origin: origin.code, destination: airport, month, tripLengthDays: length },
                creds
              );

              if (entries.length === 0) continue;

              const readings: FlightReading[] = entries.map((e) => ({
                origin: origin.code,
                destination: airport,
                departDate: e.departDate,
                tripLengthDays: length,
                priceCents: e.priceCents,
                currency: "USD",
                airline: e.airline,
                transfers: e.transfers,
                expiresAt: parseExpiry(e.expiresAt),
                source: "travelpayouts" as const,
              }));

              await persistFlightReadings(ctx.db, readings, ctx.stats);
            } catch (err) {
              /*
               * One bad month must not abandon the other 359 requests. A route
               * with no cached data at all is normal — small origin, distant
               * month — and is not worth a failed run.
               */
              ctx.stats.errorCount++;
              ctx.logger.warn(
                `${origin.code}->${airport} ${month} (${length}n) failed: ${String(err)}`
              );
            }
          }
        }
      }
    }
  },
};
