import { centsToDisplay, type RateCoasterClient } from "@ratecoaster/shared";
import type { ReactNode } from "react";
import { EMPTY_GATE, getPublicClient, relativeTime, safe } from "@/lib/api";
import type { GuideLiveKey } from "@/lib/guides";

/**
 * Figures computed from RateCoaster's own tracked data, rendered inside a guide.
 *
 * The reason this exists: an article that says "rooms are usually cheapest in
 * September" is something every travel site can write. An article that shows
 * the median tracked rate for each of the next twelve months is something only
 * a site holding the data can publish — and it stays correct without anyone
 * editing the article.
 *
 * Every block returns null when the data is not there. A guide with no box
 * reads fine; a guide with an empty table reads as broken.
 */

type Rates = Awaited<ReturnType<RateCoasterClient["listRates"]>>["items"];
type Properties = Awaited<ReturnType<RateCoasterClient["listProperties"]>>;

const ORLANDO = "universal-orlando" as const;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/** Linear-interpolated percentile, p in [0, 1]. */
function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return Math.round(sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower));
}

function latest(stamps: string[]): string | undefined {
  return [...stamps].sort().at(-1);
}

function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year!, m! - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Dates here can be up to a year out, so the year is always shown. "Tue, Mar 30"
 * is unambiguous in a calendar grid and ambiguous in a sentence.
 */
function formatStayDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

async function orlandoRates(client: RateCoasterClient, rateCode: "STANDARD" | "APH"): Promise<Rates> {
  const result = await safe(
    client.listRates({ destination: ORLANDO, rateCode, limit: 6000 }),
    { items: [], attribution: [], gate: EMPTY_GATE } as Awaited<ReturnType<RateCoasterClient["listRates"]>>
  );
  return result.items.filter((rate) => rate.available);
}

function Shell({
  title,
  asOf,
  note,
  children,
}: {
  title: string;
  asOf?: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <aside className="guide-live" aria-label="Figures from RateCoaster's tracked data">
      <p className="refresh-eyebrow">
        From our tracker{asOf ? ` · last checked ${relativeTime(asOf)}` : ""}
      </p>
      <h2>{title}</h2>
      {process.env.DEMO_MODE === "1" ? (
        <p className="tiny"><b>Demo mode.</b> These are sample figures, not real quotes.</p>
      ) : null}
      {children}
      {note ? <p className="tiny muted guide-live-note">{note}</p> : null}
    </aside>
  );
}

