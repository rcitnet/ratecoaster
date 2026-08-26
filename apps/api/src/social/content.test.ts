import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHotelDealPost, buildWaitPost, renderSocialText } from "./content.js";

const observedAt = new Date("2026-08-25T17:05:00Z");
const expiresAt = new Date("2026-08-25T17:55:00Z");

test("wait posts remain short enough for Bluesky and stable across cron retries", () => {
  const input = {
    parkName: "Universal Studios Florida With A Deliberately Long Name",
    parkSlug: "universal-studios-florida",
    waits: [
      { name: "Harry Potter and the Escape from Gringotts Extended Name", minutes: 10 },
      { name: "Jurassic Park River Adventure With Extra Words", minutes: 15 },
      { name: "The Amazing Adventures of Spider-Man Extended", minutes: 20 },
    ],
    observedAt,
    timezone: "America/New_York",
    dataSource: "ThemeParks.wiki + Queue-Times.com",
    hourKey: "2026-08-25T13",
    siteUrl: "https://www.ratecoaster.net",
    expiresAt,
  };
  const first = buildWaitPost(input);
  const second = buildWaitPost(input);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.ok(Array.from(renderSocialText(first)).length <= 300);
  assert.match(first.body, /ThemeParks\.wiki \+ Queue-Times\.com/);
  assert.match(first.url, /\?park=universal-studios-florida$/);
});

test("hotel deal posts label the rate and avoid unsupported savings claims", () => {
  const post = buildHotelDealPost({
    tierLabel: "Prime Value",
    propertyName: "Universal Endless Summer Resort — Dockside Inn and Suites",
    propertySlug: "endless-summer-dockside",
    stayDate: "2026-09-15",
    nightlyCents: 10_355,
    rateCode: "APH",
    rateLabel: "Annual Passholder rate",
    dateKey: "2026-08-25",
    siteUrl: "https://www.ratecoaster.net",
    observedAt,
    expiresAt,
  });
  assert.match(post.body, /\$103\.55\/night/);
  assert.match(post.body, /Annual Passholder rate/);
  assert.doesNotMatch(post.body, /save \$/i);
  assert.match(post.url, /rateCode=APH/);
  assert.ok(Array.from(renderSocialText(post)).length <= 300);
});
