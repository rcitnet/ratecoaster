import type { HeroVariant, ParkHours, ParkState } from "@ratecoaster/shared";
import { PARK_COLORS } from "@/lib/api";
import { TripDateFields } from "@/components/TripDateFields";
import { addIsoDays } from "@/lib/trip-form";

export type HomeParkPulse = {
  park: { slug: string; name: string; timezone: string };
  average: number | null;
  state: ParkState;
  hours: ParkHours | null;
  openCount: number;
  walkOnCount: number;
  shortest?: { attractionName: string; waitMinutes: number | null };
};

export type HomeHeroStats = {
  hotelCount: number;
  parkCount: number;
  ticketCount: number;
  expressHotelCount: number;
};

function orlandoToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "01";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function Kicker() {
  return (
    <div className="hero-kicker">
      <span aria-hidden="true">✦</span> Live waits · 365-day price calendars
    </div>
  );
}

function Stats({ stats }: { stats: HomeHeroStats }) {
  return (
    <div className="hero-stats">
      <div>
        <div className="hero-stat-value">{stats.hotelCount}</div>
        <div className="hero-stat-label">official hotels tracked</div>
      </div>
      <div>
        <div className="hero-stat-value">{stats.parkCount || "—"}</div>
        <div className="hero-stat-label">Orlando parks monitored</div>
      </div>
      <div>
        <div className="hero-stat-value">{stats.ticketCount || "—"}</div>
        <div className="hero-stat-label">Orlando ticket types priced</div>
      </div>
      <div>
        <div className="hero-stat-value">{stats.expressHotelCount}</div>
        <div className="hero-stat-label">hotels with free Express</div>
      </div>
    </div>
  );
}

function PulseChips({ parks }: { parks: HomeParkPulse[] }) {
  if (parks.length === 0) {
    return (
      <div className="hero-pulse-empty">
        Live park waits are refreshing. The pulse will appear after the next collection.
      </div>
    );
  }

  return (
    <div className="hero-pulse">
      {parks.map(({ park, average, state }) => {
        const color = PARK_COLORS[park.slug] ?? "var(--blue)";
        return (
          <a href={`/waits?park=${park.slug}`} className="hero-pulse-chip" key={park.slug}>
            <div className="hero-pulse-name">{park.name}</div>
            <div className="hero-pulse-value" style={{ color }}>
              {average === null ? (state === "closed" ? "Closed" : "—") : average}
            </div>
            <div className="hero-pulse-unit">{average === null ? "today" : "min average"}</div>
          </a>
        );
      })}
    </div>
  );
}

function PlannerForm() {
  const today = orlandoToday();
  const checkIn = addIsoDays(today, 14);
  const checkOut = addIsoDays(today, 17);
  return (
    <form action="/plan" method="get" className="hero-plan">
      <TripDateFields
        initialCheckIn={checkIn}
        initialCheckOut={checkOut}
        today={today}
      />
      <label>
        Hotel rate
        <select className="field" name="rateCode" defaultValue="STANDARD">
          <option value="STANDARD">Standard rate</option>
          <option value="APH">Annual Passholder rate</option>
        </select>
      </label>
      <button type="submit" className="btn btn-primary">
        Price my trip
      </button>
    </form>
  );
}

function OriginalCopy({
  compact,
}: {
  compact?: boolean;
}) {
  return (
    <>
      <h1>Know when to go—and what it should cost.</h1>
      <p className="lede">
        {compact
          ? "Live waits, passholder hotel rates, and Orlando ticket prices. Dates that are a deal, not just the cheapest on the page."
          : "Live park waits, public and passholder hotel rates, and Orlando ticket prices in one place. Find shorter lines and dates that are genuinely a deal—not merely the cheapest option on the page."}
      </p>
    </>
  );
}

