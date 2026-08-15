import type { Db } from "@ratecoaster/db";

export interface CollectorContext {
  db: Db;
  /** Incremented by adapters so a run's health is measurable, not guessed. */
  stats: RunStats;
  logger: Logger;
  signal?: AbortSignal;
}

export interface RunStats {
  requestCount: number;
  parsedCount: number;
  writtenCount: number;
  errorCount: number;
  notes: Record<string, unknown>;
}

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

/**
 * Every data source implements this. Keeping the surface this small is what
 * lets the runner give all of them the same treatment — run tracking, error
 * isolation, staleness detection — without knowing anything about hotels or
 * wait times.
 */
export interface Collector {
  /** Stable identifier, recorded on every run. */
  readonly name: string;
  /** Human description shown on the status page. */
  readonly description: string;
  /**
   * How often this should run. Wait times want minutes; a 365-day rate crawl
   * wants hours. Expressed in minutes.
   */
  readonly intervalMinutes: number;
  /**
   * False when the collector cannot run yet — typically because its endpoint
   * config has not been filled in from a HAR capture. The runner skips it with
   * an explanation instead of failing the whole job.
   */
  isConfigured(ctx: CollectorContext): Promise<{ ready: boolean; reason?: string }>;
  run(ctx: CollectorContext): Promise<void>;
}

export function createStats(): RunStats {
  return { requestCount: 0, parsedCount: 0, writtenCount: 0, errorCount: 0, notes: {} };
}

export function createLogger(prefix: string): Logger {
  const fmt = (msg: string, meta?: Record<string, unknown>) =>
    meta && Object.keys(meta).length ? `[${prefix}] ${msg} ${JSON.stringify(meta)}` : `[${prefix}] ${msg}`;
  return {
    info: (m, meta) => console.log(fmt(m, meta)),
    warn: (m, meta) => console.warn(fmt(m, meta)),
    error: (m, meta) => console.error(fmt(m, meta)),
  };
}
