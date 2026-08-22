import {
  centsToDisplay,
  TripQuoteQuery,
  type TripQuote,
} from "@ratecoaster/shared";
import { AdSlot } from "@/components/AdSlot";
import { formatLongDate, getClient, TIER_LABELS } from "@/lib/api";

import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Price your Universal trip",
  description:
    "Pick your dates and party, and see hotel and ticket costs totalled for that exact stay — including how the Annual Passholder rate compares with the standard one.",
  path: "/plan",
});

export const revalidate = 0;

function todayInOrlando(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "01";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addIsoDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function numberParam(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function durationCopy(ticket: NonNullable<TripQuote["ticket"]>, rateCode: TripQuote["rateCode"]): string {
  if (rateCode === "APH") {
    return "One Epic Universe admission day; eligible admission at the other parks is assumed to be covered by your Annual Pass";
  }
  if (ticket.exactDurationMatch) return "Matches your trip length";
  return `${ticket.ticketDays}-day ticket is the closest tracked fit; ${ticket.uncoveredTripDays} trip day${ticket.uncoveredTripDays === 1 ? " is" : "s are"} not covered`;
}

export default async function TripPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    rooms?: string;
    adults?: string;
    children?: string;
    rateCode?: string;
  }>;
}) {
  const params = await searchParams;
  const today = todayInOrlando();
  const defaults = {
    checkIn: addIsoDays(today, 14),
    checkOut: addIsoDays(today, 17),
    rooms: 1,
    adults: 2,
    children: 0,
    rateCode: "STANDARD" as const,
  };
  const values = {
    checkIn: params.checkIn ?? defaults.checkIn,
    checkOut: params.checkOut ?? defaults.checkOut,
    rooms: numberParam(params.rooms, defaults.rooms),
    adults: numberParam(params.adults, defaults.adults),
    children: numberParam(params.children, defaults.children),
    rateCode: params.rateCode ?? defaults.rateCode,
  };
  const submitted = Boolean(params.checkIn || params.checkOut);
  const parsed = TripQuoteQuery.safeParse(values);
  let quote: TripQuote | null = null;
  let error: string | null = parsed.success ? null : "Check the dates and party details, then try again.";

  if (submitted && parsed.success) {
    try {
      quote = await (await getClient()).tripQuote(parsed.data);
    } catch (err) {
      error = err instanceof Error ? err.message : "We could not build this trip estimate yet.";
    }
  }

  return (
    <main className="section">
      <div className="trip-hero">
        <div>
          <span className="badge badge-purple">Orlando trip planner</span>
          <h1>Price the whole trip, not just one night</h1>
          <p className="lede">
            Enter your dates and party size. We&apos;ll find the least-expensive complete hotel stay
            and match it with the ticket duration that best fits your visit.
          </p>
        </div>

        <form action="/plan" method="get" className="trip-form">
          <label>
            <span>Check-in</span>
            <input className="field" type="date" name="checkIn" min={today} defaultValue={values.checkIn} required />
          </label>
          <label>
            <span>Check-out</span>
            <input className="field" type="date" name="checkOut" min={addIsoDays(today, 1)} defaultValue={values.checkOut} required />
          </label>
          <label>
            <span>Rooms</span>
            <input className="field" type="number" name="rooms" min="1" max="4" defaultValue={values.rooms} required />
          </label>
          <label>
            <span>Adults</span>
            <input className="field" type="number" name="adults" min="1" max="8" defaultValue={values.adults} required />
          </label>
          <label>
            <span>Children</span>
            <input className="field" type="number" name="children" min="0" max="8" defaultValue={values.children} required />
          </label>
          <label>
            <span>Hotel rate</span>
            <select className="field" name="rateCode" defaultValue={values.rateCode}>
              <option value="STANDARD">Standard rate</option>
              <option value="APH">Annual Passholder rate</option>
            </select>
          </label>
          <button type="submit" className="btn btn-primary btn-lg">Find my best trip price</button>
          <p className="tiny muted">The complete collected year is free to explore. Sign in only when you want to save a trip or receive alerts.</p>
        </form>
      </div>

      {error ? <div className="notice notice-warn"><b>We need one change:</b> {error}</div> : null}

      {quote ? (
        <section className="trip-results" aria-live="polite">
          <div className="trip-total-card">
            <div>
              <span className="badge badge-deal">Best complete estimate</span>
              <h2>{formatLongDate(quote.checkIn)} to {formatLongDate(quote.checkOut)}</h2>
              <p className="muted">
                {quote.nights} nights · {quote.tripDays} trip days · {quote.adults} adult{quote.adults === 1 ? "" : "s"}
                {quote.children ? ` · ${quote.children} child${quote.children === 1 ? "" : "ren"}` : ""}
              </p>
            </div>
            <div className="trip-grand-total">
              <span>Hotel + tickets</span>
              <strong>{centsToDisplay(quote.combinedTotalCents)}</strong>
              <small>estimated trip total</small>
            </div>
          </div>

          <div className="grid grid-2 trip-breakdown">
            <article className="card">
              <span className="badge badge-blue">Best hotel stay</span>
              {quote.hotel ? (
                <>
                  <h3>{quote.hotel.propertyName}</h3>
                  <p className="muted">
                    {TIER_LABELS[quote.hotel.tier] ?? quote.hotel.tier} · {quote.hotel.roomTypeName ?? "Room type pending"}
                  </p>
                  <div className="trip-price-line">
                    <strong>{centsToDisplay(quote.hotel.averageNightlyCents)}</strong><span>average / room / night</span>
                  </div>
                  <p>{centsToDisplay(quote.hotel.subtotalCents)} hotel subtotal for {quote.rooms} room{quote.rooms === 1 ? "" : "s"}</p>
                  {quote.hotel.includesExpressPass ? <span className="badge badge-express">Express Unlimited included</span> : null}
                  <div><a className="btn btn-ghost btn-sm" href={`/hotels/${quote.hotel.propertySlug}`}>See hotel rates</a></div>
                </>
              ) : <p>No hotel has one available room type for every night of this stay yet.</p>}
            </article>

            <article className="card">
              <span className="badge badge-purple">
                {quote.rateCode === "APH" ? "Epic Universe add-on" : "Recommended tickets"}
              </span>
              {quote.ticket ? (
                <>
                  <h3>{quote.ticket.productName}</h3>
                  <p className="muted">{durationCopy(quote.ticket, quote.rateCode)}</p>
                  <div className="trip-price-line">
                    <strong>{centsToDisplay(quote.ticket.subtotalCents)}</strong><span>party ticket subtotal</span>
                  </div>
                  <p className="tiny muted">
                    Adults {centsToDisplay(quote.ticket.adultUnitCents)} each
                    {quote.children ? ` · Children ${centsToDisplay(quote.ticket.childUnitCents)} each` : ""}
                  </p>
                  <div><a className="btn btn-ghost btn-sm" href={`/tickets?destination=universal-orlando&product=${quote.ticket.productSlug}`}>See ticket calendar</a></div>
                </>
              ) : <p>No tracked ticket price is available for the first day of this trip yet.</p>}
            </article>
          </div>

          {quote.hotelAlternatives.length ? (
            <>
              <h2 className="trip-alternatives-title">Other complete hotel options</h2>
              <div className="grid grid-3">
                {quote.hotelAlternatives.map((option) => (
                  <a key={option.propertySlug} href={`/hotels/${option.propertySlug}`} className="card card-hover">
                    <span className="badge">{TIER_LABELS[option.tier] ?? option.tier}</span>
                    <h3>{option.propertyName}</h3>
                    <p className="muted tiny">{option.roomTypeName ?? "Room type pending"}</p>
                    <div className="trip-price-line"><strong>{centsToDisplay(option.subtotalCents)}</strong><span>stay subtotal</span></div>
                  </a>
                ))}
              </div>
            </>
          ) : null}

          <div className="notice trip-assumptions">
            <b>How this estimate works</b>
            <ul>{quote.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
          </div>

          <AdSlot
            placement="planner-after-results"
            slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_PLANNER}
          />
        </section>
      ) : null}
    </main>
  );
}
