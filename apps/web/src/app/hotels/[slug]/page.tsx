import { centsToDisplay, RateCode } from "@ratecoaster/shared";
import {
  getClient, EMPTY_GATE, formatLongDate, formatStayDate, getMe, relativeTime, safe, TIER_LABELS,
} from "@/lib/api";
import { Paywall, PaywallInline } from "@/components/Paywall";

export const revalidate = 60;

/**
 * Inline SVG step chart rather than a charting library.
 *
 * Because observations are only written when a price actually changes, this
 * series already IS a step function — no smoothing, no downsampling, and no
 * 90KB dependency to draw a dozen points.
 */
function PriceHistory({ points }: { points: Array<{ observedAt: string; nightlyCents: number }> }) {
  if (points.length < 2) return null;
  const w = 720, h = 200, pad = 26;
  const values = points.map((p) => p.nightlyCents);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);

  let d = `M ${x(0)} ${y(values[0]!)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${x(i)} ${y(values[i - 1]!)} L ${x(i)} ${y(values[i]!)}`;
  }
  const area = `${d} L ${x(points.length - 1)} ${h - pad} L ${x(0)} ${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Price history">
      <path d={area} fill="#e8ecff" />
      <path d={d} fill="none" stroke="#3355ee" strokeWidth="3" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={p.observedAt} cx={x(i)} cy={y(p.nightlyCents)} r="4" fill="#3355ee" />
      ))}
      <text x={pad} y={16} fontSize="12" fill="#7d76a3">{centsToDisplay(max)}</text>
      <text x={pad} y={h - 6} fontSize="12" fill="#7d76a3">{centsToDisplay(min)}</text>
    </svg>
  );
}

export default async function PropertyPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ stayDate?: string; rateCode?: string }>;
}) {
  const { slug } = await params;
  const search = await searchParams;
  const rateCode = RateCode.catch("APH").parse(search.rateCode);

  const client = await getClient();
  const [rates, me, properties] = await Promise.all([
    safe(client.listRates({ propertySlug: slug, rateCode, limit: 900 }), {
      items: [], attribution: [], gate: EMPTY_GATE,
    } as Awaited<ReturnType<typeof client.listRates>> & { gate: typeof EMPTY_GATE }),
    getMe(),
    safe(client.listProperties(), []),
  ]);

  const property = properties.find((p) => p.slug === slug);
  const gate = (rates as { gate?: typeof EMPTY_GATE }).gate ?? EMPTY_GATE;
  const selectedDate = search.stayDate ?? rates.items[0]?.stayDate;

  // Price history is a free-account feature; the API returns 402 for anonymous
  // callers, so an empty array here means "locked", not "no data".
  const history = selectedDate && me.entitlements.priceHistory
    ? await safe(client.rateHistory(slug, selectedDate, rateCode), [])
    : [];

  if (!property) {
    return (
      <main className="section">
        <h1>Hotel not found</h1>
        <p className="lede">We don&apos;t track a hotel with that name yet.</p>
        <a href="/hotels" className="btn btn-primary">See all hotels</a>
      </main>
    );
  }

  const cheapest = [...rates.items].sort((a, b) => a.nightlyCents - b.nightlyCents)[0];
  const here = `/hotels/${slug}`;

  return (
    <main className="section">
      <a href="/hotels" className="tiny muted">← All hotels</a>
      <h1 style={{ marginTop: 10 }}>{property.name}</h1>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0 20px" }}>
        <span className="badge badge-blue">{TIER_LABELS[property.tier] ?? property.tier}</span>
        {property.includesExpressPass ? (
          <span className="badge badge-express">Free Express Unlimited</span>
        ) : null}
        {property.earlyParkAdmission ? <span className="badge badge-deal">Early park entry</span> : null}
        {property.roomCount ? (
          <span className="badge">{property.roomCount.toLocaleString()} rooms</span>
        ) : null}
      </div>

      {cheapest ? (
        <div className="card" style={{ background: "var(--cream)", borderColor: "transparent", marginBottom: 26 }}>
          <div className="tiny muted" style={{ fontWeight: 700 }}>CHEAPEST NIGHT YOU CAN SEE</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
            <span className="deal-price">{centsToDisplay(cheapest.nightlyCents)}</span>
            <span className="muted">on {formatLongDate(cheapest.stayDate)}</span>
          </div>
        </div>
      ) : null}

      {me.entitlements.priceHistory ? (
        history.length >= 2 ? (
          <section className="card" style={{ marginBottom: 28 }}>
            <h3>Price history — {selectedDate ? formatStayDate(selectedDate) : ""}</h3>
            <p className="tiny muted" style={{ marginBottom: 8 }}>
              {history.length} price changes recorded. Flat stretches mean the rate held steady.
            </p>
            <PriceHistory points={history} />
          </section>
        ) : (
          <div className="notice">
            Not enough history for this date yet. Because only real changes are stored, a chart
            appears after the price has actually moved a couple of times.
          </div>
        )
      ) : (
        <div className="notice" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 240 }}>
            <b>See how this rate has moved.</b> Price history is free with an account — it&apos;s how
            you tell a genuine low from the new normal.
          </span>
          <a href={`/join?next=${encodeURIComponent(here)}`} className="btn btn-blue btn-sm">
            Unlock free
          </a>
        </div>
      )}

      {gate.gated ? <PaywallInline gate={gate} returnTo={here} /> : null}

      <h2 style={{ marginTop: 34 }}>Upcoming nights</h2>
      <div className={`table-wrap ${gate.gated ? "locked-preview" : ""}`} style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th className="num">Nightly</th>
              <th className="num">Public rate</th>
              <th className="num">You save</th>
              <th className="num">Lowest seen</th>
              <th className="num">Checked</th>
            </tr>
          </thead>
          <tbody>
            {rates.items.slice(0, 60).map((rate) => (
              <tr key={rate.stayDate}>
                <td>
                  <a href={`/hotels/${slug}?stayDate=${rate.stayDate}&rateCode=${rateCode}`}>
                    {formatStayDate(rate.stayDate)}
                  </a>
                </td>
                <td className="num" style={{ fontWeight: 600 }}>{centsToDisplay(rate.nightlyCents)}</td>
                <td className="num muted">{centsToDisplay(rate.standardNightlyCents)}</td>
                <td className="num">
                  {rate.savingsCents && rate.savingsCents > 0 ? (
                    <span className="delta-down">{centsToDisplay(rate.savingsCents)}</span>
                  ) : <span className="muted">—</span>}
                </td>
                <td className="num muted">{centsToDisplay(rate.historicalLowCents)}</td>
                <td className="num muted tiny">{relativeTime(rate.observedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paywall gate={gate} what="nights at this hotel" returnTo={here} />
    </main>
  );
}
