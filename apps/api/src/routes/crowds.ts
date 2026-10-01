import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { crowdDailyHistory, parks } from "@ratecoaster/db/schema";
import { CrowdCalendarQuery } from "@ratecoaster/shared";
import { tierOf } from "../lib/entitlements.js";
import { todayInTimezone } from "../collectors/framework/dates.js";
import { buildCrowdCalendar, crowdDateWindow } from "../lib/crowds.js";
import { loadCrowdInputs } from "../lib/crowd-data.js";
import { readArchivedCrowds } from "../lib/crowd-archive.js";
import { mergeArchivedCrowds } from "../lib/crowd-archive-rules.js";

export const crowdsRouter = new Hono();

/** Saved history is independent of current products; live outlooks still refresh. */
crowdsRouter.get("/calendar", async (c) => {
  const parsed = CrowdCalendarQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: { code: "invalid_query", message: "bad crowd calendar parameters" } }, 400);
  }
  const db = getDb();
  const parkSlug = parsed.data.parkSlug ?? "universal-studios-florida";
  // Inactive parks remain readable: archive visibility must outlive the catalogue.
  const [cataloguePark] = await db.select().from(parks).where(and(eq(parks.slug, parkSlug), eq(parks.destination, "universal-orlando"))).limit(1);
  const [savedPark] = cataloguePark ? [] : await db.select({ park: crowdDailyHistory.park }).from(crowdDailyHistory).where(eq(crowdDailyHistory.parkSlug, parkSlug)).limit(1);
  const park = cataloguePark ?? savedPark?.park;
  if (!park) return c.json({ error: { code: "not_found", message: "no Universal Orlando park with that name" } }, 404);

  const gate = crowdDateWindow(tierOf(c), parsed.data.from, parsed.data.to, park.timezone);
  const { from, to } = gate;
  const today = todayInTimezone(park.timezone);
  const archived = await readArchivedCrowds(db, park.slug, from, to);
  // Entirely historical requests do not depend on active listings or recompute saved scores.
  const inputs = to < today || !cataloguePark?.active ? null : await loadCrowdInputs(db, park, from, to);
  const computed = inputs ? buildCrowdCalendar({ ...inputs, historyBefore: today }) : [];
  return c.json({
    park: { id: park.id, destination: park.destination, slug: park.slug, name: park.name,
      timezone: park.timezone, queueTimesId: park.queueTimesId, themeParksWikiId: park.themeParksWikiId },
    days: mergeArchivedCrowds(computed, archived, today),
    updatedAt: inputs?.updatedAt?.toISOString() ?? null,
    gate: gate.info,
  });
});
