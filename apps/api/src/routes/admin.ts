import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import {
  adminAudit,
  collectorRuns,
  outboundClicks,
  properties,
  rateCurrent,
  ticketProducts,
  users,
  waitCurrent,
} from "@ratecoaster/db/schema";
import { Tier } from "@ratecoaster/shared";
import { audit } from "../lib/admin.js";
import { getAllCollectorSettings, setCollectorSetting } from "../lib/settings.js";
import { COLLECTORS } from "../jobs/registry.js";
import { runCollector } from "../collectors/framework/runner.js";
import { universalOrlandoTicketCredentialsConfigured } from "../collectors/tickets/universal-orlando-commerce.js";
import { adminSocialRouter } from "./admin-social.js";

export const adminRouter = new Hono();

adminRouter.route("/social", adminSocialRouter);

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
 * Outbound clicks
 * ------------------------------------------------------------------ */

/**
 * Which of our pages actually produce affiliate clicks.
 *
 * The network reports revenue per creative, and every link deep-links through
 * one evergreen creative, so their dashboard can say what we earned but never
 * which page earned it. This half of the picture exists nowhere but here — no
 * third-party analytics tool can see it, because the click leaves for their
 * domain and the attribution dies at the boundary.
 *
 * Grouped by page AND merchant rather than page alone: the same row can offer
 * two merchants, and collapsing them would hide which one people choose, which
 * is the question that decides who to keep.
 */
adminRouter.get("/clicks", async (c) => {
  const requested = Number(c.req.query("days"));
  const days = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 365) : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const db = getDb();

  const clicks = sql<number>`count(*)::int`;
  const day = sql`date_trunc('day', ${outboundClicks.clickedAt})`;

  const [totals] = await db
    .select({
      clicks,
      pages: sql<number>`count(distinct ${outboundClicks.fromPath})::int`,
      merchants: sql<number>`count(distinct ${outboundClicks.merchant})::int`,
    })
    .from(outboundClicks)
    .where(gte(outboundClicks.clickedAt, since));

  const byPage = await db
    .select({
      fromPath: outboundClicks.fromPath,
      merchant: outboundClicks.merchant,
      clicks,
      lastClickedAt: sql<string>`to_char(max(${outboundClicks.clickedAt}) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
    })
    .from(outboundClicks)
    .where(gte(outboundClicks.clickedAt, since))
    .groupBy(outboundClicks.fromPath, outboundClicks.merchant)
    .orderBy(sql`count(*) desc`)
    .limit(100);

  const byDay = await db
    .select({ day: sql<string>`to_char(${day}, 'YYYY-MM-DD')`, clicks })
    .from(outboundClicks)
    .where(gte(outboundClicks.clickedAt, since))
    .groupBy(day)
    .orderBy(day);

  return c.json({
    days,
    totals: {
      clicks: totals?.clicks ?? 0,
      pages: totals?.pages ?? 0,
      merchants: totals?.merchants ?? 0,
    },
    // fromPath is nullable because a click can arrive without a referrer.
    // Labelling it here keeps the "unknown" case out of the page's markup.
    byPage: byPage.map((r) => ({ ...r, fromPath: r.fromPath ?? "(no referrer)" })),
    byDay,
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
 * Active first-party price sources (read-only)
 * ------------------------------------------------------------------ */

adminRouter.get("/sources", async (c) => {
  const db = getDb();
  const [activeProperties, activeTickets] = await Promise.all([
    db
      .select({ cfg: properties.collectorConfig })
      .from(properties)
      .where(eq(properties.active, true)),
    db
      .select({ cfg: ticketProducts.collectorConfig })
      .from(ticketProducts)
      .where(eq(ticketProducts.active, true)),
  ]);

  const propertyCount = (adapter: string) =>
    activeProperties.filter(
      ({ cfg }) => (cfg as Record<string, unknown> | null)?.adapter === adapter
    ).length;
  const productCount = (adapter: string) =>
    activeTickets.filter(
      ({ cfg }) => (cfg as Record<string, unknown> | null)?.adapter === adapter
    ).length;

  const orlandoHotels = propertyCount("universal-ibe");
  const kidsHotels = propertyCount("universal-kids-commerce");
  const orlandoTickets = productCount("universal-orlando-commerce");
  const expressProducts = productCount("universal-orlando-express");
  const commerceCredentials = universalOrlandoTicketCredentialsConfigured();
  const kidsCredentials = Boolean(
    process.env.UNIVERSAL_KIDS_COMMERCE_CLIENT_SECRET?.trim()
  );

  return c.json([
    {
      id: "universal-ibe",
      name: "Universal Orlando hotels",
      host: "reservations.universalorlando.com",
      coverage: `${orlandoHotels} active hotels · Standard and Annual Passholder rates`,
      configured: orlandoHotels > 0,
      configuration: "Built in · hotel IDs stored with each active property",
    },
    {
      id: "universal-kids-commerce",
      name: "Universal Kids Resort Hotel",
      host: "comm-api.universaldestinationsandexperiences.com",
      coverage: `${kidsHotels} active hotel · Standard rates`,
      configured: kidsHotels > 0 && kidsCredentials,
      configuration: kidsCredentials
        ? "Built in · commerce credentials configured"
        : "Missing UNIVERSAL_KIDS_COMMERCE_CLIENT_SECRET",
    },
    {
      id: "universal-orlando-commerce",
      name: "Universal Orlando tickets",
      host: "comm-api.universaldestinationsandexperiences.com",
      coverage: `${orlandoTickets} active admission products · Adult and child prices`,
      configured: orlandoTickets > 0 && commerceCredentials,
      configuration: commerceCredentials
        ? "Built in · commerce credentials configured"
        : "Missing UNIVERSAL_ORLANDO_COMMERCE_CLIENT_SECRET",
    },
    {
      id: "universal-orlando-express",
      name: "Universal Orlando Express Pass",
      host: "comm-api.universaldestinationsandexperiences.com",
      coverage: `${expressProducts} active Express products · All Orlando parks`,
      configured: expressProducts > 0,
      configuration: "Built in · public product and calendar endpoints",
    },
  ]);
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
