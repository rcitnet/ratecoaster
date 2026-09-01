import assert from "node:assert/strict";
import { test } from "node:test";
import {
  shouldLoadTravelpayouts,
  TRAVELPAYOUTS_DRIVE_URL,
  travelpayoutsLoaderSource,
} from "./travelpayouts.js";

test("Travelpayouts Drive loads on public planning and price pages", () => {
  for (const path of ["/", "/guides", "/guides/hotel-rates", "/hotels", "/plan", "/waits"]) {
    assert.equal(shouldLoadTravelpayouts(path), true, path);
  }
});

test("Travelpayouts Drive stays off private and legal pages", () => {
  for (const path of [
    "/account",
    "/account/trips",
    "/admin",
    "/admin/homepage",
    "/auth/error",
    "/join",
    "/privacy",
    "/terms",
  ]) {
    assert.equal(shouldLoadTravelpayouts(path), false, path);
  }

  assert.equal(shouldLoadTravelpayouts("/administrator-guide"), true);
});

test("the inline loader uses the assigned project and CMP marker", () => {
  const source = travelpayoutsLoaderSource();
  assert.match(source, new RegExp(TRAVELPAYOUTS_DRIVE_URL.replace(/[.?]/g, "\\$&")));
  assert.match(source, /data-cmp-ab/);
  assert.match(source, /script\.async = true/);
});
