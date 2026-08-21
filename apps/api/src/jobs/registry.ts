import { waitTimesCollector } from "../collectors/waits/index.js";
import { hotelRateCollector } from "../collectors/hotels/index.js";
import { expressPassCollector, ticketPriceCollector } from "../collectors/tickets/index.js";
import { undercoverTouristTicketFeed } from "../collectors/tickets/feed.js";
import { flightPriceCollector } from "../collectors/flights/index.js";
import type { Collector } from "../collectors/framework/types.js";

/**
 * The collector registry, deliberately in its own module with no side effects.
 *
 * It previously lived in `run.ts` alongside the CLI's `main()`, which meant the
 * API server — which only wants the list to render /v1/status — triggered a
 * full collection run just by importing it. Data-fetching side effects must
 * never be a consequence of an import.
 */
export const COLLECTORS: Collector[] = [
  waitTimesCollector,
  hotelRateCollector,
  ticketPriceCollector,
  expressPassCollector,
  undercoverTouristTicketFeed,
  flightPriceCollector,
];
