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
   * Take this from CJ's own Deep Link Generator, never from a catalogue export.
   * The export lists a creative described as "deep-link enabled" with a far
   * higher EPC, and it does not work — links built on it return an error page.
   * The generator is the only source that reflects what the network will
   * actually honour today.
   */
  evergreenLinkId: string;
  /** One of the network's interchangeable redirect hosts. */
  host: string;
}

/**
 * Undercover Tourist, via Commission Junction.
 *
 * These values come from a link produced by CJ's Deep Link Generator and
 * confirmed working in a browser — not from the catalogue export.
 *
 * The export's "Evergreen Link" (15733832) advertises itself as deep-link
 * enabled and carries by far the highest EPC, so it looked like the obvious
 * choice. Links built on it return an error page, as do the plain creatives in
 * that file. Catalogue exports go stale; the generator does not.
 */
export const UNDERCOVER_TOURIST: AffiliateNetwork = {
  merchant: "undercover-tourist",
  label: "Undercover Tourist",
  publisherId: "101861754",
  evergreenLinkId: "11556282",
  host: "www.jdoqocy.com",
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

/**
 * Named destinations, for CTAs that aren't tied to one tracked product.
 *
 * "Compare hotel prices" on the hotels index has no product row behind it, and
 * inventing a fake one purely to hang a link on would be worse than a small
 * registry. Keyed rather than free-text so a page can never invent a URL — the
 * allowlist still applies, and a typo fails at build time instead of sending a
 * visitor somewhere unintended.
 */
export interface NamedLink {
  key: string;
  merchant: string;
  url: string;
  /** Button copy. Describes the destination, never a discount we can't verify. */
  label: string;
}

/**
 * Every URL below has been fetched and confirmed to return a real page.
 *
 * An earlier version of this file guessed plausible-looking paths from a naming
 * pattern. Do not add one that has not been opened in a browser: a merchant's
 * 404 handler often returns 200 with a "we couldn't find that" page, so a bad
 * path fails silently and looks exactly like a working link.
 */
export const NAMED_LINKS: Record<string, NamedLink> = {
  "tickets-orlando": {
    key: "tickets-orlando",
    merchant: UNDERCOVER_TOURIST.merchant,
    // "Universal Studios Florida Discount Tickets | Undercover Tourist"
    url: "https://www.undercovertourist.com/orlando/universal-orlando-resort/",
    label: "Compare Universal Orlando ticket prices",
  },
  "tickets-hollywood": {
    key: "tickets-hollywood",
    merchant: UNDERCOVER_TOURIST.merchant,
    // "Universal Studios Hollywood | Universal discount tickets, crowds…"
    url: "https://www.undercovertourist.com/los-angeles/universal-studios-hollywood/",
    label: "Compare Hollywood ticket prices",
  },
  "hotels-orlando": {
    key: "hotels-orlando",
    merchant: UNDERCOVER_TOURIST.merchant,
    // "Disney Hotels Discount | Universal, SeaWorld, Orlando Hotels"
    url: "https://www.undercovertourist.com/orlando/hotels/",
    label: "Compare Orlando hotel prices",
  },
};

export function namedLink(key: string): NamedLink | null {
  return NAMED_LINKS[key] ?? null;
}

export function merchantLabelFor(merchant: string | null | undefined): string {
  if (!merchant) return "the official site";
  return NETWORKS[merchant]?.label ?? merchant;
}
