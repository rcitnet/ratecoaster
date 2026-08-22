import { z } from "zod";
import { Cents, IsoDate, IsoInstant } from "./common.js";
import { RateCode } from "./hotels.js";

/**
 * Rate-drop alerts are the reason people come back to a tracker daily instead
 * of once. Keeping the subscription model identical for web push and mobile
 * push means the companion app needs no new backend surface — it just registers
 * a different channel.
 */
export const AlertChannel = z.enum(["email", "web-push", "expo-push"]);
export type AlertChannel = z.infer<typeof AlertChannel>;

/**
 * What a watch is tracking.
 *
 * One row shape for all three rather than a table each: the interesting logic
 * is the anti-spam rules, and three copies of those would be three chances to
 * get the cooldown subtly different.
 */
export const WatchKind = z.enum(["hotel", "ticket", "express"]);
export type WatchKind = z.infer<typeof WatchKind>;

export const WatchTarget = z.object({
  kind: WatchKind.default("hotel"),
  propertyId: z.string().nullable(),
  /** Set for ticket watches. Null for hotels and Express Pass. */
  ticketProductId: z.string().nullable().default(null),
  /** Watch a whole destination when propertyId is null. */
  destination: z.string().nullable(),
  rateCode: RateCode.default("APH"),
  /**
   * For a hotel this is check-in. For a ticket or Express Pass watch it is the
   * park date, and `checkOut` is simply the day after — which keeps the stored
   * range valid without a nullable column on a live table.
   */
  checkIn: IsoDate,
  checkOut: IsoDate,
  adults: z.number().int().min(1).max(8).default(2),
  children: z.number().int().min(0).max(8).default(0),
});
export type WatchTarget = z.infer<typeof WatchTarget>;

export const Watch = z.object({
  id: z.string(),
  userId: z.string(),
  target: WatchTarget,
  /** Notify when the nightly rate falls at or below this. Null = any drop. */
  thresholdCents: Cents.nullable(),
  /**
   * The rate the user actually booked, if they imported a reservation. Lets us
   * send the far more compelling "your booked rate is now beatable by $340"
   * instead of a generic price-drop ping.
   */
  bookedNightlyCents: Cents.nullable(),
  channels: z.array(AlertChannel).min(1),
  active: z.boolean(),
  createdAt: IsoInstant,
  lastNotifiedAt: IsoInstant.nullable(),
  /** Cheapest price we have notified about, to avoid re-alerting on the same low. */
  lastNotifiedCents: Cents.nullable(),
});
export type Watch = z.infer<typeof Watch>;

export const CreateWatch = Watch.pick({
  thresholdCents: true,
  bookedNightlyCents: true,
  channels: true,
}).extend({ target: WatchTarget });
export type CreateWatch = z.infer<typeof CreateWatch>;

export const PushRegistration = z.object({
  id: z.string(),
  userId: z.string(),
  channel: AlertChannel,
  /** Expo push token, or the JSON-encoded Web Push subscription. */
  token: z.string(),
  platform: z.enum(["ios", "android", "web"]),
  createdAt: IsoInstant,
  revokedAt: IsoInstant.nullable(),
});
export type PushRegistration = z.infer<typeof PushRegistration>;

export const AlertEvent = z.object({
  id: z.string(),
  watchId: z.string(),
  kind: z.enum(["price-drop", "new-low", "beats-booking", "availability"]),
  previousCents: Cents.nullable(),
  currentCents: Cents,
  message: z.string(),
  sentAt: IsoInstant,
});
export type AlertEvent = z.infer<typeof AlertEvent>;
