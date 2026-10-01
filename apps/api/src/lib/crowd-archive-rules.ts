import type { CrowdCalendarDay } from "@ratecoaster/shared";
import type { CrowdArchiveIssue } from "@ratecoaster/db/schema";
import { addDays, dateRange } from "../collectors/framework/dates.js";

export const CROWD_MODEL_VERSION = "demand-v1-monthly";
export const ARCHIVE_CHECK_MAX_AGE_HOURS = 3;
export const SIGNAL_MAX_AGE_HOURS = { ticket: 48, express: 12, hotel: 24 } as const;

/** Use complete month baselines, so a date's saved score doesn't depend on a caller's range. */
export function crowdMonthWindows(from: string, to: string) {
  const windows: Array<{ from: string; to: string }> = [];
  let cursor = `${from.slice(0, 7)}-01`;
  while (cursor <= to) {
    const next = new Date(`${cursor}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const nextMonth = next.toISOString().slice(0, 10);
    windows.push({ from: cursor, to: addDays(nextMonth, -1) > to ? to : addDays(nextMonth, -1) });
    cursor = nextMonth;
  }
  return windows;
}

/** Saved history wins even if live products are retired or the scoring model changes. */
export function mergeArchivedCrowds(computed: CrowdCalendarDay[], archived: CrowdCalendarDay[], today: string) {
  const result = new Map(computed.filter(day => day.signals.length > 0).map(day => [day.date, day]));
  for (const day of archived) {
    if (day.date < today || !result.has(day.date)) result.set(day.date, { ...day, archived: true });
  }
  return [...result.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function evaluateCrowdCoverage({ today, days, sourceTimes, now }: {
  today: string;
  days: CrowdCalendarDay[];
  sourceTimes: Record<string, Partial<Record<"ticket" | "express" | "hotel", string>>>;
  now: Date;
}): CrowdArchiveIssue[] {
  const issues: CrowdArchiveIssue[] = [];
  // Dates already archived stay present even if a collector subsequently fails.
  const dates = new Set(days.filter(day => day.signals.length).map(day => day.date));
  const missing = dateRange(addDays(today, -1), 31).filter(date => !dates.has(date));
  if (missing.length) issues.push({ kind: "missing-data", message: `${missing.length} dates have no saved crowd estimate in yesterday's and the next 30 days' window.`, dates: missing });
  for (const [signal, maxHours] of Object.entries(SIGNAL_MAX_AGE_HOURS)) {
    const stale = dateRange(today, 7).filter(date => {
      const observedAt = sourceTimes[date]?.[signal as keyof typeof SIGNAL_MAX_AGE_HOURS];
      return !observedAt || (now.getTime() - Date.parse(observedAt)) / 3_600_000 > maxHours;
    });
    if (stale.length) issues.push({ kind: "stale-signals", message: `${signal} pricing signals are missing or older than ${maxHours} hours on ${stale.length} of the next 7 dates.`, dates: stale });
  }
  return issues;
}

export function archiveScheduleIssues(checkedAt: Date | null, now = new Date()): CrowdArchiveIssue[] {
  if (!checkedAt || (now.getTime() - checkedAt.getTime()) / 3_600_000 > ARCHIVE_CHECK_MAX_AGE_HOURS) {
    return [{ kind: "archive-late", message: checkedAt ? "The hourly crowd archive has not completed a check in over 3 hours." : "The crowd archive has never completed a check." }];
  }
  return [];
}
