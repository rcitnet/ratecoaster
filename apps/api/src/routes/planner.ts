import { Hono } from "hono";
import { getDb } from "@ratecoaster/db";
import { TripPlannerQuery } from "@ratecoaster/shared";
import { computeTripCosts } from "../lib/trip-cost.js";
import { gateDateWindow, tierOf } from "../lib/entitlements.js";

export const plannerRouter = new Hono();

/**
 * GET /v1/planner/trip-cost
 *
 * The whole-trip calendar: what a specific family would pay to go, for every
 * possible start date in the window.
 *
 * The date window is clamped by tier before any query runs, exactly as the rate
 * grid is. This route is in fact the strongest argument for the free account —
 * the answer to "when is the cheapest week to go" is almost always outside
 * thirty days, because that is where the seasonal troughs live.
 */
plannerRouter.get("/trip-cost", async (c) => {
  const parsed = TripPlannerQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "invalid_query",
          message: "bad parameters",
          details: parsed.error.flatten(),
        },
      },
      400
    );
  }
  const q = parsed.data;
  const gate = gateDateWindow(tierOf(c), q.from, q.to);

  /*
   * Park days default to nights - 1: arrival day is usually consumed by travel,
   * and quoting a family for a park day they will spend in an airport makes the
   * whole estimate read as unserious to anyone who has done the trip.
   */
  const parkDays = q.parkDays ?? Math.max(1, q.nights - 1);

  const { days, notes } = await computeTripCosts(getDb(), {
    destination: q.destination,
    origin: q.origin,
    adults: q.adults,
    children: q.children,
    nights: q.nights,
    parkDays,
    rateCode: q.rateCode,
    propertySlug: q.propertySlug,
    parkToPark: q.parkToPark,
    from: gate.from,
    to: gate.to,
  });

  const priced = days.filter((d) => d.totalCents !== null);
  const cheapest = priced.reduce<(typeof priced)[number] | null>(
    (best, d) => (best === null || d.totalCents! < best.totalCents! ? d : best),
    null
  );

  /*
   * A median rather than a mean. Holiday weeks are extreme enough to drag an
   * average well above what a family would actually pay in a normal week, which
   * would make every ordinary date look like a bargain.
   */
  const sorted = priced.map((d) => d.totalCents!).sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)]! : null;

  return c.json({
    days: days.slice(0, q.limit),
    summary: {
      pricedDays: priced.length,
      totalDays: days.length,
      cheapestStartDate: cheapest?.startDate ?? null,
      cheapestTotalCents: cheapest?.totalCents ?? null,
      medianTotalCents: median,
      /** Saving available by picking the cheapest date over a typical one. */
      maxSavingCents:
        cheapest && median !== null ? Math.max(0, median - cheapest.totalCents!) : null,
      parkDays,
      partySize: q.adults + q.children,
    },
    notes,
    gate: gate.info,
  });
});
