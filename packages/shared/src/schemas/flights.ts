import { z } from "zod";
import { Cents, Currency, DestinationSlug, IsoDate, IsoInstant, QueryBoolean } from "./common.js";
import { RateCode } from "./hotels.js";

/**
 * Flights are a different animal from hotel rates, and the difference drives
 * the whole design here.
 *
 * A hotel rate is a property of the resort: one price per hotel per night, the
 * same for everyone. A flight price is a property of the *pair* — it depends on
 * where the family lives — so there is no single "the price" to store. The
 * catalogue is therefore keyed by origin, and we precompute a fixed set of
 * origins rather than pretending to cover every airport in America.
 *
 * The second difference is honesty about freshness. Every commercially
 * available flight-price feed at our budget is cached and aggregated, not a
 * live shopping request. A quote is a "from" price that was true recently, not
 * a bookable fare. Every type below carries the timestamps needed to say so out
 * loud, and the UI is expected to use them.
 */

/** Three-letter IATA code, always uppercase. */
export const IataCode = z
  .string()
  .regex(/^[A-Z]{3}$/, "expected a 3-letter uppercase IATA code");
export type IataCode = z.infer<typeof IataCode>;

export const FlightSource = z.enum([
  /** Aviasales/Travelpayouts cached calendar data. */
  "travelpayouts",
  /** Typed in through the admin portal, e.g. to correct an obviously bad cache. */
  "manual",
]);
export type FlightSource = z.infer<typeof FlightSource>;

/**
 * One cached round-trip quote: the cheapest fare seen for a given origin,
 * destination airport, departure date and trip length.
 *
 * `priceCents` is **per passenger**. Multiplying by party size is the caller's
 * job, and is done in exactly one place (`trip-cost.ts`) so the assumption is
 * stated once rather than scattered.
 */
export const FlightQuote = z.object({
  origin: IataCode,
  destination: IataCode,
  /** Outbound date. Return is this plus `tripLengthDays`. */
  departDate: IsoDate,
  /** Nights away. A 5-night trip departs on D and returns on D+5. */
  tripLengthDays: z.number().int().min(1).max(30),
  priceCents: Cents,
  currency: Currency,
  /** IATA airline code of the cheapest itinerary, when the feed reports one. */
  airline: z.string().nullable(),
  /** 0 = non-stop. Families care about this nearly as much as the price. */
  transfers: z.number().int().nonnegative().nullable(),
  /**
   * When the upstream cache says this fare stops being meaningful. Past this,
   * the number is a historical curiosity, not a quote.
   */
  expiresAt: IsoInstant.nullable(),
  observedAt: IsoInstant,
  source: FlightSource,
  /** Affiliate deeplink to a live search for this exact itinerary. */
  bookingUrl: z.string().url().nullable(),
});
export type FlightQuote = z.infer<typeof FlightQuote>;

export const FlightQuery = z.object({
  origin: IataCode,
  destination: DestinationSlug.default("universal-orlando"),
  from: IsoDate.optional(),
  to: IsoDate.optional(),
  tripLengthDays: z.coerce.number().int().min(1).max(30).default(5),
  passengers: z.coerce.number().int().min(1).max(9).default(2),
  limit: z.coerce.number().int().min(1).max(400).default(365),
});
export type FlightQuery = z.infer<typeof FlightQuery>;

/* ------------------------------------------------------------------ *
 * Trip planner
 * ------------------------------------------------------------------ */

/**
 * The three legs of a Universal trip, priced separately so the UI can show the
 * breakdown and — more importantly — so it can say which leg it is missing.
 *
 * `null` means "we do not have this", never "this is free". The distinction is
 * load-bearing: a planner that quietly totals two of three legs produces a
 * number that is wrong in the most damaging possible direction, and a family
 * would only discover it at the checkout page of someone else's website.
 */
export const TripCostComponents = z.object({
  flightsCents: Cents.nullable(),
  hotelCents: Cents.nullable(),
  ticketsCents: Cents.nullable(),
});
export type TripCostComponents = z.infer<typeof TripCostComponents>;

export const TripCostDay = z.object({
  /** Check-in / departure date. */
  startDate: IsoDate,
  /** Return date, i.e. `startDate` + `nights`. */
  endDate: IsoDate,
  nights: z.number().int().positive(),
  parkDays: z.number().int().nonnegative(),
  components: TripCostComponents,
  /**
   * Only populated when every requested component is present. A partial trip
   * has no total, by design.
   */
  totalCents: Cents.nullable(),
  /** Per-person-per-day, the number families actually compare. Null if partial. */
  perPersonPerDayCents: Cents.nullable(),
  /** Which legs we could not price, for an honest "estimate incomplete" note. */
  missing: z.array(z.enum(["flights", "hotel", "tickets"])),
  /** Cheapest hotel for this date at the requested rate code. */
  hotelSlug: z.string().nullable(),
  hotelName: z.string().nullable(),
  /** True when that hotel throws in Express Unlimited — a huge hidden saving. */
  hotelIncludesExpressPass: z.boolean(),
  /** Airline and stops for the cheapest itinerary found. */
  airline: z.string().nullable(),
  transfers: z.number().int().nonnegative().nullable(),
  /** Oldest observation feeding this total, so the UI can date the estimate. */
  oldestObservedAt: IsoInstant.nullable(),
});
export type TripCostDay = z.infer<typeof TripCostDay>;

