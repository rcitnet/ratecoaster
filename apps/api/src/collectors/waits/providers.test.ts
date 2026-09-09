import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isRetiredAttraction, parseQueueTimes, parseThemeParksWiki } from "./providers.js";
import { parseUniversalAttractionCatalog } from "./universal-catalog.js";
import {
  QUEUE_TIMES_EPIC_UNIVERSE,
  THEMEPARKS_WIKI_HOLLYWOOD,
} from "./__fixtures__/live-payloads.js";

describe("retired attractions", () => {
  test("excludes Florida's Supercharged across provider spelling variants", () => {
    for (const name of [
      "Fast & Furious - Supercharged™",
      "Fast & Furious – Supercharged",
      "Fast and Furious: Supercharged",
      "FAST & FURIOUS SUPERCHARGED®",
    ]) {
      assert.equal(isRetiredAttraction("universal-studios-florida", name), true, name);
    }
  });

  test("preserves Hollywood attractions and other closed Florida rides", () => {
    assert.equal(isRetiredAttraction("universal-studios-hollywood", "Fast & Furious - Supercharged™"), false);
    assert.equal(isRetiredAttraction("universal-studios-hollywood", "Fast & Furious: Hollywood Drift"), false);
    assert.equal(isRetiredAttraction("universal-studios-florida", "Revenge of the Mummy™"), false);
  });
});

describe("Queue-Times parser (real Epic Universe payload)", () => {
  const waits = parseQueueTimes(QUEUE_TIMES_EPIC_UNIVERSE);
  const byName = new Map(waits.map((w) => [w.name, w]));

  test("folds single-rider queues into their parent attraction", () => {
    // The fixture contains 9 raw ride entries, 3 of which are "… Single Rider".
    // Those must not appear as attractions of their own.
    assert.equal(waits.length, 6);
    assert.ok(!waits.some((w) => /single rider/i.test(w.name)), "no phantom single-rider rides");

    const marioKart = byName.get("Mario Kart™: Bowser's Challenge");
    assert.ok(marioKart);
    assert.equal(marioKart.waitMinutes, 50);
    assert.equal(marioKart.singleRiderMinutes, 15, "single-rider wait attached to the parent");
  });

  test("does not treat a closed ride's zero as a zero-minute wait", () => {
    // Stardust Racers reports is_open:false, wait_time:0. Recording that as a
    // 0-minute wait would drag every average toward zero overnight.
    const stardust = byName.get("Stardust Racers");
    assert.ok(stardust);
    assert.equal(stardust.waitMinutes, null);
    assert.equal(stardust.status, "closed");
  });

  test("carries land names through", () => {
    assert.equal(byName.get("Constellation Carousel")?.land, "Celestial Park");
    assert.equal(
      byName.get("Harry Potter and the Battle at the Ministry™")?.land,
      "The Wizarding World of Harry Potter — Ministry of Magic"
    );
  });

  test("preserves the upstream observation timestamp", () => {
    assert.equal(byName.get("Constellation Carousel")?.observedAt, "2026-08-05T23:31:34.000Z");
  });
});

describe("ThemeParks.wiki parser (real Hollywood payload)", () => {
  const waits = parseThemeParksWiki(THEMEPARKS_WIKI_HOLLYWOOD);
  const byName = new Map(waits.map((w) => [w.name, w]));

  test("reads standby and single-rider queues", () => {
    const mummy = byName.get("Revenge of the Mummy – The Ride");
    assert.ok(mummy);
    assert.equal(mummy.waitMinutes, 45);
    assert.equal(mummy.singleRiderMinutes, 10);
    assert.equal(mummy.status, "operating");
  });

  test("maps upstream status vocabulary", () => {
    assert.equal(byName.get("DinoPlay")?.status, "closed");
    assert.equal(byName.get("DinoPlay")?.waitMinutes, null);
    assert.equal(byName.get("Mario Kart™: Bowser’s Challenge")?.waitMinutes, 125);
  });

  test("distinguishes shows and character meets from rides", () => {
    // These render in different sections of the board, and folding them into
    // "rides" would distort every park-level average.
    assert.equal(byName.get("WaterWorld")?.kind, "show");
    assert.equal(byName.get("Meet Mario and Luigi")?.kind, "meet-and-greet");
    assert.equal(byName.get("Revenge of the Mummy – The Ride")?.kind, "ride");
  });

  test("prefers the provider's stable externalId for matching", () => {
    assert.equal(
      byName.get("Revenge of the Mummy – The Ride")?.externalId,
      "ush.lower_lot.rides.revenge_of_the_mummy_the_ride"
    );
  });

  test("entities with no queue still parse, with a null wait", () => {
    const raptor = byName.get("Raptor Encounter");
    assert.ok(raptor);
    assert.equal(raptor.waitMinutes, null);
    assert.equal(raptor.status, "operating");
  });
});

