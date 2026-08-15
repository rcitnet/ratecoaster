import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import {
  adminAudit,
  collectorRuns,
  properties,
  rateCurrent,
  ticketProducts,
  users,
  waitCurrent,
} from "@ratecoaster/db/schema";
import { Tier } from "@ratecoaster/shared";
import { audit, redactConfig } from "../lib/admin.js";
import {
  getAllCollectorSettings,
  listEndpointConfigs,
  loadEndpointConfigFromDb,
  recordEndpointTest,
  resolveEndpointConfig,
  saveEndpointConfig,
  setCollectorSetting,
} from "../lib/settings.js";
import { COLLECTORS } from "../jobs/registry.js";
import { runCollector } from "../collectors/framework/runner.js";
import { queryOffers } from "../collectors/hotels/index.js";
import { addDays, todayInTimezone } from "../collectors/framework/dates.js";
import { guessConfigFromHar } from "../collectors/hotels/har-guess.js";

export const adminRouter = new Hono();

/* ------------------------------------------------------------------ *
 * Overview
 * ------------------------------------------------------------------ */

adminRouter.get("/overview", async (c) => {
  const db = getDb();

  const [rateRows] = await db.select({ n: sql<number>`count(*)::int` }).from(rateCurrent);
  const [waitRows] = await db.select({ n: sql<number>`count(*)::int` }).from(waitCurrent);
  const [userRows] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  const [propRows] = await db.select({ n: sql<number>`count(*)::int` }).from(properties);

  const recentRuns = await db
    .select()
    .from(collectorRuns)
    .orderBy(desc(collectorRuns.startedAt))
    .limit(20);

  const settings = await getAllCollectorSettings();

  // A run that finished without error but parsed nothing is the failure mode
  // that hides: no exception, no alert, just a site quietly going stale.
  const silentFailures = recentRuns.filter(
    (r) => r.status === "partial" || (r.status === "ok" && r.parsedCount === 0)
  ).length;

  return c.json({
    counts: {
      rates: rateRows?.n ?? 0,
      waits: waitRows?.n ?? 0,
      users: userRows?.n ?? 0,
      properties: propRows?.n ?? 0,
    },
    silentFailures,
    liveCollectors: COLLECTORS.filter((x) => settings.get(x.name)?.dryRun === false).length,
    recentRuns: recentRuns.map((r) => ({
      collector: r.collector,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      parsedCount: r.parsedCount,
      writtenCount: r.writtenCount,
      errorCount: r.errorCount,
      notes: r.notes,
    })),
  });
});

/* ------------------------------------------------------------------ *
 * Collectors
 * ------------------------------------------------------------------ */

adminRouter.get("/collectors", async (c) => {
  const db = getDb();
  const settings = await getAllCollectorSettings();

  const runs = await db
    .select()
    .from(collectorRuns)
    .orderBy(desc(collectorRuns.startedAt))
    .limit(60);

  const latest = new Map<string, (typeof runs)[number]>();
  for (const r of runs) if (!latest.has(r.collector)) latest.set(r.collector, r);

  return c.json(
    await Promise.all(
      COLLECTORS.map(async (collector) => {
        const setting = settings.get(collector.name) ?? {
          collector: collector.name,
          enabled: true,
          dryRun: true,
          intervalMinutes: null,
        };
        const run = latest.get(collector.name);
        const ready = await collector
          .isConfigured({ db, stats: { requestCount: 0, parsedCount: 0, writtenCount: 0, errorCount: 0, notes: {} }, logger: console as never })
          .catch(() => ({ ready: false, reason: "check failed" }));

        return {
          name: collector.name,
          description: collector.description,
          intervalMinutes: setting.intervalMinutes ?? collector.intervalMinutes,
          enabled: setting.enabled,
          dryRun: setting.dryRun,
          ready: ready.ready,
          notReadyReason: ready.ready ? null : ready.reason ?? null,
          lastRun: run
            ? {
                status: run.status,
                startedAt: run.startedAt.toISOString(),
                parsedCount: run.parsedCount,
                writtenCount: run.writtenCount,
                errorCount: run.errorCount,
                ageMinutes: Math.round((Date.now() - run.startedAt.getTime()) / 60_000),
              }
            : null,
        };
      })
    )
  );
});

const CollectorPatch = z.object({
  enabled: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  intervalMinutes: z.number().int().positive().nullable().optional(),
});

adminRouter.patch("/collectors/:name", async (c) => {
  const name = c.req.param("name");
  if (!COLLECTORS.some((x) => x.name === name)) {
    return c.json({ error: { code: "not_found", message: "unknown collector" } }, 404);
  }

  const parsed = CollectorPatch.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: { code: "invalid", message: "bad payload" } }, 400);
  }

  const user = c.get("user");
  await setCollectorSetting(name, parsed.data, user?.userId);
  await audit(c, "collector.update", name, parsed.data);

  return c.json({ ok: true });
});