export const TripPlannerQuery = z.object({
  destination: DestinationSlug.default("universal-orlando"),
  /** Omit to price the trip without flights, for families driving in. */
  origin: IataCode.optional(),
  adults: z.coerce.number().int().min(1).max(8).default(2),
  children: z.coerce.number().int().min(0).max(8).default(0),
  nights: z.coerce.number().int().min(1).max(21).default(4),
  /**
   * Defaults to `nights - 1`: the arrival day is usually eaten by travel. A
   * family that flies in early can raise it.
   */
  parkDays: z.coerce.number().int().min(0).max(21).optional(),
  rateCode: RateCode.default("APH"),
  /** Restrict the hotel leg to one property instead of the cheapest available. */
  propertySlug: z.string().optional(),
  /**
   * Park-to-Park costs more but is the only way to ride the Hogwarts Express.
   *
   * Deliberately NOT `z.coerce.boolean()`: that is `Boolean("false")`, which is
   * `true`. Every query-string boolean written that way silently ignores the
   * user turning the option off.
   */
  parkToPark: QueryBoolean.default(false),
  from: IsoDate.optional(),
  to: IsoDate.optional(),
  limit: z.coerce.number().int().min(1).max(400).default(365),
});
export type TripPlannerQuery = z.infer<typeof TripPlannerQuery>;

/* ------------------------------------------------------------------ *
 * Origins
 * ------------------------------------------------------------------ */

export const Origin = z.object({
  code: IataCode,
  city: z.string(),
  state: z.string(),
  label: z.string(),
});
export type Origin = z.infer<typeof Origin>;

/**
 * The precomputed origin list.
 *
 * Flight prices cannot be precomputed for every airport — the catalogue is
 * origins x dates x trip lengths, which explodes fast. These are the busiest US
 * origin markets for Orlando leisure traffic; together they cover the large
 * majority of visitors. Airports outside the list are not currently offered.
 *
 * Metro codes (NYC, CHI, WAS) are used where the feed supports them, because a
 * family in New Jersey does not care whether the bargain is out of JFK or EWR —
 * they care that it is cheap. Single-airport metros use the airport code.
 */
export const ORIGINS: Origin[] = [
  { code: "NYC", city: "New York", state: "NY", label: "New York City (all airports)" },
  { code: "CHI", city: "Chicago", state: "IL", label: "Chicago (all airports)" },
  { code: "WAS", city: "Washington", state: "DC", label: "Washington DC (all airports)" },
  { code: "ATL", city: "Atlanta", state: "GA", label: "Atlanta" },
  { code: "BOS", city: "Boston", state: "MA", label: "Boston" },
  { code: "PHL", city: "Philadelphia", state: "PA", label: "Philadelphia" },
  { code: "DTW", city: "Detroit", state: "MI", label: "Detroit" },
  { code: "CLT", city: "Charlotte", state: "NC", label: "Charlotte" },
  { code: "RDU", city: "Raleigh-Durham", state: "NC", label: "Raleigh-Durham" },
  { code: "PIT", city: "Pittsburgh", state: "PA", label: "Pittsburgh" },
  { code: "CLE", city: "Cleveland", state: "OH", label: "Cleveland" },
  { code: "CMH", city: "Columbus", state: "OH", label: "Columbus" },
  { code: "CVG", city: "Cincinnati", state: "OH", label: "Cincinnati" },
  { code: "IND", city: "Indianapolis", state: "IN", label: "Indianapolis" },
  { code: "MCI", city: "Kansas City", state: "MO", label: "Kansas City" },
  { code: "STL", city: "St. Louis", state: "MO", label: "St. Louis" },
  { code: "MSP", city: "Minneapolis", state: "MN", label: "Minneapolis-St. Paul" },
  { code: "MKE", city: "Milwaukee", state: "WI", label: "Milwaukee" },
  { code: "BNA", city: "Nashville", state: "TN", label: "Nashville" },
  { code: "MEM", city: "Memphis", state: "TN", label: "Memphis" },
  { code: "DFW", city: "Dallas", state: "TX", label: "Dallas-Fort Worth" },
  { code: "IAH", city: "Houston", state: "TX", label: "Houston" },
  { code: "AUS", city: "Austin", state: "TX", label: "Austin" },
  { code: "DEN", city: "Denver", state: "CO", label: "Denver" },
  { code: "PHX", city: "Phoenix", state: "AZ", label: "Phoenix" },
  { code: "LAS", city: "Las Vegas", state: "NV", label: "Las Vegas" },
  { code: "LAX", city: "Los Angeles", state: "CA", label: "Los Angeles" },
  { code: "SFO", city: "San Francisco", state: "CA", label: "San Francisco" },
  { code: "SEA", city: "Seattle", state: "WA", label: "Seattle" },
  { code: "PDX", city: "Portland", state: "OR", label: "Portland" },
].sort((left, right) => left.label.localeCompare(right.label, "en"));

/**
 * Destination airports.
 *
 * Orlando is MCO alone — Sanford (SFB) is an Allegiant hub 45 minutes further
 * out, and quoting it beside MCO without saying so would flatter the total with
 * a fare the family then has to drive an extra hour from.
 *
 * Hollywood uses the LAX metro code so Burbank, Long Beach and Orange County
 * are all in scope; Burbank is in fact the closest airport to the park, so
 * excluding it would routinely miss the cheapest sensible option.
 */
export const DESTINATION_AIRPORTS: Record<DestinationSlug, IataCode> = {
  "universal-orlando": "MCO",
  "universal-hollywood": "LAX",
  "universal-kids-frisco": "DFW",
};

export function originByCode(code: string): Origin | undefined {
  return ORIGINS.find((o) => o.code === code.toUpperCase());
}
