import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldLoadAdSense } from "./adsense.js";

test("AdSense loads on editorial guides, home, and full calendar pages", () => {
  for (const path of [
    "/",
    "/guides",
    "/guides/universal-orlando-hotels-compared",
    "/hotels",
    "/hotels/cabana-bay",
    "/tickets",
    "/express-pass",
    "/waits",
    "/crowd-calendar",
    "/about",
  ]) {
    assert.equal(shouldLoadAdSense(path), true, path);
  }
});

test("AdSense stays off private, legal, contact, calculator, and thin ride detail pages", () => {
  for (const path of [
    "/account",
    "/admin",
    "/admin/status",
    "/auth/error",
    "/contact",
    "/join",
    "/plan",
    "/planner",
    "/privacy",
    "/terms",
    "/waits/epic-universe-curse-of-the-werewolf",
  ]) {
    assert.equal(shouldLoadAdSense(path), false, path);
  }
});