describe("Universal Orlando official attraction catalog", () => {
  const catalog = parseUniversalAttractionCatalog({
    PublishedOn: "2026-09-08T15:05:27.936",
    Tiles: [
      {
        Content: {
          Heading: "Honu of the Honu ika Moana™",
          Accessibility: [
            { Key: "child-swap", Description: "Child Swap" },
          ],
          TileImage: {
            DesktopTabletImage: "/uor/en/us/files/Images/honu-c.jpg",
          },
        },
        Meta: {
          AttractionExperiences: [
            { Key: "rides-attractions", Description: "Rides And Attractions" },
          ],
          AttractionLocations: [{ Key: "vb", Description: "Universal Volcano Bay" }],
          AttractionInterests: [
            { Key: "fun-for-little-ones", Description: "Fun For Little Ones" },
          ],
          AreasToExplore: [{ Key: "volcano-bay", Description: "Universal's Volcano Bay" }],
          AttractionType: [
            { Key: "multi-person-family", Description: "Multi-Person/Family" },
            { Key: "water-ride", Description: "Water Ride" },
          ],
          HeightRequirements: [
            { Key: "atleast-48-or-121.9-cm", Description: 'Minimum Height 48" (121.9 cm)' },
          ],
          Age: [{ Key: "kids-under-7", Description: "Kids (Under 7)" }],
          ExpressPass: [{ Key: "Yes", Description: "Yes" }],
          MapLatitude: "28.462759",
          MapLongitude: "-81.474116",
        },
        PageUrl: "/uor/en/us/things-to-do/rides-attractions/honu/index.html",
      },
      {
        Content: { Heading: "A Restaurant", Accessibility: [], TileImage: null },
        Meta: {
          AttractionExperiences: [{ Key: "dining", Description: "Dining" }],
          AttractionLocations: [{ Key: "usf", Description: "Universal Studios Florida" }],
          AttractionInterests: [],
          AreasToExplore: [],
          AttractionType: [],
          HeightRequirements: [],
          Age: [],
          ExpressPass: [],
          MapLatitude: null,
          MapLongitude: null,
        },
        PageUrl: null,
      },
    ],
  });

  test("keeps only rides and preserves Universal's exact classifications", () => {
    assert.equal(catalog.length, 1);
    assert.deepEqual(catalog[0]?.attractionTypes, [
      { key: "multi-person-family", label: "Multi-Person/Family" },
      { key: "water-ride", label: "Water Ride" },
    ]);
    assert.deepEqual(catalog[0]?.interests, [
      { key: "fun-for-little-ones", label: "Fun For Little Ones" },
    ]);
    assert.equal(catalog[0]?.expressPass, true);
  });

  test("maps official coordinates, accessibility, images, and URLs", () => {
    assert.equal(catalog[0]?.parkSlug, "volcano-bay");
    assert.equal(catalog[0]?.latitude, 28.462759);
    assert.equal(catalog[0]?.longitude, -81.474116);
    assert.deepEqual(catalog[0]?.accessibility, [{ key: "child-swap", label: "Child Swap" }]);
    assert.equal(
      catalog[0]?.officialImageUrl,
      "https://www.universalorlando.com/contentdata/uor/en/us/files/Images/honu-c.jpg"
    );
    assert.equal(
      catalog[0]?.officialUrl,
      "https://www.universalorlando.com/web/en/us/things-to-do/rides-attractions/honu/index.html"
    );
  });
});
