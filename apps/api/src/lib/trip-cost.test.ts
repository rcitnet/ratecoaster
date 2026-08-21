import assert from "node:assert/strict";
import { test } from "node:test";
import { combineTripDays, type TripCostInput, type TripCostTables } from "./trip-cost.js";

const OBSERVED = new Date("2026-08-20T12:00:00Z");

function input(overrides: Partial<TripCostInput> = {}): TripCostInput {
  return {
    destination: "universal-orlando",
    origin: "NYC",
    adults: 2,
    children: 2,
    nights: 3,
    parkDays: 2,
    rateCode: "APH",
    parkToPark: false,
    from: "2026-11-01",
    to: "2026-11-03",
    ...overrides,
  };
}

/** Four hotel nights at $200, tickets $500 for the party, fares $150pp. */
function tables(overrides: Partial<TripCostTables> = {}): TripCostTables {
  const nights = new Map<string, number>();
  for (const d of ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]) {
    nights.set(d, 20_000);
  }

  const tickets = new Map<string, number>();
  for (const d of ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]) {
    tickets.set(d, 50_000);
  }

  const flights = new Map<
    string,
    { priceCents: number; airline: string | null; transfers: number | null; observedAt: Date }
  >();
  for (const d of ["2026-11-01", "2026-11-02", "2026-11-03"]) {
    flights.set(d, { priceCents: 15_000, airline: "B6", transfers: 0, observedAt: OBSERVED });
  }

  return {
    ratesByProperty: new Map([["prop-1", nights]]),
    propertyById: new Map([
      ["prop-1", { slug: "cabana-bay", name: "Cabana Bay Beach Resort", includesExpressPass: false }],
    ]),
    oldestRateObservedAt: OBSERVED,
    ticketByDate: tickets,
    oldestTicketObservedAt: OBSERVED,
    flightByDate: flights,
    ...overrides,
  };
}

test("totals all three legs for a complete day", () => {
  const [day] = combineTripDays(input({ to: "2026-11-01" }), tables());

  // 3 nights x $200 = $600 hotel, $500 tickets, 4 passengers x $150 = $600 air.
  assert.equal(day!.components.hotelCents, 60_000);
  assert.equal(day!.components.ticketsCents, 50_000);
  assert.equal(day!.components.flightsCents, 60_000);
  assert.equal(day!.totalCents, 170_000);
  assert.deepEqual(day!.missing, []);
  assert.equal(day!.hotelSlug, "cabana-bay");
  assert.equal(day!.endDate, "2026-11-04");
});

test("per-person-per-day divides by party size and nights", () => {
  const [day] = combineTripDays(input({ to: "2026-11-01" }), tables());
  // $1,700 / 4 people / 3 nights = $141.67
  assert.equal(day!.perPersonPerDayCents, Math.round(170_000 / 4 / 3));
});

test("multiplies the fare by every passenger, children included", () => {
  // US domestic has no child fare. A planner that discounted children would
  // under-quote the largest single line item for a family of five.
  const [day] = combineTripDays(
    input({ to: "2026-11-01", adults: 2, children: 3 }),
    tables()
  );
  assert.equal(day!.components.flightsCents, 15_000 * 5);
});

test("refuses to total a trip when a leg is missing", () => {
  const t = tables({ flightByDate: new Map() });
  const [day] = combineTripDays(input({ to: "2026-11-01" }), t);

  // This is the rule the whole module exists to enforce: $1,100 is not the
  // price of this trip, it is the price of two thirds of it.
  assert.equal(day!.totalCents, null);
  assert.equal(day!.perPersonPerDayCents, null);
  assert.deepEqual(day!.missing, ["flights"]);
  assert.equal(day!.components.hotelCents, 60_000);
});

test("a stay that runs past the collected nights is not priced", () => {
  const partial = new Map<string, number>([
    ["2026-11-01", 20_000],
    ["2026-11-02", 20_000],
    // 2026-11-03 never collected — the third night of a 3-night stay.
  ]);
  const t = tables({ ratesByProperty: new Map([["prop-1", partial]]) });
  const [day] = combineTripDays(input({ to: "2026-11-01" }), t);

  assert.equal(day!.components.hotelCents, null);
  assert.ok(day!.missing.includes("hotel"));
});

