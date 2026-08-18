import type { CollectorContext } from "../../framework/types.js";
import type { PropertyRow, RateAdapter, RateAdapterParams, ReadingSink } from "./types.js";

/**
 * Optional affiliate rate adapter — dormant seam, not product direction.
 *
 * Direct observed STANDARD and APH rates are collected from Universal's own
 * reservation engine. This remains only so a licensed third-party source can be
 * added later without redesigning the collector.
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
