import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseMoneyToCents, centsToDisplay } from "@ratecoaster/shared";
import { addDays, dateRange, daysBetween, prioritizeDates, todayInTimezone } from "./framework/dates.js";
import { extractPath, extractOne, renderTemplate } from "./hotels/endpoint-config.js";
import { parseOffers, checkRateCode } from "./hotels/index.js";
import { normalizeDate } from "./tickets/index.js";
import { normalizeName, slugify } from "./waits/providers.js";
import type { EndpointConfig } from "./hotels/endpoint-config.js";

describe("money", () => {
  test("parses currency strings and numbers into cents", () => {
    assert.equal(parseMoneyToCents("$1,234.56"), 123456);
    assert.equal(parseMoneyToCents("249.00"), 24900);
    assert.equal(parseMoneyToCents(249), 24900);
    assert.equal(parseMoneyToCents("USD 89"), 8900);
    assert.equal(parseMoneyToCents(""), null);
    assert.equal(parseMoneyToCents(null), null);
  });

  test("avoids float drift that would corrupt price comparisons", () => {
    // 0.1 + 0.2 in floats is 0.30000000000000004. Integer cents cannot drift,
    // which is what keeps "is today cheaper than yesterday" honest.
    assert.equal(parseMoneyToCents("0.10")! + parseMoneyToCents("0.20")!, 30);
  });

  test("formats for display", () => {
    assert.equal(centsToDisplay(24900), "$249");
    assert.equal(centsToDisplay(24950), "$249.50");
    assert.equal(centsToDisplay(null), "—");
  });
});

describe("dates", () => {
  test("adds days without timezone drift", () => {
    // The classic bug: new Date("2026-12-24") is midnight UTC, which is the
    // 23rd in Orlando. String arithmetic sidesteps it entirely.
    assert.equal(addDays("2026-12-24", 1), "2026-12-25");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2028-02-28", 1), "2028-02-29"); // leap year
    assert.equal(addDays("2026-03-08", 1), "2026-03-09"); // US DST transition
  });

  test("computes spans", () => {
    assert.equal(daysBetween("2026-01-01", "2026-12-31"), 364);
    assert.equal(dateRange("2026-01-01", 365).length, 365);
  });

  test("returns a well-formed date for a destination timezone", () => {
    assert.match(todayInTimezone("America/New_York"), /^\d{4}-\d{2}-\d{2}$/);
    assert.match(todayInTimezone("America/Chicago"), /^\d{4}-\d{2}-\d{2}$/);
  });

  test("prioritizes near dates and holidays so an interrupted crawl still helps", () => {
    const dates = dateRange("2026-09-01", 60);
    const holidays = new Set(["2026-10-25"]);
    const ordered = prioritizeDates(dates, holidays);
    assert.equal(ordered[0], "2026-10-25", "holiday should sort first");
    // Everything still present, nothing duplicated.
    assert.equal(new Set(ordered).size, 60);
  });
});

describe("endpoint config path extraction", () => {
  const payload = {
    data: {
      appliedRatePlan: "APH",
      roomRates: [
        { roomTypeCode: "STDK", roomTypeName: "Standard King", rates: [{ nightly: "$249.00", total: "$298.12" }], isAvailable: true },
        { roomTypeCode: "GRDN", roomTypeName: "Garden View", rates: [{ nightly: 319, total: 381.4 }], isAvailable: true },
        { roomTypeCode: "SOLD", roomTypeName: "Sold Out Suite", rates: [{ nightly: null, total: null }], isAvailable: false },
      ],
    },
  };

  test("walks dotted paths, indexes, and wildcards", () => {
    assert.equal(extractPath(payload, "data.roomRates[*]").length, 3);
    assert.equal(extractOne(payload, "data.roomRates[0].roomTypeCode"), "STDK");
    assert.equal(extractOne(payload, "data.appliedRatePlan"), "APH");
    assert.equal(extractOne(payload, "data.nope.missing"), null);
  });

  const config: EndpointConfig = {
    name: "test",
    request: { method: "GET", urlTemplate: "https://ratecoaster.net/a", headers: {}, rpm: 12 },
    response: {
      roomsPath: "data.roomRates[*]",
      fields: {
        roomCode: "roomTypeCode",
        roomName: "roomTypeName",
        nightly: "rates[0].nightly",
        total: "rates[0].total",
        available: "isAvailable",
      },
      rateCodeAppliedPath: "data.appliedRatePlan",
      rateCodeAppliedEquals: "APH",
      pricesAreCents: false,
    },
  };

  test("parses mixed string and numeric prices", () => {
    const offers = parseOffers(config, payload);
    assert.equal(offers.length, 2, "the unpriced sold-out room must be dropped");
    assert.equal(offers[0]!.nightlyCents, 24900);
    assert.equal(offers[0]!.totalCents, 29812);
    assert.equal(offers[1]!.nightlyCents, 31900);
  });

  test("detects when the booking engine ignored the promo code", () => {
    // This is the guard that prevents storing public rates labelled as
    // passholder rates — a wrong discount is worse than no data.
    assert.equal(checkRateCode(config, payload), true);
    const ignored = { data: { ...payload.data, appliedRatePlan: "BAR" } };
    assert.equal(checkRateCode(config, ignored), false);
  });
});

describe("url templating", () => {
  test("substitutes placeholders", () => {
    const url = renderTemplate(
      "https://ratecoaster.net/avail?hotel={hotelCode}&arrive={checkIn}&adults={adults}&promo={rateCode}",
      { hotelCode: "PBH", checkIn: "2026-12-24", adults: 2, rateCode: "APH" }
    );
    assert.equal(url, "https://ratecoaster.net/avail?hotel=PBH&arrive=2026-12-24&adults=2&promo=APH");
  });

  test("drops empty params so STANDARD means 'send no promo code at all'", () => {
    const url = renderTemplate(
      "https://ratecoaster.net/avail?hotel={hotelCode}&promo={rateCode}&adults={adults}",
      { hotelCode: "PBH", rateCode: "", adults: 2 }
    );
    assert.equal(url, "https://ratecoaster.net/avail?hotel=PBH&adults=2");
    assert.ok(!url.includes("promo="), "an empty promo param is not the same request as omitting it");
  });
});

describe("ticket date normalization", () => {
  test("accepts the formats storefronts actually emit", () => {
    assert.equal(normalizeDate("2026-12-24"), "2026-12-24");
    assert.equal(normalizeDate("2026-12-24T00:00:00Z"), "2026-12-24");
    assert.equal(normalizeDate("12/24/2026"), "2026-12-24");
    assert.equal(normalizeDate("7/4/2026"), "2026-07-04");
    assert.equal(normalizeDate("not a date"), null);
    assert.equal(normalizeDate(12345), null);
  });
});

describe("attraction naming", () => {
  test("normalizes trademark marks and punctuation so providers can be matched", () => {
    assert.equal(normalizeName("Mario Kart™: Bowser's Challenge"), "mario kart bowser s challenge");
    // Same ride, two providers, two spellings of the apostrophe.
    assert.equal(
      normalizeName("Mario Kart™: Bowser’s Challenge"),
      normalizeName("Mario Kart: Bowser's Challenge")
    );
  });

  test("slugs are stable and url-safe", () => {
    assert.equal(slugify("Harry Potter and the Battle at the Ministry™"), "harry-potter-and-the-battle-at-the-ministry");
  });
});
