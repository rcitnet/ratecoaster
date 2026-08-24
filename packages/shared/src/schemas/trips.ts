import { z } from "zod";
import { Cents, IsoDate } from "./common.js";
import { PropertyTier } from "./hotels.js";

export const TripRateCode = z.enum(["STANDARD", "APH"]);
export type TripRateCode = z.infer<typeof TripRateCode>;

export const TripQuoteQuery = z.object({
  checkIn: IsoDate,
  checkOut: IsoDate,
  rooms: z.coerce.number().int().min(1).max(4).default(1),
  adults: z.coerce.number().int().min(1).max(8).default(2),
  children: z.coerce.number().int().min(0).max(8).default(0),
  rateCode: TripRateCode.default("STANDARD"),
});
export type TripQuoteQuery = z.infer<typeof TripQuoteQuery>;

export const TripHotelOption = z.object({
  propertySlug: z.string(),
  propertyName: z.string(),
  tier: PropertyTier,
  roomTypeName: z.string().nullable(),
  includesExpressPass: z.boolean(),
  nights: z.number().int().positive(),
  rooms: z.number().int().positive(),
  averageNightlyCents: Cents,
  subtotalCents: Cents,
});
export type TripHotelOption = z.infer<typeof TripHotelOption>;

export const TripTicketRecommendation = z.object({
  productSlug: z.string(),
  productName: z.string(),
  ticketDays: z.number().int().positive(),
  parkCount: z.number().int().positive().nullable(),
  startDate: IsoDate,
  adultUnitCents: Cents.nullable(),
  childUnitCents: Cents.nullable(),
  subtotalCents: Cents,
  exactDurationMatch: z.boolean(),
  uncoveredTripDays: z.number().int().nonnegative(),
});
export type TripTicketRecommendation = z.infer<typeof TripTicketRecommendation>;

export const TripQuote = z.object({
  checkIn: IsoDate,
  checkOut: IsoDate,
  nights: z.number().int().positive(),
  tripDays: z.number().int().positive(),
  rooms: z.number().int().positive(),
  adults: z.number().int().positive(),
  children: z.number().int().nonnegative(),
  rateCode: TripRateCode,
  hotel: TripHotelOption.nullable(),
  hotelAlternatives: z.array(TripHotelOption),
  ticket: TripTicketRecommendation.nullable(),
  combinedTotalCents: Cents.nullable(),
  assumptions: z.array(z.string()),
});
export type TripQuote = z.infer<typeof TripQuote>;
/** Annual passes currently require separate admission only for Epic Universe. */
export const APH_EPIC_TICKET_SLUG = "uor-1-day-epic-universe";
