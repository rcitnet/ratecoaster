import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseMoneyToCents, centsToDisplay, RateQuery } from "@ratecoaster/shared";
import { PROPERTIES, RETIRED_PROPERTY_SLUGS } from "@ratecoaster/db/src/seed-data.js";
import { addDays, dateRange, daysBetween, prioritizeDates, todayInTimezone } from "./framework/dates.js";
import { extractPath, extractOne, renderTemplate } from "./hotels/endpoint-config.js";
import { parseOffers, checkRateCode } from "./hotels/index.js";
import {
  selectAdapter,
  RATE_ADAPTERS,
  observedAdapter,
  affiliateAdapter,
  derivedAdapter,
  universalIbeAdapter,
  universalKidsCommerceAdapter,
} from "./hotels/adapters/index.js";
import {
  buildUniversalRateUrl,
  isUniversalRateUnavailablePage,
  parseUniversalRatePage,
  universalDayIndex,
} from "./hotels/adapters/universal-ibe.js";
import {
  buildKidsHotelSearchUrl,
  parseKidsHotelResponse,
} from "./hotels/adapters/universal-kids-commerce.js";
import { selectRotatingBatch, selectRotatingDates } from "./hotels/schedule.js";
import { normalizeDate } from "./tickets/index.js";
import { parseCsv, csvToObjects } from "./framework/csv.js";
import { mapFeedRecords, isPlaceholderFeedUrl, type TicketFeedConfig } from "./tickets/feed-config.js";
import { normalizeName, slugify } from "./waits/providers.js";
import type { EndpointConfig } from "./hotels/endpoint-config.js";
import { parseCollectArgs } from "../jobs/collect-args.js";

describe("hotel catalogue", () => {
  test("excludes Hollywood-area hotels from the public collection set", () => {
    assert.equal(
      PROPERTIES.some((property) => property.destination === "universal-hollywood"),
      false
    );
    const retiredSlugs = new Set<string>(RETIRED_PROPERTY_SLUGS);
    assert.equal(
      PROPERTIES.some((property) => retiredSlugs.has(property.slug)),
      false
    );
  });
});

describe("collector CLI arguments", () => {
  test("accepts a one-property hotel canary", () => {
    assert.deepEqual(
      parseCollectArgs(["--only", "hotel-rates", "--property", "universal-kids-hotel"]),
      {
        dryRun: false,
        list: false,
        only: "hotel-rates",
        propertySlug: "universal-kids-hotel",
      }
    );
  });

  test("rejects property filters for unrelated collectors", () => {
    assert.throws(
      () => parseCollectArgs(["--only", "wait-times", "--property", "universal-kids-hotel"]),
      /only be used with --only hotel-rates/
    );
  });

  test("rejects a missing or malformed property slug", () => {
    assert.throws(() => parseCollectArgs(["--only", "hotel-rates", "--property"]), /requires a value/);
    assert.throws(
      () => parseCollectArgs(["--only", "hotel-rates", "--property", "../other"]),
      /invalid property slug/
    );
  });
});

describe("hotel rate queries", () => {
  test("accepts a room type UUID and rejects arbitrary identifiers", () => {
    const roomTypeId = "00000000-0000-4000-8000-000000000001";
    assert.equal(RateQuery.parse({ roomTypeId }).roomTypeId, roomTypeId);
    assert.equal(RateQuery.safeParse({ roomTypeId: "standard-room" }).success, false);
  });
});

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

  test("keeps near dates hot while rotating through the rest of the window", () => {
    const dates = dateRange("2026-09-01", 100);
    const first = selectRotatingDates(dates, 0.25, 0, 360);
    const second = selectRotatingDates(dates, 0.25, 360 * 60_000, 360);
    assert.equal(first.length, 25);
    assert.deepEqual(first.slice(0, 14), dates.slice(0, 14));
    assert.deepEqual(second.slice(0, 14), dates.slice(0, 14));
    assert.notDeepEqual(first.slice(14), second.slice(14));
  });

  test("rotates bounded property batches without starving wraparound items", () => {
    const properties = ["a", "b", "c", "d", "e"];
    const interval = 360 * 60_000;

    assert.deepEqual(selectRotatingBatch(properties, 2, 0), ["a", "b"]);
    assert.deepEqual(selectRotatingBatch(properties, 2, interval), ["c", "d"]);
    assert.deepEqual(selectRotatingBatch(properties, 2, interval * 2), ["e", "a"]);
    assert.deepEqual(selectRotatingBatch(properties, 10, 0), properties);
  });
});