/**
 * Triggers a run without blocking the request.
 *
 * A full hotel pass takes hours. Holding an HTTP connection open for that would
 * time out at the proxy and leave the operator with no idea whether it worked.
 * The run reports itself through collector_runs, which the UI already polls.
 */
adminRouter.post("/collectors/:name/run", async (c) => {
  const name = c.req.param("name");
  const collector = COLLECTORS.find((x) => x.name === name);
  if (!collector) {
    return c.json({ error: { code: "not_found", message: "unknown collector" } }, 404);
  }

  await audit(c, "collector.run", name);

  void runCollector(collector).catch((err) => {
    console.error(`[admin] triggered run of ${name} failed:`, err);
  });

  return c.json({ ok: true, message: `${name} started — watch the last-run column.` });
});

/* ------------------------------------------------------------------ *
 * Endpoint configs
 * ------------------------------------------------------------------ */

adminRouter.get("/endpoints", async (c) => {
  const stored = await listEndpointConfigs();

  // Which adapters does the seed data actually reference? Surfacing this stops
  // you configuring an adapter name that nothing will ever look up.
  const db = getDb();
  const props = await db.select({ cfg: properties.collectorConfig }).from(properties);
  const tix = await db.select({ cfg: ticketProducts.collectorConfig }).from(ticketProducts);

  const needed = new Set<string>();
  for (const row of [...props, ...tix]) {
    const adapter = (row.cfg as Record<string, unknown> | null)?.adapter;
    if (typeof adapter === "string") needed.add(adapter);
  }

  const byName = new Map(stored.map((s) => [s.name, s]));

  return c.json(
    [...needed].sort().map((name) => {
      const s = byName.get(name);
      return {
        name,
        configured: Boolean(s),
        notes: s?.notes ?? null,
        lastTestedAt: s?.lastTestedAt?.toISOString() ?? null,
        lastTestOk: s?.lastTestOk ?? null,
        lastTestMessage: s?.lastTestMessage ?? null,
        updatedAt: s?.updatedAt?.toISOString() ?? null,
      };
    })
  );
});

adminRouter.get("/endpoints/:name", async (c) => {
  const name = c.req.param("name");
  const config = await loadEndpointConfigFromDb(name);
  if (!config) return c.json({ error: { code: "not_found", message: "not configured" } }, 404);
  return c.json({ name, config: redactConfig(config as unknown as Record<string, unknown>) });
});

/**
 * Takes a raw HAR and returns a suggested config, without saving anything.
 *
 * Separating "guess" from "save" is what makes this usable: you see what it
 * inferred and the sample row it inferred it from, and decide.
 */
adminRouter.post("/endpoints/:name/guess", async (c) => {
  const name = c.req.param("name");
  const body = await c.req.text();

  if (body.length > 40_000_000) {
    return c.json({ error: { code: "too_large", message: "HAR is over 40MB" } }, 413);
  }

  try {
    const result = guessConfigFromHar(body, name);
    await audit(c, "endpoint.guess", name, { candidates: result.candidateCount });
    return c.json(result);
  } catch (err) {
    return c.json(
      { error: { code: "bad_har", message: err instanceof Error ? err.message : String(err) } },
      400
    );
  }
});

adminRouter.put("/endpoints/:name", async (c) => {
  const name = c.req.param("name");
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: { code: "invalid", message: "expected JSON" } }, 400);

  try {
    const saved = await saveEndpointConfig(
      name,
      body.config ?? body,
      c.get("user")?.userId,
      body.notes
    );
    await audit(c, "endpoint.save", name, { roomsPath: saved.response.roomsPath });
    return c.json({ ok: true });
  } catch (err) {
    return c.json(
      { error: { code: "invalid_config", message: err instanceof Error ? err.message : String(err) } },
      400
    );
  }
});

/**
 * Sends exactly ONE request through a config and reports what was parsed.
 *
 * Always sends, regardless of the collector's dry-run setting — that is the
 * point of a test. Nothing is written to the price tables.
 */
