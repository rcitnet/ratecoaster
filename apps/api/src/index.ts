import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { desc } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { collectorRuns } from "@ratecoaster/db/schema";
import { dealsRouter, propertiesRouter, ratesRouter } from "./routes/rates.js";
import { expressRouter, ticketsRouter } from "./routes/tickets.js";
import { waitsRouter } from "./routes/waits.js";
import { flightsRouter } from "./routes/flights.js";
import { plannerRouter } from "./routes/planner.js";
import { tripsRouter } from "./routes/trips.js";
import { COLLECTORS } from "./jobs/registry.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    // Explicit origin list rather than `*`, because the watch endpoints are
    // authenticated and will send credentials.
    origin: (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(","),
    credentials: true,
  })
);

const DEMO = process.env.DEMO_MODE === "1";

app.get("/health", (c) => c.json({ ok: true, service: "ratecoaster-api", demo: DEMO }));

/*
 * Auth runs before every route, including public ones. "anonymous" is a tier
 * with real entitlements, not the absence of a user, so routes never have to
 * branch on whether someone is signed in — they ask what the tier permits.
 *
 * In demo mode a lightweight cookie stands in for a real session so the gating
 * is demonstrable without Postgres.
 */
if (DEMO) {
  const { demoAuthMiddleware } = await import("./demo.js");
  app.use("*", demoAuthMiddleware);
} else {
  const { authMiddleware } = await import("./lib/auth.js");
  app.use("*", authMiddleware);
}

/*
 * Demo routes are registered FIRST so they shadow the database-backed ones.
 * This lets the whole UI be explored — with real live wait times — before
 * Postgres exists or any booking endpoint has been captured.
 */
if (DEMO) {
  const { demoApp } = await import("./demo.js");
  app.route("/", demoApp);
  console.log("DEMO MODE: wait times are real; hotel/ticket/Express prices are sample data.");
}

/**
 * GET /v1/status
 *
 * Operational truth for the whole pipeline: which collectors exist, which are
 * configured, and when each last produced data.
 *
 * This is public on purpose. A price tracker's core promise is freshness, and
 * "last updated 4 minutes ago" next to a rate is worth more to a user than any
 * amount of design polish. It is also the fastest way for you to notice that a
 * parser broke.
 */
app.get("/v1/status", async (c) => {
  const db = getDb();
  const runs = await db
    .select()
    .from(collectorRuns)
    .orderBy(desc(collectorRuns.startedAt))
    .limit(50);

  const latest = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!latest.has(run.collector)) latest.set(run.collector, run);
  }

  return c.json({
    collectors: COLLECTORS.map((collector) => {
      const run = latest.get(collector.name);
      return {
        name: collector.name,
        description: collector.description,
        intervalMinutes: collector.intervalMinutes,
        lastRun: run
          ? {
              status: run.status,
              startedAt: run.startedAt.toISOString(),
              finishedAt: run.finishedAt?.toISOString() ?? null,
              parsedCount: run.parsedCount,
              writtenCount: run.writtenCount,
              errorCount: run.errorCount,
              ageMinutes: Math.round((Date.now() - run.startedAt.getTime()) / 60_000),
              // Stale means "should have run by now and did not".
              stale:
                (Date.now() - run.startedAt.getTime()) / 60_000 > collector.intervalMinutes * 2,
            }
          : null,
      };
    }),
  });
});

if (!DEMO) {
  const { authRouter } = await import("./routes/auth.js");
  app.route("/v1/auth", authRouter);

  // Admin is gated by requireAdmin, which 404s for everyone else so the routes
  // are indistinguishable from a typo to anyone probing the public domain.
  const { adminRouter } = await import("./routes/admin.js");
  const { requireAdmin } = await import("./lib/admin.js");
  app.use("/v1/admin/*", requireAdmin);
  app.route("/v1/admin", adminRouter);
}

app.route("/v1/properties", propertiesRouter);
app.route("/v1/rates", ratesRouter);
app.route("/v1/deals", dealsRouter);
app.route("/v1/tickets", ticketsRouter);
app.route("/v1/express-pass", expressRouter);
app.route("/v1/waits", waitsRouter);
app.route("/v1/trips", tripsRouter);
app.route("/v1/flights", flightsRouter);
app.route("/v1/planner", plannerRouter);

app.notFound((c) => c.json({ error: { code: "not_found", message: "no such route" } }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: { code: "internal", message: "unexpected error" } }, 500);
});

const port = Number(process.env.API_PORT ?? 8787);

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`ratecoaster-api listening on http://localhost:${info.port}`);
  });
}

export default app;
