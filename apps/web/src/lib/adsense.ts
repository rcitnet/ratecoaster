/** Public AdSense account identifier used by the browser tag and ad units. */
export const ADSENSE_CLIENT = "ca-pub-9805566407128224";

const AD_FREE_EXACT = new Set([
  "/account",
  "/admin",
  "/auth",
  "/contact",
  "/join",
  "/plan",
  "/planner",
  "/privacy",
  "/terms",
]);

const AD_FREE_PREFIXES = [
  "/account/",
  "/admin/",
  "/auth/",
  "/join/",
  "/plan/",
  "/planner/",
  "/privacy/",
  "/terms/",
  // Individual live attraction status cards are short utility pages (noindex).
  // Keep AdSense focused on editorial guides and full planning calendars.
  "/waits/",
];

/**
 * Only load AdSense on substantial content and calendar pages — never on
 * account, legal, contact, or thin utility subpages.
 */
export function shouldLoadAdSense(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (AD_FREE_EXACT.has(normalized)) return false;
  return !AD_FREE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