test("picks the cheapest hotel that can cover the whole stay", () => {
  const cheapButShort = new Map<string, number>([
    ["2026-11-01", 9_000],
    ["2026-11-02", 9_000],
    // gap on the 3rd — cannot host a 3-night stay
  ]);
  const dearerButComplete = new Map<string, number>([
    ["2026-11-01", 20_000],
    ["2026-11-02", 20_000],
    ["2026-11-03", 20_000],
  ]);

  const t = tables({
    ratesByProperty: new Map([
      ["cheap", cheapButShort],
      ["complete", dearerButComplete],
    ]),
    propertyById: new Map([
      ["cheap", { slug: "cheap", name: "Cheap Inn", includesExpressPass: false }],
      ["complete", { slug: "royal-pacific", name: "Royal Pacific", includesExpressPass: true }],
    ]),
  });

  const [day] = combineTripDays(input({ to: "2026-11-01" }), t);
  assert.equal(day!.hotelSlug, "royal-pacific");
  assert.equal(day!.components.hotelCents, 60_000);
  assert.equal(day!.hotelIncludesExpressPass, true);
});

test("never mixes hotels across nights of one stay", () => {
  // Cheapest-per-night across all properties would total $270 here by moving the
  // family every morning. Summing per property gives the real answer, $600.
  const a = new Map<string, number>([
    ["2026-11-01", 9_000],
    ["2026-11-02", 30_000],
    ["2026-11-03", 30_000],
  ]);
  const b = new Map<string, number>([
    ["2026-11-01", 20_000],
    ["2026-11-02", 20_000],
    ["2026-11-03", 20_000],
  ]);
  const t = tables({
    ratesByProperty: new Map([["a", a], ["b", b]]),
    propertyById: new Map([
      ["a", { slug: "a", name: "A", includesExpressPass: false }],
      ["b", { slug: "b", name: "B", includesExpressPass: false }],
    ]),
  });

  const [day] = combineTripDays(input({ to: "2026-11-01" }), t);
  assert.equal(day!.components.hotelCents, 60_000);
  assert.equal(day!.hotelSlug, "b");
});

test("prices tickets from the day after arrival by default", () => {
  // Only the 2nd has a ticket price, so a trip starting on the 1st must find it.
  const t = tables({ ticketByDate: new Map([["2026-11-02", 44_000]]) });
  const [day] = combineTripDays(input({ to: "2026-11-01" }), t);
  assert.equal(day!.components.ticketsCents, 44_000);
});

test("prices tickets from arrival day when park days equal nights", () => {
  const t = tables({ ticketByDate: new Map([["2026-11-01", 61_000]]) });
  const [day] = combineTripDays(input({ to: "2026-11-01", parkDays: 3, nights: 3 }), t);
  assert.equal(day!.components.ticketsCents, 61_000);
});

test("no origin means driving, which costs zero rather than being missing", () => {
  const [day] = combineTripDays(
    input({ to: "2026-11-01", origin: undefined }),
    tables({ flightByDate: new Map() })
  );
  assert.equal(day!.components.flightsCents, 0);
  assert.deepEqual(day!.missing, []);
  assert.equal(day!.totalCents, 110_000);
});

test("zero park days means no ticket, not a missing ticket", () => {
  const [day] = combineTripDays(
    input({ to: "2026-11-01", parkDays: 0 }),
    tables({ ticketByDate: new Map() })
  );
  assert.equal(day!.components.ticketsCents, 0);
  assert.deepEqual(day!.missing, []);
});

test("covers every start date in the requested window inclusively", () => {
  const days = combineTripDays(input(), tables());
  assert.equal(days.length, 3);
  assert.deepEqual(
    days.map((d) => d.startDate),
    ["2026-11-01", "2026-11-02", "2026-11-03"]
  );
});

test("reports the oldest observation feeding the total", () => {
  const older = new Date("2026-08-01T00:00:00Z");
  const t = tables({ oldestRateObservedAt: older });
  const [day] = combineTripDays(input({ to: "2026-11-01" }), t);
  assert.equal(day!.oldestObservedAt, older.toISOString());
});
