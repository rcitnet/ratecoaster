/**
 * Date helpers that deliberately never construct a `Date` from a stay date.
 *
 * Every timezone bug in a hotel rate tracker is the same bug: `new Date("2026-12-24")`
 * is midnight UTC, which is 19:00 on the 23rd in Orlando, so the row lands on
 * the wrong night and the calendar is quietly off by one. Treating `YYYY-MM-DD`
 * as an opaque string with integer arithmetic behind it removes the whole class.
 */

export type IsoDate = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: IsoDate): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(value);
  if (!match) throw new Error(`invalid ISO date: ${value}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function formatIsoDate(y: number, m: number, d: number): IsoDate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Days since epoch, used purely as an integer index for date arithmetic. */
function toEpochDay(value: IsoDate): number {
  const { y, m, d } = parseIsoDate(value);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function fromEpochDay(epochDay: number): IsoDate {
  const ms = epochDay * 86_400_000;
  const dt = new Date(ms);
  return formatIsoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return fromEpochDay(toEpochDay(value) + days);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

/** 0 = Sunday, matching Postgres `extract(dow)`. */
export function dayOfWeek(value: IsoDate): number {
  const { y, m, d } = parseIsoDate(value);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isWeekend(value: IsoDate): boolean {
  const dow = dayOfWeek(value);
  return dow === 0 || dow === 6;
}

/** Today's date *in the destination's timezone*, not the server's. */
export function todayInTimezone(timezone: string): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Inclusive range of dates, e.g. a 365-day lookahead window. */
export function dateRange(start: IsoDate, days: number): IsoDate[] {
  const out: IsoDate[] = [];
  for (let i = 0; i < days; i++) out.push(addDays(start, i));
  return out;
}

/**
 * Order a lookahead window so the most valuable dates are crawled first.
 *
 * A crawl can be interrupted — deploys, rate limits, a bad night. When that
 * happens you would much rather have fresh prices for next month than for next
 * August, because that is what people are actually booking. Near dates first,
 * then weekends and holidays, then everything else.
 */
export function prioritizeDates(dates: IsoDate[], holidays: Set<IsoDate> = new Set()): IsoDate[] {
  return [...dates].sort((a, b) => score(a) - score(b));

  function score(d: IsoDate): number {
    const distance = daysBetween(dates[0] ?? d, d);
    let s = distance;
    // Pull holidays and weekends forward — they are the volatile, high-demand
    // dates where a price change is most likely and most consequential.
    if (holidays.has(d)) s -= 120;
    else if (isWeekend(d)) s -= 20;
    return s;
  }
}

/**
 * Split a large crawl into slices so a 365-day pass can be spread across the
 * day rather than fired in one burst.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
