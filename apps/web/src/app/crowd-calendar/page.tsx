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

export default async function CrowdCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ park?: string }>;
}) {
  const requested = (await searchParams).park;
  const selectedPark = PARKS.some((park) => park.slug === requested)
    ? requested!
    : "universal-studios-florida";
  const client = await getClient();
  const data = await safe(client.crowdCalendar({ parkSlug: selectedPark }), null);
  const days = data?.days ?? [];
  const months = new Map<string, typeof days>();
  for (const day of days) {
    const key = monthLabel(day.date);
    const current = months.get(key) ?? [];
    current.push(day);
    months.set(key, current);
  }
  const quietDays = days.filter((day) => day.level === "very-low" || day.level === "low");
  const busyDays = days.filter((day) => day.level === "high" || day.level === "very-high");
  const quietest = [...days].sort((a, b) => a.score - b.score)[0];

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
            href={`/crowd-calendar?park=${park.slug}`}
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
              <div className="tiny" style={{ fontWeight: 700, color: "#077368" }}>LIGHTER DAYS AHEAD</div>
              <div className="cal-price" style={{ color: "#077368", fontSize: 32 }}>{quietDays.length}</div>
              <div className="tiny muted">low or very low outlook</div>
            </div>
            <div className="card" style={{ background: "var(--coral-tint)", borderColor: "transparent" }}>
              <div className="tiny" style={{ fontWeight: 700, color: "#b03514" }}>BUSIER DAYS AHEAD</div>
              <div className="cal-price" style={{ color: "#b03514", fontSize: 32 }}>{busyDays.length}</div>
              <div className="tiny muted">high or very high outlook</div>
            </div>
            <div className="card" style={{ background: "var(--blue-tint)", borderColor: "transparent" }}>
              <div className="tiny" style={{ fontWeight: 700, color: "var(--blue-dark)" }}>QUIETEST NEXT DATE</div>
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

          <section className="crowd-months" aria-label={`${data.park.name} crowd calendar`}>
            {[...months.entries()].map(([month, monthDays]) => {
              const firstDay = utcDate(monthDays[0]!.date).getUTCDay();
              return (
                <section className="crowd-month" key={month}>
                  <h2>{month}</h2>
                  <div className="crowd-weekdays" aria-hidden="true">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
                  </div>
                  <div className="crowd-grid">
                    {Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} />)}
                    {monthDays.map((day) => (
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
              );
            })}
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
