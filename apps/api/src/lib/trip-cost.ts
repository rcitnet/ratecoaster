import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import type { Db } from "@ratecoaster/db";
import {
  flightQuoteCurrent,
  properties,
  rateCurrent,
  ticketPriceCurrent,
  ticketProducts,
} from "@ratecoaster/db/schema";
import {
  DESTINATION_AIRPORTS,
  type DestinationSlug,
  type RateCode,
  type TripCostDay,
} from "@ratecoaster/shared";
import { addDays, dateRange } from "../collectors/framework/dates.js";

/**
 * The trip-cost calculation: flights + hotel + tickets, per candidate start date.
 *
 * This is the piece of the product that nobody else can build. The OTAs have
 * flights and public hotel rates but no passholder rates; the passholder sites
 * have rates but no flights or tickets. Putting all three on one calendar is
 * what turns "here are some prices" into "go the week of March 8th and save
 * $1,400".
 *
 * The governing rule below is that a missing component is never treated as
 * zero. A planner that totals two of three legs produces a number that is wrong
 * in the most damaging direction — too low — and the family only finds out at
 * someone else's checkout page. Partial days therefore carry a null total and
 * an explicit list of what is missing.
 */

export interface TripCostInput {
  destination: DestinationSlug;
  origin?: string;
  adults: number;
  children: number;
  nights: number;
  parkDays: number;
  rateCode: RateCode;
  propertySlug?: string;
  parkToPark: boolean;
  from: string;
  to: string;
}

type MissingLeg = "flights" | "hotel" | "tickets";

/**
 * Nightly rates are stored per stay-date, so an N-night stay is the sum of N
 * consecutive nights at the same property.
 *
 * Summing per property rather than taking the cheapest hotel each night matters:
 * "cheapest per night across all hotels" would quietly propose moving the family
 * to a different resort every morning.
 */
function sumStay(
  ratesByProperty: Map<string, Map<string, number>>,
  propertyId: string,
  startDate: string,
  nights: number
): number | null {
  const byDate = ratesByProperty.get(propertyId);
  if (!byDate) return null;

  let total = 0;
  for (let i = 0; i < nights; i++) {
    const night = byDate.get(addDays(startDate, i));
    // A single missing night invalidates the stay. Extrapolating across the gap
    // would invent a price for a night we have never seen.
    if (night === undefined) return null;
    total += night;
  }
  return total;
}

