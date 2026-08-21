import { Hono } from "hono";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { ticketPriceCurrent, ticketProducts } from "@ratecoaster/db/schema";
import { ExpressPassType, GuestCategory } from "@ratecoaster/shared";
import { gateDateWindow, tierOf } from "../lib/entitlements.js";
import { universalExpressConfigOf } from "../collectors/tickets/universal-orlando-express.js";

export const ticketsRouter = new Hono();

ticketsRouter.get("/products", async (c) => {
  const db = getDb();
  const destination = c.req.query("destination");
  const rows = await db
    .select()
    .from(ticketProducts)
    .where(
      destination
        ? and(
            eq(ticketProducts.active, true),
            eq(ticketProducts.destination, destination as "universal-orlando"),
            sql`${ticketProducts.kind} <> 'express-pass'`
          )
        : and(eq(ticketProducts.active, true), sql`${ticketProducts.kind} <> 'express-pass'`)
    )
    .orderBy(asc(ticketProducts.days), asc(ticketProducts.name));

  return c.json(
    rows.map((p) => {
      const cfg = (p.collectorConfig ?? {}) as Record<string, unknown>;
      return {
        id: p.id,
        destination: p.destination,
        slug: p.slug,
        name: p.name,
        kind: p.kind,
        days: p.days,
        parkCount: p.parkCount,
        externalId: p.externalId,
        /*
         * A first-party path, never the network URL.
         *
         * Everything outbound goes through /go so clicks are counted here, the
         * link can change without a deploy, and the publisher ID stays out of
         * the HTML. The column wins over the older collectorConfig value, which
         * remains readable so existing seeded rows keep working.
         */
        bookingUrl:
          p.affiliateMerchant ?? cfg.bookingMerchant
            ? `/go/ticket/${encodeURIComponent(p.slug)}`
            : null,
        bookingMerchant:
          p.affiliateMerchant ??
          (typeof cfg.bookingMerchant === "string" ? cfg.bookingMerchant : null),
      };
    })
  );
});

/**
 * GET /v1/tickets/calendar
 *
 * Date-by-date pricing for one product, banded into low/mid/high.
 *
 * Banding is computed across the *requested window* rather than against fixed
 * thresholds, because "cheap" is relative: a $145 one-day ticket is a bargain
 * in a December window and unremarkable in a September one. Terciles keep the
 * colouring meaningful whatever range the user is looking at.
 */
ticketsRouter.get("/calendar", async (c) => {
  const db = getDb();
  const productSlug = c.req.query("productSlug");
  const parsedGuestCategory = GuestCategory.safeParse(c.req.query("guestCategory") ?? "adult");
  if (!parsedGuestCategory.success) {
    return c.json({ error: { code: "invalid_query", message: "bad guest category" } }, 400);
  }
  const guestCategory = parsedGuestCategory.data;
  const gate = gateDateWindow(tierOf(c), c.req.query("from"), c.req.query("to") ?? undefined);
  const from = gate.from;
  const to = gate.to;

  if (!productSlug) {
    return c.json({ error: { code: "missing_param", message: "productSlug is required" } }, 400);
  }

  const [product] = await db
    .select()
    .from(ticketProducts)
    .where(and(eq(ticketProducts.slug, productSlug), eq(ticketProducts.active, true)))
    .limit(1);

  if (!product) {
    return c.json({ error: { code: "not_found", message: `no product ${productSlug}` } }, 404);
  }

  const rows = await db
    .select({
      validDate: ticketPriceCurrent.validDate,
      priceCents: ticketPriceCurrent.priceCents,
      totalCents: ticketPriceCurrent.totalCents,
      available: ticketPriceCurrent.available,
    })
    .from(ticketPriceCurrent)
    .where(
      and(
        eq(ticketPriceCurrent.productId, product.id),
        eq(ticketPriceCurrent.guestCategory, guestCategory),
        gte(ticketPriceCurrent.validDate, from),
        lte(ticketPriceCurrent.validDate, to)
      )
    )
    .orderBy(asc(ticketPriceCurrent.validDate));

  const comparablePrice = (row: (typeof rows)[number]) => row.totalCents ?? row.priceCents;
  const prices = rows.filter((row) => row.available).map(comparablePrice).sort((a, b) => a - b);
  const lowCut = prices[Math.floor(prices.length / 3)] ?? 0;
  const highCut = prices[Math.floor((prices.length * 2) / 3)] ?? 0;
  const windowLow = prices[0] ?? null;

  return c.json(
    rows.map((r) => ({
      validDate: r.validDate,
      priceCents: r.priceCents,
      totalCents: r.totalCents,
      available: r.available,
      band: !r.available
        ? null
        : comparablePrice(r) <= lowCut
          ? "low"
          : comparablePrice(r) >= highCut
            ? "high"
            : "mid",
      isWindowLow: r.available && windowLow !== null && comparablePrice(r) === windowLow,
    }))
  );
});

