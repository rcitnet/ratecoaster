import assert from "node:assert/strict";
import { test } from "node:test";
import { TripQuoteQuery } from "@ratecoaster/shared";
import { completeTripTotal } from "./trips.js";

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
