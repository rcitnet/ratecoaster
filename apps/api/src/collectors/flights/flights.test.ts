import assert from "node:assert/strict";
import { test } from "node:test";
import { TripPlannerQuery } from "@ratecoaster/shared";
import { buildBookingUrl, parseCalendar } from "./travelpayouts.js";

/**
 * The calendar payload, in the documented shape.
 *
 * Kept verbatim from the API reference rather than hand-simplified, so that
 * when the real response arrives via `flights:probe` the two can be compared
 * field for field.
 */
const DOCUMENTED_PAYLOAD = {
  success: true,
  data: {
    "2026-11-03": {
      origin: "NYC",
      destination: "MCO",
      price: 187,
      transfers: 0,
      airline: "B6",
      flight_number: 1183,
      departure_at: "2026-11-03T06:35:00Z",
      return_at: "2026-11-08T13:30:00Z",
      expires_at: "2026-08-25T12:34:14Z",
    },
    "2026-11-04": {
      origin: "NYC",
      destination: "MCO",
      price: 162.5,
      transfers: 1,
      airline: "NK",
      flight_number: 231,
      departure_at: "2026-11-04T09:10:00Z",
      return_at: "2026-11-09T18:05:00Z",
      expires_at: "2026-08-25T12:34:14Z",
    },
  },
};

test("parses the documented calendar shape into cents", () => {
  const entries = parseCalendar(DOCUMENTED_PAYLOAD);
  assert.equal(entries.length, 2);

  const [first, second] = entries;
  assert.equal(first!.departDate, "2026-11-03");
  assert.equal(first!.priceCents, 18_700);
  assert.equal(first!.airline, "B6");
  assert.equal(first!.transfers, 0);

  // Fractional currency units must round, not truncate: 162.5 -> 16250, not 16249.
  assert.equal(second!.priceCents, 16_250);
});

test("returns entries sorted by departure date", () => {
  const shuffled = {
    success: true,
    data: {
      "2026-12-20": { price: 400 },
      "2026-12-01": { price: 220 },
      "2026-12-11": { price: 310 },
    },
  };
  const dates = parseCalendar(shuffled).map((e) => e.departDate);
  assert.deepEqual(dates, ["2026-12-01", "2026-12-11", "2026-12-20"]);
});

test("tolerates the alternate field names seen in the wild", () => {
  const alternate = {
    success: true,
    data: { "2026-09-14": { value: 244, number_of_changes: 2, airline: "AA" } },
  };
  const [entry] = parseCalendar(alternate);
  assert.equal(entry!.priceCents, 24_400);
  assert.equal(entry!.transfers, 2);
});

test("skips non-date keys and unusable rows instead of throwing", () => {
  const messy = {
    success: true,
    data: {
      currency: "usd",
      "2026-10-02": { price: 0 },
      "2026-10-03": { price: null },
      "2026-10-04": { price: 199 },
      "not-a-date": { price: 150 },
    },
  };
  const entries = parseCalendar(messy);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.departDate, "2026-10-04");
});

test("surfaces an upstream failure rather than reporting no flights", () => {
  // An empty array here would render as "no fares on these dates", which is a
  // lie about a route that may be perfectly well served.
  assert.throws(
    () => parseCalendar({ success: false, error: "Invalid token" }),
    /Invalid token/
  );
});

test("returns nothing for a null or malformed payload", () => {
  assert.deepEqual(parseCalendar(null), []);
  assert.deepEqual(parseCalendar("nope"), []);
  assert.deepEqual(parseCalendar({ success: true }), []);
});

test("builds an affiliate booking link in DDMM order", () => {
  const url = buildBookingUrl({
    origin: "NYC",
    destination: "MCO",
    departDate: "2026-11-03",
    returnDate: "2026-11-08",
    passengers: 4,
    marker: "12345",
  });
  assert.equal(url, "https://www.aviasales.com/search/NYC0311MCO08114?marker=12345");
});

test("emits no link at all when the affiliate marker is missing", () => {
  // Sending traffic away unattributed is the one part of this feature with a
  // direct cost, so absence of a marker must mean absence of a link.
  const url = buildBookingUrl({
    origin: "NYC",
    destination: "MCO",
    departDate: "2026-11-03",
    returnDate: "2026-11-08",
    passengers: 2,
    marker: null,
  });
  assert.equal(url, null);
});

test("a query-string 'false' turns the option off", () => {
  // z.coerce.boolean() would make this true, silently ignoring the user.
  const parsed = TripPlannerQuery.parse({ parkToPark: "false" });
  assert.equal(parsed.parkToPark, false);

  assert.equal(TripPlannerQuery.parse({ parkToPark: "true" }).parkToPark, true);
  assert.equal(TripPlannerQuery.parse({ parkToPark: "1" }).parkToPark, true);
  assert.equal(TripPlannerQuery.parse({}).parkToPark, false);
});

test("park days default to one fewer than nights", () => {
  // The arrival day is eaten by travel; quoting a park ticket for it would
  // overstate every trip.
  const q = TripPlannerQuery.parse({ nights: "5" });
  assert.equal(q.nights, 5);
  assert.equal(q.parkDays, undefined, "the route applies the default, not the schema");
});
