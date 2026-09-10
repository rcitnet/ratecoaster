import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { publishToPlatform } from "./platforms.js";
import { socialImageUrl, socialPlatformConfigured } from "./settings.js";

const savedEnv = { ...process.env };
const originalFetch = globalThis.fetch;
let calls: Array<{ url: URL; init: RequestInit }>;
beforeEach(() => {
  calls = [];
  Object.assign(process.env, {
    FACEBOOK_PAGE_ID: "123", FACEBOOK_PAGE_ACCESS_TOKEN: "facebook-secret",
    INSTAGRAM_USER_ID: "456", INSTAGRAM_ACCESS_TOKEN: "instagram-secret",
    SOCIAL_PUBLIC_API_URL: "https://ratecoaster.net/api", META_GRAPH_API_VERSION: "v25.0",
  });
  delete process.env.FACEBOOK_TOKEN_EXPIRES_AT;
  delete process.env.INSTAGRAM_TOKEN_EXPIRES_AT;
});
afterEach(() => { process.env = { ...savedEnv }; globalThis.fetch = originalFetch; });

function responses(items: Array<Record<string, unknown> | Error>) {
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: new URL(String(input)), init });
    const item = items.shift();
    assert.ok(item, "Unexpected extra network request");
    if (item instanceof Error) throw item;
    return Response.json(item, { status: item.error ? 400 : 200 });
  };
}

test("Facebook publishes the saved text and link using a Page token outside the URL", async () => {
  responses([{ id: "123_789" }]);
  const result = await publishToPlatform("facebook", "Current waits\nhttps://ratecoaster.net/waits", "https://ratecoaster.net/waits");
  assert.equal(result.externalUrl, "https://www.facebook.com/123_789");
  assert.equal(calls[0]!.url.href, "https://graph.facebook.com/v25.0/123/feed");
  assert.equal(calls[0]!.init.method, "POST");
  assert.equal(new Headers(calls[0]!.init.headers).get("authorization"), "Bearer facebook-secret");
  const body = calls[0]!.init.body as URLSearchParams;
  assert.equal(body.get("link"), "https://ratecoaster.net/waits");
  assert.match(body.get("message")!, /Current waits/);
});

test("Instagram creates a JPEG container, verifies readiness, then publishes once", async () => {
  responses([{ id: "111" }, { status_code: "FINISHED" }, { id: "222" }, { permalink: "https://www.instagram.com/p/abc/" }]);
  const imageUrl = socialImageUrl("example");
  const result = await publishToPlatform("instagram", "Saved caption", "https://ratecoaster.net", imageUrl);
  assert.equal(result.externalUrl, "https://www.instagram.com/p/abc/");
  assert.deepEqual(calls.map((call) => call.url.pathname), ["/v25.0/456/media", "/v25.0/111", "/v25.0/456/media_publish", "/v25.0/222"]);
  assert.equal((calls[0]!.init.body as URLSearchParams).get("image_url"), imageUrl);
  assert.equal((calls[0]!.init.body as URLSearchParams).get("caption"), "Saved caption");
  assert.equal((calls[2]!.init.body as URLSearchParams).get("creation_id"), "111");
  assert.ok(calls.every((call) => !call.url.href.includes("secret")));
});

test("Instagram never publishes an errored container", async () => {
  responses([{ id: "111" }, { status_code: "ERROR" }]);
  await assert.rejects(publishToPlatform("instagram", "Caption", "https://ratecoaster.net", socialImageUrl("example")), /not publishable/);
  assert.equal(calls.length, 2);
});

test("Instagram timeout is surfaced without retrying an ambiguous publish", async () => {
  responses([{ id: "111" }, { status_code: "FINISHED" }, new Error("Timed out")]);
  await assert.rejects(publishToPlatform("instagram", "Caption", "https://ratecoaster.net", socialImageUrl("example")), /Timed out/);
  assert.equal(calls.length, 3);
});

test("permalink lookup failure does not make a published Instagram post retryable", async () => {
  responses([{ id: "111" }, { status_code: "FINISHED" }, { id: "222" }, new Error("Unavailable")]);
  assert.deepEqual(await publishToPlatform("instagram", "Caption", "https://ratecoaster.net", socialImageUrl("example")), { externalPostId: "222", externalUrl: null });
});

test("Meta errors expose actionable codes without echoing tokens", async () => {
  responses([{ error: { code: 190, message: "Invalid facebook-secret" } }]);
  await assert.rejects(publishToPlatform("facebook", "Text", "https://ratecoaster.net"), (error: Error) => {
    assert.match(error.message, /code 190/);
    assert.doesNotMatch(error.message, /facebook-secret/);
    return true;
  });
});

test("missing media and unsupported X automation fail before any request", async () => {
  responses([]);
  await assert.rejects(publishToPlatform("instagram", "Caption", "https://ratecoaster.net"), /JPEG/);
  await assert.rejects(publishToPlatform("x" as never, "Text", "https://ratecoaster.net"), /Unsupported/);
  assert.equal(calls.length, 0);
});

test("Meta setup checks credentials, expiry, API version and the proxied media base", () => {
  assert.equal(socialPlatformConfigured("facebook"), true);
  assert.equal(socialPlatformConfigured("instagram"), true);
  assert.equal(socialImageUrl("abc"), "https://ratecoaster.net/api/v1/social/posts/abc/image.jpg");
  process.env.FACEBOOK_TOKEN_EXPIRES_AT = "2020-01-01";
  assert.equal(socialPlatformConfigured("facebook"), false);
  process.env.INSTAGRAM_TOKEN_EXPIRES_AT = "not-a-date";
  assert.equal(socialPlatformConfigured("instagram"), false);
  delete process.env.INSTAGRAM_TOKEN_EXPIRES_AT;
  process.env.SOCIAL_PUBLIC_API_URL = "http://localhost:8787";
  assert.equal(socialPlatformConfigured("instagram"), false);
  process.env.SOCIAL_PUBLIC_API_URL = "https://ratecoaster.net/api";
  process.env.INSTAGRAM_ACCESS_TOKEN = "";
  assert.equal(socialPlatformConfigured("instagram"), false);
  delete process.env.FACEBOOK_TOKEN_EXPIRES_AT;
  process.env.META_GRAPH_API_VERSION = "../other";
  assert.equal(socialPlatformConfigured("facebook"), false);
});