export async function computeTripCosts(
  db: Db,
  input: TripCostInput
): Promise<{ days: TripCostDay[]; notes: string[] }> {
  const notes: string[] = [];
  const partySize = input.adults + input.children;

  /*
   * Fetch a window that extends `nights` beyond the requested end, because a
   * trip starting on the last visible date still needs the nights after it.
   * Without this the final week of every window would silently price as
   * incomplete.
   */
  const rateWindowEnd = addDays(input.to, input.nights);

  /* ---------- hotels ---------- */

  const propertyFilter = [
    eq(properties.active, true),
    eq(properties.destination, input.destination),
  ];
  if (input.propertySlug) propertyFilter.push(eq(properties.slug, input.propertySlug));

  const props = await db
    .select({
      id: properties.id,
      slug: properties.slug,
      name: properties.name,
      includesExpressPass: properties.includesExpressPass,
    })
    .from(properties)
    .where(and(...propertyFilter));

  const propertyById = new Map(props.map((p) => [p.id, p]));

  const ratesByProperty = new Map<string, Map<string, number>>();
  let oldestRateObservedAt: Date | null = null;

  if (props.length > 0) {
    const rateRows = await db
      .select({
        propertyId: rateCurrent.propertyId,
        stayDate: rateCurrent.stayDate,
        nightlyCents: rateCurrent.nightlyCents,
        observedAt: rateCurrent.observedAt,
      })
      .from(rateCurrent)
      .where(
        and(
          inArray(
            rateCurrent.propertyId,
            props.map((p) => p.id)
          ),
          eq(rateCurrent.rateCode, input.rateCode),
          eq(rateCurrent.nights, 1),
          eq(rateCurrent.available, true),
          gte(rateCurrent.stayDate, input.from),
          lte(rateCurrent.stayDate, rateWindowEnd)
        )
      )
      .orderBy(asc(rateCurrent.nightlyCents));

    for (const row of rateRows) {
      let byDate = ratesByProperty.get(row.propertyId);
      if (!byDate) {
        byDate = new Map();
        ratesByProperty.set(row.propertyId, byDate);
      }
      // Rows arrive cheapest-first, so the first sighting of a date is the
      // cheapest room type for that night.
      if (!byDate.has(row.stayDate)) byDate.set(row.stayDate, row.nightlyCents);
      if (!oldestRateObservedAt || row.observedAt < oldestRateObservedAt) {
        oldestRateObservedAt = row.observedAt;
      }
    }
  }

  if (ratesByProperty.size === 0) notes.push("No hotel rates collected yet.");

  /* ---------- tickets ---------- */

  /*
   * Ticket products are matched on day count and park scope. Universal prices a
   * multi-day ticket as a bundle, not as a day rate, so a 3-day ticket is the
   * only correct answer for a 3-park-day trip — multiplying a 1-day price would
   * overstate the cost by a wide margin and make every trip look worse than it is.
   */
  const wantedKinds = input.parkToPark
    ? (["park-to-park-1-day", "park-to-park-multi-day"] as const)
    : (["single-park-1-day", "single-park-multi-day"] as const);

  const ticketByDate = new Map<string, number>();
  let oldestTicketObservedAt: Date | null = null;

  if (input.parkDays > 0) {
    const candidates = await db
      .select({ id: ticketProducts.id, days: ticketProducts.days })
      .from(ticketProducts)
      .where(
        and(
          eq(ticketProducts.destination, input.destination),
          eq(ticketProducts.active, true),
          inArray(ticketProducts.kind, [...wantedKinds])
        )
      );

    const product = candidates.find((p) => p.days === input.parkDays);

    if (!product) {
      notes.push(
        `No ${input.parkDays}-day ${input.parkToPark ? "park-to-park" : "single-park"} ticket is tracked yet.`
      );
    } else {
      const ticketRows = await db
        .select({
          validDate: ticketPriceCurrent.validDate,
          guestCategory: ticketPriceCurrent.guestCategory,
          priceCents: ticketPriceCurrent.priceCents,
          observedAt: ticketPriceCurrent.observedAt,
        })
        .from(ticketPriceCurrent)
        .where(
          and(
            eq(ticketPriceCurrent.productId, product.id),
            eq(ticketPriceCurrent.available, true),
            gte(ticketPriceCurrent.validDate, input.from),
            lte(ticketPriceCurrent.validDate, rateWindowEnd)
          )
        );

      /*
       * Adult and child are priced separately and the gap is real money on a
       * multi-day ticket. Where only an adult price exists we use it for
       * everyone: overstating a child ticket is the safe direction to be wrong.
       */
      const adultByDate = new Map<string, number>();
      const childByDate = new Map<string, number>();
      for (const row of ticketRows) {
        if (!row.validDate) continue;
        const target = row.guestCategory === "child" ? childByDate : adultByDate;
        const existing = target.get(row.validDate);
        if (existing === undefined || row.priceCents < existing) {
          target.set(row.validDate, row.priceCents);
        }
        if (!oldestTicketObservedAt || row.observedAt < oldestTicketObservedAt) {
          oldestTicketObservedAt = row.observedAt;
        }
      }

      for (const [date, adultCents] of adultByDate) {
        const childCents = childByDate.get(date) ?? adultCents;
        ticketByDate.set(date, adultCents * input.adults + childCents * input.children);
      }

      if (ticketByDate.size === 0) notes.push("No ticket prices collected yet.");
    }
  }

  /* ---------- flights ---------- */

  const flightByDate = new Map<
    string,
    { priceCents: number; airline: string | null; transfers: number | null; observedAt: Date }
  >();

  if (input.origin) {
    const airport = DESTINATION_AIRPORTS[input.destination];
    const flightRows = await db
      .select({
        departDate: flightQuoteCurrent.departDate,
        priceCents: flightQuoteCurrent.priceCents,
        airline: flightQuoteCurrent.airline,
        transfers: flightQuoteCurrent.transfers,
        observedAt: flightQuoteCurrent.observedAt,
      })
      .from(flightQuoteCurrent)
      .where(
        and(
          eq(flightQuoteCurrent.origin, input.origin),
          eq(flightQuoteCurrent.destination, airport),
          eq(flightQuoteCurrent.tripLengthDays, input.nights),
          gte(flightQuoteCurrent.departDate, input.from),
          lte(flightQuoteCurrent.departDate, input.to)
        )
      );

    for (const row of flightRows) flightByDate.set(row.departDate, row);

    if (flightRows.length === 0) {
      notes.push(
        `No cached fares from ${input.origin} for a ${input.nights}-night trip yet.`
      );
    }
  }

  /* ---------- combine ---------- */

  const days = combineTripDays(input, {
    ratesByProperty,
    propertyById,
    oldestRateObservedAt,
    ticketByDate,
    oldestTicketObservedAt,
    flightByDate,
  });

  return { days, notes };
}

/* ------------------------------------------------------------------ *
 * The pure part
 * ------------------------------------------------------------------ */

