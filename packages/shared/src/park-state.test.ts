import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveParkState, parkStateMessage } from "./park-state.js";

test("a park with rides posting waits is open", () => {
  const state = deriveParkState([
    { status: "operating", waitMinutes: 35 },
    { status: "operating", waitMinutes: null },
    { status: "closed", waitMinutes: null },
  ]);
  assert.equal(state, "open");
  assert.match(parkStateMessage(state, 1, 0), /1 rides reporting/);
});

test("a park with nothing operating is closed", () => {
  // The 10pm case: every ride reports closed with a null wait.
  const state = deriveParkState([
    { status: "closed", waitMinutes: null },
    { status: "closed", waitMinutes: null },
  ]);
  assert.equal(state, "closed");
  assert.match(parkStateMessage(state, 0, 0), /Closed right now/);
});

test("shows and meets operating without queues is not closed", () => {
  /*
   * This is the case that made the old message wrong in both directions:
   * calling it closed would be a lie, and calling it "no attractions
   * reporting" made an open park look broken.
   */
  const state = deriveParkState([
    { status: "operating", waitMinutes: null },
    { status: "operating", waitMinutes: null },
    { status: "closed", waitMinutes: null },
  ]);
  assert.equal(state, "no-standby");
  assert.match(parkStateMessage(state, 0, 0), /only shows and character meets/);
});

test("an empty park report is not the same as a closed park", () => {
  const state = deriveParkState([]);
  assert.equal(state, "no-data");
  assert.match(parkStateMessage(state, 0, 0), /No report/);
});

test("one ride posting a wait beats any number of silent ones", () => {
  // Guards against a future 'majority' rule: a single real number is still
  // a real number, and hiding it would be worse than showing it.
  const waits = Array.from({ length: 40 }, () => ({
    status: "operating",
    waitMinutes: null as number | null,
  }));
  waits.push({ status: "operating", waitMinutes: 5 });
  assert.equal(deriveParkState(waits), "open");
});

test("a zero-minute wait is a real wait, not a missing one", () => {
  // A walk-on ride posts 0. Treating that as absent would drop the emptiest
  // rides from the average, which is exactly backwards.
  assert.equal(deriveParkState([{ status: "operating", waitMinutes: 0 }]), "open");
});

test("down and refurbishment do not count as operating", () => {
  assert.equal(
    deriveParkState([
      { status: "down", waitMinutes: null },
      { status: "refurbishment", waitMinutes: null },
    ]),
    "closed"
  );
});
