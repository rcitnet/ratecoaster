/**
 * Folds raw wait samples into hourly percentiles, then prunes expired operational
 * tables and aged raw samples.
 *
 * Wait times are the only genuinely high-volume data here: ~250 attractions
 * sampled every 5 minutes is ~72,000 rows a day, or ~26 million a year. Nobody
 * queries an individual sample from eight months ago — what they want is "how
 * long is Velocicoaster usually on a Saturday at 2pm", which is a percentile.
 *
 * Buckets are computed in each park's own IANA timezone so Daylight Saving Time
 * transitions never shift typical wait curves by an hour.
 */
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "@ratecoaster/db";

const RAW_RETENTION_DAYS = Number(process.env.WAIT_RAW_RETENTION_DAYS ?? 45);
const COLLECTOR_RUNS_RETENTION_DAYS = Number(process.env.COLLECTOR_RUNS_RETENTION_DAYS ?? 90);

async function main() {
  const db = getDb();

  /*
   * Percentiles are computed in Postgres rather than in Node because the whole
   * point is to avoid pulling millions of rows across the wire.
   *
   * Only OPERATING samples count. A closed ride reports no wait, and folding
   * those in as zeros would drag every percentile toward zero and make the
   * "typical wait" numbers useless.
   *
   * `observed_at AT TIME ZONE p.timezone` converts timestamptz into the park's
   * local wall-clock time before extracting DOW (0=Sun..6=Sat) and hour (0..23),
   * independent of the database session timezone and resilient across DST.
   */
  const rolled = await db.execute(sql`
    INSERT INTO wait_rollups (attraction_id, day_of_week, hour, avg_minutes, p50_minutes, p90_minutes, sample_count, updated_at)
    SELECT
      wo.attraction_id,
      EXTRACT(DOW FROM (wo.observed_at AT TIME ZONE p.timezone))::smallint  AS day_of_week,
      EXTRACT(HOUR FROM (wo.observed_at AT TIME ZONE p.timezone))::smallint AS hour,
      AVG(wo.wait_minutes)                                                 AS avg_minutes,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY wo.wait_minutes)::smallint AS p50_minutes,
      PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY wo.wait_minutes)::smallint AS p90_minutes,
      COUNT(*)                                                             AS sample_count,
      NOW()
    FROM wait_observations wo
    INNER JOIN attractions a ON a.id = wo.attraction_id
    INNER JOIN parks p ON p.id = a.park_id
    WHERE wo.status = 'operating' AND wo.wait_minutes IS NOT NULL
    GROUP BY wo.attraction_id, day_of_week, hour
    ON CONFLICT (attraction_id, day_of_week, hour) DO UPDATE SET
      avg_minutes  = EXCLUDED.avg_minutes,
      p50_minutes  = EXCLUDED.p50_minutes,
      p90_minutes  = EXCLUDED.p90_minutes,
      sample_count = EXCLUDED.sample_count,
      updated_at   = NOW()
  `);

  console.log(`rolled up wait times (${rolled.count ?? 0} buckets)`);

  const pruned = await db.execute(sql`
    DELETE FROM wait_observations
    WHERE observed_at < NOW() - (${RAW_RETENTION_DAYS} || ' days')::interval
  `);
  console.log(`pruned ${pruned.count ?? 0} raw samples older than ${RAW_RETENTION_DAYS} days`);

  // Raw upstream payloads are debugging aids, not data. A week is plenty.
  const prunedSnapshots = await db.execute(sql`
    DELETE FROM raw_snapshots WHERE captured_at < NOW() - INTERVAL '7 days'
  `);
  console.log(`pruned ${prunedSnapshots.count ?? 0} raw snapshots`);

  // Expired auth records serve no purpose once past their expiry window.
  const prunedSessions = await db.execute(sql`
    DELETE FROM sessions WHERE expires_at < NOW()
  `);
  console.log(`pruned ${prunedSessions.count ?? 0} expired sessions`);

  const prunedMagicLinks = await db.execute(sql`
    DELETE FROM magic_link_tokens
    WHERE expires_at < NOW() - INTERVAL '1 day'
       OR (consumed_at IS NOT NULL AND consumed_at < NOW() - INTERVAL '7 days')
  `);
  console.log(`pruned ${prunedMagicLinks.count ?? 0} old magic-link tokens`);

  const prunedCollectorRuns = await db.execute(sql`
    DELETE FROM collector_runs
    WHERE started_at < NOW() - (${COLLECTOR_RUNS_RETENTION_DAYS} || ' days')::interval
  `);
  console.log(
    `pruned ${prunedCollectorRuns.count ?? 0} collector runs older than ${COLLECTOR_RUNS_RETENTION_DAYS} days`
  );

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
