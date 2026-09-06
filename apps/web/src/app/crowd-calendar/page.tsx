import type { Metadata } from "next";
import { dayOfWeekLabel, getClient, PARK_COLORS, safe } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Universal Orlando crowd calendar",
  description:
    "Plan lower-crowd Universal Orlando days with RateCoaster's date-by-date outlook, built from published ticket, Express Pass, and hotel demand signals.",
  path: "/crowd-calendar",
});

export const revalidate = 300;

const PARKS = [
  { slug: "universal-studios-florida", label: "Universal Studios Florida" },
  { slug: "islands-of-adventure", label: "Islands of Adventure" },
  { slug: "epic-universe", label: "Epic Universe" },
  { slug: "volcano-bay", label: "Volcano Bay" },
] as const;

const LEVEL_LABELS = {
  "very-low": "Very low",
  low: "Low",
  moderate: "Moderate",
  high: "High",
  "very-high": "Very high",
} as const;

function utcDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function monthLabel(date: string): string {
  return utcDate(date).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dateNumber(date: string): string {
  return String(utcDate(date).getUTCDate());
}

function todayInOrlando(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function isMonth(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return false;
  const [year, month] = value.split("-").map(Number);
  return month! >= 1 && month! <= 12 && year! >= 2020;
}

function addMonths(month: string, amount: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year!, monthNumber! - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastDayOfMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year!, monthNumber!, 0));
  return date.toISOString().slice(0, 10);
}

function calendarHref(park: string, month: string): string {
  return `/crowd-calendar?${new URLSearchParams({ park, month })}`;
}

