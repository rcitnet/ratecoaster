/**
 * Analytics configuration, read on the server at request time.
 *
 * Deliberately NOT using NEXT_PUBLIC_*. Those are inlined into the bundle at
 * build time by textual substitution, which means adding a key to .env and
 * restarting would leave the tag silently absent until someone remembered to
 * rebuild — a five-minute build on a small instance, and a failure that looks
 * exactly like "nobody visited". The layout is a server component, so it can
 * read plain environment variables at runtime and hand them down as props.
 * Changing a measurement id then costs a service restart, not a deploy.
 *
 * Both providers are optional and independent. An unset — or obviously
 * unedited — value means the script is never emitted at all, rather than
 * emitted with a broken id. That distinction is the point: a tag that loads and
 * records nothing produces a dashboard reading "no traffic", indistinguishable
 * from a site nobody visits. Refusing to render is the failure that announces
 * itself.
 */

export type AnalyticsConfig = {
  cloudflareToken: string;
  gaMeasurementId: string;
};

/** Placeholder shapes people paste from documentation without editing. */
const UNEDITED = [/^(your|xxx|placeholder|changeme|todo|example)/i, /^(g-)?x+$/i];

function configured(raw: string | undefined, shape: RegExp): string {
  const value = raw?.trim() ?? "";
  if (!value) return "";
  if (UNEDITED.some((p) => p.test(value))) return "";
  return shape.test(value) ? value : "";
}

/** Server-only. Calling this from a client component yields empty strings. */
export function analyticsConfig(): AnalyticsConfig {
  return {
    // Cloudflare beacon tokens are 32 hex characters.
    cloudflareToken: configured(process.env.CLOUDFLARE_ANALYTICS_TOKEN, /^[0-9a-f]{32}$/i),
    // GA4 measurement ids are "G-" followed by the stream id.
    gaMeasurementId: configured(process.env.GA_MEASUREMENT_ID, /^G-[A-Z0-9]{6,}$/i),
  };
}
