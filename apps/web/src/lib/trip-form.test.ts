import assert from "node:assert/strict";
import { test } from "node:test";
import { addIsoDays, checkoutAfterCheckIn } from "./trip-form.js";

test("moves check-out seven nights ahead when check-in passes it", () => {
  assert.equal(checkoutAfterCheckIn("2026-10-20", "2026-10-12"), "2026-10-27");
});

test("moves check-out when it matches the new check-in", () => {
  assert.equal(checkoutAfterCheckIn("2026-12-28", "2026-12-28"), "2027-01-04");
});

test("preserves a check-out that is still after check-in", () => {
  assert.equal(checkoutAfterCheckIn("2026-10-20", "2026-10-29"), "2026-10-29");
});

test("date arithmetic crosses month and year boundaries", () => {
  assert.equal(addIsoDays("2026-12-29", 7), "2027-01-05");
});
