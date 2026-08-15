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

export const WatchTarget = z.object({
  propertyId: z.string().nullable(),
  /** Watch a whole destination when propertyId is null. */
  destination: z.string().nullable(),
  rateCode: RateCode.default("APH"),
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
