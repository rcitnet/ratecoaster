import { Hono } from "hono";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { properties, rateCurrent, rateObservations, roomTypes } from "@ratecoaster/db/schema";
import { DestinationSlug, RateCode, RateQuery } from "@ratecoaster/shared";
import { addDays, todayInTimezone } from "../collectors/framework/dates.js";
import { gateDateWindow, requireFeature, tierOf } from "../lib/entitlements.js";

export const ratesRouter = new Hono();

/** Filter controls derived from current observations, not assumed capabilities. */
ratesRouter.get("/options", async (c) => {
  const db = getDb();
  const destination = c.req.query("destination");
  const propertySlug = c.req.query("propertySlug");
  const parsedDestination = destination ? DestinationSlug.safeParse(destination) : null;
  if (parsedDestination && !parsedDestination.success) {
    return c.json({ error: { code: "invalid_query", message: "bad destination" } }, 400);
  }

  const propertyFilter = [eq(properties.active, true)];
  if (parsedDestination?.success) {
    propertyFilter.push(eq(properties.destination, parsedDestination.data));
  }
  if (propertySlug) propertyFilter.push(eq(properties.slug, propertySlug));
  const props = await db.select({ id: properties.id }).from(properties).where(and(...propertyFilter));
  if (props.length === 0) return c.json({ rateCodes: [], roomTypes: [] });

  const propertyIds = props.map((property) => property.id);
  const [codes, rooms] = await Promise.all([
    db
      .selectDistinct({ rateCode: rateCurrent.rateCode })
      .from(rateCurrent)
      .where(
        and(
          inArray(rateCurrent.propertyId, propertyIds),
          eq(rateCurrent.available, true)
        )
      ),
    propertySlug
      ? db
          .selectDistinct({
            id: roomTypes.id,
            propertyId: roomTypes.propertyId,
            externalCode: roomTypes.externalCode,
            name: roomTypes.name,
            maxOccupancy: roomTypes.maxOccupancy,
          })
          .from(roomTypes)
          .innerJoin(rateCurrent, eq(rateCurrent.roomTypeId, roomTypes.id))
          .where(
            and(
              inArray(roomTypes.propertyId, propertyIds),
              eq(rateCurrent.available, true)
            )
          )
          .orderBy(asc(roomTypes.name))
      : Promise.resolve([]),
  ]);

  const codeOrder = new Map(RateCode.options.map((code, index) => [code, index]));
  return c.json({
    rateCodes: codes
      .map(({ rateCode }) => rateCode)
      .sort((a, b) => (codeOrder.get(a) ?? 999) - (codeOrder.get(b) ?? 999)),
    roomTypes: rooms,
  });
});

/**
 * GET /v1/rates
 *
 * The rate grid: cheapest room per property per date for a given rate code,
 * with the standard rate alongside so the UI can show what the passholder code
 * is actually saving.
 */
