import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";
import { parks, parkHours } from "@ratecoaster/db/schema";
import type { Collector, CollectorContext } from "../framework/types.js";
import { fetchJson } from "../framework/http.js";

/**
 * Park opening hours.
 *
 * Added because every status-based guess at "is this park open" is wrong.
 * Shows and character meets keep reporting OPERATING long after the gates
 * shut, so at 11pm a park with 33 shows still "operating" read as open. The
 * published schedule is the only honest source, and ThemeParks.wiki serves it
 * free alongside the live data we already take from them.
 *
 * The `park_hours` table has existed since the first schema and was never
 * filled. This fills it.
 */

const ScheduleEntry = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.string(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
});

const ScheduleResponse = z.object({
  id: z.string(),
  timezone: z.string().optional(),
  schedule: z.array(ScheduleEntry).default([]),
});

export interface NormalizedHours {
  date: string;
  kind: string;
  opensAt: Date | null;
  closesAt: Date | null;
}

/**
 * Split out from the fetch so it can be tested against a captured payload.
 *
 * The timestamps arrive with an explicit UTC offset, so they parse to absolute
 * instants and no local-time arithmetic is needed downstream. That matters:
 * "is the park open right now" computed in local time is the exact shape of
 * bug that works all summer and breaks the week the clocks change.
 */
export function parseSchedule(payload: unknown): NormalizedHours[] {
  const parsed = ScheduleResponse.safeParse(payload);
  if (!parsed.success) return [];

  const out: NormalizedHours[] = [];
  const seen = new Set<string>();
  for (const entry of parsed.data.schedule) {
    const opensAt = entry.openingTime ? new Date(entry.openingTime) : null;
    const closesAt = entry.closingTime ? new Date(entry.closingTime) : null;

    // A row with unparseable times is worse than no row: it reads as "we know
    // the hours" while answering every question wrongly.
    if (opensAt && Number.isNaN(opensAt.getTime())) continue;
    if (closesAt && Number.isNaN(closesAt.getTime())) continue;

    const key = `${entry.date}|${entry.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      date: entry.date,
      /*
       * Kept verbatim rather than mapped to a boolean. A park can carry an
       * OPERATING row and a TICKETED_EVENT row for the same date — Halloween
       * Horror Nights being the obvious case — and collapsing those loses the
       * difference between "open to everyone" and "open to ticket holders".
       */
      kind: entry.type,
      opensAt,
      closesAt,
    });
  }
  return out;
}

export async function fetchParkSchedule(entityId: string): Promise<NormalizedHours[]> {
  const json = await fetchJson(`https://api.themeparks.wiki/v1/entity/${entityId}/schedule`, {
    // Free public API that welcomes this traffic, same as the live endpoint.
    alwaysSend: true,
    rpm: 30,
  });
  if (!json) return [];
  return parseSchedule(json);
}

export const parkHoursCollector: Collector = {
  name: "park-hours",
  description: "Opening and closing times, so the site can tell a closed park from a quiet one",
  // Schedules are published well ahead and change rarely. Twice a day is
  // generous; hourly would re-read the same month of data.
  intervalMinutes: 60 * 12,

  async isConfigured({ db }) {
    const rows = await db.select({ id: parks.id }).from(parks).where(eq(parks.active, true));
    if (rows.length === 0) {
      return { ready: false, reason: "no parks seeded — run `npm run db:seed`" };
    }
    return { ready: true };
  },

  async run(ctx: CollectorContext) {
    const { db, stats, logger } = ctx;
    const parkRows = await db.select().from(parks).where(eq(parks.active, true));

    for (const park of parkRows) {
      if (!park.themeParksWikiId) {
        logger.info(`skipping ${park.slug} — no schedule provider`);
        continue;
      }

      stats.requestCount++;
      let entries: NormalizedHours[] = [];
      try {
        entries = await fetchParkSchedule(park.themeParksWikiId);
      } catch (err) {
        stats.errorCount++;
        logger.warn(`${park.slug} schedule failed: ${String(err)}`);
        continue;
      }

      if (entries.length === 0) {
        logger.warn(`${park.slug}: no schedule entries returned`);
        continue;
      }

      stats.parsedCount += entries.length;
      const dates = entries.map((entry) => entry.date).sort();
      await db.transaction(async (tx) => {
        // The provider response is a snapshot. Replacing its covered range
        // removes cancelled events and obsolete OPERATING rows instead of
        // letting them override the corrected schedule forever.
        await tx
          .delete(parkHours)
          .where(
            and(
              eq(parkHours.parkId, park.id),
              gte(parkHours.date, dates[0]!),
              lte(parkHours.date, dates.at(-1)!)
            )
          );
        await tx.insert(parkHours).values(
          entries.map((entry) => ({
            parkId: park.id,
            date: entry.date,
            opensAt: entry.opensAt,
            closesAt: entry.closesAt,
            kind: entry.kind,
          }))
        );
      });
      stats.writtenCount += entries.length;

      logger.info(`${park.slug}: ${entries.length} days of hours`);
      stats.notes[park.slug] = entries.length;
    }
  },
};
