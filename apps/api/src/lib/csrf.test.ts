import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Hono } from "hono";
import { csrfProtection } from "./csrf.js";

function makeApp() {
  const app = new Hono();
  app.use("*", csrfProtection(["https://ratecoaster.net", "https://www.ratecoaster.net"]));
  app.get("/item", (c) => c.json({ ok: true }));
  app.post("/item", (c) => c.json({ ok: true }));
  app.delete("/item", (c) => c.json({ ok: true }));
  return app;
}

describe("csrfProtection", () => {
  test("blocks cookie-authenticated mutations from untrusted origins", async () => {
    const app = makeApp();
    const res = await app.request("/item", {
      method: "POST",
      headers: {
        cookie: "rc_session=abc123",
        origin: "https://evil.example",
      },
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "csrf_rejected");
  });

  test("blocks cookie-authenticated mutations with no origin, sec-fetch-site, or referer", async () => {
    const app = makeApp();
    const res = await app.request("/item", {
      method: "DELETE",
      headers: { cookie: "rc_session=abc123" },
    });
    assert.equal(res.status, 403);
  });

  test("allows cookie-authenticated mutations from allowed origins", async () => {
    const app = makeApp();
    const res = await app.request("/item", {
      method: "POST",
      headers: {
        cookie: "rc_session=abc123",
        origin: "https://ratecoaster.net",
      },
    });
    assert.equal(res.status, 200);
  });

  test("allows Bearer-authenticated native mutations regardless of Origin", async () => {
    const app = makeApp();
    const res = await app.request("/item", {
      method: "POST",
      headers: {
        authorization: "Bearer native-token",
        cookie: "rc_session=ignored",
      },
    });
    assert.equal(res.status, 200);
  });

  test("allows safe GET requests and unauthenticated POST requests", async () => {
    const app = makeApp();
    assert.equal((await app.request("/item", { headers: { cookie: "rc_session=abc" } })).status, 200);
    assert.equal((await app.request("/item", { method: "POST" })).status, 200);
  });
});