/** Product-specific Express catalogue. One row per actual storefront offering. */
export const expressRouter = new Hono().get("/products", async (c) => {
  const db = getDb();
  const destination = (c.req.query("destination") ?? "universal-orlando") as "universal-orlando";
  const rows = await db
    .select()
    .from(ticketProducts)
    .where(
      and(
        eq(ticketProducts.destination, destination),
        eq(ticketProducts.kind, "express-pass"),
        eq(ticketProducts.active, true)
      )
    )
    .orderBy(asc(ticketProducts.days), asc(ticketProducts.name));

  return c.json(
    rows.flatMap((product) => {
      const config = universalExpressConfigOf(product);
      if (!config || !product.days || !product.parkCount) return [];
      return [{
        id: product.id,
        destination: product.destination,
        slug: product.slug,
        name: product.name,
        days: product.days,
        parkCount: product.parkCount,
        parkSlugs: config.parkSlugs,
        passType: config.passType,
      }];
    })
  );
}).get("/", async (c) => {
  const db = getDb();
  const destination = (c.req.query("destination") ?? "universal-orlando") as "universal-orlando";
  const parsedPassType = ExpressPassType.safeParse(c.req.query("passType"));
  const passType = parsedPassType.success ? parsedPassType.data : undefined;
  const requestedDays = Number(c.req.query("days"));
  const days = Number.isInteger(requestedDays) && requestedDays >= 1 && requestedDays <= 5
    ? requestedDays
    : undefined;
  const productSlug = c.req.query("productSlug");
  const parkSlug = c.req.query("parkSlug");
  const gate = gateDateWindow(tierOf(c), c.req.query("from"), c.req.query("to") ?? undefined);
  const from = gate.from;
  const to = gate.to;

  const productRows = await db
    .select()
    .from(ticketProducts)
    .where(
      and(
        eq(ticketProducts.destination, destination),
        eq(ticketProducts.kind, "express-pass"),
        eq(ticketProducts.active, true)
      )
    );
  const products = productRows.flatMap((product) => {
    const config = universalExpressConfigOf(product);
    if (!config || !product.days || !product.parkCount) return [];
    if (productSlug && product.slug !== productSlug) return [];
    if (passType && config.passType !== passType) return [];
    if (days && product.days !== days) return [];
    if (parkSlug && !config.parkSlugs.includes(parkSlug)) return [];
    return [{ product, config }];
  });
  if (products.length === 0) return c.json([]);

  const metadata = new Map(products.map(({ product, config }) => [product.id, { product, config }]));
  const rows = await db
    .select({
      productId: ticketPriceCurrent.productId,
      validDate: ticketPriceCurrent.validDate,
      priceCents: ticketPriceCurrent.priceCents,
      totalCents: ticketPriceCurrent.totalCents,
      available: ticketPriceCurrent.available,
      source: ticketPriceCurrent.source,
      isEstimated: ticketPriceCurrent.isEstimated,
      merchant: ticketPriceCurrent.merchant,
      observedAt: ticketPriceCurrent.observedAt,
    })
    .from(ticketPriceCurrent)
    .where(
      and(
        inArray(ticketPriceCurrent.productId, [...metadata.keys()]),
        eq(ticketPriceCurrent.guestCategory, "all-ages"),
        gte(ticketPriceCurrent.validDate, from),
        lte(ticketPriceCurrent.validDate, to)
      )
    )
    .orderBy(asc(ticketPriceCurrent.validDate));

  return c.json(
    rows.flatMap((row) => {
      const target = metadata.get(row.productId);
      if (!target || !row.validDate) return [];
      return [{
        productSlug: target.product.slug,
        productName: target.product.name,
        destination: target.product.destination,
        days: target.product.days!,
        parkCount: target.product.parkCount!,
        parkSlugs: target.config.parkSlugs,
        passType: target.config.passType,
        validDate: row.validDate,
        priceCents: row.priceCents,
        totalCents: row.totalCents ?? row.priceCents,
        currency: "USD",
        available: row.available,
        source: row.source,
        isEstimated: row.isEstimated,
        merchant: row.merchant,
        observedAt: row.observedAt.toISOString(),
      }];
    })
  );
});
