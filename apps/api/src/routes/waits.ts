import { Hono } from "hono";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { attractions, parkHours, parks, waitCurrent, waitRollups } from "@ratecoaster/db/schema";
import {
  QUEUE_TIMES_ATTRIBUTION,
  THEMEPARKS_WIKI_ATTRIBUTION,
  isRetiredAttraction,
} from "../collectors/waits/providers.js";

export const waitsRouter = new Hono();

const WEEKDAY_TO_DOW: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Local calendar date, Postgres-compatible DOW (0=Sun..6=Sat), and 24-hour
 * clock hour for a park's IANA timezone.
 */
export function parkLocalClock(
  now: Date,
  timezone: string
): { date: string; dayOfWeek: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    dayOfWeek: WEEKDAY_TO_DOW[part("weekday")] ?? now.getUTCDay(),
    hour: Number(part("hour")) % 24,
  };
}

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
  if (parkRows.length === 0) {
    return c.json({
      parks: [],
      attribution: [THEMEPARKS_WIKI_ATTRIBUTION, QUEUE_TIMES_ATTRIBUTION],
      fetchedAt: now.toISOString(),
    });
  }

  /*
   * Compute each park's local date, weekday, and hour once, then fetch park
   * hours, live waits, and matching typical-wait rollups in 3 batched queries
   * instead of 2*N sequential per-park queries.
   */
  const clockByPark = new Map(parkRows.map((park) => [park.id, parkLocalClock(now, park.timezone)]));
  const parkIds = parkRows.map((park) => park.id);
  const uniqueDates = [...new Set([...clockByPark.values()].map((clock) => clock.date))];
  const uniqueClockBuckets = [
    ...new Map(
      [...clockByPark.values()].map((clock) => [`${clock.dayOfWeek}:${clock.hour}`, clock])
    ).values(),
  ];

  const [allHours, allAttractionWaits, allRollups] = await Promise.all([
    db
      .select({
        parkId: parkHours.parkId,
        date: parkHours.date,
        opensAt: parkHours.opensAt,
        closesAt: parkHours.closesAt,
        kind: parkHours.kind,
      })
      .from(parkHours)
      .where(and(inArray(parkHours.parkId, parkIds), inArray(parkHours.date, uniqueDates))),
    db
      .select({
        parkId: attractions.parkId,
        attractionId: attractions.id,
        attractionSlug: attractions.slug,
        attractionName: attractions.name,
        land: attractions.land,
        kind: attractions.kind,
        attractionTypes: attractions.attractionTypes,
        interests: attractions.interests,
        ageGroups: attractions.ageGroups,
        heightRequirements: attractions.heightRequirements,
        accessibility: attractions.accessibility,
        expressPass: attractions.expressPass,
        latitude: attractions.latitude,
        longitude: attractions.longitude,
        officialUrl: attractions.officialUrl,
        officialImageUrl: attractions.officialImageUrl,
        waitMinutes: waitCurrent.waitMinutes,
        singleRiderMinutes: waitCurrent.singleRiderMinutes,
        status: waitCurrent.status,
        observedAt: waitCurrent.observedAt,
      })
      .from(attractions)
      .innerJoin(waitCurrent, eq(waitCurrent.attractionId, attractions.id))
      .where(
        and(
          inArray(attractions.parkId, parkIds),
          eq(attractions.active, true),
          ridesOnly ? eq(attractions.kind, "ride") : sql`true`
        )
      )
      .orderBy(asc(attractions.name)),
    db
      .select({
        attractionId: waitRollups.attractionId,
        dayOfWeek: waitRollups.dayOfWeek,
        hour: waitRollups.hour,
        p50Minutes: waitRollups.p50Minutes,
      })
      .from(waitRollups)
      .innerJoin(attractions, eq(attractions.id, waitRollups.attractionId))
      .where(
        and(
          inArray(attractions.parkId, parkIds),
          or(
            ...uniqueClockBuckets.map((bucket) =>
              and(eq(waitRollups.dayOfWeek, bucket.dayOfWeek), eq(waitRollups.hour, bucket.hour))
            )
          )
        )
      ),
  ]);

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
    const localDate = clockByPark.get(park.id)!.date;
    const rows = allHours.filter((row) => row.parkId === park.id && row.date === localDate);
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

  const typicalByKey = new Map<string, number | null>(
    allRollups.map((row) => [`${row.attractionId}|${row.dayOfWeek}|${row.hour}`, row.p50Minutes])
  );

  const waitsByPark = new Map<string, typeof allAttractionWaits>();
  for (const row of allAttractionWaits) {
    const list = waitsByPark.get(row.parkId);
    if (list) list.push(row);
    else waitsByPark.set(row.parkId, [row]);
  }

  const result = parkRows.map((park) => {
    const clock = clockByPark.get(park.id)!;
    const rows = waitsByPark.get(park.id) ?? [];

    return {
      park: {
        id: park.id,
        destination: park.destination,
        slug: park.slug,
        name: park.name,
        timezone: park.timezone,
        queueTimesId: park.queueTimesId,
        themeParksWikiId: park.themeParksWikiId,
      },
      waits: rows
        .filter((r) => !isRetiredAttraction(park.slug, r.attractionName))
        .map((r) => {
          const typicalMinutes =
            typicalByKey.get(`${r.attractionId}|${clock.dayOfWeek}|${clock.hour}`) ?? null;
          return {
            attractionId: r.attractionId,
            attractionSlug: r.attractionSlug,
            attractionName: r.attractionName,
            parkSlug: park.slug,
            parkName: park.name,
            land: r.land,
            kind: r.kind,
            attractionTypes: r.attractionTypes,
            interests: r.interests,
            ageGroups: r.ageGroups,
            heightRequirements: r.heightRequirements,
            accessibility: r.accessibility,
            expressPass: r.expressPass,
            latitude: r.latitude,
            longitude: r.longitude,
            officialUrl: r.officialUrl,
            officialImageUrl: r.officialImageUrl,
            waitMinutes: r.waitMinutes,
            singleRiderMinutes: r.singleRiderMinutes,
            status: r.status,
            observedAt: r.observedAt.toISOString(),
            typicalMinutes,
            vsTypicalMinutes:
              r.waitMinutes !== null && typicalMinutes !== null
                ? r.waitMinutes - typicalMinutes
                : null,
          };
        }),
      hours: hoursByPark.get(park.id) ?? null,
    };
  });

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

  /*
   * Rollups are stored as a weekday/hour matrix so the live board can compare
   * a Tuesday at 2pm with other Tuesdays at 2pm. The ride detail chart needs
   * a simpler answer: one readable, typical day. Weight each weekday bucket by
   * its sample count and fold it into a single point per hour. Returning the
   * raw rows here used to make seven overlapping points share every x-value.
   */
  const byHour = new Map<number, {
    weightedAverage: number;
    weightedP50: number;
    weightedP90: number;
    sampleCount: number;
  }>();

  for (const row of rows) {
    const bucket = byHour.get(row.hour) ?? {
      weightedAverage: 0,
      weightedP50: 0,
      weightedP90: 0,
      sampleCount: 0,
    };
    const weight = row.sampleCount;
    if (row.avgMinutes !== null) bucket.weightedAverage += row.avgMinutes * weight;
    if (row.p50Minutes !== null) bucket.weightedP50 += row.p50Minutes * weight;
    if (row.p90Minutes !== null) bucket.weightedP90 += row.p90Minutes * weight;
    bucket.sampleCount += weight;
    byHour.set(row.hour, bucket);
  }

  return c.json(
    [...byHour.entries()]
      .sort(([a], [b]) => a - b)
      .map(([hour, bucket]) => ({
        hour,
        avgMinutes: bucket.sampleCount ? bucket.weightedAverage / bucket.sampleCount : null,
        p50Minutes: bucket.sampleCount ? Math.round(bucket.weightedP50 / bucket.sampleCount) : null,
        p90Minutes: bucket.sampleCount ? Math.round(bucket.weightedP90 / bucket.sampleCount) : null,
        sampleCount: bucket.sampleCount,
      }))
  );
});