export interface TripCostTables {
  /** propertyId -> stayDate -> cheapest nightly cents. */
  ratesByProperty: Map<string, Map<string, number>>;
  propertyById: Map<
    string,
    { slug: string; name: string; includesExpressPass: boolean }
  >;
  oldestRateObservedAt: Date | null;
  /** First-park-day date -> total ticket cost for the whole party. */
  ticketByDate: Map<string, number>;
  oldestTicketObservedAt: Date | null;
  /** Departure date -> per-passenger fare and itinerary detail. */
  flightByDate: Map<
    string,
    { priceCents: number; airline: string | null; transfers: number | null; observedAt: Date }
  >;
}

/**
 * Combine the three priced legs into a calendar.
 *
 * Kept free of the database so the arithmetic — which is the part a family
 * makes a four-figure decision on — can be tested directly against known
 * inputs, rather than only through a live Postgres with real collector data in
 * it. Every rule about what may be totalled lives here and nowhere else.
 */
export function combineTripDays(
  input: TripCostInput,
  tables: TripCostTables
): TripCostDay[] {
  const {
    ratesByProperty,
    propertyById,
    oldestRateObservedAt,
    ticketByDate,
    oldestTicketObservedAt,
    flightByDate,
  } = tables;

  const partySize = input.adults + input.children;
  const days: TripCostDay[] = [];

  for (const startDate of dateRange(input.from, dayCount(input.from, input.to))) {
    const missing: MissingLeg[] = [];
    let oldest: Date | null = null;
    const noteOldest = (d: Date | null) => {
      if (d && (!oldest || d < oldest)) oldest = d;
    };

    // Hotel: cheapest property that can cover the whole stay.
    let hotelCents: number | null = null;
    let hotelSlug: string | null = null;
    let hotelName: string | null = null;
    let hotelExpress = false;

    for (const [propertyId] of ratesByProperty) {
      const stay = sumStay(ratesByProperty, propertyId, startDate, input.nights);
      if (stay === null) continue;
      if (hotelCents === null || stay < hotelCents) {
        const p = propertyById.get(propertyId);
        hotelCents = stay;
        hotelSlug = p?.slug ?? null;
        hotelName = p?.name ?? null;
        hotelExpress = p?.includesExpressPass ?? false;
      }
    }
    if (hotelCents === null) missing.push("hotel");
    else noteOldest(oldestRateObservedAt);

    // Tickets: priced from the first park day, which is the day after arrival
    // unless the family asked for park days equal to nights.
    let ticketsCents: number | null = null;
    if (input.parkDays === 0) {
      ticketsCents = 0;
    } else {
      const firstParkDay =
        input.parkDays >= input.nights ? startDate : addDays(startDate, 1);
      const found = ticketByDate.get(firstParkDay);
      if (found === undefined) missing.push("tickets");
      else {
        ticketsCents = found;
        noteOldest(oldestTicketObservedAt);
      }
    }

    // Flights: per-passenger fare times party size.
    let flightsCents: number | null = null;
    let airline: string | null = null;
    let transfers: number | null = null;

    if (input.origin) {
      const quote = flightByDate.get(startDate);
      if (!quote) missing.push("flights");
      else {
        /*
         * Children fly at adult fares on US domestic routes — there is no child
         * discount to apply, only lap infants, which we do not model. Treating
         * every seat the same is correct here, not a simplification.
         */
        flightsCents = quote.priceCents * partySize;
        airline = quote.airline;
        transfers = quote.transfers;
        noteOldest(quote.observedAt);
      }
    } else {
      // No origin means the family is driving. Zero is the honest answer, not
      // "missing" — there is no flight to price.
      flightsCents = 0;
    }

    const complete = missing.length === 0;
    const totalCents = complete
      ? (flightsCents ?? 0) + (hotelCents ?? 0) + (ticketsCents ?? 0)
      : null;

    days.push({
      startDate,
      endDate: addDays(startDate, input.nights),
      nights: input.nights,
      parkDays: input.parkDays,
      components: { flightsCents, hotelCents, ticketsCents },
      totalCents,
      perPersonPerDayCents:
        totalCents === null
          ? null
          : Math.round(totalCents / partySize / input.nights),
      missing,
      hotelSlug,
      hotelName,
      hotelIncludesExpressPass: hotelExpress,
      airline,
      transfers,
      oldestObservedAt: oldest ? (oldest as Date).toISOString() : null,
    });
  }

  return days;
}

function dayCount(from: string, to: string): number {
  const parse = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y!, m! - 1, d!);
  };
  return Math.max(0, Math.round((parse(to) - parse(from)) / 86_400_000) + 1);
}
