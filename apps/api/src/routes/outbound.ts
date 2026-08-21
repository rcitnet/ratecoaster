import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { outboundClicks, ticketProducts } from "@ratecoaster/db/schema";
import {
  buildAffiliateLink,
  buildMerchantLink,
  normalizeSid,
  UnsafeDestinationError,
} from "@ratecoaster/shared";

export const outboundRouter = new Hono();

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

  /*
   * Log after building, so a broken link never produces a click record, and
   * fire-and-forget so a slow insert cannot delay someone leaving for the
   * merchant. A lost row is a rounding error; a lost sale is not.
   */
  void db
    .insert(outboundClicks)
    .values({
      sid,
      merchant,
      // Path only. Query strings on our own pages can carry dates and party
      // sizes, and a click log has no business keeping those.
      fromPath: fromPath ? fromPath.split("?")[0]!.slice(0, 200) : null,
    })
    .catch((err) => console.error("[outbound] click log failed:", err));

  return c.json({ url, merchant, product: product.name });
});
