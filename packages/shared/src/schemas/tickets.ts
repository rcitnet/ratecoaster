import { z } from "zod";
import { Cents, Currency, DestinationSlug, IsoDate, IsoInstant, RateSource } from "./common.js";

/**
 * Universal prices park admission dynamically by date — the same 2-day ticket
 * costs materially more on a December Saturday than a September Tuesday. The
 * unit of tracking is therefore (product, date), not just (product).
 */
export const TicketProductKind = z.enum([
  "single-park-1-day",
  "park-to-park-1-day",
  "single-park-multi-day",
  "park-to-park-multi-day",
  "seasonal-pass",
  "annual-pass",
  "express-pass",
  "early-park-admission",
  "add-on",
]);
export type TicketProductKind = z.infer<typeof TicketProductKind>;

export const GuestCategory = z.enum(["adult", "child", "senior"]);
export type GuestCategory = z.infer<typeof GuestCategory>;

export const TicketProduct = z.object({
  id: z.string(),
  destination: DestinationSlug,
  slug: z.string(),
  name: z.string(),
  kind: TicketProductKind,
  /** Null for passes and single-day products. */
  days: z.number().int().positive().nullable(),
  /** Number of parks the ticket admits to per day, where meaningful. */
  parkCount: z.number().int().positive().nullable(),
  externalId: z.string().nullable(),
  /** Affiliate deep link for the Book button; null until a feed populates it. */
  bookingUrl: z.string().nullable().default(null),
  /** Merchant the booking link points at, e.g. "undercover-tourist". */
  bookingMerchant: z.string().nullable().default(null),
});
export type TicketProduct = z.infer<typeof TicketProduct>;

/**
 * Append-only, same reasoning as hotel rates. Ticket prices creep upward over
 * time and guests want to know whether today's price is a genuine low or just
 * the new normal — you can only answer that with history.
 */
export const TicketPriceObservation = z.object({
  id: z.string(),
  productId: z.string(),
  /** First day of use. Null for products with no date-based pricing. */
  validDate: IsoDate.nullable(),
  guestCategory: GuestCategory,
  priceCents: Cents,
  /** Price with tax, when the storefront exposes it separately. */
  totalCents: Cents.nullable(),
  currency: Currency,
  available: z.boolean(),
  source: RateSource,
  isEstimated: z.boolean(),
  /** Affiliate feed the price came from; null for observed. */
  merchant: z.string().nullable(),
  observedAt: IsoInstant,
});
export type TicketPriceObservation = z.infer<typeof TicketPriceObservation>;

/**
 * Express Pass is the most volatile price on the whole property — it can swing
 * by more than 100% between a slow Tuesday and a holiday Saturday, and it
 * re-prices intraday as the park fills. It gets its own shape because guests
 * shop it as a calendar ("which day is Express cheapest?") rather than as a
 * product.
 */
export const ExpressPassTier = z.enum(["standard", "unlimited"]);
export type ExpressPassTier = z.infer<typeof ExpressPassTier>;

export const ExpressPassPrice = z.object({
  destination: DestinationSlug,
  /** Park slug where the pass is valid, or null for resort-wide passes. */
  parkSlug: z.string().nullable(),
  validDate: IsoDate,
  tier: ExpressPassTier,
  priceCents: Cents,
  currency: Currency,
  available: z.boolean(),
  source: RateSource,
  isEstimated: z.boolean(),
  /** Feed the price came from, when not first-party; null for observed. */
  merchant: z.string().nullable(),
  observedAt: IsoInstant,
});
export type ExpressPassPrice = z.infer<typeof ExpressPassPrice>;

/** One cell in the dynamic pricing calendar the UI renders. */
export const PriceCalendarDay = z.object({
  validDate: IsoDate,
  /** Storefront's displayed per-day amount. */
  priceCents: Cents.nullable(),
  /** Exact full-ticket amount; differs from priceCents for multi-day products. */
  totalCents: Cents.nullable().default(null),
  available: z.boolean(),
  /** "low" | "mid" | "high" bucket, computed against the visible window. */
  band: z.enum(["low", "mid", "high"]).nullable(),
  /** Cheapest price seen in the window, for highlighting. */
  isWindowLow: z.boolean(),
  /** Provenance of this cell's price; defaults to observed. */
  source: RateSource.default("observed"),
  isEstimated: z.boolean().default(false),
  /** Affiliate feed the price came from; null for observed. */
  merchant: z.string().nullable().default(null),
});
export type PriceCalendarDay = z.infer<typeof PriceCalendarDay>;

export const TicketQuery = z.object({
  destination: DestinationSlug.default("universal-orlando"),
  productSlug: z.string().optional(),
  kind: TicketProductKind.optional(),
  guestCategory: GuestCategory.default("adult"),
  from: IsoDate.optional(),
  to: IsoDate.optional(),
});
export type TicketQuery = z.infer<typeof TicketQuery>;

export const ExpressPassQuery = z.object({
  destination: DestinationSlug.default("universal-orlando"),
  tier: ExpressPassTier.optional(),
  from: IsoDate.optional(),
  to: IsoDate.optional(),
});
export type ExpressPassQuery = z.infer<typeof ExpressPassQuery>;
