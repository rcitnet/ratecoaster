import { eq } from "drizzle-orm";
import { attractions, parks, waitCurrent, waitObservations } from "@ratecoaster/db/schema";
import type { Collector, CollectorContext } from "../framework/types.js";
import {
  fetchQueueTimes,
  fetchThemeParksWiki,
  slugify,
  type NormalizedWait,
} from "./providers.js";

/**
 * Wait-time collector.
 *
 * Unlike the pricing collectors, this one is fully operational today: both
 * upstream providers are free, unauthenticated, and explicitly intended for
 * this use. Nothing here needs a HAR capture or a reverse-engineered endpoint.
 */
export const waitTimesCollector: Collector = {
  name: "wait-times",
  description: "Live ride wait times for Universal Orlando, Hollywood, and Frisco",
  // Both providers refresh roughly every 5 minutes; polling faster only burns
  // their bandwidth to re-read numbers that have not moved.
  intervalMinutes: 5,

  async isConfigured({ db }) {
    const rows = await db.select({ id: parks.id }).from(parks).where(eq(parks.active, true));
    if (rows.length === 0) {
      return { ready: false, reason: "no parks seeded — run `npm run db:seed`" };
    }
    return { ready: true };
  },

  async run(ctx: CollectorContext) {
    const { db, stats, logger } = ctx;
    const preferred = (process.env.WAITS_PROVIDER ?? "themeparks").toLowerCase();

    const parkRows = await db.select().from(parks).where(eq(parks.active, true));

    for (const park of parkRows) {
      if (park.queueTimesId === null && park.themeParksWikiId === null) {
        // Universal Kids Resort lands here until a provider adds it. Skipping
        // quietly (rather than erroring) keeps the park visible in the UI while
        // its wait board stays empty.
        logger.info(`skipping ${park.slug} — no provider coverage yet`);
        stats.notes[`${park.slug}.skipped`] = "no provider id";
        continue;
      }

      let waits: NormalizedWait[] = [];
      const order =
        preferred === "queue-times"
          ? (["queue-times", "themeparks"] as const)
          : (["themeparks", "queue-times"] as const);

      for (const provider of order) {
        try {
          if (provider === "themeparks" && park.themeParksWikiId) {
            stats.requestCount++;
            waits = await fetchThemeParksWiki(park.themeParksWikiId);
          } else if (provider === "queue-times" && park.queueTimesId !== null) {
            stats.requestCount++;
            waits = await fetchQueueTimes(park.queueTimesId);
          }
          if (waits.length > 0) {
            stats.notes[`${park.slug}.provider`] = provider;
            break;
          }
        } catch (err) {
          // Fall through to the other provider rather than failing the park.
          stats.errorCount++;
          logger.warn(`${provider} failed for ${park.slug}: ${String(err)}`);
        }
      }

      if (waits.length === 0) {
        logger.warn(`no wait data for ${park.slug} from any provider`);
        continue;
      }

      await ingestParkWaits(ctx, park.id, park.slug, waits);
      logger.info(`${park.slug}: ${waits.length} attractions`);
    }
  },
};

async function ingestParkWaits(
  ctx: CollectorContext,
  parkId: string,
  parkSlug: string,
  waits: NormalizedWait[]
) {
  const { db, stats } = ctx;

  const existing = await db
    .select({
      id: attractions.id,
      externalId: attractions.externalId,
      slug: attractions.slug,
    })
    .from(attractions)
    .where(eq(attractions.parkId, parkId));

  const byExternalId = new Map(existing.filter((a) => a.externalId).map((a) => [a.externalId!, a]));
  const bySlug = new Map(existing.map((a) => [a.slug, a]));

  for (const w of waits) {
    stats.parsedCount++;

    // Match on the provider's stable external id first, falling back to a slug
    // derived from the name. The fallback matters when switching providers:
    // external ids differ between them, but "Revenge of the Mummy" does not.
    // Park slug is prefixed so two parks can both have a "Raptor Encounter".
    const slug = `${parkSlug}-${slugify(w.name)}`;
    let attraction = byExternalId.get(w.externalId) ?? bySlug.get(slug);

    if (!attraction) {
      const [created] = await db
        .insert(attractions)
        .values({
          parkId,
          slug,
          name: w.name,
          kind: w.kind,
          land: w.land,
          externalId: w.externalId,
        })
        .onConflictDoUpdate({
          target: attractions.slug,
          set: { name: w.name, externalId: w.externalId, land: w.land },
        })
        .returning({ id: attractions.id, externalId: attractions.externalId, slug: attractions.slug });
      if (!created) continue;
      attraction = created;
      byExternalId.set(w.externalId, created);
      bySlug.set(slug, created);
    } else if (w.land && attraction) {
      await db.update(attractions).set({ land: w.land }).where(eq(attractions.id, attraction.id));
    }

    const observedAt = new Date(w.observedAt);

    // Raw sample: always written. Unlike prices, wait times are a genuine time
    // series where the *absence* of change is itself information — a ride stuck
    // at 90 minutes for two hours is a real signal, and the rollups need every
    // sample to compute honest percentiles.
    await db.insert(waitObservations).values({
      attractionId: attraction.id,
      waitMinutes: w.waitMinutes,
      singleRiderMinutes: w.singleRiderMinutes,
      status: w.status,
      observedAt,
    });
    stats.writtenCount++;

    await db
      .insert(waitCurrent)
      .values({
        attractionId: attraction.id,
        waitMinutes: w.waitMinutes,
        singleRiderMinutes: w.singleRiderMinutes,
        status: w.status,
        observedAt,
      })
      .onConflictDoUpdate({
        target: waitCurrent.attractionId,
        set: {
          waitMinutes: w.waitMinutes,
          singleRiderMinutes: w.singleRiderMinutes,
          status: w.status,
          observedAt,
        },
      });
  }
}