describe("Universal reservation engine", () => {
  const standardHtml = `
    <a class="ws-button-small wsViewRateRoom" roomcode="STD2Q" rmid="76565"
      amt="592.00" tax="74.00" ratetype="Flexible Rate" ratecode="0RACW"
      access="" roomtype="Standard 2 Queen Beds">Book Now</a>`;
  const aphHtml = `
    <a class="ws-button-small wsViewRateRoom" roomcode="KIDS" rmid="76573"
      amt="337.25" tax="42.17" ratetype="Annual Passholder Rate" ratecode="3APHW"
      access="APH" roomtype="Future Rock Star Kids&#39; Suite">Book Now</a>`;

  test("builds one-night STANDARD and APH URLs with the engine's Y2K date index", () => {
    assert.equal(universalDayIndex("2026-08-24"), 9732);
    const standard = new URL(buildUniversalRateUrl(14842, 641, "2026-08-24", "STANDARD"));
    const aph = new URL(buildUniversalRateUrl(14842, 641, "2026-08-24", "APH"));
    assert.equal(standard.searchParams.get("rate"), "0RACW");
    assert.equal(standard.searchParams.get("access"), "");
    assert.equal(aph.searchParams.get("rate"), "3APHW");
    assert.equal(aph.searchParams.get("access"), "APH");
    assert.equal(aph.searchParams.get("nights"), "1");
  });

  test("parses standard and passholder offers without crossing rate labels", () => {
    const standard = parseUniversalRatePage(standardHtml + aphHtml, "STANDARD");
    const aph = parseUniversalRatePage(standardHtml + aphHtml, "APH");
    assert.deepEqual(standard, [{
      roomCode: "STD2Q",
      roomName: "Standard 2 Queen Beds",
      nightlyCents: 59200,
      totalCents: 66600,
      available: true,
    }]);
    assert.equal(aph.length, 1);
    assert.equal(aph[0]!.roomName, "Future Rock Star Kids' Suite");
    assert.equal(aph[0]!.nightlyCents, 33725);
    assert.equal(aph[0]!.totalCents, 37942);
  });

  test("rejects an APH-looking price when the access marker is missing", () => {
    assert.deepEqual(parseUniversalRatePage(aphHtml.replace('access="APH"', 'access=""'), "APH"), []);
  });

  test("distinguishes a sold-out page from an unexpected parser break", () => {
    assert.equal(isUniversalRateUnavailablePage("The property is currently unavailable."), true);
    assert.equal(isUniversalRateUnavailablePage("The offer is not available or expired."), true);
    assert.equal(isUniversalRateUnavailablePage("<html>new unexplained markup</html>"), false);
  });
});

