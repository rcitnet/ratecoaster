import { Hono } from "hono";
import { and, asc, eq, gt, gte, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import {
  properties,
  flightQuoteCurrent,
  rateCurrent,
  roomTypes,
  ticketPriceCurrent,
  ticketProducts,
} from "@ratecoaster/db/schema";
import {
  TripQuote,
  TripQuoteQuery,
  APH_EPIC_TICKET_SLUG,
  DESTINATION_AIRPORTS,
  type TripHotelOption,
  type TripRateCode,
  type TripTicketRecommendation,
} from "@ratecoaster/shared";
import { buildBookingUrl, readCredentials } from "../collectors/flights/travelpayouts.js";
import { addDays, daysBetween, todayInTimezone } from "../collectors/framework/dates.js";
import { gateDateWindow, tierOf } from "../lib/entitlements.js";

export const tripsRouter = new Hono();

export interface HotelQuoteRow {
  propertyId: string;
  propertySlug: string;
  propertyName: string;
  tier: TripHotelOption["tier"];
  includesExpressPass: boolean;
  roomTypeId: string | null;
  roomTypeName: string | null;
  stayDate: string;
  nightlyCents: number;
  totalCents: number | null;
}

/** Build one complete, same-room quote per hotel and discard partial stays. */
export function summarizeHotelOptions(
  rows: HotelQuoteRow[],
  nights: number,
  rooms: number
): TripHotelOption[] {
  const groups = new Map<string, HotelQuoteRow[]>();
  for (const row of rows) {
    const key = `${row.propertyId}|${row.roomTypeId ?? "unassigned"}`;
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }

  const completeRooms: TripHotelOption[] = [];
  for (const group of groups.values()) {
    const uniqueNights = new Map(group.map((row) => [row.stayDate, row]));
    if (uniqueNights.size !== nights) continue;

    const stay = [...uniqueNights.values()];
    const first = stay[0]!;
    const nightlySum = stay.reduce((sum, row) => sum + row.nightlyCents, 0);
    const stayTotal = stay.reduce((sum, row) => sum + (row.totalCents ?? row.nightlyCents), 0);
    completeRooms.push({
      propertySlug: first.propertySlug,
      propertyName: first.propertyName,
      tier: first.tier,
      roomTypeName: first.roomTypeName,
      includesExpressPass: first.includesExpressPass,
      nights,
      rooms,
      averageNightlyCents: Math.round(nightlySum / nights),
      subtotalCents: stayTotal * rooms,
    });
  }

  // Keep the least-expensive complete room at each hotel.
  const bestByProperty = new Map<string, TripHotelOption>();
  for (const option of completeRooms) {
    const current = bestByProperty.get(option.propertySlug);
    if (!current || option.subtotalCents < current.subtotalCents) {
      bestByProperty.set(option.propertySlug, option);
    }
  }
  return [...bestByProperty.values()].sort((a, b) => a.subtotalCents - b.subtotalCents);
}

export interface TicketQuoteRow {
  productSlug: string;
  productName: string;
  ticketDays: number;
  parkCount: number | null;
  guestCategory: "adult" | "child" | "senior";
  priceCents: number;
  totalCents: number | null;
}

/** Passholders only need the separately ticketed Epic Universe admission. */
export function eligibleTicketRows(
  rows: TicketQuoteRow[],
  rateCode: TripRateCode
): TicketQuoteRow[] {
  return rateCode === "APH"
    ? rows.filter((row) => row.productSlug === APH_EPIC_TICKET_SLUG)
    : rows;
}

/** Choose the closest duration, then the broadest park coverage at the best price. */
export function recommendTicket(
  rows: TicketQuoteRow[],
  tripDays: number,
  adults: number,
  children: number,
  startDate: string
): TripTicketRecommendation | null {
  const availableDurations = [...new Set(rows.map((row) => row.ticketDays))].sort((a, b) => a - b);
  const fitting = availableDurations.filter((days) => days <= tripDays);
  const targetDays = fitting.at(-1) ?? availableDurations[0];
  if (!targetDays) return null;

  const products = new Map<string, TicketQuoteRow[]>();
  for (const row of rows) {
    if (row.ticketDays !== targetDays) continue;
    const current = products.get(row.productSlug) ?? [];
    current.push(row);
    products.set(row.productSlug, current);
  }

  const candidates: TripTicketRecommendation[] = [];
  for (const productRows of products.values()) {
    const first = productRows[0]!;
    const adult = productRows.find((row) => row.guestCategory === "adult");
    const child = productRows.find((row) => row.guestCategory === "child");
    if (!adult || (children > 0 && !child)) continue;
    const adultUnitCents = adult.totalCents ?? adult.priceCents;
    const childUnitCents = child ? child.totalCents ?? child.priceCents : null;
    candidates.push({
      productSlug: first.productSlug,
      productName: first.productName,
      ticketDays: first.ticketDays,
      parkCount: first.parkCount,
      startDate,
      adultUnitCents,
      childUnitCents,
      subtotalCents: adultUnitCents * adults + (childUnitCents ?? 0) * children,
      exactDurationMatch: first.ticketDays === tripDays,
      uncoveredTripDays: Math.max(0, tripDays - first.ticketDays),
    });
  }

  candidates.sort(
    (a, b) => (b.parkCount ?? 0) - (a.parkCount ?? 0) || a.subtotalCents - b.subtotalCents
  );
  return candidates[0] ?? null;
}

/** A grand total is only honest when every component the visitor requested exists. */
export function completeTripTotal(input: {
  hotelCents: number | null;
  ticketCents: number | null;
  flightRequested: boolean;
  flightCents: number | null;
}): number | null {
  const components: Array<number | null> = [input.hotelCents, input.ticketCents];
  if (input.flightRequested) components.push(input.flightCents);
  return components.every((value): value is number => value !== null)
    ? components.reduce((sum, value) => sum + value, 0)
    : null;
}

tripsRouter.get("/quote", async (c) => {
  const parsed = TripQuoteQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      { error: { code: "invalid_query", message: "Enter valid trip dates and party details." } },
      400
    );
  }

  const query = parsed.data;
  const today = todayInTimezone("America/New_York");
  const nights = daysBetween(query.checkIn, query.checkOut);
  if (query.checkIn < today) {
    return c.json({ error: { code: "invalid_query", message: "Check-in cannot be in the past." } }, 400);
  }
  if (nights < 1 || nights > 30) {
    return c.json(
      { error: { code: "invalid_query", message: "Trips must be between 1 and 30 nights." } },
      400
    );
  }

  const tier = tierOf(c);
  const gate = gateDateWindow(tier, today, undefined);
  const visibleThrough = gate.info.visibleThrough ?? today;
  const lastHotelNight = addDays(query.checkOut, -1);
  if (lastHotelNight > visibleThrough) {
    return c.json(
      {
        error: {
          code: "date_unavailable",
          message: `Collected pricing currently runs through ${visibleThrough}.`,
        },
      },
      400
    );
  }

  const db = getDb();
  const hotelRows = await db
    .select({
      propertyId: properties.id,
      propertySlug: properties.slug,
      propertyName: properties.name,
      tier: properties.tier,
      includesExpressPass: properties.includesExpressPass,
      roomTypeId: rateCurrent.roomTypeId,
      roomTypeName: roomTypes.name,
      stayDate: rateCurrent.stayDate,
      nightlyCents: rateCurrent.nightlyCents,
      totalCents: rateCurrent.totalCents,
    })
    .from(rateCurrent)
    .innerJoin(properties, eq(rateCurrent.propertyId, properties.id))
    .leftJoin(roomTypes, eq(rateCurrent.roomTypeId, roomTypes.id))
    .where(
      and(
        eq(properties.destination, "universal-orlando"),
        eq(properties.active, true),
        eq(rateCurrent.rateCode, query.rateCode),
        eq(rateCurrent.nights, 1),
        eq(rateCurrent.adults, 2),
        eq(rateCurrent.children, 0),
        eq(rateCurrent.available, true),
        gte(rateCurrent.stayDate, query.checkIn),
        lt(rateCurrent.stayDate, query.checkOut)
      )
    )
    .orderBy(asc(properties.name), asc(rateCurrent.stayDate));

  const hotelOptions = summarizeHotelOptions(hotelRows, nights, query.rooms);
  const hotel = hotelOptions[0] ?? null;
  const tripDays = nights + 1;

  const ticketRows = await db
    .select({
      productSlug: ticketProducts.slug,
      productName: ticketProducts.name,
      ticketDays: ticketProducts.days,
      parkCount: ticketProducts.parkCount,
      guestCategory: ticketPriceCurrent.guestCategory,
      priceCents: ticketPriceCurrent.priceCents,
      totalCents: ticketPriceCurrent.totalCents,
    })
    .from(ticketPriceCurrent)
    .innerJoin(ticketProducts, eq(ticketPriceCurrent.productId, ticketProducts.id))
    .where(
      and(
        eq(ticketProducts.destination, "universal-orlando"),
        eq(ticketProducts.active, true),
        sql`${ticketProducts.kind} <> 'express-pass'`,
        sql`${ticketProducts.days} is not null`,
        eq(ticketPriceCurrent.validDate, query.checkIn),
        eq(ticketPriceCurrent.available, true)
      )
    );

  const normalizedTicketRows: TicketQuoteRow[] = ticketRows
    .filter(
      (row): row is typeof row & {
        ticketDays: number;
        guestCategory: "adult" | "child" | "senior";
      } => row.ticketDays !== null && row.guestCategory !== "all-ages"
    )
    .map((row) => ({ ...row, ticketDays: row.ticketDays }));
  const ticket = recommendTicket(
    eligibleTicketRows(normalizedTicketRows, query.rateCode),
    tripDays,
    query.adults,
    query.children,
    query.checkIn
  );

  const destinationAirport = DESTINATION_AIRPORTS["universal-orlando"];
  let flight: {
    origin: string;
    destination: string;
    departDate: string;
    returnDate: string;
    perPassengerCents: number;
    subtotalCents: number;
    currency: string;
    airline: string | null;
    transfers: number | null;
    observedAt: string;
    bookingUrl: string | null;
  } | null = null;

  if (query.origin) {
    const [fare] = await db
      .select()
      .from(flightQuoteCurrent)
      .where(
        and(
          eq(flightQuoteCurrent.origin, query.origin),
          eq(flightQuoteCurrent.destination, destinationAirport),
          eq(flightQuoteCurrent.departDate, query.checkIn),
          eq(flightQuoteCurrent.tripLengthDays, nights),
          or(isNull(flightQuoteCurrent.expiresAt), gt(flightQuoteCurrent.expiresAt, new Date()))
        )
      )
      .limit(1);

    if (fare) {
      const partySize = query.adults + query.children;
      flight = {
        origin: fare.origin,
        destination: fare.destination,
        departDate: fare.departDate,
        returnDate: query.checkOut,
        perPassengerCents: fare.priceCents,
        subtotalCents: fare.priceCents * partySize,
        currency: fare.currency,
        airline: fare.airline,
        transfers: fare.transfers,
        observedAt: fare.observedAt.toISOString(),
        bookingUrl: buildBookingUrl({
          origin: fare.origin,
          destination: fare.destination,
          departDate: fare.departDate,
          returnDate: query.checkOut,
          passengers: partySize,
          marker: readCredentials()?.marker ?? null,
        }),
      };
    }
  }

  const combinedTotalCents = completeTripTotal({
    hotelCents: hotel?.subtotalCents ?? null,
    ticketCents: ticket?.subtotalCents ?? null,
    flightRequested: Boolean(query.origin),
    flightCents: flight?.subtotalCents ?? null,
  });

  return c.json(
    TripQuote.parse({
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      nights,
      tripDays,
      rooms: query.rooms,
      adults: query.adults,
      children: query.children,
      origin: query.origin ?? null,
      rateCode: query.rateCode,
      hotel,
      hotelAlternatives: hotelOptions.slice(1, 7),
      ticket,
      flight,
      combinedTotalCents,
      assumptions: [
        "Hotel estimates use one room type for the entire stay and the tracked two-adult occupancy, multiplied by the number of rooms.",
        query.rateCode === "APH"
          ? "Annual Passholder estimates add only one day of Epic Universe admission; eligible admission at the other parks is assumed to be covered by the Annual Pass."
          : "Ticket estimates assume the first park day is check-in day and favor the widest park access for the closest available duration.",
        query.origin
          ? "Flight estimates use a recently cached Aviasales round-trip fare for the selected dates, multiplied by every traveler. Search results can change before booking."
          : "Flights are excluded because no departure city was selected.",
        "Taxes and fees are included when the source supplies a total. Always confirm availability and the final price before booking.",
      ],
    })
  );
});
