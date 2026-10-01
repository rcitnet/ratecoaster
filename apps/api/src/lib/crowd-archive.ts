import { and, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { crowdArchiveHealth, crowdDailyHistory, parks } from "@ratecoaster/db/schema";
import { CrowdCalendarDay, Park } from "@ratecoaster/shared";
import { addDays, todayInTimezone } from "../collectors/framework/dates.js";
import { loadCrowdInputs, type CrowdDb } from "./crowd-data.js";
import { buildCrowdCalendar } from "./crowds.js";
import { archiveScheduleIssues, CROWD_MODEL_VERSION, crowdMonthWindows, evaluateCrowdCoverage } from "./crowd-archive-rules.js";

export async function readArchivedCrowds(db: CrowdDb, parkSlug: string, from: string, to: string) {
  const rows = await db.select().from(crowdDailyHistory).where(and(eq(crowdDailyHistory.parkSlug, parkSlug), gte(crowdDailyHistory.date, from), lte(crowdDailyHistory.date, to)));
  return rows.map(row => ({ ...CrowdCalendarDay.parse(row.estimate), archived: true, reconstructed: row.reconstructed }));
}

/** One transaction plus an advisory lock prevents overlapping cron/backfill runs. */
export async function archiveCrowds({ backfill = false, now = new Date() } = {}) {
  return getDb().transaction(async (db) => {
    const lock = await db.execute(sql`SELECT pg_try_advisory_xact_lock(82471633) AS acquired`);
    if (!lock[0]?.acquired) return { skipped: true, parks: [], written: 0 };
    const catalogue = await db.select().from(parks).where(and(eq(parks.destination, "universal-orlando"), eq(parks.active, true)));
    const [bounds] = await db.select({ earliest: sql<string | null>`(SELECT min(d) FROM (SELECT min(valid_date) AS d FROM ticket_price_current UNION ALL SELECT min(stay_date) AS d FROM rate_current) AS dates)` }).from(parks).limit(1);
    let written = 0;
    const results: Array<{ park: string; issues: ReturnType<typeof evaluateCrowdCoverage>; storedDays: number }> = [];
    for (const park of catalogue) {
      const parkMetadata = Park.parse(park);
      const today = todayInTimezone(park.timezone);
      const from = backfill && bounds?.earliest ? bounds.earliest : addDays(today, -7);
      const to = addDays(today, 364);
      for (const window of crowdMonthWindows(from, to)) {
        const inputs = await loadCrowdInputs(db, park, window.from, window.to, window.to < today);
        const candidates = buildCrowdCalendar(inputs).filter(day => day.signals.length > 0);
        for (const day of candidates) {
          const sources: typeof crowdDailyHistory.$inferInsert.sources = {};
          const ticket = inputs.ticketByDate.get(day.date);
          const express = inputs.expressByDate.get(day.date);
          const hotel = inputs.hotelByDate.get(day.date);
          if (ticket) sources.ticket = { ...ticket, observedAt: inputs.ticketUpdatedByDate.get(day.date)!.toISOString() };
          if (express) sources.express = { ...express, observedAt: inputs.expressUpdatedByDate.get(day.date)!.toISOString() };
          if (hotel !== undefined) sources.hotel = { value: hotel, observedAt: inputs.hotelUpdatedByDate.get(day.date)!.toISOString() };
          const rows = await db.insert(crowdDailyHistory).values({
            parkSlug: park.slug, date: day.date, park: parkMetadata, estimate: day, sources,
            modelVersion: CROWD_MODEL_VERSION, reconstructed: day.date < today,
            capturedAt: now, updatedAt: now, finalizedAt: day.date < today ? now : null,
          }).onConflictDoUpdate({
            target: [crowdDailyHistory.parkSlug, crowdDailyHistory.date],
            set: { estimate: day, sources, park: parkMetadata, updatedAt: now, modelVersion: CROWD_MODEL_VERSION },
            // Completed dates are immutable, including reconstructed backfills.
            setWhere: and(gte(crowdDailyHistory.date, today), isNull(crowdDailyHistory.finalizedAt)),
          }).returning({ date: crowdDailyHistory.date });
          written += rows.length;
        }
      }
      await db.update(crowdDailyHistory).set({ finalizedAt: now }).where(and(eq(crowdDailyHistory.parkSlug, park.slug), lt(crowdDailyHistory.date, today), isNull(crowdDailyHistory.finalizedAt)));
      const saved = await db.select().from(crowdDailyHistory).where(and(eq(crowdDailyHistory.parkSlug, park.slug), gte(crowdDailyHistory.date, addDays(today, -1)), lte(crowdDailyHistory.date, addDays(today, 29))));
      const sourceTimes = Object.fromEntries(saved.map(row => [row.date, Object.fromEntries(Object.entries(row.sources).map(([name, source]) => [name, source.observedAt]))]));
      const issues = evaluateCrowdCoverage({ today, days: saved.map(row => row.estimate), sourceTimes, now });
      await db.insert(crowdArchiveHealth).values({ parkSlug: park.slug, parkName: park.name, checkedAt: now, issues }).onConflictDoUpdate({ target: crowdArchiveHealth.parkSlug, set: { checkedAt: now, issues, parkName: park.name } });
      results.push({ park: park.slug, issues, storedDays: saved.length });
    }
    return { skipped: false, written, parks: results };
  });
}

export async function getCrowdArchiveStatus(now = new Date()) {
  const db = getDb();
  const [health, summaries, catalogue] = await Promise.all([
    db.select().from(crowdArchiveHealth),
    db.select({ parkSlug: crowdDailyHistory.parkSlug, park: sql<Park>`jsonb_agg(${crowdDailyHistory.park} ORDER BY ${crowdDailyHistory.date} DESC)->0`, storedDays: sql<number>`count(*)::int`, finalizedDays: sql<number>`count(finalized_at)::int`, earliestDate: sql<string>`min(date)::text`, latestDate: sql<string>`max(date)::text` }).from(crowdDailyHistory).groupBy(crowdDailyHistory.parkSlug),
    db.select({ slug: parks.slug, name: parks.name, active: parks.active }).from(parks).where(eq(parks.destination, "universal-orlando")),
  ]);
  const knownParks = new Map(catalogue.map(park => [park.slug, park]));
  for (const summary of summaries) if (!knownParks.has(summary.parkSlug)) knownParks.set(summary.parkSlug, { slug: summary.parkSlug, name: summary.park.name, active: false });
  return { parks: [...knownParks.values()].map(park => {
    const checked = health.find(row => row.parkSlug === park.slug);
    const summary = summaries.find(row => row.parkSlug === park.slug);
    return { slug: park.slug, name: park.name, monitored: park.active, checkedAt: checked?.checkedAt.toISOString() ?? null,
      storedDays: summary?.storedDays ?? 0, finalizedDays: summary?.finalizedDays ?? 0,
      earliestDate: summary?.earliestDate ?? null, latestDate: summary?.latestDate ?? null,
      issues: park.active ? [...(checked?.issues ?? []), ...archiveScheduleIssues(checked?.checkedAt ?? null, now)] : [],
    };
  }) };
}
