import type { CollectorContext } from "../../framework/types.js";
import type { PropertyRow, RateAdapter, RateAdapterParams, ReadingSink } from "./types.js";

/**
 * Derived rate adapter — SEAM, not yet live.
 *
 * The APH strategy after the pivot: no feed will ever carry authenticated
 * passholder rates, so instead of collecting APH prices we reconstruct them.
 * Sample the passholder discount sparsely (a few probes per hotel per date band
 * per week), derive the delta against the public rate, and apply it to the
 * affiliate-sourced public rate to synthesise all 365 days. Every row this
 * produces is `source: "derived"`, `isEstimated: true`.
 *
 * Requires (a) an affiliate public-rate baseline to apply the discount to and
 * (b) a sampled discount model — neither exists yet, so this reports
 * "not configured".
 */
export const derivedAdapter: RateAdapter = {
  source: "derived",
  name: "derived",

  async isReady(_ctx: CollectorContext, _property: PropertyRow) {
    return {
      ready: false,
      reason: "no discount model yet (needs sampled APH deltas + an affiliate baseline)",
    };
  },

  async collect(
    _ctx: CollectorContext,
    _property: PropertyRow,
    _params: RateAdapterParams,
    _emit: ReadingSink
  ) {
    // No-op until the discount-sampling model exists.
  },
};
