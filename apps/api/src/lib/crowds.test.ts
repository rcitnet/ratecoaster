import assert from "node:assert/strict";
import test from "node:test";
import { CrowdCalendarQuery } from "@ratecoaster/shared";
import { buildCrowdCalendar, crowdDateWindow, crowdLevel } from "./crowds.js";

test("crowd calendar rewards agreement between Universal demand signals", () => {
  const days = buildCrowdCalendar({
    from: "2026-09-07",
    to: "2026-09-12",
    ticketByDate: new Map([
      ["2026-09-07", { value: 18000, available: true }],
      ["2026-09-08", { value: 18500, available: true }],
      ["2026-09-09", { value: 19000, available: true }],
      ["2026-09-10", { value: 21000, available: true }],
      ["2026-09-11", { value: 23000, available: true }],
      ["2026-09-12", { value: 24500, available: true }],
    ]),
    expressByDate: new Map([
      ["2026-09-07", { value: 8500, available: true }],
      ["2026-09-08", { value: 9000, available: true }],
      ["2026-09-09", { value: 9500, available: true }],
      ["2026-09-10", { value: 11000, available: true }],
      ["2026-09-11", { value: 13500, available: true }],
      ["2026-09-12", { value: 16000, available: true }],
    ]),
    hotelByDate: new Map([
      ["2026-09-07", 12500],
      ["2026-09-08", 13000],
      ["2026-09-09", 13500],
      ["2026-09-10", 15000],
      ["2026-09-11", 17500],
      ["2026-09-12", 21000],
    ]),
  });

  assert.equal(days.length, 6);
  assert.equal(days[0]?.confidence, "high");
  assert.ok(days[5]!.score > days[0]!.score);
  assert.equal(days[5]?.level, "very-high");
});

test("a sold-out demand signal is treated as high pressure, not missing data", () => {
  const days = buildCrowdCalendar({
    from: "2026-09-07",
    to: "2026-09-08",
    ticketByDate: new Map([
      ["2026-09-07", { value: 18000, available: true }],
      ["2026-09-08", { value: 18000, available: false }],
    ]),
    expressByDate: new Map(),
    hotelByDate: new Map(),
  });

  assert.ok(days[1]!.score > days[0]!.score);
  assert.equal(days[1]?.signals[0], "ticket");
});

test("crowd labels cover the full score range", () => {
  assert.equal(crowdLevel(1), "very-low");
  assert.equal(crowdLevel(4), "low");
  assert.equal(crowdLevel(6), "moderate");
  assert.equal(crowdLevel(8), "high");
  assert.equal(crowdLevel(10), "very-high");
});

test("historical crowd windows retain past dates without a lookback cutoff", () => {
  const window = crowdDateWindow("anonymous", "2015-08-01", "2015-08-31", "America/New_York");
  assert.equal(window.from, "2015-08-01");
  assert.equal(window.to, "2015-08-31");
  assert.equal(window.info.visibleDays, 31);
  assert.equal(window.info.gated, false);
});

test("an open-ended historic request returns a bounded year", () => {
  const window = crowdDateWindow("anonymous", "2015-01-01", undefined, "America/New_York");
  assert.equal(window.info.visibleDays, 366);
  assert.equal(window.to, "2016-01-01");
});

test("historical scores require recorded signals and keep their calendar dates", () => {
  const days = buildCrowdCalendar({
    from: "2026-08-01", to: "2026-08-31", historyBefore: "2026-09-01",
    ticketByDate: new Map([["2026-08-14", { value: 19000, available: true }]]),
    expressByDate: new Map(), hotelByDate: new Map(),
  });
  assert.equal(days.length, 1);
  assert.equal(days[0]?.date, "2026-08-14");
  assert.deepEqual(days[0]?.signals, ["ticket"]);
});

test("crowd queries reject invalid dates and oversized or reversed ranges", () => {
  assert.equal(CrowdCalendarQuery.safeParse({ from: "2015-08-01", to: "2015-08-31" }).success, true);
  assert.equal(CrowdCalendarQuery.safeParse({ from: "2026-02-30", to: "2026-03-01" }).success, false);
  assert.equal(CrowdCalendarQuery.safeParse({ from: "2020-01-01", to: "2026-01-01" }).success, false);
  assert.equal(CrowdCalendarQuery.safeParse({ from: "2026-08-31", to: "2026-08-01" }).success, false);
});
