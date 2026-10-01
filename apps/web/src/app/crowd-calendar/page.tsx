import type { Metadata } from "next";
import { dayOfWeekLabel, getClient, PARK_COLORS, safe } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = pageMetadata({
  title: "Universal Orlando crowd calendar",
  description:
    "Explore Universal Orlando crowd outlooks and archived demand estimates, built from published ticket, Express Pass, and hotel pricing signals.",
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

function utcDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year!, month! - 1, day!);
  return date;
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
  return month! >= 1 && month! <= 12 && year! >= 1;
}

function addMonths(month: string, amount: number): string {
  const monthNumber = Number(month.slice(5, 7));
  const date = utcDate(`${month}-01`);
  date.setUTCMonth(monthNumber! - 1 + amount);
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastDayOfMonth(month: string): string {
  const monthNumber = Number(month.slice(5, 7));
  const date = utcDate(`${month}-01`);
  date.setUTCMonth(monthNumber!, 0);
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
  const lastMonth = addMonths(currentMonth, 12);
  const selectedMonth = isMonth(params.month) && params.month <= lastMonth
    ? params.month
    : currentMonth;
  const requestedFrom = `${selectedMonth}-01`;
  const client = await getClient();
  const data = await safe(client.crowdCalendar({
    parkSlug: selectedPark,
    from: requestedFrom,
    to: lastDayOfMonth(selectedMonth),
  }), null);
  const days = (data?.days ?? []).filter((day) => day.date.slice(0, 7) === selectedMonth);
  const daysByDate = new Map(days.map((day) => [day.date, day]));
  const monthDates = Array.from({ length: utcDate(lastDayOfMonth(selectedMonth)).getUTCDate() }, (_, index) => `${selectedMonth}-${String(index + 1).padStart(2, "0")}`);
  const isHistory = selectedMonth < currentMonth;
  const quietDays = days.filter((day) => day.level === "very-low" || day.level === "low");
  const busyDays = days.filter((day) => day.level === "high" || day.level === "very-high");
  const quietest = [...days].sort((a, b) => a.score - b.score)[0];
  const firstDay = utcDate(`${selectedMonth}-01`).getUTCDay();
  const canGoBack = selectedMonth > "0001-01";
  const canGoForward = selectedMonth < (data?.gate.visibleThrough?.slice(0, 7) ?? lastMonth);

  return (
    <main className="section page-refresh">
      <PageIntro eyebrow="A little flexibility goes a long way" title="Pick a lighter park day." action={{ href: "/plan", label: "Build your trip around your dates" }}>
      <p className="lede" style={{ marginTop: 12 }}>
        A date-by-date crowd outlook for Universal Orlando. It reads the demand signals Universal
        publishes—admission, Express Pass, and on-site hotel pricing—so you can spot lighter and
        heavier days before you build your itinerary.
      </p>
      </PageIntro>

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

      <form action="/crowd-calendar" method="get" className="crowd-month-picker">
        <input type="hidden" name="park" value={selectedPark} />
        <label>Jump to a month<input type="month" name="month" defaultValue={selectedMonth} max={lastMonth} required /></label>
        <button type="submit" className="btn btn-ghost btn-sm">Go to month</button>
      </form>
      <p className="tiny muted">Browse previous months to explore archived demand estimates. Past scores use the pricing signals collected for those dates; they are not measured attendance. Dates without archived signals show “No data.”</p>

      {data && days.length > 0 ? (
        <>
          <section className="grid grid-3" style={{ marginTop: 28 }}>
            <div className="card" style={{ background: "var(--teal-tint)", borderColor: "transparent" }}>
              <div className="tiny" style={{ fontWeight: 700, color: "#077368" }}>LIGHTER DAYS THIS MONTH</div>
              <div className="cal-price" style={{ color: "#077368", fontSize: 32 }}>{quietDays.length}</div>
              <div className="tiny muted">low or very low {isHistory ? "historical demand" : "outlook"}</div>
            </div>
            <div className="card" style={{ background: "var(--coral-tint)", borderColor: "transparent" }}>
              <div className="tiny" style={{ fontWeight: 700, color: "#b03514" }}>BUSIER DAYS THIS MONTH</div>
              <div className="cal-price" style={{ color: "#b03514", fontSize: 32 }}>{busyDays.length}</div>
              <div className="tiny muted">high or very high {isHistory ? "historical demand" : "outlook"}</div>
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

        </>
      ) : null}

          <section className="crowd-calendar" aria-label={`${PARKS.find((park) => park.slug === selectedPark)!.label} crowd calendar`}>
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
              {monthDates.map((date) => {
                const day = daysByDate.get(date);
                return day ? (
                <div
                  key={day.date}
                  className={`crowd-day crowd-${day.level}`}
                  title={`${day.date}: ${LEVEL_LABELS[day.level]} ${day.date < today ? "historical demand estimate" : "crowd outlook"} (${day.score}/10)`}
                >
                  <span className="crowd-date">{dateNumber(day.date)}</span>
                  <strong>{LEVEL_LABELS[day.level]}</strong>
                  <span className="crowd-score">{day.score}/10</span>
                </div>
              ) : <div key={date} className="crowd-day crowd-no-data" title={`${date}: no archived crowd signals available`}><span className="crowd-date">{dateNumber(date)}</span><strong>No data</strong></div>;
              })}
            </div>
          </section>

      {days.length > 0 ? (
          <section className="notice" style={{ marginTop: 34 }}>
            <b>How to use this:</b> this is a relative demand estimate, not a promise of a
            particular wait time. A higher score means Universal&apos;s own demand signals line up for
            a busier date. Check <a href={`/waits?park=${selectedPark}`}><b>live waits</b></a> when
            you&apos;re at the resort for what is happening right now.
            {data?.updatedAt ? <> Signals last refreshed from RateCoaster&apos;s collected pricing data.</> : null}
          </section>
      ) : (
        <div className="notice" style={{ marginTop: 28 }}>
          <b>{isHistory ? "No archived signals for this month." : "The crowd calendar is building."}</b>{" "}
          {isHistory ? "RateCoaster has no stored ticket, Express, or hotel demand signals for these dates. You can continue browsing earlier or later months." : "It will appear as ticket, Express, and hotel demand data become available for this park."}
        </div>
      )}
    </main>
  );
}
