/**
 * Folds raw wait samples into hourly percentiles, then prunes the raw table.
 *
 * Wait times are the only genuinely high-volume data here: ~250 attractions
 * sampled every 5 minutes is ~72,000 rows a day, or ~26 million a year. Nobody
 * queries an individual sample from eight months ago — what they want is "how
 * long is Velocicoaster usually on a Saturday at 2pm", which is a percentile.
 *
 * So: roll up, then delete what has been rolled up. Run daily.
 */
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "@parkpulse/db";

const RAW_RETENTION_DAYS = Number(process.env.WAIT_RAW_RETENTION_DAYS ?? 45);

async function main() {
  const db = getDb();

  /*
   * Percentiles are computed in Postgres rather than in Node because the whole
   * point is to avoid pulling 26 million rows across the wire to average them.
   *
   * Only OPERATING samples count. A closed ride reports no wait, and folding
   * those in as zeros would drag every percentile toward zero and make the
   * "typical wait" numbers useless — the exact bug that makes wait-time
   * averages on other sites untrustworthy.
   */
  const rolled = await db.execute(sql`
    INSERT INTO wait_rollups (attraction_id, day_of_week, hour, avg_minutes, p50_minutes, p90_minutes, sample_count, updated_at)
    SELECT
      attraction_id,
      EXTRACT(DOW FROM observed_at)::smallint  AS day_of_week,
      EXTRACT(HOUR FROM observed_at)::smallint AS hour,
      AVG(wait_minutes)                                                            AS avg_minutes,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY wait_minutes)::smallint          AS p50_minutes,
      PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY wait_minutes)::smallint          AS p90_minutes,
      COUNT(*)                                                                     AS sample_count,
      NOW()
    FROM wait_observations
    WHERE status = 'operating' AND wait_minutes IS NOT NULL
    GROUP BY attraction_id, day_of_week, hour
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

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
