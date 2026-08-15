import { centsToDisplay } from "@ratecoaster/shared";
import { getClient, dayNumber, dayOfWeekLabel, formatLongDate, getMe, safe } from "@/lib/api";
import { Paywall } from "@/components/Paywall";

export const revalidate = 300;

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; destination?: string }>;
}) {
  const params = await searchParams;
  const destination = params.destination ?? "universal-orlando";
  const client = await getClient();
  const [products, me] = await Promise.all([
    safe(client.listTicketProducts(destination), []),
    getMe(),
  ]);
  const selected = params.product ?? products[0]?.slug;
  const calendar = selected
    ? await safe(client.ticketCalendar({ productSlug: selected, guestCategory: "adult" }), [])
    : [];

  const priced = calendar.filter((d) => d.priceCents !== null);
  const cheapest = [...priced].sort((a, b) => a.priceCents! - b.priceCents!)[0];
  const dearest = [...priced].sort((a, b) => b.priceCents! - a.priceCents!)[0];
  const swing = cheapest && dearest ? dearest.priceCents! - cheapest.priceCents! : 0;

  return (
    <main className="section">
      <h1>Ticket prices by date</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Universal prices admission dynamically — the same ticket costs noticeably more on a December
        Saturday than a September Tuesday. Green days are the cheapest third of what you can see.
      </p>

      <div className="chips">
        {products.map((p) => (
          <a key={p.slug} href={`/tickets?destination=${destination}&product=${p.slug}`}
             className={`chip ${selected === p.slug ? "on" : ""}`}>
            {p.name}
          </a>
        ))}
      </div>

      {calendar.length === 0 ? (
        <div className="notice">
          No ticket pricing collected yet. Storefronts return a whole calendar per request, so this
          collector is cheap once its endpoint is captured — about a dozen requests covers a year.
        </div>
      ) : (
        <>
          {cheapest ? (
            <div className="grid grid-3" style={{ margin: "24px 0 28px" }}>
              <div className="card" style={{ background: "var(--teal-tint)", borderColor: "transparent" }}>
                <div className="tiny" style={{ fontWeight: 700, color: "#077368" }}>CHEAPEST DAY</div>
                <div className="cal-price" style={{ fontSize: 32, color: "#077368" }}>
                  {centsToDisplay(cheapest.priceCents)}
                </div>
                <div className="tiny muted">{formatLongDate(cheapest.validDate)}</div>
              </div>
              <div className="card" style={{ background: "var(--coral-tint)", borderColor: "transparent" }}>
                <div className="tiny" style={{ fontWeight: 700, color: "#b03514" }}>PEAK DAY</div>
                <div className="cal-price" style={{ fontSize: 32, color: "#b03514" }}>
                  {centsToDisplay(dearest?.priceCents)}
                </div>
                <div className="tiny muted">{dearest ? formatLongDate(dearest.validDate) : ""}</div>
              </div>
              <div className="card" style={{ background: "var(--blue-tint)", borderColor: "transparent" }}>
                <div className="tiny" style={{ fontWeight: 700, color: "var(--blue-dark)" }}>
                  PICKING WELL SAVES
                </div>
                <div className="cal-price" style={{ fontSize: 32, color: "var(--blue-dark)" }}>
                  {centsToDisplay(swing)}
                </div>
                <div className="tiny muted">per ticket, same product</div>
              </div>
            </div>
          ) : null}

          <div className="cal">
            {calendar.map((day) => (
              <div key={day.validDate}
                   className={`cal-day ${day.band === "low" ? "cal-low" : day.band === "high" ? "cal-high" : ""} ${day.isWindowLow ? "cal-best" : ""}`}>
                <div className="cal-dow">{dayOfWeekLabel(day.validDate)}</div>
                <div className="tiny muted">{dayNumber(day.validDate)}</div>
                <div className="cal-price">{centsToDisplay(day.priceCents)}</div>
                {day.isWindowLow ? (
                  <span className="badge badge-hot" style={{ marginTop: 6 }}>Best</span>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}

      {me.entitlements.lookaheadDays < 365 ? (
        <Paywall
          gate={{
            gated: true, tier: "anonymous", requiredTier: "free",
            visibleDays: me.entitlements.lookaheadDays,
            withheldDays: 365 - me.entitlements.lookaheadDays,
            visibleThrough: null, reason: null,
          }}
          what="ticket prices"
          returnTo="/tickets"
        />
      ) : null}
    </main>
  );
}
