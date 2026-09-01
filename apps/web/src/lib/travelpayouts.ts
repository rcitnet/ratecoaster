/** Travelpayouts Drive project script supplied for ratecoaster.net. */
export const TRAVELPAYOUTS_DRIVE_URL = "https://emrld.ltd/NTY0OTc0.js?t=564974";

/**
 * Drive may inspect and rewrite page links, so it belongs on public content
 * only. Private account and staff screens must never be exposed to it.
 */
export const TRAVELPAYOUTS_EXCLUDED_PREFIXES = [
  "/account",
  "/admin",
  "/auth",
  "/join",
  "/privacy",
  "/terms",
] as const;

export function shouldLoadTravelpayouts(pathname: string): boolean {
  return !TRAVELPAYOUTS_EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Inline bootstrap supplied by Travelpayouts, with one deliberate guard:
 * sensitive RateCoaster routes are rejected before the remote request occurs.
 * The remote script itself remains async and retains their CMP compatibility
 * marker.
 */
export function travelpayoutsLoaderSource(): string {
  return `(function () {
  var excluded = ${JSON.stringify(TRAVELPAYOUTS_EXCLUDED_PREFIXES)};
  var path = window.location.pathname;
  if (excluded.some(function (prefix) {
    return path === prefix || path.indexOf(prefix + "/") === 0;
  })) return;
  var script = document.createElement("script");
  script.async = true;
  script.setAttribute("data-cmp-ab", "2");
  script.src = ${JSON.stringify(TRAVELPAYOUTS_DRIVE_URL)};
  document.head.appendChild(script);
})();`;
}
