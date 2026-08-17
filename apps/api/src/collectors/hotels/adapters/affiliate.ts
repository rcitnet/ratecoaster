import type { CollectorContext } from "../../framework/types.js";
import type { PropertyRow, RateAdapter, RateAdapterParams, ReadingSink } from "./types.js";

/**
 * Affiliate rate adapter — SEAM, not yet live.
 *
 * The pivot: instead of scraping booking engines, source public nightly rates
 * from a commercial feed. For Universal's Loews-operated on-site hotels the only
 * viable carriers are OTA APIs — Expedia (direct or via Travelpayouts),
 * Booking.com's demand API, or Stay22. Each needs credentials RateCoaster does
 * not hold yet, so this adapter reports "not configured" rather than guessing.
 *
 * When a key exists, `collect` should: fetch the property's date-keyed rate
 * calendar in as few requests as the feed allows (feeds return whole calendars,
 * unlike the per-date scraper), map each night to a RateReading with
 * `source: "affiliate"` and `merchant` set to the feed name, then `emit`.
 */
export const affiliateAdapter: RateAdapter = {
  source: "affiliate",
  name: "affiliate",

  async isReady(_ctx: CollectorContext, _property: PropertyRow) {
    return {
      ready: false,
      reason:
        "no affiliate feed configured (needs an Expedia/Travelpayouts, Booking, or Stay22 key)",
    };
  },

  async collect(
    _ctx: CollectorContext,
    _property: PropertyRow,
    _params: RateAdapterParams,
    _emit: ReadingSink
  ) {
    // No-op until a feed is wired in; isReady gates this off at the collector.
  },
};
