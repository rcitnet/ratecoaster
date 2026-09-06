import assert from "node:assert/strict";
import test from "node:test";
import { buildCrowdCalendar, crowdLevel } from "./crowds.js";

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
