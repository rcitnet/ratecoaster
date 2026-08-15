import { z } from "zod";
import { Attribution, DestinationSlug, IsoDate, IsoInstant } from "./common.js";

export const Park = z.object({
  id: z.string(),
  destination: DestinationSlug,
  slug: z.string(),
  name: z.string(),
  timezone: z.string(),
  /** Provider-specific IDs, so we can switch providers without a migration. */
  queueTimesId: z.number().int().nullable(),
  themeParksWikiId: z.string().nullable(),
});
export type Park = z.infer<typeof Park>;

export const AttractionStatus = z.enum([
  "operating",
  "down",
  "closed",
  "refurbishment",
  "unknown",
]);
export type AttractionStatus = z.infer<typeof AttractionStatus>;

export const AttractionKind = z.enum(["ride", "show", "meet-and-greet", "other"]);
export type AttractionKind = z.infer<typeof AttractionKind>;

export const Attraction = z.object({
  id: z.string(),
  parkId: z.string(),
  slug: z.string(),
  name: z.string(),
  kind: AttractionKind,
  land: z.string().nullable(),
  externalId: z.string().nullable(),
});
export type Attraction = z.infer<typeof Attraction>;

/**
 * A wait-time sighting. High cardinality — every attraction, every few minutes,
 * forever — so this table is the one that will dominate row count. See the db
 * package for the retention policy that keeps it from eating the disk: raw
 * samples are kept for a short window and rolled up into hourly aggregates,
 * which is all anyone actually queries after the day is over.
 */
export const WaitTimeObservation = z.object({
  id: z.string(),
  attractionId: z.string(),
  /** Posted standby wait in minutes. Null when the ride is not operating. */
  waitMinutes: z.number().int().nonnegative().nullable(),
  /** Single-rider queue, where the ride offers one. */
  singleRiderMinutes: z.number().int().nonnegative().nullable(),
  status: AttractionStatus,
  observedAt: IsoInstant,
});
export type WaitTimeObservation = z.infer<typeof WaitTimeObservation>;

/** The live board the UI renders. */
export const LiveWait = z.object({
  attractionId: z.string(),
  attractionSlug: z.string(),
  attractionName: z.string(),
  parkSlug: z.string(),
  parkName: z.string(),
  land: z.string().nullable(),
  kind: AttractionKind,
  waitMinutes: z.number().int().nonnegative().nullable(),
  singleRiderMinutes: z.number().int().nonnegative().nullable(),
  status: AttractionStatus,
  observedAt: IsoInstant,
  /** Typical wait for this attraction at this hour, from rolled-up history. */
  typicalMinutes: z.number().int().nonnegative().nullable(),
  /** waitMinutes - typicalMinutes. Negative means it is quieter than usual. */
  vsTypicalMinutes: z.number().int().nullable(),
});
export type LiveWait = z.infer<typeof LiveWait>;

/** Hourly rollup used for "best time to ride" charts. */
export const WaitRollupPoint = z.object({
  hour: z.number().int().min(0).max(23),
  avgMinutes: z.number().nullable(),
  p50Minutes: z.number().int().nullable(),
  p90Minutes: z.number().int().nullable(),
  sampleCount: z.number().int().nonnegative(),
});
export type WaitRollupPoint = z.infer<typeof WaitRollupPoint>;

export const ParkHours = z.object({
  parkId: z.string(),
  date: IsoDate,
  opensAt: IsoInstant.nullable(),
  closesAt: IsoInstant.nullable(),
  /** Early Park Admission window for on-site hotel guests. */
  earlyEntryAt: IsoInstant.nullable(),
  kind: z.enum(["operating", "closed", "special-ticketed"]),
});
export type ParkHours = z.infer<typeof ParkHours>;

/** Live board response, carrying the provider attribution with it. */
export const LiveWaitsResponse = z.object({
  parks: z.array(
    z.object({
      park: Park,
      waits: z.array(LiveWait),
      hours: ParkHours.nullable(),
    })
  ),
  attribution: z.array(Attribution),
  fetchedAt: IsoInstant,
});
export type LiveWaitsResponse = z.infer<typeof LiveWaitsResponse>;

export const WaitQuery = z.object({
  destination: DestinationSlug.optional(),
  parkSlug: z.string().optional(),
  /** Drop shows and meet-and-greets, which most users do not want. */
  ridesOnly: z.coerce.boolean().default(false),
});
export type WaitQuery = z.infer<typeof WaitQuery>;
