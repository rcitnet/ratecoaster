import { Hono } from "hono";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { attractions, parkHours, parks, waitCurrent, waitRollups } from "@ratecoaster/db/schema";
import {
  QUEUE_TIMES_ATTRIBUTION,
  THEMEPARKS_WIKI_ATTRIBUTION,
} from "../collectors/waits/providers.js";

export const waitsRouter = new Hono();

/**
 * GET /v1/waits/live
 *
 * Attribution ships in the payload rather than being left to each client. The
 * Queue-Times licence requires a visible credit; putting it in the response
 * means the web app, the iOS app, and anything else built on this API all get
 * it right by default instead of each remembering independently.
 */
waitsRouter.get("/live", async (c) => {
  const db = getDb();
  const destination = c.req.query("destination");
  const parkSlug = c.req.query("parkSlug");
  const ridesOnly = c.req.query("ridesOnly") === "true";

  const parkFilters = [eq(parks.active, true)];
  if (destination) parkFilters.push(eq(parks.destination, destination as "universal-orlando"));
  if (parkSlug) parkFilters.push(eq(parks.slug, parkSlug));

  const parkRows = await db
    .select()
    .from(parks)
    .where(and(...parkFilters))
    .orderBy(asc(parks.name));

  const now = new Date();
  const dow = now.getUTCDay();
  const hour = now.getUTCHours();

  /*
   * Today's hours, per park, in the park's own local date.
   *
   * "Today" has to be computed in the park's timezone, not the server's. At
   * 1am UTC it is still the previous day in Orlando, and looking up the wrong
   * date would report a park closed on the very evening it is busiest.
   */
  const hoursByPark = new Map<
    string,
    {
      parkId: string;
      date: string;
      opensAt: string | null;
      closesAt: string | null;
      earlyEntryAt: string | null;
      kind: string;
    }
  >();
  for (const park of parkRows) {
    const localDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: park.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const rows = await db
      .select({
        opensAt: parkHours.opensAt,
        closesAt: parkHours.closesAt,
        kind: parkHours.kind,
      })
      .from(parkHours)
      .where(and(eq(parkHours.parkId, park.id), eq(parkHours.date, localDate)));

    if (rows.length === 0) continue;

    /*
     * Prefer the OPERATING row. A date can also carry TICKETED_EVENT (Halloween
     * Horror Nights and similar), and answering "is the park open" with the
     * separately-ticketed event's hours would tell a normal guest they can walk
     * in when they cannot.
     */
    const row = rows.find((r) => r.kind.toUpperCase() === "OPERATING") ?? rows[0]!;
    hoursByPark.set(park.id, {
      parkId: park.id,
      date: localDate,
      opensAt: row.opensAt?.toISOString() ?? null,
      closesAt: row.closesAt?.toISOString() ?? null,
      // Not published by this endpoint; the column stays for when a source is
      // found, rather than being guessed at from the opening time.
      earlyEntryAt: null,
      kind: row.kind,
    });
  }

  const result = [];
  for (const park of parkRows) {
    const rows = await db
      .select({
        attractionId: attractions.id,
        attractionSlug: attractions.slug,
        attractionName: attractions.name,
        land: attractions.land,
        kind: attractions.kind,
        waitMinutes: waitCurrent.waitMinutes,
        singleRiderMinutes: waitCurrent.singleRiderMinutes,
        status: waitCurrent.status,
        observedAt: waitCurrent.observedAt,
        typicalMinutes: waitRollups.p50Minutes,
      })
      .from(attractions)
      .innerJoin(waitCurrent, eq(waitCurrent.attractionId, attractions.id))
      .leftJoin(
        waitRollups,
        and(
          eq(waitRollups.attractionId, attractions.id),
          eq(waitRollups.dayOfWeek, dow),
          eq(waitRollups.hour, hour)
        )
      )
      .where(
        and(
          eq(attractions.parkId, park.id),
          eq(attractions.active, true),
          ridesOnly ? eq(attractions.kind, "ride") : sql`true`
        )
      )
      .orderBy(asc(attractions.name));

    result.push({
      park: {
        id: park.id,
        destination: park.destination,
        slug: park.slug,
        name: park.name,
        timezone: park.timezone,
        queueTimesId: park.queueTimesId,
        themeParksWikiId: park.themeParksWikiId,
      },
      waits: rows.map((r) => ({
        attractionId: r.attractionId,
        attractionSlug: r.attractionSlug,
        attractionName: r.attractionName,
        parkSlug: park.slug,
        parkName: park.name,
        land: r.land,
        kind: r.kind,
        waitMinutes: r.waitMinutes,
        singleRiderMinutes: r.singleRiderMinutes,
        status: r.status,
        observedAt: r.observedAt.toISOString(),
        typicalMinutes: r.typicalMinutes,
        vsTypicalMinutes:
          r.waitMinutes !== null && r.typicalMinutes !== null
            ? r.waitMinutes - r.typicalMinutes
            : null,
      })),
      hours: hoursByPark.get(park.id) ?? null,
    });
  }

  return c.json({
    parks: result,
    attribution: [THEMEPARKS_WIKI_ATTRIBUTION, QUEUE_TIMES_ATTRIBUTION],
    fetchedAt: now.toISOString(),
  });
});

/** GET /v1/waits/:slug/typical — hourly profile for "when should I ride this?" */
waitsRouter.get("/:slug/typical", async (c) => {
  const db = getDb();
  const slug = c.req.param("slug");

  const [attraction] = await db
    .select({ id: attractions.id })
    .from(attractions)
    .where(eq(attractions.slug, slug))
    .limit(1);

  if (!attraction) {
    return c.json({ error: { code: "not_found", message: `no attraction ${slug}` } }, 404);
  }

  const rows = await db
    .select({
      hour: waitRollups.hour,
      avgMinutes: waitRollups.avgMinutes,
      p50Minutes: waitRollups.p50Minutes,
      p90Minutes: waitRollups.p90Minutes,
      sampleCount: waitRollups.sampleCount,
    })
    .from(waitRollups)
    .where(eq(waitRollups.attractionId, attraction.id))
    .orderBy(asc(waitRollups.hour));

  return c.json(rows);
});
