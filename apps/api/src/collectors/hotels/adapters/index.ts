import type { RateAdapter } from "./types.js";
import { observedAdapter } from "./observed.js";
import { affiliateAdapter } from "./affiliate.js";
import { derivedAdapter } from "./derived.js";
import { universalIbeAdapter } from "./universal-ibe.js";
import { universalKidsCommerceAdapter } from "./universal-kids-commerce.js";

export type { RateAdapter, RateAdapterParams, ReadingSink, PropertyRow } from "./types.js";
export { observedAdapter } from "./observed.js";
export { affiliateAdapter } from "./affiliate.js";
export { derivedAdapter } from "./derived.js";
export { universalIbeAdapter } from "./universal-ibe.js";
export { universalKidsCommerceAdapter } from "./universal-kids-commerce.js";

/**
 * Adapters keyed by the `source` a property's collectorConfig requests. An
 * absent or unknown value resolves to the observed (scraper) adapter, so
 * existing seed data and the current behaviour are unchanged.
 */
export const RATE_ADAPTERS: Record<string, RateAdapter> = {
  observed: observedAdapter,
  affiliate: affiliateAdapter,
  derived: derivedAdapter,
};

/**
 * Pick the adapter for a property. `collectorConfig.source` selects it;
 * `collectorConfig.adapter` (the endpoint-config name) is unrelated and still
 * used by the observed adapter to find its captured endpoint.
 */
export function selectAdapter(cfg: Record<string, unknown> | null | undefined): RateAdapter {
  if (cfg?.adapter === "universal-ibe") return universalIbeAdapter;
  if (cfg?.adapter === "universal-kids-commerce") return universalKidsCommerceAdapter;
  const source = typeof cfg?.source === "string" ? cfg.source : "observed";
  return RATE_ADAPTERS[source] ?? observedAdapter;
}
