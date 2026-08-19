import { z } from "zod";
import { IsoInstant } from "./common.js";

/**
 * Account tiers.
 *
 * Modelled as an ordered ladder from day one, even though `pro` sells nothing
 * yet. The alternative — a boolean `isRegistered` — would need unpicking from
 * every route the moment a paid tier appears, and paid tiers always appear.
 */
export const Tier = z.enum(["anonymous", "free", "pro", "admin"]);
export type Tier = z.infer<typeof Tier>;

export const TIER_RANK: Record<Tier, number> = { anonymous: 0, free: 1, pro: 2, admin: 3 };

export function atLeast(actual: Tier, required: Tier): boolean {
  return TIER_RANK[actual] >= TIER_RANK[required];
}

/**
 * What a tier is allowed to see.
 *
 * All limits live in this one table so the answer to "what do I get if I sign
 * up?" is readable in a single place — by you, and by the pricing page, which
 * renders straight from it rather than hardcoding a duplicate list that drifts.
 */
export const Entitlements = z.object({
  tier: Tier,
  /** How many days of rate/ticket/Express calendar are visible. */
  lookaheadDays: z.number().int().positive(),
  /** Price history charts and "all-time low" context. */
  priceHistory: z.boolean(),
  /** Rate-drop alerts. */
  alerts: z.boolean(),
  /** Max simultaneous watched date ranges. */
  maxWatches: z.number().int().nonnegative(),
  /** Room-type breakdowns are available in the hotel rate explorer. */
  allRoomTypes: z.boolean(),
  /** Cross-hotel comparison and "best time to book" modelling. */
  advancedInsights: z.boolean(),
  /** Access to /admin. Operational control, not a product feature. */
  admin: z.boolean(),
});
export type Entitlements = z.infer<typeof Entitlements>;

export const ENTITLEMENTS: Record<Tier, Entitlements> = {
  anonymous: {
    tier: "anonymous",
    lookaheadDays: 45,
    priceHistory: false,
    alerts: false,
    maxWatches: 0,
    allRoomTypes: true,
    advancedInsights: false,
    admin: false,
  },
  free: {
    tier: "free",
    // The full year — the headline reason to make an account.
    lookaheadDays: 365,
    priceHistory: true,
    alerts: true,
    maxWatches: 5,
    allRoomTypes: true,
    advancedInsights: false,
    admin: false,
  },
  pro: {
    tier: "pro",
    lookaheadDays: 365,
    priceHistory: true,
    alerts: true,
    maxWatches: 100,
    allRoomTypes: true,
    advancedInsights: true,
    admin: false,
  },
  admin: {
    tier: "admin",
    lookaheadDays: 365,
    priceHistory: true,
    alerts: true,
    maxWatches: 1000,
    allRoomTypes: true,
    advancedInsights: true,
    admin: true,
  },
};

/**
 * Envelope returned when a response was trimmed by the caller's tier.
 *
 * Being explicit about *what* was withheld and *what unlocks it* means the UI
 * can render an honest, specific upsell ("335 more days are waiting") instead
 * of a vague nag — and the mobile app gets the same information for free.
 */
export const GateInfo = z.object({
  gated: z.boolean(),
  tier: Tier,
  requiredTier: Tier.nullable(),
  /** Days actually returned. */
  visibleDays: z.number().int().nonnegative(),
  /** Days that exist but were withheld. */
  withheldDays: z.number().int().nonnegative(),
  /** Last date the caller is allowed to see, inclusive. */
  visibleThrough: z.string().nullable(),
  reason: z.string().nullable(),
});
export type GateInfo = z.infer<typeof GateInfo>;

export const SessionUser = z.object({
  id: z.string(),
  email: z.string().nullable(),
  tier: Tier,
  displayName: z.string().nullable(),
  createdAt: IsoInstant,
});
export type SessionUser = z.infer<typeof SessionUser>;

export const MeResponse = z.object({
  user: SessionUser.nullable(),
  entitlements: Entitlements,
});
export type MeResponse = z.infer<typeof MeResponse>;

export const RequestMagicLink = z.object({
  email: z.string().email(),
  /** Where to send them after they click. Validated against an allowlist. */
  redirectTo: z.string().optional(),
});
export type RequestMagicLink = z.infer<typeof RequestMagicLink>;

export const OAuthProvider = z.enum(["google", "apple"]);
export type OAuthProvider = z.infer<typeof OAuthProvider>;
