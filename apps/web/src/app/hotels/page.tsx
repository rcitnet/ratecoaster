import {
  centsToDisplay,
  DestinationSlug,
  RateCode,
  RATE_CODE_LABELS,
  type RateCode as RateCodeValue,
} from "@ratecoaster/shared";
import {
  getPublicClient, EMPTY_GATE, dayNumber, dayOfWeekLabel, formatLongDate, relativeTime, safe, TIER_LABELS,
} from "@/lib/api";
import { AdSlot } from "@/components/AdSlot";
import { CompareButton } from "@/components/CompareButton";
import { PageIntro } from "@/components/PageIntro";
import { HotelPhoto } from "@/components/HotelPhoto";

import { pageMetadata } from "@/lib/seo";
import { PageExplainer } from "@/components/PageExplainer";

export const metadata = pageMetadata({
  title: "Universal hotel rates — a full year of prices",
  description:
    "Compare nightly rates across every on-site Universal hotel, at Annual Passholder and standard prices, for the next 365 nights. See which hotels include free Express Unlimited.",
  path: "/hotels",
});

export const revalidate = 60;

const DESTS = [
  { slug: "universal-orlando", label: "Orlando", dot: "#3355ee" },
  { slug: "universal-kids-frisco", label: "Frisco", dot: "#ffc53d" },
] as const;

const DATE_WINDOWS = [
  { id: "1", startOffset: 0, endOffset: 89, tag: "Next 90 days" },
  { id: "2", startOffset: 90, endOffset: 179, tag: "3–6 months out" },
  { id: "3", startOffset: 180, endOffset: 269, tag: "6–9 months out" },
  { id: "4", startOffset: 270, endOffset: 364, tag: "9–12 months out" },
] as const;

function todayInDestination(destination: string): string {
  const timeZone = destination === "universal-kids-frisco" ? "America/Chicago" : "America/New_York";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + days));
  return next.toISOString().slice(0, 10);
}

function windowRangeLabel(from: string, to: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };
  return `${fmt(from)} – ${fmt(to)}`;
}

