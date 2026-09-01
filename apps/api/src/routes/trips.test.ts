import assert from "node:assert/strict";
import { test } from "node:test";
import { TripQuoteQuery } from "@ratecoaster/shared";
import {
  completeTripTotal,
  selectPlannerFare,
  type PlannerFareCandidate,
} from "./trips.js";

const OBSERVED = new Date("2026-09-01T12:00:00Z");

function fare(
  departDate: string,
  tripLengthDays: number,
  priceCents: number
): PlannerFareCandidate {
  return {
    origin: "PDX",
    destination: "MCO",
    departDate,
    tripLengthDays,
    priceCents,
    currency: "USD",
    airline: "AA",
    transfers: 1,
    expiresAt: new Date("2026-09-01T13:00:00Z"),
    observedAt: OBSERVED,
  };
}

test("includes airfare when a flight was requested", () => {
  assert.equal(
    completeTripTotal({
      hotelCents: 80_000,
      ticketCents: 50_000,
      flightRequested: true,
      flightCents: 60_000,
    }),
    190_000
  );
});

test("does not present a partial total when requested airfare is missing", () => {
  assert.equal(
    completeTripTotal({
      hotelCents: 80_000,
      ticketCents: 50_000,
      flightRequested: true,
      flightCents: null,
    }),
    null
  );
});

test("keeps the driving total independent of airfare", () => {
  assert.equal(
    completeTripTotal({
      hotelCents: 80_000,
      ticketCents: 50_000,
      flightRequested: false,
      flightCents: null,
    }),
    130_000
  );
});

test("accepts a supported IATA origin and rejects arbitrary input", () => {
  const base = { checkIn: "2026-11-03", checkOut: "2026-11-08" };
  assert.equal(TripQuoteQuery.parse({ ...base, origin: "NYC" }).origin, "NYC");
  assert.equal(TripQuoteQuery.safeParse({ ...base, origin: "Chicago" }).success, false);
});

test("prefers an exact-date and exact-length fare", () => {
  const selected = selectPlannerFare(
    [fare("2026-10-01", 5, 20_000), fare("2026-10-03", 5, 15_000)],
    "2026-10-01",
    5
  );
  assert.equal(selected?.basis, "exact-date");
  assert.equal(selected?.row.priceCents, 20_000);
  assert.equal(selected?.dateDifferenceDays, 0);
});

test("uses the closest same-length fare and discloses the date distance", () => {
  const selected = selectPlannerFare(
    [fare("2026-10-08", 5, 18_000), fare("2026-09-29", 5, 22_000)],
    "2026-10-01",
    5
  );
  assert.equal(selected?.basis, "nearby-date");
  assert.equal(selected?.row.departDate, "2026-09-29");
  assert.equal(selected?.dateDifferenceDays, 2);
});

test("falls back to the median recent route fare when dates and lengths do not match", () => {
  const selected = selectPlannerFare(
    [
      fare("2026-09-02", 3, 12_000),
      fare("2026-12-20", 7, 30_000),
      fare("2027-01-05", 4, 20_000),
    ],
    "2026-11-01",
    10
  );
  assert.equal(selected?.basis, "route-baseline");
  assert.equal(selected?.row.priceCents, 20_000);
  assert.equal(selected?.dateDifferenceDays, null);
});

test("returns no airfare estimate when the route has no recent observations", () => {
  assert.equal(selectPlannerFare([], "2026-10-01", 5), null);
});
