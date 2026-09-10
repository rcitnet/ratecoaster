import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { renderSocialImage } from "./image.js";

test("social card is a square JPEG within Instagram's size limit and escapes XML", async () => {
  const jpeg = await renderSocialImage({
    kind: "shortest-waits",
    body: '🎢 Islands of Adventure shortest now:\n• Hagrid\'s <ride> & friends: 10m\n• Jurassic Park: 15m\n• Spider-Man: 20m\n1:05 PM EDT • Data: ThemeParks.wiki + Queue-Times.com',
    url: "https://ratecoaster.net/waits?park=islands-of-adventure",
  });
  const meta = await sharp(jpeg).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 1080);
  assert.equal(meta.height, 1080);
  assert.ok(jpeg.length < 8 * 1024 * 1024);
});

test("cards fail rather than silently truncating source facts", async () => {
  await assert.rejects(renderSocialImage({ kind: "hotel-deal", body: "line\n".repeat(20), url: null }), /does not fit/);
});
