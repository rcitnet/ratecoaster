import assert from "node:assert/strict";
import { test } from "node:test";
import { ORIGINS } from "./schemas/flights.js";

test("flight origins are presented alphabetically by city label", () => {
  const labels = ORIGINS.map((origin) => origin.label);
  assert.deepEqual(labels, [...labels].sort((left, right) => left.localeCompare(right, "en")));
});
