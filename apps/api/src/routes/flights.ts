import { Hono } from "hono";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { flightQuoteCurrent } from "@ratecoaster/db/schema";
import { DESTINATION_AIRPORTS, FlightQuery, ORIGINS } from "@ratecoaster/shared";
import { buildBookingUrl, readCredentials } from "../collectors/flights/travelpayouts.js";
import { addDays } from "../collectors/framework/dates.js";
import { gateDateWindow, tierOf } from "../lib/entitlements.js";

export const flightsRouter = new Hono();

/**
 * GET /v1/flights/origins
 *
 * The precomputed origin list. Public and ungated — it is a menu, not data, and
 * a family needs to see whether their city is covered before deciding whether
 * signing up is worth it.
 */
flightsRouter.get("/origins", (c) =>
  c.json({
    origins: ORIGINS,
    destinationAirports: DESTINATION_AIRPORTS,
  })
);

/**
 * GET /v1/flights
 *
 * Cheapest cached round-trip fare per departure date for one origin.
 *
 * Gated on the same window as everything else, via the same helper, so there is
 * exactly one implementation of "how far ahead may this tier look" in the
 * codebase. A second one would drift.
 */
flightsRouter.get("/", async (c) => {
  const db = getDb();
  const parsed = FlightQuery.safeParse(c.req.query());
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
  const airport = DESTINATION_AIRPORTS[q.destination];
  const creds = readCredentials();

  const rows = await db
    .select()
    .from(flightQuoteCurrent)
    .where(
      and(
        eq(flightQuoteCurrent.origin, q.origin),
        eq(flightQuoteCurrent.destination, airport),
        eq(flightQuoteCurrent.tripLengthDays, q.tripLengthDays),
        gte(flightQuoteCurrent.departDate, gate.from),
        lte(flightQuoteCurrent.departDate, gate.to)
      )
    )
    .orderBy(asc(flightQuoteCurrent.departDate))
    .limit(q.limit);

  const now = Date.now();

  return c.json({
    items: rows.map((r) => ({
      origin: r.origin,
      destination: r.destination,
      departDate: r.departDate,
      tripLengthDays: r.tripLengthDays,
      priceCents: r.priceCents,
      currency: r.currency,
      airline: r.airline,
      transfers: r.transfers,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      observedAt: r.observedAt.toISOString(),
      source: r.source,
      historicalLowCents: r.historicalLowCents,
      /*
       * Say out loud when a cached fare has passed its own expiry rather than
       * dropping it. A family scrolling to next August would otherwise see an
       * empty calendar and conclude we have no data, when what we have is old
       * data — a different thing, and one they can judge for themselves.
       */
      stale: r.expiresAt ? r.expiresAt.getTime() < now : false,
      bookingUrl: buildBookingUrl({
        origin: r.origin,
        destination: r.destination,
        departDate: r.departDate,
        returnDate: addDays(r.departDate, r.tripLengthDays),
        passengers: q.passengers,
        marker: creds?.marker ?? null,
      }),
    })),
    gate: gate.info,
    attribution: [
      {
        source: "Aviasales",
        text: "Fares via Aviasales. Cached prices, not live availability.",
        url: "https://www.aviasales.com",
      },
    ],
  });
});