ratesRouter.get("/", async (c) => {
  const db = getDb();
  const parsed = RateQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      { error: { code: "invalid_query", message: "bad parameters", details: parsed.error.flatten() } },
      400
    );
  }
  const q = parsed.data;

  /*
   * Clamp the window to the caller's tier BEFORE querying. The rows outside it
   * are never loaded, never serialized, and never leave the process — which is
   * what makes this a real gate rather than a CSS one.
   */
  const gate = gateDateWindow(tierOf(c), q.from, q.to);
  const from = gate.from;
  const to = gate.to;

  const propertyFilter = [eq(properties.active, true)];
  if (q.destination) propertyFilter.push(eq(properties.destination, q.destination));
  if (q.propertySlug) propertyFilter.push(eq(properties.slug, q.propertySlug));

  const props = await db
    .select()
    .from(properties)
    .where(and(...propertyFilter));

  if (props.length === 0) return c.json({ items: [], attribution: [] });
  const propertyIds = props.map((p) => p.id);
  const propertyById = new Map(props.map((p) => [p.id, p]));

  /*
   * Cheapest room per (property, date) rather than every room type.
   *
   * The collector deliberately stores all room types, but a calendar grid wants
   * one number per cell — the price a guest would actually pay if they booked
   * the cheapest available room. DISTINCT ON is Postgres-specific and much
   * cheaper here than a window function or a correlated subquery.
   */
  const cheapest = async (rateCode: typeof q.rateCode) =>
    db
      .select({
        propertyId: rateCurrent.propertyId,
        stayDate: rateCurrent.stayDate,
        nightlyCents: rateCurrent.nightlyCents,
        totalCents: rateCurrent.totalCents,
        available: rateCurrent.available,
        source: rateCurrent.source,
        isEstimated: rateCurrent.isEstimated,
        merchant: rateCurrent.merchant,
        historicalLowCents: rateCurrent.historicalLowCents,
        previousCents: rateCurrent.previousCents,
        observedAt: rateCurrent.observedAt,
        roomTypeId: rateCurrent.roomTypeId,
        roomTypeName: roomTypes.name,
      })
      .from(rateCurrent)
      .leftJoin(roomTypes, eq(rateCurrent.roomTypeId, roomTypes.id))
      .where(
        and(
          inArray(rateCurrent.propertyId, propertyIds),
          eq(rateCurrent.rateCode, rateCode),
          eq(rateCurrent.nights, q.nights),
          eq(rateCurrent.adults, q.adults),
          eq(rateCurrent.children, q.children),
          q.roomTypeId ? eq(rateCurrent.roomTypeId, q.roomTypeId) : sql`true`,
          gte(rateCurrent.stayDate, from),
          lte(rateCurrent.stayDate, to),
          eq(rateCurrent.available, true)
        )
      )
      .orderBy(
        asc(rateCurrent.propertyId),
        asc(rateCurrent.stayDate),
        asc(rateCurrent.nightlyCents)
      );

  const [target, standard] = await Promise.all([
    cheapest(q.rateCode),
    q.rateCode === "STANDARD" ? Promise.resolve([]) : cheapest("STANDARD"),
  ]);

  const dedupe = <T extends { propertyId: string; stayDate: string }>(rows: T[]) => {
    const out = new Map<string, T>();
    for (const row of rows) {
      const key = `${row.propertyId}|${row.stayDate}`;
      if (!out.has(key)) out.set(key, row); // already sorted by price ascending
    }
    return out;
  };

  const targetByKey = dedupe(target);
  const standardByKey = new Map(
    standard.map((row) => [`${row.propertyId}|${row.stayDate}|${row.roomTypeId ?? ""}`, row])
  );

  const items = [...targetByKey.values()]
    .map((row) => {
      const property = propertyById.get(row.propertyId)!;
      const std = standardByKey.get(
        `${row.propertyId}|${row.stayDate}|${row.roomTypeId ?? ""}`
      );
      return {
        propertyId: row.propertyId,
        propertySlug: property.slug,
        propertyName: property.name,
        stayDate: row.stayDate,
        rateCode: q.rateCode,
        nightlyCents: row.nightlyCents,
        totalCents: row.totalCents,
        roomTypeName: row.roomTypeName,
        available: row.available,
        source: row.source,
        isEstimated: row.isEstimated,
        merchant: row.merchant,
        observedAt: row.observedAt.toISOString(),
        standardNightlyCents: std?.nightlyCents ?? null,
        savingsCents: std ? std.nightlyCents - row.nightlyCents : null,
        historicalLowCents: row.historicalLowCents,
        changeCents: row.previousCents === null ? null : row.nightlyCents - row.previousCents,
      };
    })
    .sort((a, b) => a.stayDate.localeCompare(b.stayDate) || a.propertyName.localeCompare(b.propertyName))
    .slice(q.offset, q.offset + q.limit);

  return c.json({ items, attribution: [], gate: gate.info });
});

/**
 * GET /v1/rates/:slug/history
 *
 * Because observations are written only on change, this is a straight ordered
 * read — no deduplication, no downsampling. Each row is a real price movement.
 */
ratesRouter.get("/:slug/history", async (c) => {
  const db = getDb();
  const slug = c.req.param("slug");
  const stayDate = c.req.query("stayDate");
  const parsedHistoryQuery = RateQuery.pick({ rateCode: true, roomTypeId: true }).safeParse(
    c.req.query()
  );
  if (!parsedHistoryQuery.success) {
    return c.json({ error: { code: "invalid_query", message: "bad rate or room type" } }, 400);
  }
  const { rateCode, roomTypeId } = parsedHistoryQuery.data;

  // Price history is a free-account feature. 402 rather than 403 so the client
  // can distinguish "you need to sign up" from "you are not allowed at all".
  const feature = requireFeature(tierOf(c), "priceHistory");
  if (!feature.allowed) {
    return c.json(
      {
        error: {
          code: "upgrade_required",
          message: feature.reason ?? "Sign in to see price history.",
          details: { requiredTier: feature.requiredTier },
        },
      },
      402
    );
  }

  if (!stayDate) {
    return c.json({ error: { code: "missing_param", message: "stayDate is required" } }, 400);
  }

  const [property] = await db.select().from(properties).where(eq(properties.slug, slug)).limit(1);
  if (!property) {
    return c.json({ error: { code: "not_found", message: `no property ${slug}` } }, 404);
  }

  const rows = await db
    .select({
      observedAt: rateObservations.observedAt,
      nightlyCents: sql<number>`min(${rateObservations.nightlyCents})`,
      available: sql<boolean>`bool_or(${rateObservations.available})`,
    })
    .from(rateObservations)
    .where(
      and(
        eq(rateObservations.propertyId, property.id),
        eq(rateObservations.stayDate, stayDate),
        eq(rateObservations.rateCode, rateCode),
        roomTypeId ? eq(rateObservations.roomTypeId, roomTypeId) : sql`true`
      )
    )
    .groupBy(rateObservations.observedAt)
    .orderBy(asc(rateObservations.observedAt));

  return c.json(
    rows.map((r) => ({
      observedAt: r.observedAt.toISOString(),
      nightlyCents: Number(r.nightlyCents),
      available: r.available,
    }))
  );
});

