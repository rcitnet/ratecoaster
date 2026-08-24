import assert from "node:assert/strict";
import { test } from "node:test";
import { CreateWatch } from "@ratecoaster/shared";
import { COOLDOWN_HOURS, evaluateWatch, totalForStay, type WatchState } from "./alerts.js";

const NOW = new Date("2026-08-21T12:00:00Z");

test("watch targets require the product appropriate to their kind", () => {
  const common = {
    thresholdCents: null,
    bookedNightlyCents: null,
    channels: ["email"],
  } as const;
  const invalidExpress = CreateWatch.safeParse({
    ...common,
    target: {
      kind: "express",
      propertyId: null,
      ticketProductId: null,
      destination: "universal-orlando",
      rateCode: "STANDARD",
      checkIn: "2026-11-01",
      checkOut: "2026-11-02",
      adults: 2,
      children: 0,
    },
  });
  assert.equal(invalidExpress.success, false);
});

function watch(overrides: Partial<WatchState> = {}): WatchState {
  return {
    thresholdCents: null,
    bookedNightlyCents: null,
    lastNotifiedCents: null,
    lastNotifiedAt: null,
    baselineCents: null,
    ...overrides,
  };
}

test("says nothing on the first observation", () => {
  // Alerting here would be an alert about nothing having changed, which teaches
  // people our emails are not worth opening.
  const d = evaluateWatch(watch(), 60_000, NOW);
  assert.equal(d.notify, false);
  assert.match(d.reason, /first observation/);
});

test("alerts when a threshold is met", () => {
  const d = evaluateWatch(watch({ thresholdCents: 50_000 }), 49_900, NOW);
  assert.equal(d.notify, true);
  assert.equal(d.kind, "price-drop");
});

test("stays quiet while above the threshold", () => {
  const d = evaluateWatch(watch({ thresholdCents: 50_000 }), 50_100, NOW);
  assert.equal(d.notify, false);
});

test("a threshold overrides the generic drop rule", () => {
  // The user asked to be told at a number, not whenever it moves.
  const d = evaluateWatch(
    watch({ thresholdCents: 40_000, lastNotifiedCents: 60_000 }),
    55_000,
    NOW
  );
  assert.equal(d.notify, false);
  assert.match(d.reason, /above your target/);
});

test("a threshold crossing is not suppressed by the generic five-dollar rule", () => {
  const d = evaluateWatch(watch({ thresholdCents: 50_000, baselineCents: 50_200 }), 49_900, NOW);
  assert.equal(d.notify, true);
  assert.equal(d.kind, "price-drop");
});

test("does not repeatedly report the same target price", () => {
  const d = evaluateWatch(
    watch({
      thresholdCents: 50_000,
      lastNotifiedCents: 49_900,
      lastNotifiedAt: new Date("2026-08-19T12:00:00Z"),
    }),
    49_900,
    NOW
  );
  assert.equal(d.notify, false);
});

test("beating a booked rate is its own kind of alert", () => {
  const d = evaluateWatch(watch({ bookedNightlyCents: 70_000 }), 62_000, NOW);
  assert.equal(d.notify, true);
  assert.equal(d.kind, "beats-booking");
});

test("does not claim to beat a booking it does not beat", () => {
  const d = evaluateWatch(watch({ bookedNightlyCents: 70_000 }), 70_000, NOW);
  assert.equal(d.notify, false);
});

test("alerts on a new low below the last one we sent", () => {
  const d = evaluateWatch(
    watch({ lastNotifiedCents: 60_000, lastNotifiedAt: new Date("2026-08-19T12:00:00Z") }),
    54_000,
    NOW
  );
  assert.equal(d.notify, true);
  assert.equal(d.kind, "new-low");
});

test("alerts on a meaningful drop below the silent first-observation baseline", () => {
  const d = evaluateWatch(watch({ baselineCents: 60_000 }), 54_000, NOW);
  assert.equal(d.notify, true);
  assert.equal(d.kind, "new-low");
});

test("ignores a trivially small improvement", () => {
  // Five dollars off a room is noise. Nobody re-books for it, and an email
  // about it costs more trust than it earns.
  const d = evaluateWatch(
    watch({ lastNotifiedCents: 60_000, lastNotifiedAt: new Date("2026-08-19T12:00:00Z") }),
    59_800,
    NOW
  );
  assert.equal(d.notify, false);
  assert.match(d.reason, /not meaningfully below/);
});

test("respects the cooldown even for a genuine new low", () => {
  const d = evaluateWatch(
    watch({
      lastNotifiedCents: 60_000,
      lastNotifiedAt: new Date(NOW.getTime() - 2 * 3_600_000),
    }),
    40_000,
    NOW
  );
  assert.equal(d.notify, false);
  assert.match(d.reason, /cooling down/);
});

test("alerts once the cooldown has elapsed", () => {
  const d = evaluateWatch(
    watch({
      lastNotifiedCents: 60_000,
      lastNotifiedAt: new Date(NOW.getTime() - (COOLDOWN_HOURS + 1) * 3_600_000),
    }),
    40_000,
    NOW
  );
  assert.equal(d.notify, true);
});

test("never alerts on an incomplete price", () => {
  const d = evaluateWatch(watch({ thresholdCents: 99_999_99 }), null, NOW);
  assert.equal(d.notify, false);
  assert.match(d.reason, /no complete price/);
});

test("a repeated identical price is never re-sent", () => {
  const d = evaluateWatch(
    watch({ lastNotifiedCents: 55_000, lastNotifiedAt: new Date("2026-08-01T00:00:00Z") }),
    55_000,
    NOW
  );
  assert.equal(d.notify, false);
});

/* ---------- totalForStay ---------- */

test("sums every night of the stay", () => {
  const nightly = new Map([
    ["2026-11-01", 20_000],
    ["2026-11-02", 21_000],
    ["2026-11-03", 19_000],
  ]);
  assert.equal(totalForStay(nightly, ["2026-11-01", "2026-11-02", "2026-11-03"]), 60_000);
});

test("refuses to total a stay with a missing night", () => {
  // Extrapolating across the gap would invent a price, and an alert built on an
  // invented price is worse than no alert at all.
  const nightly = new Map([
    ["2026-11-01", 20_000],
    ["2026-11-03", 19_000],
  ]);
  assert.equal(totalForStay(nightly, ["2026-11-01", "2026-11-02", "2026-11-03"]), null);
});

test("an empty stay has no total", () => {
  assert.equal(totalForStay(new Map(), []), null);
});
