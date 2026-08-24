import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { outboundClicks, ticketProducts } from "@ratecoaster/db/schema";
import {
  buildAffiliateLink,
  buildMerchantLink,
  namedLink,
  normalizeSid,
  UnsafeDestinationError,
} from "@ratecoaster/shared";

export const outboundRouter = new Hono();
const recentClicks = new Map<string, number>();

function pathOnly(from: string | null): string | null {
  if (!from) return null;
  try {
    return new URL(from, "https://www.ratecoaster.net").pathname.slice(0, 200);
  } catch {
    return from.split("?")[0]!.slice(0, 200);
  }
}

/**
 * Record a click, and never let that failure cost us the click.
 *
 * `getDb()` throws synchronously when no database is configured, so the obvious
 * `void db.insert(...).catch(...)` still takes the whole handler down — the
 * `.catch` never gets a chance to run. That turned every affiliate link into a
 * redirect back to our own homepage whenever Postgres was unreachable, which is
 * precisely backwards: resolving a link needs no database, and losing a log row
 * is a rounding error next to losing the sale.
 */
function logClick(sid: string, merchant: string, from: string | null): void {
  const fromPath = pathOnly(from);
  const key = `${sid}|${merchant}|${fromPath ?? ""}`;
  const now = Date.now();
  const previous = recentClicks.get(key);
  if (previous && now - previous < 60_000) return;
  recentClicks.set(key, now);
  if (recentClicks.size > 2_000) {
    for (const [candidate, at] of recentClicks) {
      if (now - at > 60_000) recentClicks.delete(candidate);
    }
    while (recentClicks.size > 2_000) {
      const oldest = recentClicks.keys().next().value as string | undefined;
      if (!oldest) break;
      recentClicks.delete(oldest);
    }
  }
  try {
    void getDb()
      .insert(outboundClicks)
      .values({
        sid,
        merchant,
        // Path only. Query strings on our pages carry dates and party sizes,
        // and a click log has no business keeping those.
        fromPath,
      })
      .catch((err) => console.error("[outbound] click log failed:", err));
  } catch (err) {
    console.error("[outbound] click log unavailable:", err);
  }
}

/**
 * GET /v1/outbound/link/:key
 *
 * Resolves a named destination — the CTAs that aren't tied to one tracked
 * product, like "compare hotel prices" on the hotels index.
 *
 * Keys are looked up in a fixed registry rather than accepting a URL, so no
 * page can ever cause this endpoint to forward somewhere arbitrary.
 */
outboundRouter.get("/link/:key", async (c) => {
  const key = c.req.param("key");
  const link = namedLink(key);
  if (!link) {
    return c.json({ error: { code: "not_found", message: "no such link" } }, 404);
  }

  const sid = normalizeSid(`link_${link.key}`);
  let url: string;
  try {
    url = buildAffiliateLink({ merchant: link.merchant, destinationUrl: link.url, sid });
  } catch (err) {
    console.error(`[outbound] named link ${key} is misconfigured: ${String(err)}`);
    return c.json({ error: { code: "bad_link", message: "link is misconfigured" } }, 500);
  }

  logClick(sid, link.merchant, c.req.query("from") ?? null);
  return c.json({ url, merchant: link.merchant, product: link.label });
});

/**
 * GET /v1/outbound/ticket/:slug
 *
 * Resolves a tracked product to its affiliate link and records the click.
 *
 * Returns JSON rather than issuing the redirect itself, so the visible URL in
 * the address bar stays first-party (`ratecoaster.net/go/...`) and the mobile
 * app can consume the same endpoint without following a browser redirect it
 * would then have to unpick.
 */
outboundRouter.get("/ticket/:slug", async (c) => {
  const db = getDb();
  const slug = c.req.param("slug");
  const fromPath = c.req.query("from") ?? null;

  const [product] = await db
    .select({
      slug: ticketProducts.slug,
      name: ticketProducts.name,
      affiliateUrl: ticketProducts.affiliateUrl,
      merchant: ticketProducts.affiliateMerchant,
      collectorConfig: ticketProducts.collectorConfig,
    })
    .from(ticketProducts)
    .where(and(eq(ticketProducts.slug, slug), eq(ticketProducts.active, true)))
    .limit(1);

  if (!product) {
    return c.json({ error: { code: "not_found", message: "no link for that product" } }, 404);
  }

  // The columns are authoritative; collectorConfig is the older home for the
  // same two values and stays readable so seeded rows keep working.
  const cfg = (product.collectorConfig ?? {}) as Record<string, unknown>;
  const merchant =
    product.merchant ?? (typeof cfg.bookingMerchant === "string" ? cfg.bookingMerchant : null);
  const destination =
    product.affiliateUrl ?? (typeof cfg.bookingUrl === "string" ? cfg.bookingUrl : null);

  if (!merchant) {
    return c.json({ error: { code: "not_found", message: "no link for that product" } }, 404);
  }

  const sid = normalizeSid(`ticket_${product.slug}`);

  let url: string;
  try {
    url = destination
      ? buildAffiliateLink({ merchant, destinationUrl: destination, sid })
      : // No specific destination recorded — send them to the merchant's own
        // landing page rather than nowhere. Still tracked, still attributed.
        buildMerchantLink(merchant, sid);
  } catch (err) {
    if (err instanceof UnsafeDestinationError) {
      /*
       * A stored destination that fails the allowlist is a data problem, not a
       * visitor problem, and it must never be followed: this endpoint sits
       * behind our own domain, so forwarding an arbitrary URL would hand an
       * attacker a first-party open redirect to phish with.
       */
      console.error(`[outbound] refusing unsafe destination for ${slug}: ${String(err)}`);
      return c.json({ error: { code: "bad_link", message: "link is misconfigured" } }, 500);
    }
    throw err;
  }

  // After building, so a broken link never produces a click record.
  logClick(sid, merchant, fromPath);
  return c.json({ url, merchant, product: product.name });
});
