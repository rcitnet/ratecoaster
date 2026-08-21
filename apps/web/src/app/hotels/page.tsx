import {
  centsToDisplay,
  DestinationSlug,
  RateCode,
  RATE_CODE_LABELS,
  type RateCode as RateCodeValue,
} from "@ratecoaster/shared";
import {
  getClient, EMPTY_GATE, dayNumber, dayOfWeekLabel, relativeTime, safe, TIER_LABELS,
} from "@/lib/api";
import { AdSlot } from "@/components/AdSlot";
import { CompareButton } from "@/components/CompareButton";

export const revalidate = 60;

const DESTS = [
  { slug: "universal-orlando", label: "Orlando", dot: "#3355ee" },
  { slug: "universal-kids-frisco", label: "Frisco", dot: "#ffc53d" },
] as const;

export default async function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<{
    destination?: string;
    rateCode?: string;
    adults?: string;
    available?: string;
  }>;
}) {
  const params = await searchParams;
  const requestedDestination = DestinationSlug.catch("universal-orlando").parse(params.destination);
  const destination = requestedDestination === "universal-hollywood"
    ? "universal-orlando"
    : requestedDestination;
  // Straight off the query string, so it has to survive garbage: RateQuery
  // accepts 1–8, and a NaN would 400 the whole page the same way limit:900 did.
  const adultsRaw = Number(params.adults ?? 2);
  const adults = Number.isFinite(adultsRaw)
    ? Math.min(8, Math.max(1, Math.trunc(adultsRaw)))
    : 2;
  const availableOnly = params.available === "1";

  const client = await getClient();
  const filterOptions = await safe(client.rateFilterOptions({ destination }), {
    rateCodes: [],
    roomTypes: [],
  });
  const availableRateCodes: RateCodeValue[] = filterOptions.rateCodes.length > 0
    ? filterOptions.rateCodes
    : ["STANDARD"];
  const requestedRateCode = params.rateCode
    ? RateCode.catch("STANDARD").parse(params.rateCode)
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
  const [properties, rates] = await Promise.all([
    safe(client.listProperties(destination), []),
    // One row per hotel/date across the complete public year.
    safe(client.listRates({ destination, rateCode, adults, limit: 6000 }), {
      items: [], attribution: [], gate: EMPTY_GATE,
    } as Awaited<ReturnType<typeof client.listRates>> & { gate: typeof EMPTY_GATE }),
  ]);

  const dates = [...new Set(rates.items.map((r) => r.stayDate))].sort();
  const byProperty = new Map<string, Map<string, (typeof rates.items)[number]>>();
  for (const rate of rates.items) {
    if (!byProperty.has(rate.propertySlug)) byProperty.set(rate.propertySlug, new Map());
    byProperty.get(rate.propertySlug)!.set(rate.stayDate, rate);
  }
  const visibleProperties = availableOnly
    ? properties.filter((property) => byProperty.has(property.slug))
    : properties;
  const lastObserved = rates.items.map((r) => r.observedAt).sort().at(-1);
  const availabilityParam = availableOnly ? "&available=1" : "";

  return (
    <main className="section">
      <h1>Hotel rates</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        The cheapest available room at every hotel, night by night.
        {availableRateCodes.includes("APH")
          ? " Switch rate type to see exactly what the passholder discount is worth on each date."
          : " Rates shown are the plans currently published for this destination."}
        {lastObserved ? ` Updated ${relativeTime(lastObserved)}.` : ""}
      </p>

      <div className="chips">
        {DESTS.map((d) => (
          <a key={d.slug} href={`/hotels?destination=${d.slug}&rateCode=${rateCode}&adults=${adults}${availabilityParam}`}
             className={`chip ${destination === d.slug ? "on" : ""}`}>
            <span className="chip-dot" style={{ background: d.dot }} />
            {d.label}
          </a>
        ))}
      </div>

      <div className="chips" style={{ marginTop: 0 }}>
        {rateChoices.length > 1 ? rateChoices.map((c) => (
          <a key={c.code} href={`/hotels?destination=${destination}&rateCode=${c.code}&adults=${adults}${availabilityParam}`}
             className={`chip ${rateCode === c.code ? "on" : ""}`}>
            {c.label}
          </a>
        )) : null}
        <a
          href={`/hotels?destination=${destination}&rateCode=${rateCode}&adults=${adults}${availableOnly ? "" : "&available=1"}`}
          className={`chip ${availableOnly ? "on" : ""}`}
          aria-pressed={availableOnly}
        >
          Available only
        </a>
      </div>

      {rates.items.length === 0 ? (
        <div className="notice">
          <b>Rate tracking for these {properties.length} hotels isn&apos;t live yet.</b> We&apos;re
          working on it. In the meantime, <a href="/waits"><b>live ride wait times</b></a> are
          available for every park.
        </div>
      ) : (
        <div>
          <div
            className="table-wrap pricing-scroll"
            tabIndex={0}
            role="region"
            aria-label="Hotel prices by date; scroll horizontally and vertically to see all rates"
          >
            <table>
              <thead>
                <tr>
                  <th className="sticky-col" style={{ background: "var(--cream)", zIndex: 2 }}>Hotel</th>
                  {dates.map((date) => (
                    <th key={date} className="num">
                      <div style={{ fontSize: 11, opacity: 0.75 }}>{dayOfWeekLabel(date)}</div>
                      {dayNumber(date)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleProperties.map((property) => {
                  const row = byProperty.get(property.slug) ?? new Map();
                  const prices = [...row.values()].map((r) => r.nightlyCents);
                  const best = prices.length > 0 ? Math.min(...prices) : null;
                  return (
                    <tr key={property.slug}>
                      <td className="sticky-col">
                        <a href={`/hotels/${property.slug}`}>{property.name}</a>
                        <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                          <span className="badge">{TIER_LABELS[property.tier] ?? property.tier}</span>
                          {property.includesExpressPass ? (
                            <span className="badge badge-express">Express</span>
                          ) : null}
                        </div>
                      </td>
                      {dates.map((date) => {
                        const cell = row.get(date);
                        if (!cell) return <td key={date} className="num muted">—</td>;
                        const isBest = best !== null && cell.nightlyCents === best;
                        return (
                          <td key={date} className="num">
                            <span style={{
                              fontWeight: isBest ? 700 : 500,
                              color: isBest ? "#077368" : "var(--ink)",
                              background: isBest ? "var(--teal-tint)" : "transparent",
                              padding: isBest ? "3px 8px" : 0,
                              borderRadius: 8,
                            }}>
                              {centsToDisplay(cell.nightlyCents)}
                            </span>
                            {cell.savingsCents && cell.savingsCents > 0 ? (
                              <div className="tiny delta-down">save {centsToDisplay(cell.savingsCents)}</div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AdSlot
        placement="hotels-after-comparison"
        slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOTELS}
      />

      <h2 style={{ marginTop: 48 }}>Every hotel we track</h2>
      <div className="grid grid-3" style={{ marginTop: 18 }}>
        {properties.map((property) => (
          <a key={property.slug} href={`/hotels/${property.slug}`}>
            <div className="card card-hover">
              <h3 style={{ fontSize: 17 }}>{property.name}</h3>
              <div className="tiny muted" style={{ marginTop: 4 }}>
                {TIER_LABELS[property.tier] ?? property.tier} · {property.operator}
                {property.roomCount ? ` · ${property.roomCount.toLocaleString()} rooms` : ""}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {property.includesExpressPass ? (
                  <span className="badge badge-express">Free Express Unlimited</span>
                ) : null}
                {property.earlyParkAdmission ? (
                  <span className="badge badge-blue">Early park entry</span>
                ) : null}
              </div>
            </div>
          </a>
        ))}
      </div>

      {/*
        Off-site hotels, after the on-site list.
        Placed last on purpose: the on-site properties are what this site is for,
        and a family reading the rate grid should reach our data before an
        outbound link. Below the list it answers "what if none of these work?"
        rather than competing with the thing they came for.
      */}
      {/*
        Orlando only. Our merchant covers Orlando and Los Angeles; it has no
        Frisco inventory, and a "compare prices" button that lands on a page
        with nothing relevant on it is worse than no button.
      */}
      {destination === "universal-orlando" ? (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 20 }}>Staying off-site?</h2>
          <p className="muted" style={{ fontSize: 15, marginTop: 6 }}>
            We track the on-site hotels because that&apos;s where Express Pass and early
            entry live. For everything else in the area, this is where we&apos;d look.
          </p>
          <CompareButton linkKey="hotels-orlando" />
        </div>
      ) : null}
    </main>
  );
}
