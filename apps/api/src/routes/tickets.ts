import { Hono } from "hono";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import {
  expressPassPrices,
  ticketPriceCurrent,
  ticketProducts,
} from "@ratecoaster/db/schema";
import { GuestCategory } from "@ratecoaster/shared";
import { addDays, todayInTimezone } from "../collectors/framework/dates.js";
import { gateDateWindow, tierOf } from "../lib/entitlements.js";

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
        // The affiliate deep link a feed collector writes back per product, plus
        // which merchant it points at — powers the Book button and its FTC note.
        bookingUrl: typeof cfg.bookingUrl === "string" ? cfg.bookingUrl : null,
        bookingMerchant: typeof cfg.bookingMerchant === "string" ? cfg.bookingMerchant : null,
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

/** GET /v1/express-pass — latest Express price per date and tier. */
export const expressRouter = new Hono().get("/", async (c) => {
  const db = getDb();
  const destination = (c.req.query("destination") ?? "universal-orlando") as "universal-orlando";
  const tier = c.req.query("tier");
  const gate = gateDateWindow(tierOf(c), c.req.query("from"), c.req.query("to") ?? undefined);
  const from = gate.from;
  const to = gate.to;

  // Express is append-only with no `current` table — it re-prices intraday and
  // every sighting is interesting — so the latest value per date is selected here.
  const rows = await db
    .select({
      destination: expressPassPrices.destination,
      validDate: expressPassPrices.validDate,
      tier: expressPassPrices.tier,
      priceCents: expressPassPrices.priceCents,
      available: expressPassPrices.available,
      observedAt: expressPassPrices.observedAt,
    })
    .from(expressPassPrices)
    .where(
      and(
        eq(expressPassPrices.destination, destination),
        gte(expressPassPrices.validDate, from),
        lte(expressPassPrices.validDate, to),
        tier ? eq(expressPassPrices.tier, tier as "standard") : sql`true`
      )
    )
    .orderBy(asc(expressPassPrices.validDate), desc(expressPassPrices.observedAt));

  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = `${row.validDate}|${row.tier}`;
    if (!latest.has(key)) latest.set(key, row);
  }

  return c.json(
    [...latest.values()].map((r) => ({
      destination: r.destination,
      parkSlug: null,
      validDate: r.validDate,
      tier: r.tier,
      priceCents: r.priceCents,
      currency: "USD",
      available: r.available,
      observedAt: r.observedAt.toISOString(),
    }))
  );
});
