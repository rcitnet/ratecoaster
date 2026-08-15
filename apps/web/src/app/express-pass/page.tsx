import { centsToDisplay } from "@parkpulse/shared";
import { getClient, dayNumber, dayOfWeekLabel, formatLongDate, getMe, safe } from "@/lib/api";
import { Paywall } from "@/components/Paywall";

export const revalidate = 300;

export default async function ExpressPage({
  searchParams,
}: {
  searchParams: Promise<{ destination?: string }>;
}) {
  const params = await searchParams;
  const destination = (params.destination ?? "universal-orlando") as "universal-orlando";
  const client = await getClient();
  const [prices, me] = await Promise.all([
    safe(client.expressPassCalendar({ destination }), []),
    getMe(),
  ]);

  const values = prices.map((p) => p.priceCents).sort((a, b) => a - b);
  const low = values[0] ?? null;
  const high = values.at(-1) ?? null;
  const median = values[Math.floor(values.length / 2)] ?? null;

  return (
    <main className="section">
      <h1>Express Pass prices</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        The most volatile price on property. Express can more than double between a quiet Tuesday
        and a holiday Saturday — and it re-prices during the day as the park fills up. Worth
        watching rather than assuming.
      </p>

      {prices.length === 0 ? (
        <div className="notice">
          No Express Pass pricing yet. Once configured this collector runs every four hours, because
          Express moves intraday in a way hotel rates do not.
        </div>
      ) : (
        <>
          <div className="grid grid-3" style={{ margin: "24px 0 28px" }}>
            <div className="card" style={{ background: "var(--teal-tint)", borderColor: "transparent" }}>
              <div className="tiny" style={{ fontWeight: 700, color: "#077368" }}>CHEAPEST</div>
              <div className="cal-price" style={{ fontSize: 32, color: "#077368" }}>{centsToDisplay(low)}</div>
            </div>
            <div className="card">
              <div className="tiny" style={{ fontWeight: 700, color: "var(--ink-mute)" }}>TYPICAL</div>
              <div className="cal-price" style={{ fontSize: 32 }}>{centsToDisplay(median)}</div>
            </div>
            <div className="card" style={{ background: "var(--coral-tint)", borderColor: "transparent" }}>
              <div className="tiny" style={{ fontWeight: 700, color: "#b03514" }}>PEAK</div>
              <div className="cal-price" style={{ fontSize: 32, color: "#b03514" }}>{centsToDisplay(high)}</div>
            </div>
          </div>

          <div className="cal">
            {prices.map((p) => {
              const band = median === null ? "" : p.priceCents <= median * 0.9 ? "cal-low"
                : p.priceCents >= median * 1.25 ? "cal-high" : "";
              return (
                <div key={`${p.validDate}-${p.tier}`} className={`cal-day ${band} ${p.priceCents === low ? "cal-best" : ""}`}>
                  <div className="cal-dow">{dayOfWeekLabel(p.validDate)}</div>
                  <div className="tiny muted">{dayNumber(p.validDate)}</div>
                  <div className="cal-price">{centsToDisplay(p.priceCents)}</div>
                </div>
              );
            })}
          </div>

          <p className="tiny muted" style={{ marginTop: 22 }}>
            Premier hotels include Express Unlimited free for everyone in the room. For a family of
            four on a peak day that perk alone can be worth more than the room rate — which is why
            the hotel pages flag it.
          </p>
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
          what="Express Pass prices"
          returnTo="/express-pass"
        />
      ) : null}
    </main>
  );
}