describe("Universal Kids Resort commerce API", () => {
  const response = {
    bookingRooms: [
      {
        bookingRoomSequenceId: 1,
        products: [
          {
            code: "UKRFR-STDQ",
            name: "Standard Queen",
            hotelId: "UNI012",
            roomTypeCode: "STDQ",
            purchasable: true,
            maxOccupancy: 5,
            stock: { stockLevelStatus: "inStock" },
            hotelPrice: {
              currencyIso: "USD",
              ratePlanCode: "RACK",
              value: 194,
            },
          },
          {
            code: "UKRFR-SOLD",
            name: "Sold Out Suite",
            hotelId: "UNI012",
            roomTypeCode: "SOLD",
            purchasable: false,
            maxOccupancy: 6,
            stock: { stockLevelStatus: "outOfStock" },
            hotelPrice: {
              currencyIso: "USD",
              ratePlanCode: "RACK",
              value: "349.00",
            },
          },
          {
            code: "UKRFR-PROMO",
            name: "Unverified Promotion",
            hotelId: "UNI012",
            roomTypeCode: "PROMO",
            purchasable: true,
            hotelPrice: {
              currencyIso: "USD",
              ratePlanCode: "SOMETHING_ELSE",
              value: 99,
            },
          },
        ],
      },
    ],
  };

  test("builds the public UNI012 commerce search endpoint", () => {
    const url = new URL(buildKidsHotelSearchUrl());
    assert.equal(url.hostname, "comm-api.universaldestinationsandexperiences.com");
    assert.equal(url.pathname, "/occ/v2/ukrfr_b2c_hotel/hotelsWithRoomDetails");
    assert.equal(url.searchParams.get("siteId"), "ukrfr_b2c_hotel");
  });

  test("parses RACK as Standard and preserves sold-out availability", () => {
    assert.deepEqual(parseKidsHotelResponse(response), [
      {
        roomCode: "STDQ",
        roomName: "Standard Queen",
        nightlyCents: 19400,
        currency: "USD",
        available: true,
        maxOccupancy: 5,
      },
      {
        roomCode: "SOLD",
        roomName: "Sold Out Suite",
        nightlyCents: 34900,
        currency: "USD",
        available: false,
        maxOccupancy: 6,
      },
    ]);
  });

  test("rejects an unexpected response instead of treating it as sold out", () => {
    assert.throws(() => parseKidsHotelResponse({ products: [] }), /bookingRooms/);
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

describe("rate source adapters", () => {
  test("each adapter's source matches the registry key it is filed under", () => {
    for (const [key, adapter] of Object.entries(RATE_ADAPTERS)) {
      assert.equal(adapter.source, key);
    }
  });

  test("selectAdapter defaults to the observed scraper", () => {
    // Absent, empty, or scraper-only config (adapter is the endpoint name, not
    // a source) must keep behaving exactly as before the pivot.
    assert.equal(selectAdapter(null), observedAdapter);
    assert.equal(selectAdapter({}), observedAdapter);
    assert.equal(selectAdapter({ adapter: "loews-portofino" }), observedAdapter);
  });

  test("selectAdapter uses the dedicated Universal driver for Universal hotel ids", () => {
    assert.equal(
      selectAdapter({ adapter: "universal-ibe", hotelId: 14842, hotelGroupId: 641 }),
      universalIbeAdapter
    );
  });

  test("selectAdapter uses the separate Universal Kids commerce driver", () => {
    assert.equal(
      selectAdapter({ adapter: "universal-kids-commerce", hotelId: "UNI012" }),
      universalKidsCommerceAdapter
    );
  });

  test("selectAdapter resolves the requested source; unknown falls back to observed", () => {
    assert.equal(selectAdapter({ source: "affiliate" }), affiliateAdapter);
    assert.equal(selectAdapter({ source: "derived" }), derivedAdapter);
    assert.equal(selectAdapter({ source: "nope" }), observedAdapter);
  });

  test("seam adapters report not-ready with a reason until feeds/keys exist", async () => {
    const ctx = {} as Parameters<typeof affiliateAdapter.isReady>[0];
    const property = {} as Parameters<typeof affiliateAdapter.isReady>[1];

    const aff = await affiliateAdapter.isReady(ctx, property);
    assert.equal(aff.ready, false);
    assert.ok(aff.reason, "affiliate adapter should explain why it is not ready");

    const der = await derivedAdapter.isReady(ctx, property);
    assert.equal(der.ready, false);
    assert.ok(der.reason, "derived adapter should explain why it is not ready");
  });
});

describe("csv parsing", () => {
  test("handles quoted delimiters, escaped quotes, and CRLF", () => {
    const text = 'a,b,c\r\n"1,000","he said ""hi""",z\r\n';
    const rows = parseCsv(text);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[1], ["1,000", 'he said "hi"', "z"]);
  });

  test("maps a header row to trimmed records", () => {
    const { header, records } = csvToObjects("SKU, NAME ,PRICE\nX, Widget ,9.99\n");
    assert.deepEqual(header, ["SKU", "NAME", "PRICE"]);
    assert.equal(records.length, 1);
    assert.equal(records[0]!.NAME, "Widget");
    assert.equal(records[0]!.PRICE, "9.99");
  });
});

describe("affiliate ticket feed mapping", () => {
  const config: TicketFeedConfig = {
    name: "undercover-tourist",
    merchant: "undercover-tourist",
    network: "cj",
    feedUrl: "https://feeds.cj.com/12345/uct.csv",
    format: "csv",
    currency: "USD",
    headers: {},
    columns: {
      sku: "SKU",
      name: "NAME",
      price: "SALEPRICE",
      retailPrice: "PRICE",
      currency: "CURRENCY",
      buyUrl: "BUYURL",
      available: "INSTOCK",
    },
    filter: { column: "ADVERTISERNAME", equals: "Undercover Tourist" },
    defaultGuestCategory: "adult",
  };

  // A realistic CJ product-catalog feed: a comma inside a quoted ticket name, a
  // discounted SALEPRICE vs list PRICE, a broken row with no price, and a row
  // from another advertiser that the filter must drop.
  const feed =
    "SKU,NAME,SALEPRICE,PRICE,CURRENCY,BUYURL,INSTOCK,ADVERTISERNAME\n" +
    'UOR2DP2P,"Universal Orlando 2-Day, Park-to-Park",279.99,314.99,USD,https://www.dpbolvw.net/click-1?u=uor2,yes,Undercover Tourist\n' +
    "UOR1D1P,Universal Orlando 1-Day 1-Park,169.00,185.00,USD,https://www.dpbolvw.net/click-1?u=uor1,yes,Undercover Tourist\n" +
    "BROKEN,Missing Price Row,,199.00,USD,https://x,yes,Undercover Tourist\n" +
    "DISNEY1,Some Disney Ticket,109.00,,USD,https://x,yes,Other Merchant\n";

  test("keeps only priced rows from the configured advertiser", () => {
    const rows = mapFeedRecords(config, csvToObjects(feed).records);
    assert.equal(rows.length, 2, "no-price and other-advertiser rows must be dropped");
    assert.deepEqual(
      rows.map((r) => r.sku),
      ["UOR2DP2P", "UOR1D1P"]
    );
  });

  test("parses the discounted price, keeps names with commas, and the deep link", () => {
    const [first] = mapFeedRecords(config, csvToObjects(feed).records);
    assert.equal(first!.priceCents, 27999, "uses SALEPRICE, in cents");
    assert.equal(first!.retailCents, 31499);
    assert.equal(first!.name, "Universal Orlando 2-Day, Park-to-Park");
    assert.ok(first!.buyUrl.startsWith("https://"), "the affiliate deep link survives intact");
    assert.equal(first!.currency, "USD");
    assert.equal(first!.available, true);
    assert.equal(first!.validDate, null, "CJ product feeds are date-less");
  });

  test("isPlaceholderFeedUrl flags an unconfigured feed", () => {
    assert.equal(isPlaceholderFeedUrl("https://CHANGE_ME_CJ_PRODUCT_FEED_URL"), true);
    assert.equal(isPlaceholderFeedUrl(""), true);
    assert.equal(isPlaceholderFeedUrl("ftp://feeds.cj.com/x.csv"), true);
    assert.equal(isPlaceholderFeedUrl("https://feeds.cj.com/12345/uct.csv"), false);
  });
});
