import {
  centsToDisplay,
  RateCode,
  RATE_CODE_LABELS,
  type RateCode as RateCodeValue,
} from "@ratecoaster/shared";
import {
  getClient, EMPTY_GATE, formatLongDate, formatStayDate, getMe, relativeTime, safe, TIER_LABELS,
} from "@/lib/api";
import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { breadcrumbSchema, jsonLd, pageMetadata, SITE_URL } from "@/lib/seo";
import { WatchButton } from "@/components/WatchButton";

export const revalidate = 60;

/**
 * Per-hotel metadata — the highest-value SEO surface on the site.
 *
 * "cabana bay passholder rate" and its cousins are exactly the long-tail
 * queries this site should own, and they can only be won with a page whose
 * title and description name that specific hotel. A shared title makes eleven
 * hotels compete as one page and win nothing.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const client = await getClient();
  const properties = await safe(client.listProperties(), []);
  const property = properties.find((p) => p.slug === slug);

  if (!property) {
    return pageMetadata({
      title: "Hotel not found",
      description: "We don't track a hotel with that name yet.",
      path: `/hotels/${slug}`,
      noindex: true,
    });
  }

  const express = property.includesExpressPass
    ? " Includes free Express Unlimited for every guest in the room."
    : "";

  return pageMetadata({
    title: `${property.name} rates — passholder and standard prices`,
    description:
      `Nightly rates for ${property.name} for the next 365 nights, at Annual Passholder ` +
      `and standard prices, with price history so you can tell a genuine low from the ` +
      `new normal.${express}`,
    path: `/hotels/${slug}`,
  });
}

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
  searchParams: Promise<{ stayDate?: string; rateCode?: string; roomTypeId?: string }>;
}) {
  const { slug } = await params;
  const search = await searchParams;
  const client = await getClient();
  const [properties, filterOptions] = await Promise.all([
    safe(client.listProperties(), []),
    safe(client.rateFilterOptions({ propertySlug: slug }), { rateCodes: [], roomTypes: [] }),
  ]);

  const property = properties.find((p) => p.slug === slug);
  if (!property) {
    return (
      <main className="section">
        <h1>Hotel not found</h1>
        <p className="lede">We don&apos;t track a hotel with that name yet.</p>
        <a href="/hotels" className="btn btn-primary">See all hotels</a>
      </main>
    );
  }

  const availableRateCodes: RateCodeValue[] = filterOptions.rateCodes.length > 0
    ? filterOptions.rateCodes
    : ["STANDARD"];
  const requestedRateCode = search.rateCode
    ? RateCode.catch("STANDARD").parse(search.rateCode)
    : null;
  const rateCode = requestedRateCode && availableRateCodes.includes(requestedRateCode)
    ? requestedRateCode
    : availableRateCodes.includes("APH")
      ? "APH"
      : availableRateCodes[0]!;
  const rateChoices = availableRateCodes.map((code) => ({
    code,
    label: RATE_CODE_LABELS[code],
  }));
  const roomTypeId = filterOptions.roomTypes.some((room) => room.id === search.roomTypeId)
    ? search.roomTypeId
    : undefined;
  const selectedRoomType = filterOptions.roomTypes.find((room) => room.id === roomTypeId);
  const rates = await safe(
    client.listRates({ propertySlug: slug, rateCode, roomTypeId, limit: 500 }),
    {
      items: [], attribution: [], gate: EMPTY_GATE,
    } as Awaited<ReturnType<typeof client.listRates>> & { gate: typeof EMPTY_GATE }
  );
  const selectedDate = search.stayDate ?? rates.items[0]?.stayDate;

  const history = selectedDate
    ? await safe(client.rateHistory(slug, selectedDate, rateCode, roomTypeId), [])
    : [];

  const cheapest = [...rates.items].sort((a, b) => a.nightlyCents - b.nightlyCents)[0];
  const roomTypeParam = roomTypeId ? `&roomTypeId=${encodeURIComponent(roomTypeId)}` : "";
  // Decides whether the watch control invites a sign-up or creates the watch.
  const me = await getMe();

  /*
   * Hotel schema, with an offer only when a real price exists.
   *
   * Deliberately no `priceRange` or `offers` on an empty page. Structured data
   * asserting a price we do not have is worse than none: Google penalises
   * markup that contradicts the visible page, and a family seeing a fabricated
   * rate in a search result is exactly the harm this site exists to prevent.
   */
  const hotelSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: property.name,
    url: `${SITE_URL}/hotels/${slug}`,
    ...(property.latitude && property.longitude
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: property.latitude,
            longitude: property.longitude,
          },
        }
      : {}),
    ...(property.roomCount ? { numberOfRooms: property.roomCount } : {}),
    ...(cheapest
      ? {
          makesOffer: {
            "@type": "Offer",
            priceCurrency: "USD",
            price: (cheapest.nightlyCents / 100).toFixed(2),
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };

  return (
    <main className="section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(hotelSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Hotels", path: "/hotels" },
              { name: property.name, path: `/hotels/${slug}` },
            ])
          ),
        }}
      />
      <a href="/hotels" className="tiny muted">← All hotels</a>
      <h1 style={{ marginTop: 10 }}>{property.name}</h1>

      <WatchButton
        propertyId={property.id}
        propertyName={property.name}
        destination={property.destination}
        rateCode={rateCode}
        signedIn={Boolean(me.user)}
        returnTo={`/hotels/${slug}`}
      />

      {rateChoices.length > 1 ? (
        <div className="chips" style={{ margin: "16px 0 4px" }} aria-label="Rate type">
          {rateChoices.map((choice) => (
          <a
            key={choice.code}
            href={`/hotels/${slug}?rateCode=${choice.code}${selectedDate ? `&stayDate=${selectedDate}` : ""}${roomTypeParam}`}
            className={`chip ${rateCode === choice.code ? "on" : ""}`}
            aria-pressed={rateCode === choice.code}
          >
            {choice.label}
          </a>
          ))}
        </div>
      ) : null}

      {filterOptions.roomTypes.length > 1 ? (
        <form
          action={`/hotels/${slug}`}
          method="get"
          style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", margin: "14px 0 20px" }}
        >
          <input type="hidden" name="rateCode" value={rateCode} />
          {selectedDate ? <input type="hidden" name="stayDate" value={selectedDate} /> : null}
          <label style={{ minWidth: 260 }}>
            <span className="tiny muted" style={{ display: "block", marginBottom: 5, fontWeight: 700 }}>
              ROOM TYPE
            </span>
            <select className="field" name="roomTypeId" defaultValue={roomTypeId ?? ""}>
              <option value="">Cheapest available room</option>
              {filterOptions.roomTypes.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}{room.maxOccupancy ? ` · sleeps ${room.maxOccupancy}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-blue btn-sm">Apply</button>
        </form>
      ) : null}

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
          <div className="tiny muted" style={{ marginTop: 4 }}>
            {selectedRoomType?.name ?? cheapest.roomTypeName ?? "Cheapest available room"}
          </div>
        </div>
      ) : null}

      {history.length >= 2 ? (
          <section className="card" style={{ marginBottom: 28 }}>
            <h3>Price history — {selectedDate ? formatStayDate(selectedDate) : ""}</h3>
            <p className="tiny muted" style={{ marginBottom: 8 }}>
              {history.length} price changes. Flat stretches mean the rate held steady.
            </p>
            <PriceHistory points={history} />
          </section>
        ) : (
          <div className="notice">
            Not enough history for this date yet. A chart appears once the price has moved a
            couple of times.
          </div>
      )}

      <AdSlot
        placement="hotel-before-calendar"
        slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOTEL_DETAIL}
      />

      <h2 style={{ marginTop: 34 }}>Upcoming nights</h2>
      {selectedRoomType ? <p className="tiny muted">Showing {selectedRoomType.name}.</p> : null}
      <div
        className="table-wrap pricing-scroll"
        style={{ marginTop: 14 }}
        tabIndex={0}
        role="region"
        aria-label="Upcoming hotel nights; scroll horizontally and vertically to see all rates"
      >
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Room type</th>
              <th className="num">{rateCode === "APH" ? "Passholder" : "Standard"}</th>
              {rateCode === "APH" ? <th className="num">Standard</th> : null}
              {rateCode === "APH" ? <th className="num">You save</th> : null}
              <th className="num">Lowest seen</th>
              <th className="num">Checked</th>
            </tr>
          </thead>
          <tbody>
            {rates.items.map((rate) => (
              <tr key={rate.stayDate}>
                <td>
                  <a href={`/hotels/${slug}?stayDate=${rate.stayDate}&rateCode=${rateCode}${roomTypeParam}`}>
                    {formatStayDate(rate.stayDate)}
                  </a>
                </td>
                <td>{rate.roomTypeName ?? "Room"}</td>
                <td className="num" style={{ fontWeight: 600 }}>{centsToDisplay(rate.nightlyCents)}</td>
                {rateCode === "APH" ? (
                  <td className="num muted">{centsToDisplay(rate.standardNightlyCents)}</td>
                ) : null}
                {rateCode === "APH" ? (
                  <td className="num">
                    {rate.savingsCents && rate.savingsCents > 0 ? (
                      <span className="delta-down">{centsToDisplay(rate.savingsCents)}</span>
                    ) : <span className="muted">—</span>}
                  </td>
                ) : null}
                <td className="num muted">{centsToDisplay(rate.historicalLowCents)}</td>
                <td className="num muted tiny">{relativeTime(rate.observedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </main>
  );
}
