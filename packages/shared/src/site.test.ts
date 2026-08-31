import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_HOMEPAGE_SETTINGS,
  HERO_VARIANT_OPTIONS,
  HomepageSettings,
} from "./schemas/site.js";

test("every advertised homepage layout is accepted by the public settings contract", () => {
  assert.equal(HERO_VARIANT_OPTIONS.length, 8);
  assert.equal(new Set(HERO_VARIANT_OPTIONS.map((option) => option.id)).size, 8);

  for (const option of HERO_VARIANT_OPTIONS) {
    assert.deepEqual(HomepageSettings.parse({ heroVariant: option.id }), {
      heroVariant: option.id,
    });
  }
});

test("the homepage settings contract rejects unknown stored layouts", () => {
  assert.equal(HomepageSettings.safeParse({ heroVariant: "surprise-me" }).success, false);
  assert.deepEqual(DEFAULT_HOMEPAGE_SETTINGS, { heroVariant: "current" });
});
