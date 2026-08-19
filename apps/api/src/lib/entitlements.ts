import type { Context } from "hono";
import { ENTITLEMENTS, type Entitlements, type GateInfo, type Tier } from "@ratecoaster/shared";
import { addDays, daysBetween, todayInTimezone } from "../collectors/framework/dates.js";

/**
 * Server-side gating.
 *
 * The single most important property here: the API never sends data the caller
 * is not entitled to. It would be far easier to return all 365 days and let the
 * front end hide the rest — and it would be worthless, because the paywall
 * would be visible to anyone who opens the network tab. A gate that lives in
 * the client is not a gate.
 *
 * Everything below therefore trims the *query*, not the rendered output.
 */

export interface GateWindow {
  from: string;
  to: string;
  info: GateInfo;
}

/**
 * Clamps a requested date range to what the tier allows.
 *
 * Returns the clamped range plus a description of what was withheld, so the
 * response can carry an honest, specific upsell rather than silently returning
 * less than was asked for. Silently truncating is the worst option: it looks
 * like missing data, and users report it as a bug.
 */
/** How far ahead the collectors actually gather data. The ceiling for any tier. */
export const CATALOGUE_DAYS = 365;

export function gateDateWindow(
  tier: Tier,
  requestedFrom: string | undefined,
  requestedTo: string | undefined,
  timezone = "America/New_York"
): GateWindow {
  const entitlements = ENTITLEMENTS[tier];
  const today = todayInTimezone(timezone);

  const from = requestedFrom && requestedFrom > today ? requestedFrom : today;
  const horizon = addDays(today, CATALOGUE_DAYS - 1);
  const requested = requestedTo && requestedTo < horizon ? requestedTo : horizon;

  // The ceiling is measured from today, not from the requested start date.
  // Otherwise `?from=2027-06-01&to=2027-07-01` would hand an anonymous caller a
  // 45-day window a year out — which is exactly the thing being sold.
  const maxVisible = addDays(today, entitlements.lookaheadDays - 1);
  const to = requested > maxVisible ? maxVisible : requested;

  /*
   * Withholding is measured against what EXISTS, not against what was asked
   * for. Measuring against the request meant a free user with the full 365-day
   * entitlement saw "1 more day available" — a phantom paywall — purely because
   * the default range was computed one day past the horizon.
   */
  const withheldDays = Math.max(0, CATALOGUE_DAYS - entitlements.lookaheadDays);
  const gated = withheldDays > 0;

  return {
    from,
    to,
    info: {
      gated,
      tier,
      requiredTier: gated ? (tier === "anonymous" ? "free" : "pro") : null,
      visibleDays: Math.max(0, daysBetween(from, to) + 1),
      withheldDays,
      visibleThrough: maxVisible,
      reason: gated
        ? tier === "anonymous"
          ? `Free accounts see all 365 days. You're seeing the next ${entitlements.lookaheadDays}.`
          : "Upgrade for deeper history and cross-hotel insights."
        : null,
    },
  };
}

/** Feature gate for non-date-range capabilities. */
export function requireFeature(
  tier: Tier,
  feature: keyof Omit<Entitlements, "tier" | "lookaheadDays" | "maxWatches">
): { allowed: boolean; requiredTier: Tier | null; reason: string | null } {
  if (ENTITLEMENTS[tier][feature]) {
    return { allowed: true, requiredTier: null, reason: null };
  }
  const requiredTier: Tier = ENTITLEMENTS.free[feature] ? "free" : "pro";
  const reason =
    requiredTier === "free"
      ? "Create a free account to unlock this."
      : "This is part of the upcoming Pro plan.";
  return { allowed: false, requiredTier, reason };
}

/** Tier of the current request, set by the auth middleware. */
export function tierOf(c: Context): Tier {
  return c.get("tier") ?? "anonymous";
}

export function entitlementsOf(c: Context): Entitlements {
  return ENTITLEMENTS[tierOf(c)];
}
