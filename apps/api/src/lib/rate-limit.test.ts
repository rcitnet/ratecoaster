import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Hono } from "hono";
import {
  MemoryRateLimitStore,
  opaqueRateLimitKey,
  rateLimitByIp,
} from "./rate-limit.js";

describe("MemoryRateLimitStore", () => {
  test("blocks after the limit and opens a fresh window after reset", () => {
    const store = new MemoryRateLimitStore();
    const start = Date.UTC(2026, 8, 2, 12);

    assert.equal(store.take("visitor", 2, 60_000, start).allowed, true);
    assert.equal(store.take("visitor", 2, 60_000, start + 1).allowed, true);
    const blocked = store.take("visitor", 2, 60_000, start + 2);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.equal(blocked.retryAfterSeconds, 60);
    assert.equal(store.take("visitor", 2, 60_000, start + 60_000).allowed, true);
  });

  test("hashes normalized identifiers instead of retaining personal data", () => {
    const lower = opaqueRateLimitKey("magic-email", " Traveler@Example.com ");
    assert.equal(lower, opaqueRateLimitKey("magic-email", "traveler@example.com"));
    assert.doesNotMatch(lower, /traveler|example/i);
  });
});

test("IP middleware trusts Caddy's final forwarded address and returns 429 headers", async () => {
  const app = new Hono();
  const store = new MemoryRateLimitStore();
  app.use("*", rateLimitByIp({ namespace: "test", limit: 2, windowMs: 60_000, store }));
  app.get("/", (c) => c.json({ ok: true }));

  const request = () => app.request("/", { headers: { "x-forwarded-for": "198.51.100.7" } });
  assert.equal((await request()).status, 200);
  assert.equal((await request()).status, 200);
  const blocked = await request();
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("RateLimit-Remaining"), "0");
  assert.ok(Number(blocked.headers.get("Retry-After")) >= 1);
  const body = await blocked.json() as { error: { code: string } };
  assert.equal(body.error.code, "rate_limited");
});