/**
 * GET /v1/deals
 *
 * The "cheapest upcoming stays" board. Ranked by how good the price is against
 * the property's own history rather than by absolute price — otherwise the
 * value hotels win every slot and the board tells you nothing you did not
 * already know.
 */
export const dealsRouter = new Hono().get("/", async (c) => {
  const db = getDb();
  const destination = c.req.query("destination");
  const limit = Math.min(Number(c.req.query("limit") ?? 40), 200);
  const from = todayInTimezone("America/New_York");
  const to = gateDateWindow(tierOf(c), from, undefined).to;

  const filters = [
    eq(properties.active, true),
    gte(rateCurrent.stayDate, from),
    lte(rateCurrent.stayDate, to),
    eq(rateCurrent.available, true),
    eq(rateCurrent.rateCode, "APH"),
  ];

  const rows = await db
    .selectDistinctOn([rateCurrent.propertyId], {
      propertyId: rateCurrent.propertyId,
      slug: properties.slug,
      name: properties.name,
      destination: properties.destination,
      tier: properties.tier,
      includesExpressPass: properties.includesExpressPass,
      stayDate: rateCurrent.stayDate,
      nights: rateCurrent.nights,
      nightlyCents: rateCurrent.nightlyCents,
      totalCents: rateCurrent.totalCents,
      historicalLowCents: rateCurrent.historicalLowCents,
      source: rateCurrent.source,
      isEstimated: rateCurrent.isEstimated,
      merchant: rateCurrent.merchant,
    })
    .from(rateCurrent)
    .innerJoin(properties, eq(properties.id, rateCurrent.propertyId))
    .where(and(...filters, destination ? eq(properties.destination, destination as "universal-orlando") : sql`true`))
    // Pick one cheapest candidate for every hotel before applying the public
    // response limit. Limiting the raw price rows first let inexpensive Value
    // inventory fill the entire candidate window and starved higher tiers.
    .orderBy(
      asc(rateCurrent.propertyId),
      asc(rateCurrent.nightlyCents),
      asc(rateCurrent.stayDate)
    );

  const deals = rows
    .map((r) => {
      const low = r.historicalLowCents ?? r.nightlyCents;
      // 0 = at its all-time low, 100 = far above it.
      const percentile = low > 0 ? Math.min(100, ((r.nightlyCents - low) / low) * 100) : null;
      return {
        propertyId: r.propertyId,
        propertySlug: r.slug,
        propertyName: r.name,
        destination: r.destination,
        tier: r.tier,
        stayDate: r.stayDate,
        nights: r.nights,
        rateCode: "APH" as const,
        nightlyCents: r.nightlyCents,
        totalCents: r.totalCents,
        savingsCents: null,
        savingsPercent: null,
        percentileOfHistory: percentile,
        includesExpressPass: r.includesExpressPass,
        source: r.source,
        isEstimated: r.isEstimated,
        merchant: r.merchant,
      };
    })
    .sort((a, b) => (a.percentileOfHistory ?? 999) - (b.percentileOfHistory ?? 999))
    .slice(0, limit);

  return c.json(deals);
});

export const propertiesRouter = new Hono().get("/", async (c) => {
  const db = getDb();
  const destination = c.req.query("destination");
  const rows = await db
    .select()
    .from(properties)
    .where(
      destination
        ? and(eq(properties.active, true), eq(properties.destination, destination as "universal-orlando"))
        : eq(properties.active, true)
    )
    .orderBy(desc(properties.tier), asc(properties.name));

  return c.json(
    rows.map((p) => ({
      id: p.id,
      destination: p.destination,
      slug: p.slug,
      name: p.name,
      tier: p.tier,
      operator: p.operator,
      onSite: p.onSite,
      includesExpressPass: p.includesExpressPass,
      earlyParkAdmission: p.earlyParkAdmission,
      roomCount: p.roomCount,
      latitude: p.latitude,
      longitude: p.longitude,
    }))
  );
});
