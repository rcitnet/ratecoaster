import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deriveParkState,
  formatParkHours,
  formatParkTime,
  parkStateMessage,
  type ParkWaitSample,
} from "./park-state.js";

const TZ = "America/New_York";

/** Universal Studios Florida on 21 Aug 2026: 10:00 to 21:00 Eastern. */
const HOURS = {
  opensAt: "2026-08-21T10:00:00-04:00",
  closesAt: "2026-08-21T21:00:00-04:00",
};

/** What the feed looks like at 11pm: rides shut, shows still claiming OPERATING. */
const LATE_NIGHT: ParkWaitSample[] = [
  ...Array.from({ length: 30 }, () => ({ status: "closed", waitMinutes: null })),
  ...Array.from({ length: 33 }, () => ({ status: "operating", waitMinutes: null })),
];

test("a park past closing time is closed, whatever the shows claim", () => {
  /*
   * The bug this was written for. At 11pm, 33 shows still reported OPERATING,
   * and status-counting concluded the park was open.
   */
  const state = deriveParkState({
    waits: LATE_NIGHT,
    hours: HOURS,
    now: new Date("2026-08-22T03:00:00Z"), // 11pm Eastern
  });
  assert.equal(state, "closed");
});

test("a park before opening time is closed", () => {
  const state = deriveParkState({
    waits: LATE_NIGHT,
    hours: HOURS,
    now: new Date("2026-08-21T12:00:00Z"), // 8am Eastern, opens at 10
  });
  assert.equal(state, "closed");
});

test("and says when it opens", () => {
  const msg = parkStateMessage(
    "closed",
    0,
    0,
    HOURS,
    TZ,
    new Date("2026-08-21T12:00:00Z")
  );
  assert.match(msg, /opens at 10:00 AM/);
});

test("after closing it points at tomorrow rather than a time that has passed", () => {
  const msg = parkStateMessage(
    "closed",
    0,
    0,
    HOURS,
    TZ,
    new Date("2026-08-22T03:00:00Z")
  );
  assert.match(msg, /tomorrow/);
  assert.doesNotMatch(msg, /opens at/);
});

test("inside opening hours with rides posting is open", () => {
  const state = deriveParkState({
    waits: [{ status: "operating", waitMinutes: 35 }],
    hours: HOURS,
    now: new Date("2026-08-21T18:00:00Z"), // 2pm Eastern
  });
  assert.equal(state, "open");
});

test("open early with nothing posting yet is not called closed", () => {
  // 10:05am: gates open, the feed has not caught up. Saying "closed" here
  // would be as wrong as saying "open" at midnight.
  const state = deriveParkState({
    waits: [{ status: "operating", waitMinutes: null }],
    hours: HOURS,
    now: new Date("2026-08-21T14:05:00Z"),
  });
  assert.equal(state, "no-standby");
  assert.match(parkStateMessage(state, 0, 0, HOURS, TZ), /no rides are posting/);
});

test("scheduled-open hours override an all-closed stale attraction feed", () => {
  const state = deriveParkState({
    waits: [{ status: "closed", waitMinutes: null }],
    hours: {
      opensAt: "2026-08-21T12:00:00Z",
      closesAt: "2026-08-22T01:00:00Z",
    },
    now: new Date("2026-08-21T15:00:00Z"),
  });
  assert.equal(state, "no-standby");
});

test("without hours it falls back to statuses", () => {
  // Universal Kids Resort has no schedule provider yet.
  assert.equal(
    deriveParkState({ waits: [{ status: "closed", waitMinutes: null }], hours: null }),
    "closed"
  );
  assert.equal(
    deriveParkState({ waits: [{ status: "operating", waitMinutes: 20 }], hours: null }),
    "open"
  );
});

test("an empty report is not the same as a closed park", () => {
  const state = deriveParkState({ waits: [], hours: null });
  assert.equal(state, "no-data");
  assert.match(parkStateMessage(state, 0, 0), /No report/);
});

test("a zero-minute wait is a real wait, not a missing one", () => {
  // A walk-on ride posts 0. Treating that as absent would drop the emptiest
  // rides from the average, which is exactly backwards.
  const state = deriveParkState({
    waits: [{ status: "operating", waitMinutes: 0 }],
    hours: HOURS,
    now: new Date("2026-08-21T18:00:00Z"),
  });
  assert.equal(state, "open");
});

test("times render in 12-hour form in the park's own timezone", () => {
  // A visitor from California still arrives at Orlando's 9am, and nobody
  // planning a park day thinks in 21:00.
  assert.equal(formatParkTime("2026-08-21T21:00:00-04:00", TZ), "9:00 PM");
  assert.equal(formatParkTime("2026-08-21T10:00:00-04:00", TZ), "10:00 AM");
  assert.equal(formatParkHours(HOURS, TZ), "10:00 AM to 9:00 PM");
});

test("Hollywood hours render in Pacific, not Eastern", () => {
  assert.equal(
    formatParkTime("2026-08-21T09:00:00-07:00", "America/Los_Angeles"),
    "9:00 AM"
  );
});

test("a half-known schedule still says something useful", () => {
  assert.equal(formatParkHours({ opensAt: HOURS.opensAt, closesAt: null }, TZ), "Opens 10:00 AM");
  assert.equal(formatParkHours({ opensAt: null, closesAt: HOURS.closesAt }, TZ), "Closes 9:00 PM");
  assert.equal(formatParkHours({ opensAt: null, closesAt: null }, TZ), null);
  assert.equal(formatParkHours(null, TZ), null);
});

test("one ride reporting reads as singular", () => {
  assert.match(parkStateMessage("open", 1, 0), /1 ride reporting/);
  assert.match(parkStateMessage("open", 7, 2), /7 rides reporting/);
});