export default async function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<{
    destination?: string;
    rateCode?: string;
    adults?: string;
    available?: string;
    window?: string;
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

  const today = todayInDestination(destination);
  const windows = DATE_WINDOWS.map((w) => {
    const from = addDaysIso(today, w.startOffset);
    const to = addDaysIso(today, w.endOffset);
    return { ...w, from, to, rangeLabel: windowRangeLabel(from, to) };
  });
  const activeWindow = windows.find((w) => w.id === params.window) ?? windows[0]!;

  const client = getPublicClient(60);
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
    // Bounded to a 90-day window so the HTML table stays snappy and the API
    // payload stays well under Next.js's 2 MB per-fetch Data Cache cap.
    safe(
      client.listRates({
        destination,
        rateCode,
        adults,
        from: activeWindow.from,
        to: activeWindow.to,
        limit: 1500,
      }),
      {
        items: [], attribution: [], gate: EMPTY_GATE,
      } as Awaited<ReturnType<typeof client.listRates>> & { gate: typeof EMPTY_GATE }
    ),
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
  const buildHref = (overrides: {
    destination?: string;
    rateCode?: string;
    available?: boolean;
    window?: string;
  }) => {
    const q = new URLSearchParams();
    q.set("destination", overrides.destination ?? destination);
    q.set("rateCode", overrides.rateCode ?? rateCode);
    q.set("adults", String(adults));
    const win = overrides.window ?? activeWindow.id;
    if (win !== "1") q.set("window", win);
    if (overrides.available ?? availableOnly) q.set("available", "1");
    return `/hotels?${q.toString()}`;
  };

  return (
    <main className="section page-refresh">
      <PageIntro eyebrow="Find your place in the adventure" title="Great stays. Smarter dates."
        image={destination === "universal-orlando" ? { src: "/hotels/royal-pacific.webp", alt: "Loews Royal Pacific Resort", label: "Loews Royal Pacific Resort · Orlando" } : undefined}
        action={{ href: "#hotel-calendar", label: "Compare nights side by side" }}>
      <p className="lede" style={{ marginTop: 12 }}>
        The cheapest available room at every hotel, night by night.
        {availableRateCodes.includes("APH")
          ? " Switch rate type to see exactly what the passholder discount is worth on each date."
          : " Rates shown are the plans currently published for this destination."}
        {lastObserved ? ` Updated ${relativeTime(lastObserved)}.` : ""}
      </p>
      </PageIntro>

      <div className="chips">
        {DESTS.map((d) => (
          <a key={d.slug} rel="nofollow" href={buildHref({ destination: d.slug })}
             className={`chip ${destination === d.slug ? "on" : ""}`}>
            <span className="chip-dot" style={{ background: d.dot }} />
            {d.label}
          </a>
        ))}
      </div>

      <div className="chips" style={{ marginTop: 0 }}>
        {rateChoices.length > 1 ? rateChoices.map((c) => (
          <a key={c.code} rel="nofollow" href={buildHref({ rateCode: c.code })}
             className={`chip ${rateCode === c.code ? "on" : ""}`}>
            {c.label}
          </a>
        )) : null}
        <a
          rel="nofollow"
          href={buildHref({ available: !availableOnly })}
          className={`chip ${availableOnly ? "on" : ""}`}
          aria-pressed={availableOnly}
        >
          Available only
        </a>
      </div>

      {visibleProperties.length > 0 ? (
        <section className="hotel-browse" aria-labelledby="hotel-browse-heading">
          <div className="refresh-section-head">
            <div><h2 id="hotel-browse-heading">A stay for your kind of trip.</h2><p>Explore the hotels, then compare your dates below.</p></div>
            <span className="tiny muted">Scroll to explore all {visibleProperties.length} hotels</span>
          </div>
          <div className="hotel-browse-strip" tabIndex={0} role="region" aria-label="Hotel photos and lowest tracked nights; scroll horizontally for more hotels">
            {visibleProperties.map((property) => {
              const lowest = [...(byProperty.get(property.slug)?.values() ?? [])].sort((a, b) => a.nightlyCents - b.nightlyCents)[0];
              return <a key={property.slug} className="hotel-browse-card" href={`/hotels/${property.slug}?rateCode=${rateCode}${lowest ? `&stayDate=${lowest.stayDate}` : ""}`}>
                <HotelPhoto slug={property.slug} name={property.name} />
                <div className="hotel-browse-copy">
                  <span className="refresh-eyebrow">{TIER_LABELS[property.tier] ?? property.tier}</span>
                  <h3>{property.name}</h3>
                  {property.includesExpressPass ? <span className="badge badge-express">Express Unlimited included</span> : null}
                  {lowest ? <><p><strong>{centsToDisplay(lowest.nightlyCents)}</strong> <span className="tiny muted">/ night</span></p><span className="tiny muted">{formatLongDate(lowest.stayDate)} · {RATE_CODE_LABELS[rateCode]} · before taxes and fees</span></> : <p className="tiny muted">Rates are being collected.</p>}
                  <span className="refresh-text-link">Explore this hotel →</span>
                </div>
              </a>;
            })}
          </div>
          {destination === "universal-orlando" ? <p className="tiny muted hotel-photo-credit">Hotel photography: Loews Hotels. Prices show the lowest tracked night for the selected rate and occupancy.</p> : null}
        </section>
      ) : null}

      <div className="refresh-section-head" id="hotel-calendar">
        <div>
          <p className="refresh-eyebrow">{activeWindow.tag} · {activeWindow.rangeLabel}</p>
          <h2>Compare every night.</h2>
        </div>
        <p>Lowest tracked rates in this 90-day window are highlighted in green.</p>
      </div>
      <div className="chips" style={{ marginTop: 0, marginBottom: 18 }} aria-label="90-day date window">
        {windows.map((w) => (
          <a
            key={w.id}
            rel="nofollow"
            href={`${buildHref({ window: w.id })}#hotel-calendar`}
            className={`chip ${activeWindow.id === w.id ? "on" : ""}`}
            aria-pressed={activeWindow.id === w.id}
          >
            {w.rangeLabel}
          </a>
        ))}
      </div>
      {rates.items.length === 0 ? (
        <div className="notice">
          <b>No {RATE_CODE_LABELS[rateCode]} rates published for {activeWindow.rangeLabel} yet.</b>{" "}
          {rateCode !== "STANDARD" ? (
            <>
              Universal typically releases passholder inventory closer to travel dates. Try{" "}
              <a rel="nofollow" href={buildHref({ rateCode: "STANDARD" })}><b>Standard rates</b></a>{" "}
              or switch to an earlier 90-day window above.
            </>
          ) : (
            <>Try another 90-day window above, or check <a href="/waits"><b>live ride wait times</b></a>.</>
          )}
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
        <div className="page-callout" style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 20 }}>Staying off-site?</h2>
          <p className="muted" style={{ fontSize: 15, marginTop: 6 }}>
            We track the on-site hotels because that&apos;s where Express Pass and early
            entry live. For everything else in the area, this is where we&apos;d look.
          </p>
          <CompareButton linkKey="hotels-orlando" />
        </div>
      ) : null}

      <PageExplainer page="hotels" />
    </main>
  );
}
