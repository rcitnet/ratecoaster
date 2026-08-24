import { z } from "zod";
import { Cents, DestinationSlug, IsoDate, IsoInstant } from "./common.js";
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
  propertyId: z.string().uuid().nullable(),
  /** Set for ticket and Express Pass watches. Null for hotel watches. */
  ticketProductId: z.string().uuid().nullable().default(null),
  /** Watch a whole destination when propertyId is null. */
  destination: DestinationSlug.nullable(),
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
}).superRefine((target, ctx) => {
  if (target.kind === "hotel" && !target.propertyId && !target.destination) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["propertyId"],
      message: "a hotel watch needs a property or destination",
    });
  }
  if (target.kind === "hotel" && target.ticketProductId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ticketProductId"],
      message: "hotel watches cannot target a ticket product",
    });
  }
  if ((target.kind === "ticket" || target.kind === "express") && target.propertyId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["propertyId"],
      message: `${target.kind} watches cannot target a hotel`,
    });
  }
  if ((target.kind === "ticket" || target.kind === "express") && !target.ticketProductId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ticketProductId"],
      message: `${target.kind} watches need a ticket product`,
    });
  }
  if ((target.kind === "ticket" || target.kind === "express") && !target.destination) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["destination"],
      message: `${target.kind} watches need a destination`,
    });
  }
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
  /** Initial/current comparison baseline, saved without sending an email. */
  baselineCents: Cents.nullable(),
  baselineAt: IsoInstant.nullable(),
});
export type Watch = z.infer<typeof Watch>;

/** Account-facing watch plus human-readable labels for its target. */
export const WatchView = Watch.extend({
  propertySlug: z.string().nullable(),
  propertyName: z.string().nullable(),
  ticketProductSlug: z.string().nullable(),
  ticketProductName: z.string().nullable(),
});
export type WatchView = z.infer<typeof WatchView>;

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
