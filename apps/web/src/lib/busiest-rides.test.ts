import assert from "node:assert/strict";
import { test } from "node:test";
import { LiveWait, LiveWaitsResponse } from "@ratecoaster/shared";
import { busiestRides } from "./busiest-rides.js";

const now = new Date("2026-09-09T16:00:00Z");
function ride(name: string, minutes: number | null, extra = {}) {
  return LiveWait.parse({
    attractionId: name, attractionSlug: name, attractionName: name,
    parkSlug: "epic-universe", parkName: "Epic Universe", land: null, kind: "ride",
    waitMinutes: minutes, singleRiderMinutes: null, status: "operating",
    observedAt: now.toISOString(), typicalMinutes: null, vsTypicalMinutes: null, ...extra,
  });
}
function park(waits: LiveWait[], closed = false) {
  return LiveWaitsResponse.parse({
    parks: [{
      park: { id: "epic", destination: "universal-orlando", slug: "epic-universe",
        name: "Epic Universe", timezone: "America/New_York", queueTimesId: null, themeParksWikiId: null },
      waits,
      hours: { parkId: "epic", date: "2026-09-09", opensAt: "2026-09-09T14:00:00Z",
        closesAt: closed ? "2026-09-09T15:00:00Z" : "2026-09-10T01:00:00Z",
        earlyEntryAt: null, kind: "OPERATING" },
    }], attribution: [], fetchedAt: now.toISOString(),
  }).parks[0]!;
}

test("ranks the three longest waits across parks without mutating the feed", () => {
  const first = park([ride("A", 20), ride("B", 80)]);
  const second = park([ride("C", 50), ride("D", 100)]);
  assert.deepEqual(busiestRides([first, second], now).map(r => r.attractionName), ["D", "B", "C"]);
  assert.deepEqual(first.waits.map(r => r.attractionName), ["A", "B"]);
});

test("excludes closed parks, shows, unavailable rides, and stale or invalid readings", () => {
  const open = park([
    ride("Fresh", 15), ride("Show", 120, { kind: "show" }),
    ride("Down", 100, { status: "down" }), ride("No wait", null),
    ride("Old", 90, { observedAt: "2026-09-09T15:29:00Z" }),
    ride("Future", 90, { observedAt: "2026-09-09T17:00:00Z" }),
  ]);
  assert.deepEqual(busiestRides([open, park([ride("Closed park", 200)], true)], now)
    .map(r => r.attractionName), ["Fresh"]);
  assert.deepEqual(busiestRides([], now), []);
});

test("retains zero-minute waits and orders ties consistently", () => {
  assert.deepEqual(busiestRides([park([ride("B", 0), ride("A", 0)])], now)
    .map(r => r.attractionName), ["A", "B"]);
});
