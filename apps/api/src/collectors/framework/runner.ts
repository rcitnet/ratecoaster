import { eq } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { collectorRuns } from "@ratecoaster/db/schema";
import { createLogger, createStats, type Collector } from "./types.js";
import { getCollectorSetting } from "../../lib/settings.js";

export interface RunResult {
  collector: string;
  status: "ok" | "partial" | "failed" | "skipped";
  reason?: string;
  requestCount: number;
  parsedCount: number;
  writtenCount: number;
  errorCount: number;
  durationMs: number;
}

/**
 * Runs one collector with full bookkeeping.
 *
 * The status distinction that matters is `partial`: a run that completed
 * without throwing but parsed zero rows. That is exactly what happens when a
 * booking engine changes its JSON shape — no exception, no error log, just a
 * site that silently stops updating. Treating "finished but parsed nothing" as
 * a failure state is the difference between noticing in an hour and noticing
 * when a user emails you three weeks later.
 */
export async function runCollector(collector: Collector): Promise<RunResult> {
  const db = getDb();
  const logger = createLogger(collector.name);
  const stats = createStats();
  const startedAt = Date.now();

  /*
   * Per-collector dry-run, applied to the process environment for the duration
   * of this run. Collectors execute sequentially and in-process, so this is
   * safe; the alternative — threading a flag down to every fetch call site —
   * would touch far more code for the same effect. If runs ever become
   * concurrent, this has to become explicit context instead.
   */
  const setting = await getCollectorSetting(collector.name);
  const previousDryRun = process.env.COLLECTOR_DRY_RUN;
  process.env.COLLECTOR_DRY_RUN = setting.dryRun ? "1" : "0";

  const restoreEnv = () => {
    if (previousDryRun === undefined) delete process.env.COLLECTOR_DRY_RUN;
    else process.env.COLLECTOR_DRY_RUN = previousDryRun;
  };

  if (!setting.enabled) {
    logger.info("skipped — disabled in admin settings");
    restoreEnv();
    return {
      collector: collector.name,
      status: "skipped",
      reason: "disabled in admin settings",
      requestCount: 0,
      parsedCount: 0,
      writtenCount: 0,
      errorCount: 0,
      durationMs: 0,
    };
  }

  const readiness = await collector.isConfigured({ db, stats, logger });
  if (!readiness.ready) {
    logger.warn(`skipped — ${readiness.reason ?? "not configured"}`);
    restoreEnv();
    return {
      collector: collector.name,
      status: "skipped",
      reason: readiness.reason,
      requestCount: 0,
      parsedCount: 0,
      writtenCount: 0,
      errorCount: 0,
      durationMs: 0,
    };
  }

  const [run] = await db
    .insert(collectorRuns)
    .values({ collector: collector.name, status: "running" })
    .returning({ id: collectorRuns.id });

  let status: "ok" | "partial" | "failed" = "ok";
  let thrown: unknown = null;

  try {
    await collector.run({ db, stats, logger });
    if (stats.parsedCount === 0) {
      status = "partial";
      logger.warn(
        "run finished but parsed 0 records — the upstream response shape has probably changed"
      );
    } else if (stats.errorCount > 0) {
      status = "partial";
    }
  } catch (err) {
    status = "failed";
    thrown = err;
    stats.errorCount++;
    logger.error(`run failed: ${String(err)}`);
  }

  restoreEnv();
  const durationMs = Date.now() - startedAt;

  if (run) {
    await db
      .update(collectorRuns)
      .set({
        status,
        finishedAt: new Date(),
        requestCount: stats.requestCount,
        parsedCount: stats.parsedCount,
        writtenCount: stats.writtenCount,
        errorCount: stats.errorCount,
        notes: {
          ...stats.notes,
          durationMs,
          dryRun: setting.dryRun,
          ...(thrown ? { error: String(thrown) } : {}),
        },
      })
      .where(eq(collectorRuns.id, run.id));
  }

  logger.info(
    `${status} in ${durationMs}ms — ${stats.requestCount} requests, ${stats.parsedCount} parsed, ${stats.writtenCount} written, ${stats.errorCount} errors`
  );

  return {
    collector: collector.name,
    status,
    requestCount: stats.requestCount,
    parsedCount: stats.parsedCount,
    writtenCount: stats.writtenCount,
    errorCount: stats.errorCount,
    durationMs,
  };
}

/**
 * Run several collectors in sequence.
 *
 * Sequential on purpose: the rate limiter is per-host, but running a hotel
 * crawl and a ticket crawl concurrently against the same origin doubles the
 * perceived load for no real gain, since these are scheduled jobs with hours of
 * headroom. One failing collector never stops the others.
 */
export async function runAll(collectors: Collector[]): Promise<RunResult[]> {
  const results: RunResult[] = [];
  for (const c of collectors) {
    results.push(await runCollector(c));
  }
  return results;
}