export default async function CrowdCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ park?: string; month?: string }>;
}) {
  const params = await searchParams;
  const requested = params.park;
  const selectedPark = PARKS.some((park) => park.slug === requested)
    ? requested!
    : "universal-studios-florida";
  const today = todayInOrlando();
  const currentMonth = today.slice(0, 7);
  // The server still enforces the one-year catalogue boundary; this only keeps
  // hand-edited URLs from landing on a blank, impossible month.
  const lastMonth = addMonths(currentMonth, 12);
  const selectedMonth = isMonth(params.month) && params.month >= currentMonth && params.month <= lastMonth
    ? params.month
    : currentMonth;
  const requestedFrom = selectedMonth === currentMonth ? today : `${selectedMonth}-01`;
  const client = await getClient();
  const data = await safe(client.crowdCalendar({
    parkSlug: selectedPark,
    from: requestedFrom,
    to: lastDayOfMonth(selectedMonth),
  }), null);
  const days = data?.days ?? [];
  const quietDays = days.filter((day) => day.level === "very-low" || day.level === "low");
  const busyDays = days.filter((day) => day.level === "high" || day.level === "very-high");
  const quietest = [...days].sort((a, b) => a.score - b.score)[0];
  const firstDay = utcDate(`${selectedMonth}-01`).getUTCDay();
  const canGoBack = selectedMonth > currentMonth;
  const canGoForward = selectedMonth < (data?.gate.visibleThrough?.slice(0, 7) ?? lastMonth);

  return (
    <main className="section">
      <span className="badge badge-purple">Universal Orlando crowd outlook</span>
      <h1 style={{ marginTop: 14 }}>Pick a lighter park day</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        A date-by-date crowd outlook for Universal Orlando. It reads the demand signals Universal
        publishes—admission, Express Pass, and on-site hotel pricing—so you can spot lighter and
        heavier days before you build your itinerary.
      </p>

      <div className="chips" aria-label="Choose a Universal Orlando park" style={{ marginTop: 26 }}>
        {PARKS.map((park) => (
          <a
            key={park.slug}
            href={calendarHref(park.slug, selectedMonth)}
            className={`chip ${selectedPark === park.slug ? "on" : ""}`}
          >
            <span
              className="chip-dot"
              style={{ background: PARK_COLORS[park.slug] ?? "var(--blue)" }}
              aria-hidden="true"
            />
            {park.label}
          </a>
        ))}
      </div>

      {data && days.length > 0 ? (
        <>
          <section className="grid grid-3" style={{ marginTop: 28 }}>
            <div className="card" style={{ background: "var(--teal-tint)", borderColor: "transparent" }}>
              <div className="tiny" style={{ fontWeight: 700, color: "#077368" }}>LIGHTER DAYS THIS MONTH</div>
              <div className="cal-price" style={{ color: "#077368", fontSize: 32 }}>{quietDays.length}</div>
              <div className="tiny muted">low or very low outlook</div>
            </div>
            <div className="card" style={{ background: "var(--coral-tint)", borderColor: "transparent" }}>
              <div className="tiny" style={{ fontWeight: 700, color: "#b03514" }}>BUSIER DAYS THIS MONTH</div>
              <div className="cal-price" style={{ color: "#b03514", fontSize: 32 }}>{busyDays.length}</div>
              <div className="tiny muted">high or very high outlook</div>
            </div>
            <div className="card" style={{ background: "var(--blue-tint)", borderColor: "transparent" }}>
              <div className="tiny" style={{ fontWeight: 700, color: "var(--blue-dark)" }}>QUIETEST DATE THIS MONTH</div>
              <div className="cal-price" style={{ color: "var(--blue-dark)", fontSize: 26 }}>
                {quietest ? `${dayOfWeekLabel(quietest.date)} ${dateNumber(quietest.date)}` : "—"}
              </div>
              <div className="tiny muted">{quietest ? `${LEVEL_LABELS[quietest.level]} · ${quietest.score}/10` : "Forecast building"}</div>
            </div>
          </section>

          <div className="crowd-legend" aria-label="Crowd level legend">
            {Object.entries(LEVEL_LABELS).map(([level, label]) => (
              <span key={level} className="crowd-legend-item">
                <i className={`crowd-swatch crowd-${level}`} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>

          <section className="crowd-calendar" aria-label={`${data.park.name} crowd calendar`}>
            <div className="crowd-calendar-head">
              {canGoBack ? (
                <a className="btn btn-ghost btn-sm" href={calendarHref(selectedPark, addMonths(selectedMonth, -1))}>
                  ← Previous month
                </a>
              ) : <span />}
              <h2>{monthLabel(`${selectedMonth}-01`)}</h2>
              {canGoForward ? (
                <a className="btn btn-ghost btn-sm" href={calendarHref(selectedPark, addMonths(selectedMonth, 1))}>
                  Next month →
                </a>
              ) : <span />}
            </div>
            <div className="crowd-weekdays" aria-hidden="true">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="crowd-grid">
              {Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} />)}
              {days.map((day) => (
                <div
                  key={day.date}
                  className={`crowd-day crowd-${day.level}`}
                  title={`${day.date}: ${LEVEL_LABELS[day.level]} crowd outlook (${day.score}/10)`}
                >
                  <span className="crowd-date">{dateNumber(day.date)}</span>
                  <strong>{LEVEL_LABELS[day.level]}</strong>
                  <span className="crowd-score">{day.score}/10</span>
                </div>
              ))}
            </div>
          </section>

          <section className="notice" style={{ marginTop: 34 }}>
            <b>How to use this:</b> this is a relative planning forecast, not a promise of a
            particular wait time. A higher score means Universal&apos;s own demand signals line up for
            a busier date. Check <a href={`/waits?park=${data.park.slug}`}><b>live waits</b></a> when
            you&apos;re at the resort for what is happening right now.
            {data.updatedAt ? <> Signals last refreshed from RateCoaster&apos;s collected pricing data.</> : null}
          </section>
        </>
      ) : (
        <div className="notice" style={{ marginTop: 28 }}>
          <b>The crowd calendar is building.</b> It will appear as soon as ticket, Express, and hotel
          demand data are available for this park.
        </div>
      )}
    </main>
  );
}
