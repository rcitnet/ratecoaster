import { z } from "zod";
import { Cents, Currency, DestinationSlug, IsoDate, IsoInstant, RateSource } from "./common.js";

/**
 * Rate codes are the heart of this product.
 *
 * Universal's booking engine returns a different price for the same room on the
 * same night depending on the selected rate plan. APH is a separate public
 * Annual Passholder rate selection rather than a promo-code fallback.
 *
 * We treat the code as a first-class dimension rather than a boolean flag,
 * because the interesting comparisons are between codes: what does the
 * passholder rate save you against standard on this date, and is that gap
 * widening or closing?
 */
export const RateCode = z.enum([
  "STANDARD", // public best-available rate, no code
  "APH", // Universal Orlando Annual Passholder
  "FLR", // Florida Resident
  "CAR", // California Resident (Hollywood)
  "TXR", // Texas Resident (Frisco)
  "AAA",
  "AARP",
  "GOV",
  "MIL", // military
]);
export type RateCode = z.infer<typeof RateCode>;

export const RATE_CODE_LABELS: Record<RateCode, string> = {
  STANDARD: "Standard",
  APH: "Annual Passholder",
  FLR: "Florida Resident",
  CAR: "California Resident",
  TXR: "Texas Resident",
  AAA: "AAA",
  AARP: "AARP",
  GOV: "Government",
  MIL: "Military",
};

/** Universal Orlando's marketing tiers, which map to real perks. */
export const PropertyTier = z.enum([
  "premier", // includes Express Unlimited — the reason these cost what they do
  "preferred",
  "universal-classic",
  "prime-value",
  "value",
  "partner", // Other official resort-hotel classifications
]);
export type PropertyTier = z.infer<typeof PropertyTier>;

export const Property = z.object({
  id: z.string(),
  destination: DestinationSlug,
  slug: z.string(),
  name: z.string(),
  tier: PropertyTier,
  /** Operator, e.g. "Loews Hotels", "Hilton". Drives which collector runs. */
  operator: z.string(),
  onSite: z.boolean(),
  /** Free Express Unlimited passes for all guests — the big value lever. */
  includesExpressPass: z.boolean(),
  earlyParkAdmission: z.boolean(),
  roomCount: z.number().int().positive().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});
export type Property = z.infer<typeof Property>;

export const RoomType = z.object({
  id: z.string(),
  propertyId: z.string(),
  /** Operator's own code, e.g. "STDK". Stable across rate codes. */
  externalCode: z.string(),
  name: z.string(),
  maxOccupancy: z.number().int().positive().nullable(),
});
export type RoomType = z.infer<typeof RoomType>;

/** Filter controls backed by rate data that actually exists. */
export const RateFilterOptions = z.object({
  rateCodes: z.array(RateCode),
  roomTypes: z.array(RoomType),
});
export type RateFilterOptions = z.infer<typeof RateFilterOptions>;

/**
 * Occupancy is part of the query key, not part of the response: the booking
 * engine wants to know who is coming before it will quote you. Room *types*,
 * by contrast, all come back in a single response — which is why a full
 * "every room type" crawl costs the same as a "cheapest room" crawl.
 */
export const Occupancy = z.object({
  adults: z.number().int().min(1).max(8),
  children: z.number().int().min(0).max(8),
});
export type Occupancy = z.infer<typeof Occupancy>;

/**
 * A single price sighting: append-only, never updated.
 *
 * Storing observations rather than a mutable "current price" column is the one
 * schema decision that everything else depends on. It gives you price history
 * charts, "cheaper than when you booked" alerts, and the ability to answer
 * "when should I book?" — none of which can be reconstructed after the fact if
 * you overwrite.
 */
export const RateObservation = z.object({
  id: z.string(),
  propertyId: z.string(),
  roomTypeId: z.string().nullable(),
  rateCode: RateCode,
  /** Check-in date. */
  stayDate: IsoDate,
  /** Length of stay in nights this quote covers. Usually 1. */
  nights: z.number().int().positive(),
  adults: z.number().int().positive(),
  children: z.number().int().nonnegative(),
  /** Nightly rate before tax and resort fee. */
  nightlyCents: Cents,
  /** All-in total for the stay including tax and fees, when the engine gives it. */
  totalCents: Cents.nullable(),
  currency: Currency,
  /** False when the engine quoted a price but the room is sold out. */
  available: z.boolean(),
  /** Where this price came from: observed | affiliate | derived. */
  source: RateSource,
  /** True when the price is reconstructed rather than directly quoted. */
  isEstimated: z.boolean(),
  /** Feed/OTA the price came from; null for observed. */
  merchant: z.string().nullable(),
  observedAt: IsoInstant,
});
export type RateObservation = z.infer<typeof RateObservation>;

/**
 * The denormalized "what is the price right now" view the UI actually renders.
 * Derived from the newest observation per (property, date, rateCode).
 */
export const CurrentRate = z.object({
  propertyId: z.string(),
  propertySlug: z.string(),
  propertyName: z.string(),
  stayDate: IsoDate,
  rateCode: RateCode,
  nightlyCents: Cents,
  totalCents: Cents.nullable(),
  roomTypeName: z.string().nullable(),
  available: z.boolean(),
  source: RateSource,
  isEstimated: z.boolean(),
  /** Feed/OTA the price came from; null for observed. Drives the Book button. */
  merchant: z.string().nullable(),
  observedAt: IsoInstant,
  /** Cheapest standard rate for the same night, for savings math. */
  standardNightlyCents: Cents.nullable(),
  /** Positive means this rate beats standard. */
  savingsCents: z.number().int().nullable(),
  /** Lowest price ever observed for this property/date/code. */
  historicalLowCents: Cents.nullable(),
  /** Change vs. the previous distinct observation. Negative means it dropped. */
  changeCents: z.number().int().nullable(),
});
export type CurrentRate = z.infer<typeof CurrentRate>;

/** One point on a price-history chart. */
export const RateHistoryPoint = z.object({
  observedAt: IsoInstant,
  nightlyCents: Cents,
  available: z.boolean(),
});
export type RateHistoryPoint = z.infer<typeof RateHistoryPoint>;

/** A surfaced bargain for the "best deals" board. */
export const Deal = z.object({
  propertyId: z.string(),
  propertySlug: z.string(),
  propertyName: z.string(),
  destination: DestinationSlug,
  tier: PropertyTier,
  stayDate: IsoDate,
  nights: z.number().int().positive(),
  rateCode: RateCode,
  nightlyCents: Cents,
  totalCents: Cents.nullable(),
  savingsCents: z.number().int().nullable(),
  savingsPercent: z.number().nullable(),
  /** Percentile of this price within the property's own observed history. */
  percentileOfHistory: z.number().min(0).max(100).nullable(),
  includesExpressPass: z.boolean(),
  source: RateSource,
  isEstimated: z.boolean(),
  /** Feed/OTA the price came from; null for observed. Drives the Book button. */
  merchant: z.string().nullable(),
});
export type Deal = z.infer<typeof Deal>;

export const RateQuery = z.object({
  destination: DestinationSlug.optional(),
  propertySlug: z.string().optional(),
  roomTypeId: z.string().uuid().optional(),
  rateCode: RateCode.default("APH"),
  from: IsoDate.optional(),
  to: IsoDate.optional(),
  adults: z.coerce.number().int().min(1).max(8).default(2),
  children: z.coerce.number().int().min(0).max(8).default(0),
  nights: z.coerce.number().int().min(1).max(30).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});
export type RateQuery = z.infer<typeof RateQuery>;
