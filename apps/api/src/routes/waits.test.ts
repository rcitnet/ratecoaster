import assert from "node:assert/strict";
import { test } from "node:test";
import { parkLocalClock } from "./waits.js";

test("parkLocalClock aligns park-local date, DOW, and hour across timezones and DST", () => {
  // 2026-07-05 01:30Z (Sunday UTC) is still Saturday 2026-07-04 21:30 EDT in Orlando
  // and Saturday 2026-07-04 18:30 PDT in Hollywood.
  const summerEvening = new Date("2026-07-05T01:30:00Z");
  assert.deepEqual(parkLocalClock(summerEvening, "America/New_York"), {
    date: "2026-07-04",
    dayOfWeek: 6,
    hour: 21,
  });
  assert.deepEqual(parkLocalClock(summerEvening, "America/Los_Angeles"), {
    date: "2026-07-04",
    dayOfWeek: 6,
    hour: 18,
  });

  // 2026-01-15 19:00Z (Thursday) is 14:00 EST in Orlando (UTC-5, not UTC-4).
  const winterAfternoon = new Date("2026-01-15T19:00:00Z");
  assert.deepEqual(parkLocalClock(winterAfternoon, "America/New_York"), {
    date: "2026-01-15",
    dayOfWeek: 4,
    hour: 14,
  });
  assert.deepEqual(parkLocalClock(winterAfternoon, "America/Chicago"), {
    date: "2026-01-15",
    dayOfWeek: 4,
    hour: 13,
  });
});