export function HomeHero({
  variant,
  stats,
  parks,
}: {
  variant: HeroVariant;
  stats: HomeHeroStats;
  parks: HomeParkPulse[];
}) {
  if (variant === "slim") {
    return (
      <section className="hero" data-hero="slim">
        <div className="hero-slim">
          <div>
            <Kicker />
            <h1>Know when to go—and what it should cost.</h1>
          </div>
          <div className="hero-actions">
            <a href="/plan" className="btn btn-primary">
              Price my trip
            </a>
          </div>
        </div>
      </section>
    );
  }

  if (variant === "split") {
    return (
      <section className="hero" data-hero="split">
        <div className="hero-split">
          <div>
            <Kicker />
            <h1>Know when to go.</h1>
            <p className="lede">
              Live waits plus passholder hotel and ticket prices for Universal Orlando.
            </p>
            <div className="hero-actions">
              <a href="/plan" className="btn btn-primary">
                Price my trip
              </a>
              <a href="#hotel-deals" className="btn btn-ghost">
                Hotel deals
              </a>
            </div>
          </div>
          <PulseChips parks={parks} />
        </div>
      </section>
    );
  }

  if (variant === "light") {
    return (
      <section className="hero" data-hero="light">
        <Kicker />
        <h1>Know when to go—and what it should cost.</h1>
        <p className="lede">Live waits, passholder hotel rates, and Orlando tickets. Free.</p>
        <div className="hero-actions">
          <a href="/plan" className="btn btn-primary">
            Price my trip
          </a>
          <a href="/waits" className="btn btn-ghost">
            Live wait times
          </a>
        </div>
      </section>
    );
  }

  if (variant === "planner") {
    return (
      <section className="hero" data-hero="planner">
        <Kicker />
        <h1>Price a Universal trip in one pass.</h1>
        <p className="lede">Hotels, tickets, and Express — with live park waits on the side.</p>
        <PlannerForm />
      </section>
    );
  }

  if (variant === "tiles") {
    const epic = parks.find((item) => item.park.slug === "epic-universe");
    const studios = parks.find((item) => item.park.slug === "universal-studios-florida");
    const waitHint =
      epic?.average != null && studios?.average != null
        ? `Epic ${epic.average}m · Studios ${studios.average}m`
        : "Updated throughout the day";
    return (
      <section className="hero" data-hero="tiles">
        <Kicker />
        <h1>Universal prices and waits, without the guesswork.</h1>
        <p className="lede">Free. Updated throughout the day.</p>
        <div className="hero-tiles">
          <a className="hero-tile hero-tile-plan" href="/plan">
            <h3>Price my trip</h3>
            <span>Hotels + tickets + Express</span>
          </a>
          <a className="hero-tile hero-tile-deals" href="#hotel-deals">
            <h3>Today&apos;s deals</h3>
            <span>Best rate in every category</span>
          </a>
          <a className="hero-tile hero-tile-waits" href="/waits">
            <h3>Live waits</h3>
            <span>{waitHint}</span>
          </a>
        </div>
      </section>
    );
  }

  if (variant === "pulse") {
    return (
      <section className="hero" data-hero="pulse">
        <div className="hero-pulse-bar">
          <h1>Know when to go — and what it should cost.</h1>
          <a href="/plan" className="btn btn-primary btn-sm">
            Price my trip
          </a>
        </div>
      </section>
    );
  }

  const compact = variant === "compact";
  return (
    <section className="hero" data-hero={compact ? "compact" : "current"}>
      <Kicker />
      <OriginalCopy compact={compact} />
      <div className="hero-actions">
        <a href="/plan" className={`btn btn-primary ${compact ? "" : "btn-lg"}`}>
          Price my trip
        </a>
        {compact ? (
          <a href="/waits" className="btn btn-ghost">
            Live waits
          </a>
        ) : (
          <>
            <a href="#hotel-deals" className="btn btn-ghost btn-lg">
              Today&apos;s best deals
            </a>
            <a href="/waits" className="btn btn-ghost btn-lg">
              Live wait times
            </a>
          </>
        )}
      </div>
      <Stats stats={stats} />
    </section>
  );
}
