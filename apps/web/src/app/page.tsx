import { centsToDisplay } from "@ratecoaster/shared";
import { getClient, getMe, safe, formatLongDate, TIER_COLORS, TIER_LABELS } from "@/lib/api";
import { Paywall } from "@/components/Paywall";

export const revalidate = 60;

export default async function DealsPage() {
  const client = await getClient();
  const [deals, me] = await Promise.all([safe(client.listDeals({ limit: 24 }), []), getMe()]);

  const cheapest = deals[0];
  const withExpress = deals.filter((d) => d.includesExpressPass).length;

  return (
    <main>
      <section className="hero">
        <div className="hero-kicker">
          <span aria-hidden="true">✦</span> Free forever · No card required
        </div>
        <h1>The best week to go is cheaper than you think.</h1>
        <p className="lede">
          We check every Universal hotel — Orlando, Hollywood and the new Frisco resort — every few
          hours, at both the passholder rate and the public one. Then we tell you which nights are
          genuinely a bargain, not just cheap.
        </p>
        <div className="hero-actions">
          <a href="/hotels" className="btn btn-primary btn-lg">
            See hotel rates
          </a>
          <a href="/waits" className="btn btn-ghost btn-lg" style={{ borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}>
            Live wait times
          </a>
        </div>

        <div className="hero-stats">
          <div>
            <div className="hero-stat-value">16</div>
            <div className="hero-stat-label">hotels tracked</div>
          </div>
          <div>
            <div className="hero-stat-value">365</div>
            <div className="hero-stat-label">days ahead</div>
          </div>
          <div>
            <div className="hero-stat-value">
              {cheapest ? centsToDisplay(cheapest.nightlyCents) : "—"}
            </div>
            <div className="hero-stat-label">cheapest night right now</div>
          </div>
          <div>
            <div className="hero-stat-value">{withExpress}</div>
            <div className="hero-stat-label">with free Express Pass</div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Tonight&apos;s standout deals</h2>
        <p className="lede" style={{ marginBottom: 26 }}>
          Ranked by how good each price is against that hotel&apos;s <em>own</em> history — so a
          $520 night at Portofino can outrank a $180 night somewhere else, because it&apos;s the
          bigger genuine saving.
        </p>

        {deals.length === 0 ? (
          <div className="notice">
            <b>We&apos;re still gathering hotel rates.</b> Live ride wait times are up and
            running now — <a href="/waits"><b>take a look</b></a> while we finish.
          </div>
        ) : (
          <div className="grid grid-3">
            {deals.map((deal) => {
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

      {/* The wall only appears for signed-out visitors, and only below content
          they can already use — never in place of it. */}
      {me.entitlements.lookaheadDays < 365 ? (
        <Paywall
          gate={{
            gated: true,
            tier: "anonymous",
            requiredTier: "free",
            visibleDays: me.entitlements.lookaheadDays,
            withheldDays: 365 - me.entitlements.lookaheadDays,
            visibleThrough: null,
            reason: null,
          }}
          what="hotel rates"
          returnTo="/"
        />
      ) : null}

      <section className="section">
        <h2>Why families use this</h2>
        <div className="grid grid-3" style={{ marginTop: 20 }}>
          <div className="card">
            <span className="badge badge-deal" style={{ marginBottom: 10 }}>
              Honest pricing
            </span>
            <h3>Real passholder rates</h3>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: 15 }}>
              We query the same public promo-code field you would. When the booking engine quietly
              ignores the code and quotes the public price, we throw that reading away rather than
              show you a discount that isn&apos;t real.
            </p>
          </div>
          <div className="card">
            <span className="badge badge-purple" style={{ marginBottom: 10 }}>
              Know when to book
            </span>
            <h3>Every price change, kept</h3>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: 15 }}>
              We record each move a rate makes, so you can see whether today&apos;s number is a
              genuine low or simply the new normal — before you put down a deposit.
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