function Table({ head, rows, label }: { head: string[]; rows: ReactNode[][]; label: string }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={label}>
      <table>
        <thead>
          <tr>{head.map((cell, i) => <th key={cell} className={i === 0 ? undefined : "num"}>{cell}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>{row.map((cell, i) => <td key={i} className={i === 0 ? undefined : "num"}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */

async function HotelLows({ client, properties }: { client: RateCoasterClient; properties: Properties }) {
  const rates = await orlandoRates(client, "STANDARD");
  if (rates.length === 0) return null;

  const rows: ReactNode[][] = [];
  for (const property of properties) {
    const own = rates.filter((rate) => rate.propertySlug === property.slug);
    const low = [...own].sort((a, b) => a.nightlyCents - b.nightlyCents)[0];
    if (!low) continue;
    rows.push([
      <a key="name" href={`/hotels/${property.slug}`}>{property.name}</a>,
      property.includesExpressPass ? "Yes" : "No",
      centsToDisplay(low.nightlyCents),
      formatStayDate(low.stayDate),
      centsToDisplay(median(own.map((rate) => rate.nightlyCents))),
    ]);
  }
  if (rows.length === 0) return null;

  return (
    <Shell
      title="What each hotel costs right now"
      asOf={latest(rates.map((rate) => rate.observedAt))}
      note="Standard rate, least expensive available room for two adults, per night before tax, across every night currently tracked."
    >
      <Table
        label="Lowest and median tracked nightly rate by hotel"
        head={["Hotel", "Express included", "Lowest night", "On", "Median night"]}
        rows={rows}
      />
    </Shell>
  );
}

async function HotelMonths({ client, properties }: { client: RateCoasterClient; properties: Properties }) {
  const rates = await orlandoRates(client, "STANDARD");
  if (rates.length === 0) return null;
  const express = new Set(properties.filter((p) => p.includesExpressPass).map((p) => p.slug));

  const months = [...new Set(rates.map((rate) => rate.stayDate.slice(0, 7)))].sort().slice(0, 13);
  const summary = months.map((month) => {
    const inMonth = rates.filter((rate) => rate.stayDate.startsWith(month));
    return {
      month,
      // A month with a handful of nights is the ragged edge of the tracking
      // window, and its median would describe three days, not a month.
      nights: new Set(inMonth.map((rate) => rate.stayDate)).size,
      other: median(inMonth.filter((rate) => !express.has(rate.propertySlug)).map((rate) => rate.nightlyCents)),
      withExpress: median(inMonth.filter((rate) => express.has(rate.propertySlug)).map((rate) => rate.nightlyCents)),
      low: Math.min(...inMonth.map((rate) => rate.nightlyCents)),
    };
  }).filter((row) => row.nights >= 10 && row.other !== null);
  if (summary.length < 2) return null;

  // Only near-complete months are named as lowest or highest. The first and
  // last months of the window are usually partial, and three weeks that happen
  // to include or miss a holiday are not a fair picture of the month.
  const complete = summary.filter((row) => row.nights >= 25);
  if (complete.length < 2) return null;
  const ranked = [...complete].sort((a, b) => (a.other ?? 0) - (b.other ?? 0));
  const cheapest = ranked[0]!;
  const dearest = ranked.at(-1)!;

  return (
    <Shell
      title="Median nightly rate by month"
      asOf={latest(rates.map((rate) => rate.observedAt))}
      note="Standard rate, least expensive available room for two adults, per night before tax. The median is taken across every tracked hotel-night in the month. The first and last months shown may cover only part of the month, and rates for months far ahead often change before they arrive."
    >
      <p>
        Among the complete months currently tracked, the lowest is <b>{monthLabel(cheapest.month)}</b> at
        a median of {centsToDisplay(cheapest.other)} a night at hotels without Express, and the
        highest is <b>{monthLabel(dearest.month)}</b> at {centsToDisplay(dearest.other)}.
      </p>
      <Table
        label="Median tracked nightly hotel rate by month"
        head={["Month", "Hotels without Express", "Express-included hotels", "Lowest single night"]}
        rows={summary.map((row) => [
          row.nights >= 25 ? monthLabel(row.month) : `${monthLabel(row.month)} (part)`,
          centsToDisplay(row.other),
          centsToDisplay(row.withExpress),
          centsToDisplay(row.low),
        ])}
      />
    </Shell>
  );
}

async function PremierMath({ client, properties }: { client: RateCoasterClient; properties: Properties }) {
  const [rates, products] = await Promise.all([
    orlandoRates(client, "STANDARD"),
    safe(client.listExpressPassProducts(ORLANDO), []),
  ]);
  const product =
    products.find((p) => p.passType === "unlimited" && p.days === 1 && p.parkCount === 2) ??
    products.find((p) => p.passType === "unlimited" && p.days === 1);
  if (rates.length === 0 || !product) return null;

  const prices = await safe(client.expressPassCalendar({ productSlug: product.slug }), []);
  const passByDate = new Map(
    prices.filter((price) => price.available).map((price) => [price.validDate, price.totalCents])
  );
  const express = new Set(properties.filter((p) => p.includesExpressPass).map((p) => p.slug));
  if (express.size === 0 || passByDate.size === 0) return null;

  const cheapestWith = new Map<string, number>();
  const cheapestWithout = new Map<string, number>();
  for (const rate of rates) {
    const bucket = express.has(rate.propertySlug) ? cheapestWith : cheapestWithout;
    const current = bucket.get(rate.stayDate);
    if (current === undefined || rate.nightlyCents < current) bucket.set(rate.stayDate, rate.nightlyCents);
  }

  const premiums: number[] = [];
  const passCosts: number[] = [];
  const wins = { 2: 0, 3: 0, 4: 0, 5: 0 };
  const winsOneDay = { 2: 0, 3: 0, 4: 0, 5: 0 };
  let compared = 0;
  for (const [date, withExpress] of cheapestWith) {
    const without = cheapestWithout.get(date);
    const dayOne = passByDate.get(date);
    const dayTwo = passByDate.get(addDays(date, 1));
    if (without === undefined || dayOne === undefined || dayTwo === undefined) continue;
    compared += 1;
    const premium = withExpress - without;
    premiums.push(premium);
    passCosts.push(dayOne);
    // One night covers check-in day and check-out day, so up to two days of
    // passes. Many parties would only have bought Express for one of them, so
    // both cases are counted.
    for (const party of [2, 3, 4, 5] as const) {
      if (premium < party * (dayOne + dayTwo)) wins[party] += 1;
      if (premium < party * Math.min(dayOne, dayTwo)) winsOneDay[party] += 1;
    }
  }
  if (compared < 14) return null;

  const share = (count: number) => `${count} of ${compared} (${Math.round((count / compared) * 100)}%)`;

  return (
    <Shell
      title="How often the Express-included hotel costs less"
      asOf={latest(rates.map((rate) => rate.observedAt))}
      note={
        <>
          For each tracked night: the least expensive Express-included hotel minus the least
          expensive other on-site hotel, compared with buying {product.name} for each person.
          The first column assumes you would have bought it for both the check-in day and the
          following day, the second for only the cheaper of those two days. Room rates are the
          standard rate for two adults before tax, so a larger party may need a bigger room.
        </>
      }
    >
      <p>
        Across {compared} upcoming nights, the median room premium for an Express-included hotel
        is <b>{centsToDisplay(median(premiums))}</b> a night, and the median one-day pass
        is <b>{centsToDisplay(median(passCosts))}</b> per person.
      </p>
      <Table
        label="Nights on which an Express-included hotel costs less than a cheaper hotel plus purchased Express"
        head={["Party size", "Cheaper than buying Express for both days", "Cheaper than buying Express for one day"]}
        rows={([2, 3, 4, 5] as const).map((party) => [
          `${party} people`,
          share(wins[party]),
          share(winsOneDay[party]),
        ])}
      />
    </Shell>
  );
}

async function PassholderSavings({ client, properties }: { client: RateCoasterClient; properties: Properties }) {
  const rates = await orlandoRates(client, "APH");
  if (rates.length === 0) return null;

  const rows: ReactNode[][] = [];
  for (const property of properties) {
    const own = rates.filter((rate) => rate.propertySlug === property.slug);
    const discounted = own.filter(
      (rate) => rate.savingsCents !== null && rate.savingsCents > 0 && rate.standardNightlyCents
    );
    if (own.length === 0) continue;
    const percents = discounted.map((rate) => (rate.savingsCents! / rate.standardNightlyCents!) * 100);
    const medianPercent = median(percents.map((value) => Math.round(value)));
    rows.push([
      <a key="name" href={`/hotels/${property.slug}?rateCode=APH`}>{property.name}</a>,
      `${discounted.length} of ${own.length}`,
      discounted.length > 0 ? centsToDisplay(median(discounted.map((rate) => rate.savingsCents!))) : "—",
      medianPercent !== null ? `${medianPercent}%` : "—",
      discounted.length > 0
        ? `${centsToDisplay(percentile(discounted.map((rate) => rate.savingsCents!), 0.25))} to ${centsToDisplay(percentile(discounted.map((rate) => rate.savingsCents!), 0.75))}`
        : "—",
    ]);
  }
  if (rows.length === 0) return null;

  return (
    <Shell
      title="What the passholder rate is saving right now"
      asOf={latest(rates.map((rate) => rate.observedAt))}
      note="Per night before tax, for two adults, across every night currently tracked. Each figure compares the least expensive passholder room with the least expensive standard rate recorded for the same night, which are not always the same room type, so check the exact saving for your room and dates on the hotel page and at checkout."
    >
      <Table
        label="Tracked Annual Passholder savings by hotel"
        head={["Hotel", "Nights with a saving", "Median saving", "Median %", "Middle half of nights"]}
        rows={rows}
      />
    </Shell>
  );
}

async function TicketRange({ client }: { client: RateCoasterClient }) {
  const products = (await safe(client.listTicketProducts(ORLANDO), [])).slice(0, 8);
  if (products.length === 0) return null;

  const calendars = await Promise.all(
    products.map((product) =>
      safe(client.ticketCalendar({ productSlug: product.slug, guestCategory: "adult" }), [])
    )
  );

  const rows: ReactNode[][] = [];
  products.forEach((product, index) => {
    const days = (calendars[index] ?? [])
      .map((day) => ({
        date: day.validDate,
        cents: (product.days ?? 1) > 1 ? (day.totalCents ?? day.priceCents) : day.priceCents,
        available: day.available,
      }))
      .filter((day): day is { date: string; cents: number; available: boolean } => day.available && day.cents !== null);
    if (days.length === 0) return;
    const sorted = [...days].sort((a, b) => a.cents - b.cents);
    const low = sorted[0]!;
    const high = sorted.at(-1)!;
    rows.push([
      <a key="name" href={`/tickets?product=${product.slug}`}>{product.name}</a>,
      centsToDisplay(low.cents),
      formatStayDate(low.date),
      centsToDisplay(high.cents),
      formatStayDate(high.date),
    ]);
  });
  if (rows.length === 0) return null;

  return (
    <Shell
      title="Lowest and highest tracked ticket prices"
      note="Adult price for the whole ticket, before tax, across every start date currently tracked."
    >
      <Table
        label="Lowest and highest tracked adult ticket price by product"
        head={["Ticket", "Lowest", "Starting", "Highest", "Starting"]}
        rows={rows}
      />
    </Shell>
  );
}

async function ExpressRange({ client }: { client: RateCoasterClient }) {
  const products = (await safe(client.listExpressPassProducts(ORLANDO), []))
    .filter((product) => product.days === 1)
    .slice(0, 8);
  if (products.length === 0) return null;

  const calendars = await Promise.all(
    products.map((product) => safe(client.expressPassCalendar({ productSlug: product.slug }), []))
  );

  const rows: ReactNode[][] = [];
  const stamps: string[] = [];
  products.forEach((product, index) => {
    const days = (calendars[index] ?? []).filter((day) => day.available);
    if (days.length === 0) return;
    stamps.push(...days.map((day) => day.observedAt));
    const sorted = [...days].sort((a, b) => a.totalCents - b.totalCents);
    const low = sorted[0]!;
    const high = sorted.at(-1)!;
    rows.push([
      <a key="name" href={`/express-pass?product=${product.slug}`}>{product.name.replace(/^1-Day /, "")}</a>,
      centsToDisplay(low.totalCents),
      formatStayDate(low.validDate),
      centsToDisplay(high.totalCents),
      formatStayDate(high.validDate),
    ]);
  });
  if (rows.length === 0) return null;

  return (
    <Shell
      title="How far one-day Express prices swing"
      asOf={latest(stamps)}
      note="Per person for one day, before tax, across every date currently tracked."
    >
      <Table
        label="Lowest and highest tracked one-day Express Pass price by product"
        head={["One-day pass", "Lowest", "On", "Highest", "On"]}
        rows={rows}
      />
    </Shell>
  );
}

async function WaitsNow({ client }: { client: RateCoasterClient }) {
  const data = await safe(
    client.liveWaits({ destination: ORLANDO, ridesOnly: true }),
    { parks: [], attribution: [], fetchedAt: new Date().toISOString() }
  );
  const open = data.parks
    .flatMap((entry) => entry.waits)
    .filter((wait) => wait.status === "operating" && wait.waitMinutes !== null);
  if (open.length === 0) return null;

  const compared = open.filter((wait) => wait.vsTypicalMinutes !== null && wait.typicalMinutes !== null);
  const row = (wait: (typeof open)[number]): ReactNode[] => [
    <a key="name" href={`/waits/${wait.attractionSlug}`}>{wait.attractionName}</a>,
    wait.parkName.replace(/^Universal(?:'s)? /, ""),
    `${wait.waitMinutes} min`,
    wait.typicalMinutes !== null ? `${wait.typicalMinutes} min` : "—",
  ];

  if (compared.length < 6) {
    const longest = [...open].sort((a, b) => (b.waitMinutes ?? 0) - (a.waitMinutes ?? 0)).slice(0, 8);
    return (
      <Shell title="Longest waits right now" asOf={data.fetchedAt} note="Posted standby waits at operating rides in the Universal Orlando parks.">
        <Table label="Longest current ride waits" head={["Ride", "Park", "Now", "Typical for this hour"]} rows={longest.map(row)} />
      </Shell>
    );
  }

  // A ride sitting exactly on its typical wait belongs in neither list.
  const below = compared
    .filter((wait) => (wait.vsTypicalMinutes ?? 0) <= -5)
    .sort((a, b) => (a.vsTypicalMinutes ?? 0) - (b.vsTypicalMinutes ?? 0))
    .slice(0, 5);
  const above = compared
    .filter((wait) => (wait.vsTypicalMinutes ?? 0) >= 5)
    .sort((a, b) => (b.vsTypicalMinutes ?? 0) - (a.vsTypicalMinutes ?? 0))
    .slice(0, 5);

  return (
    <Shell
      title="Rides furthest from their usual wait right now"
      asOf={data.fetchedAt}
      note="Posted standby waits at operating rides in the Universal Orlando parks, compared with each ride's typical wait for this hour from stored history. When the parks are closed this box is empty."
    >
      {below.length > 0 ? (
        <>
          <h3>Shorter than usual</h3>
          <Table label="Rides currently below their typical wait" head={["Ride", "Park", "Now", "Typical for this hour"]} rows={below.map(row)} />
        </>
      ) : null}
      {above.length > 0 ? (
        <>
          <h3>Longer than usual</h3>
          <Table label="Rides currently above their typical wait" head={["Ride", "Park", "Now", "Typical for this hour"]} rows={above.map(row)} />
        </>
      ) : null}
      {below.length === 0 && above.length === 0 ? (
        <p>Every operating ride is within five minutes of its typical wait for this hour.</p>
      ) : null}
    </Shell>
  );
}

async function CrowdOutlook({ client }: { client: RateCoasterClient }) {
  const today = new Date().toISOString().slice(0, 10);
  const parks = [
    { slug: "universal-studios-florida", label: "Universal Studios Florida" },
    { slug: "islands-of-adventure", label: "Islands of Adventure" },
    { slug: "epic-universe", label: "Epic Universe" },
  ];
  const calendars = await Promise.all(
    parks.map((park) =>
      safe(client.crowdCalendar({ parkSlug: park.slug, from: today, to: addDays(today, 29) }), null)
    )
  );

  const rows: ReactNode[][] = [];
  parks.forEach((park, index) => {
    const days = calendars[index]?.days ?? [];
    if (days.length === 0) return;
    const quiet = days.filter((day) => day.level === "low" || day.level === "very-low").length;
    const busy = days.filter((day) => day.level === "high" || day.level === "very-high").length;
    const calmest = [...days].sort((a, b) => a.score - b.score)[0]!;
    const busiest = [...days].sort((a, b) => b.score - a.score)[0]!;
    rows.push([
      <a key="name" href={`/crowd-calendar?park=${park.slug}`}>{park.label}</a>,
      `${quiet} of ${days.length}`,
      `${busy} of ${days.length}`,
      `${formatStayDate(calmest.date)} (${calmest.score}/10)`,
      `${formatStayDate(busiest.date)} (${busiest.score}/10)`,
    ]);
  });
  if (rows.length === 0) return null;

  return (
    <Shell
      title="The next 30 days at a glance"
      note="A demand outlook built from Universal's published admission, Express Pass and hotel pricing. It ranks dates against each other and is not a wait-time forecast."
    >
      <Table
        label="Crowd outlook for the next 30 days by park"
        head={["Park", "Lighter days", "Busier days", "Lowest-scored day", "Highest-scored day"]}
        rows={rows}
      />
    </Shell>
  );
}

/* ------------------------------------------------------------------ */

export async function GuideLive({ kind }: { kind: GuideLiveKey }) {
  const client = getPublicClient(300);
  const needsProperties =
    kind === "hotel-lows" || kind === "hotel-months" || kind === "premier-math" || kind === "passholder-savings";
  const properties = needsProperties ? await safe(client.listProperties(ORLANDO), []) : [];

  switch (kind) {
    case "hotel-lows":
      return <HotelLows client={client} properties={properties} />;
    case "hotel-months":
      return <HotelMonths client={client} properties={properties} />;
    case "premier-math":
      return <PremierMath client={client} properties={properties} />;
    case "passholder-savings":
      return <PassholderSavings client={client} properties={properties} />;
    case "ticket-range":
      return <TicketRange client={client} />;
    case "express-range":
      return <ExpressRange client={client} />;
    case "waits-now":
      return <WaitsNow client={client} />;
    case "crowd-outlook":
      return <CrowdOutlook client={client} />;
  }
}
