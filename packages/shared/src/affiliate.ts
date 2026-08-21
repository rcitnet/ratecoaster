/**
 * Affiliate link construction.
 *
 * Deliberately pure and in `shared`: the mobile app will need to build the same
 * links, and a second implementation would drift the moment one network changes
 * its parameter names.
 *
 * The governing decision here is that we store the **destination** — a plain
 * undercovertourist.com product URL — and wrap it at render time, rather than
 * storing pre-baked network links. Storing wrapped links means the network is
 * welded into the data: switching from CJ to a direct programme, or adding a
 * second merchant for the same product, becomes a data migration instead of a
 * one-file change.
 */

export interface AffiliateNetwork {
  /** Stable key stored on rows, e.g. "undercover-tourist". */
  merchant: string;
  /** Human label for the UI. */
  label: string;
  /** Publisher ID with the network. */
  publisherId: string;
  /**
   * Link ID of a **deep-link-enabled** creative.
   *
   * For Commission Junction this must be an "Evergreen Link". Ordinary creative
   * IDs ignore `url=` and dump the visitor on the advertiser's homepage — which
   * looks like it works, converts far worse, and is invisible unless you click
   * one and watch where you land.
   */
  evergreenLinkId: string;
  /** One of the network's interchangeable redirect hosts. */
  host: string;
}

/**
 * Undercover Tourist, via Commission Junction.
 *
 * Link 15733832 is CJ's Evergreen creative for this advertiser — the only one in
 * the catalogue that is deep-link enabled, and by a wide margin the highest
 * earning ($144.40 three-month EPC against $15.77 for the best fixed link).
 * The specific "Save $53 on…" creatives are both lower earning and stale, most
 * last touched in April 2023.
 */
export const UNDERCOVER_TOURIST: AffiliateNetwork = {
  merchant: "undercover-tourist",
  label: "Undercover Tourist",
  publisherId: "101861754",
  evergreenLinkId: "15733832",
  host: "www.anrdoezrs.net",
};

export const NETWORKS: Record<string, AffiliateNetwork> = {
  [UNDERCOVER_TOURIST.merchant]: UNDERCOVER_TOURIST,
};

/** Hosts we are willing to deep-link to, per merchant. */
const ALLOWED_DESTINATIONS: Record<string, string[]> = {
  "undercover-tourist": ["undercovertourist.com", "www.undercovertourist.com"],
};

/**
 * Sub-ID: how we find out which of *our* pages earned the money.
 *
 * The network reports revenue per creative, and we use one creative for
 * everything, so without this every sale would be attributed to a single
 * undifferentiated link. CJ restricts the value to a short alphanumeric token,
 * so anything else is stripped rather than sent and silently dropped.
 */
export function normalizeSid(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export class UnsafeDestinationError extends Error {
  constructor(url: string, merchant: string) {
    super(`${url} is not an allowed destination for ${merchant}`);
    this.name = "UnsafeDestinationError";
  }
}

export interface BuildLinkOptions {
  merchant: string;
  /** Plain destination URL on the merchant's own site. */
  destinationUrl: string;
  /** Identifies the page and product that produced the click. */
  sid?: string;
}

/**
 * Wrap a destination URL in a network tracking link.
 *
 * Throws rather than degrading when the destination is not on the merchant's
 * own domain. An open redirect that will happily forward to any URL an attacker
 * supplies is a genuine vulnerability — ours would sit behind a first-party
 * `/go/` path on our own domain, which is exactly what makes it useful for
 * phishing. The allowlist is the whole defence, so it fails loudly.
 */
export function buildAffiliateLink(opts: BuildLinkOptions): string {
  const network = NETWORKS[opts.merchant];
  if (!network) throw new Error(`unknown merchant: ${opts.merchant}`);

  let destination: URL;
  try {
    destination = new URL(opts.destinationUrl);
  } catch {
    throw new UnsafeDestinationError(opts.destinationUrl, opts.merchant);
  }

  if (destination.protocol !== "https:") {
    throw new UnsafeDestinationError(opts.destinationUrl, opts.merchant);
  }

  const allowed = ALLOWED_DESTINATIONS[opts.merchant] ?? [];
  if (!allowed.includes(destination.hostname.toLowerCase())) {
    throw new UnsafeDestinationError(opts.destinationUrl, opts.merchant);
  }

  const base = `https://${network.host}/click-${network.publisherId}-${network.evergreenLinkId}`;
  const params = new URLSearchParams();
  params.set("url", destination.toString());
  if (opts.sid) {
    const sid = normalizeSid(opts.sid);
    if (sid) params.set("sid", sid);
  }

  return `${base}?${params.toString()}`;
}

/**
 * The bare tracking link, no destination.
 *
 * Used where we want to send someone to the merchant generally — a "browse all
 * tickets" CTA — rather than to one product.
 */
export function buildMerchantLink(merchant: string, sid?: string): string {
  const network = NETWORKS[merchant];
  if (!network) throw new Error(`unknown merchant: ${merchant}`);

  const base = `https://${network.host}/click-${network.publisherId}-${network.evergreenLinkId}`;
  const normalized = sid ? normalizeSid(sid) : "";
  return normalized ? `${base}?sid=${normalized}` : base;
}

export function merchantLabelFor(merchant: string | null | undefined): string {
  if (!merchant) return "the official site";
  return NETWORKS[merchant]?.label ?? merchant;
}
