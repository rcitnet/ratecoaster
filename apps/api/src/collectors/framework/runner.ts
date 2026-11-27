import { eq } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { collectorRuns } from "@ratecoaster/db/schema";
import { runWithDryRun } from "./http.js";
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

const activeCollectors = new Set<string>();

export function isCollectorRunning(name: string): boolean {
  return activeCollectors.has(name);
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
  const logger = createLogger(collector.name);

  if (activeCollectors.has(collector.name)) {
    logger.warn("skipped — collector is already running in this process");
    return {
      collector: collector.name,
      status: "skipped",
      reason: "already running",
      requestCount: 0,
      parsedCount: 0,
      writtenCount: 0,
      errorCount: 0,
      durationMs: 0,
    };
  }

  activeCollectors.add(collector.name);
  try {
    const db = getDb();
    const stats = createStats();
    const startedAt = Date.now();

    const setting = await getCollectorSetting(collector.name);
    const forceDryRun = process.env.RATECOASTER_FORCE_DRY_RUN === "1";
    const isDryRun = setting.dryRun || forceDryRun;

    if (!setting.enabled) {
      logger.info("skipped — disabled in admin settings");
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

    const readiness = await collector.isConfigured({ db, stats, logger, dryRun: isDryRun });
    if (!readiness.ready) {
      logger.warn(`skipped — ${readiness.reason ?? "not configured"}`);
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
      // AsyncLocalStorage scopes dry-run mode to this execution tree so
      // concurrent admin-triggered runs never race on process.env.
      await runWithDryRun(isDryRun, () => collector.run({ db, stats, logger, dryRun: isDryRun }));
      if (stats.errorCount > 0) {
        status = "partial";
      } else if (stats.parsedCount === 0 && isDryRun) {
        logger.info(`dry-run planned ${stats.requestCount} requests; no requests were sent`);
      } else if (stats.parsedCount === 0) {
        status = "partial";
        logger.warn(
          "run finished but parsed 0 records — the upstream response shape has probably changed"
        );
      }
    } catch (err) {
      status = "failed";
      thrown = err;
      stats.errorCount++;
      logger.error(`run failed: ${String(err)}`);
    }

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
            dryRun: isDryRun,
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
  } finally {
    activeCollectors.delete(collector.name);
  }
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
