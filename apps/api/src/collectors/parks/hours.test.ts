import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSchedule } from "./hours.js";

test("park schedule parsing preserves offset-aware instants and removes duplicate rows", () => {
  const rows = parseSchedule({
    id: "park",
    schedule: [
      {
        date: "2026-11-08",
        type: "OPERATING",
        openingTime: "2026-11-08T09:00:00-05:00",
        closingTime: "2026-11-08T21:00:00-05:00",
      },
      {
        date: "2026-11-08",
        type: "OPERATING",
        openingTime: "2026-11-08T09:00:00-05:00",
        closingTime: "2026-11-08T21:00:00-05:00",
      },
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.opensAt?.toISOString(), "2026-11-08T14:00:00.000Z");
  assert.equal(rows[0]?.closesAt?.toISOString(), "2026-11-09T02:00:00.000Z");
});

test("park schedule parsing refuses malformed timestamps", () => {
  assert.deepEqual(
    parseSchedule({
      id: "park",
      schedule: [{ date: "2026-11-08", type: "OPERATING", openingTime: "not-a-date" }],
    }),
    []
  );
});