adminRouter.post("/endpoints/:name/test", async (c) => {
  const name = c.req.param("name");
  const body = await c.req.json().catch(() => ({}));
  const hotelCode = String(body.hotelCode ?? "");
  const rateCode = String(body.rateCode ?? "APH");

  const config = await resolveEndpointConfig(name);
  if (!config) {
    return c.json({ error: { code: "not_found", message: "not configured" } }, 404);
  }

  const checkIn = addDays(todayInTimezone("America/New_York"), 45);
  const previous = process.env.COLLECTOR_DRY_RUN;
  process.env.COLLECTOR_DRY_RUN = "0";

  try {
    const result = await queryOffers(config, {
      hotelCode,
      checkIn,
      checkOut: addDays(checkIn, 1),
      nights: 1,
      adults: 2,
      children: 0,
      rateCode: rateCode === "STANDARD" ? "" : rateCode,
      currency: "USD",
    });

    if (result === null) {
      await recordEndpointTest(name, false, "request was skipped");
      return c.json({ ok: false, message: "Request was skipped unexpectedly." });
    }

    const ok = result.offers.length > 0 && result.rateCodeApplied;
    const message = !result.rateCodeApplied
      ? `Parsed ${result.offers.length} offers, but the ${rateCode} rate code was NOT applied — these would be discarded.`
      : result.offers.length === 0
        ? "Connected, but parsed 0 offers. Check roomsPath."
        : `Parsed ${result.offers.length} offers.`;

    await recordEndpointTest(name, ok, message);
    await audit(c, "endpoint.test", name, { ok, offers: result.offers.length });

    return c.json({
      ok,
      message,
      rateCodeApplied: result.rateCodeApplied,
      checkIn,
      offers: result.offers.slice(0, 25),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordEndpointTest(name, false, message);
    return c.json({ ok: false, message });
  } finally {
    if (previous === undefined) delete process.env.COLLECTOR_DRY_RUN;
    else process.env.COLLECTOR_DRY_RUN = previous;
  }
});

/* ------------------------------------------------------------------ *
 * Properties
 * ------------------------------------------------------------------ */

adminRouter.get("/properties", async (c) => {
  const rows = await getDb().select().from(properties).orderBy(properties.destination, properties.name);
  return c.json(
    rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      destination: p.destination,
      tier: p.tier,
      operator: p.operator,
      includesExpressPass: p.includesExpressPass,
      earlyParkAdmission: p.earlyParkAdmission,
      roomCount: p.roomCount,
      active: p.active,
      collectorConfig: p.collectorConfig,
    }))
  );
});

const PropertyPatch = z.object({
  includesExpressPass: z.boolean().optional(),
  earlyParkAdmission: z.boolean().optional(),
  active: z.boolean().optional(),
  hotelCode: z.string().nullable().optional(),
  adapter: z.string().nullable().optional(),
});

adminRouter.patch("/properties/:id", async (c) => {
  const id = c.req.param("id");
  const parsed = PropertyPatch.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: { code: "invalid", message: "bad payload" } }, 400);

  const db = getDb();
  const [existing] = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
  if (!existing) return c.json({ error: { code: "not_found", message: "no such property" } }, 404);

  const cfg = { ...((existing.collectorConfig ?? {}) as Record<string, unknown>) };
  if (parsed.data.hotelCode !== undefined) cfg.hotelCode = parsed.data.hotelCode;
  if (parsed.data.adapter !== undefined) cfg.adapter = parsed.data.adapter;

  await db
    .update(properties)
    .set({
      ...(parsed.data.includesExpressPass !== undefined
        ? { includesExpressPass: parsed.data.includesExpressPass }
        : {}),
      ...(parsed.data.earlyParkAdmission !== undefined
        ? { earlyParkAdmission: parsed.data.earlyParkAdmission }
        : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      collectorConfig: cfg,
    })
    .where(eq(properties.id, id));

  await audit(c, "property.update", existing.slug, parsed.data);
  return c.json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * Users
 * ------------------------------------------------------------------ */

adminRouter.get("/users", async (c) => {
  const rows = await getDb()
    .select({
      id: users.id,
      email: users.email,
      tier: users.tier,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(200);

  return c.json(
    rows.map((u) => ({
      id: u.id,
      email: u.email,
      tier: u.tier,
      createdAt: u.createdAt.toISOString(),
      lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
    }))
  );
});

adminRouter.patch("/users/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const tier = Tier.safeParse(body.tier);
  if (!tier.success) return c.json({ error: { code: "invalid", message: "bad tier" } }, 400);

  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!existing) return c.json({ error: { code: "not_found", message: "no such user" } }, 404);

  // Removing your own admin access locks you out of this panel with no way
  // back except the CLI. Refuse rather than let it happen by mis-click.
  const me = c.get("user");
  if (me?.userId === id && tier.data !== "admin") {
    return c.json(
      {
        error: {
          code: "self_demote",
          message: "You can't remove your own admin access here. Use the admin:grant CLI.",
        },
      },
      400
    );
  }

  await db.update(users).set({ tier: tier.data }).where(eq(users.id, id));
  await audit(c, "user.tier", existing.email ?? id, { from: existing.tier, to: tier.data });
  return c.json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * Audit log
 * ------------------------------------------------------------------ */

adminRouter.get("/audit", async (c) => {
  const rows = await getDb()
    .select()
    .from(adminAudit)
    .orderBy(desc(adminAudit.at))
    .limit(100);

  return c.json(
    rows.map((r) => ({
      at: r.at.toISOString(),
      email: r.email,
      action: r.action,
      target: r.target,
      detail: r.detail,
    }))
  );
});
