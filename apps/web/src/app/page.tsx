import { centsToDisplay } from "@ratecoaster/shared";
import {
  formatLongDate,
  getClient,
  PARK_COLORS,
  relativeTime,
  safe,
  TIER_COLORS,
  TIER_LABELS,
} from "@/lib/api";
import { AdSlot } from "@/components/AdSlot";

export const revalidate = 60;

const HOME_TIERS = ["premier", "preferred", "prime-value", "value"] as const;

export default async function DealsPage() {
  const client = await getClient();
  const [deals, properties, waits, ticketProducts] = await Promise.all([
    safe(client.listDeals({ destination: "universal-orlando", limit: 40 }), []),
    safe(client.listProperties(), []),
    safe(client.liveWaits({ destination: "universal-orlando" }), {
      parks: [],
      attribution: [],
      fetchedAt: new Date().toISOString(),
    }),
    safe(client.listTicketProducts("universal-orlando"), []),
  ]);

  // This headline describes hotel inventory, not whichever deal rows happen
  // to be visible today. Counting deals made the number drop to zero whenever
  // rate collection was still warming up (and could over-count one hotel when
  // several dates appeared in the deal feed).
  const withExpress = properties.filter((property) => property.includesExpressPass).length;
  const orlandoProperties = properties.filter(
    (property) => property.destination === "universal-orlando"
  );
  const parkSummaries = waits.parks.map(({ park, waits: parkWaits }) => {
    const open = parkWaits.filter(
      (wait) => wait.status === "operating" && wait.waitMinutes !== null
    );
    const average = open.length
      ? Math.round(open.reduce((sum, wait) => sum + (wait.waitMinutes ?? 0), 0) / open.length)
      : null;
    const shortest = [...open].sort(
      (a, b) => (a.waitMinutes ?? Number.MAX_SAFE_INTEGER) - (b.waitMinutes ?? Number.MAX_SAFE_INTEGER)
    )[0];

    return {
      park,
      average,
      openCount: open.length,
      walkOnCount: open.filter((wait) => (wait.waitMinutes ?? 99) <= 15).length,
      shortest,
    };
  });
  const dealsByTier = HOME_TIERS.map((tier) => ({
    tier,
    propertyCount: orlandoProperties.filter((property) => property.tier === tier).length,
    deal: deals
      .filter((deal) => deal.tier === tier)
      .sort(
        (a, b) =>
          (a.percentileOfHistory ?? Number.MAX_SAFE_INTEGER) -
            (b.percentileOfHistory ?? Number.MAX_SAFE_INTEGER) ||
          a.nightlyCents - b.nightlyCents
      )[0],
  })).filter(({ propertyCount }) => propertyCount > 0);

  return (
    <main>
      <section className="hero">
        <div className="hero-kicker">
          <span aria-hidden="true">✦</span> Live waits · 365-day price calendars
        </div>
        <h1>Know when to go—and what it should cost.</h1>
        <p className="lede">
          Live park waits, public and passholder hotel rates, and Orlando ticket prices in one
          place. Find shorter lines and dates that are genuinely a deal—not merely the cheapest
          option on the page.
        </p>
        <div className="hero-actions">
          <a href="/plan" className="btn btn-primary btn-lg">
            Price my trip
          </a>
          <a href="#hotel-deals" className="btn btn-ghost btn-lg" style={{ borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}>
            Today&apos;s best deals
          </a>
          <a href="/waits" className="btn btn-ghost btn-lg" style={{ borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}>
            Live wait times
          </a>
        </div>

        <div className="hero-stats">
          <div>
            <div className="hero-stat-value">{properties.length}</div>
            <div className="hero-stat-label">official hotels tracked</div>
          </div>
          <div>
            <div className="hero-stat-value">{parkSummaries.length || "—"}</div>
            <div className="hero-stat-label">Orlando parks monitored</div>
          </div>
          <div>
            <div className="hero-stat-value">{ticketProducts.length || "—"}</div>
            <div className="hero-stat-label">Orlando ticket types priced</div>
          </div>
          <div>
            <div className="hero-stat-value">{withExpress}</div>
            <div className="hero-stat-label">hotels with free Express</div>
          </div>
        </div>
      </section>

      <AdSlot
        placement="home-after-park-pulse"
        slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME}
      />

      <section className="section" style={{ paddingBottom: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "end",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div>
            <span className="badge badge-deal" style={{ marginBottom: 10 }}>
              Live now
            </span>
            <h2>Orlando park pulse</h2>
            <p className="lede" style={{ marginTop: 8 }}>
              Average posted standby wait for operating attractions, broken out by park.
            </p>
          </div>
          <a href="/waits" className="btn btn-ghost">
            See every attraction
          </a>
        </div>

        {parkSummaries.length === 0 ? (
          <div className="notice">
            <b>Live park waits are refreshing.</b> The park pulse will appear as soon as the next
            collection finishes.
          </div>
        ) : (
          <div className="grid grid-4">
            {parkSummaries.map(({ park, average, openCount, walkOnCount, shortest }) => {
              const color = PARK_COLORS[park.slug] ?? "var(--blue)";
              return (
                <a
                  href={`/waits?park=${park.slug}`}
                  className="card card-hover"
                  key={park.slug}
                  style={{ borderTop: `5px solid ${color}` }}
                >
                  <div className="tiny muted" style={{ fontWeight: 700, minHeight: 42 }}>
                    {park.name.toUpperCase()}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 8 }}>
                    <span
                      className="display"
                      style={{ fontSize: 42, color: average === null ? "var(--ink-mute)" : color }}
                    >
                      {average ?? "—"}
                    </span>
                    <span className="tiny muted">min average</span>
                  </div>
                  <div className="tiny muted" style={{ marginTop: 10 }}>
                    {openCount > 0
                      ? `${openCount} attractions reporting · ${walkOnCount} at 15 min or less`
                      : "No operating attractions reporting right now"}
                  </div>
                  {shortest ? (
                    <div
                      className="tiny"
                      style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}
                    >
                      <b>Shortest posted:</b> {shortest.attractionName} · {shortest.waitMinutes}m
                    </div>
                  ) : null}
                </a>
              );
            })}
          </div>
        )}

        {parkSummaries.length > 0 ? (
          <p className="tiny muted" style={{ marginTop: 14 }}>
            Updated {relativeTime(waits.fetchedAt)}. Average excludes closed and unavailable
            attractions.
            {waits.attribution.map((credit) => (
              <span key={credit.source}>
                {" "}·{" "}
                <a href={credit.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                  {credit.text}
                </a>
              </span>
            ))}
          </p>
        ) : null}
      </section>

      <section className="section" id="hotel-deals">
        <div
          style={{
            display: "flex",
            alignItems: "end",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div>
            <h2>Today&apos;s best deal in every Orlando hotel category</h2>
            <p className="lede" style={{ marginTop: 8 }}>
              Premier should not compete with Value on raw price. Each pick is the strongest
              current passholder rate against that hotel&apos;s own observed history.
            </p>
          </div>
          <a href="/hotels" className="btn btn-ghost">
            Compare all hotel rates
          </a>
        </div>

        {deals.length === 0 ? (
          <div className="notice">
            <b>We&apos;re still gathering hotel rates.</b> Live ride wait times are up and
            running now — <a href="/waits"><b>take a look</b></a> while we finish.
          </div>
        ) : (
          <div className="grid grid-4">
            {dealsByTier.map(({ tier, propertyCount, deal }) => {
              if (!deal) {
                return (
                  <article className="card deal" key={tier}>
                    <div
                      className="deal-band"
                      style={{ background: TIER_COLORS[tier] ?? "var(--blue)" }}
                    >
                      <span className="deal-tier">{TIER_LABELS[tier] ?? tier}</span>
                    </div>
                    <div className="deal-body">
                      <div className="deal-name">Rates are being collected</div>
                      <div className="deal-when" style={{ marginTop: 8 }}>
                        Watching {propertyCount} {propertyCount === 1 ? "hotel" : "hotels"} in this
                        category.
                      </div>
                    </div>
                  </article>
                );
              }

              const atLow = (deal.percentileOfHistory ?? 100) < 5;
              return (
                <a key={`${deal.propertySlug}-${deal.stayDate}`} href={`/hotels/${deal.propertySlug}`}>
                  <article className="card card-hover deal">
                    <div
                      className="deal-band"
                      style={{ background: TIER_COLORS[deal.tier] ?? TIER_COLORS.value }}
                    >
                      <span className="deal-tier">{TIER_LABELS[deal.tier] ?? deal.tier}</span>
                    </div>

                    <div className="deal-body">
                      <div className="deal-name">{deal.propertyName}</div>
                      <div className="deal-when">{formatLongDate(deal.stayDate)}</div>

                      <div className="deal-price-row">
                        <span className="deal-price">{centsToDisplay(deal.nightlyCents)}</span>
                        <span className="deal-per">/ night</span>
                      </div>

                      <div className="deal-perks">
                        <span className="badge badge-deal">Best in category</span>
                        {atLow ? <span className="badge badge-hot">Lowest ever seen</span> : null}
                        {deal.includesExpressPass ? (
                          <span className="badge badge-express">Free Express Unlimited</span>
                        ) : null}
                        <span className="badge badge-blue">Passholder rate</span>
                      </div>
                    </div>
                  </article>
                </a>
              );
            })}
          </div>
        )}
      </section>

      <section className="section-tight">
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
            padding: "28px 30px",
            background: "linear-gradient(135deg, var(--blue-tint), var(--purple-tint))",
            borderColor: "transparent",
          }}
        >
          <div style={{ maxWidth: 700 }}>
            <span className="badge badge-purple" style={{ marginBottom: 10 }}>
              New: Orlando tickets
            </span>
            <h2>See the real total before picking your park dates.</h2>
            <p className="lede" style={{ marginTop: 8, marginBottom: 0 }}>
              Compare adult and child prices for Universal Studios, Islands of Adventure, Epic
              Universe, Volcano Bay, and multi-day Park-to-Park tickets across the full year.
            </p>
          </div>
          <a href="/tickets" className="btn btn-blue btn-lg">
            Explore ticket calendars
          </a>
        </div>
      </section>

      <section className="section">
        <h2>Why families use this</h2>
        <div className="grid grid-3" style={{ marginTop: 20 }}>
          <div className="card">
            <span className="badge badge-deal" style={{ marginBottom: 10 }}>
              Honest pricing
            </span>
            <h3>Real passholder rates</h3>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: 15 }}>
              Every passholder saving we show is one you can actually book. If the discount
              doesn&apos;t apply on a date, we won&apos;t pretend it does.
            </p>
          </div>
          <div className="card">
            <span className="badge badge-purple" style={{ marginBottom: 10 }}>
              Know when to book
            </span>
            <h3>See the full price history</h3>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: 15 }}>
              Find out whether today&apos;s price is a genuine low or simply the new normal —
              before you put down a deposit.
            </p>
          </div>
          <div className="card">
            <span className="badge badge-coral" style={{ marginBottom: 10 }}>
              Worth more than the room
            </span>
            <h3>Express Pass, counted</h3>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: 15 }}>
              Premier hotels include Express Unlimited for everyone in your room. For a family of
              four in peak season that perk can be worth more per night than the room itself.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
