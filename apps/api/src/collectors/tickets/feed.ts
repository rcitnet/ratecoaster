import { and, eq, sql } from "drizzle-orm";
import {
  ticketPriceCurrent,
  ticketPriceObservations,
  ticketProducts,
} from "@ratecoaster/db/schema";
import { politeFetch } from "../framework/http.js";
import type { Collector, CollectorContext } from "../framework/types.js";
import { normalizeDate } from "./index.js";
import {
  isPlaceholderFeedUrl,
  loadTicketFeedConfig,
  parseFeed,
} from "./feed-config.js";

type ProductRow = typeof ticketProducts.$inferSelect;
type GuestCategory = "adult" | "child" | "senior";

/** The CJ SKU a product is matched on, from its collectorConfig. */
function feedSkuOf(cfg: Record<string, unknown> | null): string | null {
  const c = (cfg ?? {}) as Record<string, unknown>;
  const v = c.feedSku ?? c.cjSku ?? c.sku;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function guestCategoryOf(cfg: Record<string, unknown> | null): GuestCategory | null {
  const v = ((cfg ?? {}) as Record<string, unknown>).feedGuestCategory;
  return v === "adult" || v === "child" || v === "senior" ? v : null;
}

/**
 * Affiliate ticket-price feed collector.
 *
 * The ticket side of the scrape-to-affiliate pivot: instead of probing a
 * storefront API, ingest a network product feed (CJ, carrying Undercover
 * Tourist), match its rows to the ticket products we track by SKU, and record
 * the discounted price plus the affiliate deep link. Prices are stamped
 * `source: "affiliate"` with the configured merchant; the deep link is written
 * into each product's `collectorConfig.bookingUrl` for the Book button.
 *
 * Merchant-generic on purpose — a second feed (a hotel OTA CSV, another ticket
 * reseller) is a new config file plus one registry line, not new code.
 */
export function createTicketFeedCollector(configName: string): Collector {
  return {
    name: `ticket-feed-${configName}`,
    description: `Ticket prices via the ${configName} affiliate feed`,
    intervalMinutes: 720,

    async isConfigured({ db }) {
      const config = await loadTicketFeedConfig(configName);
      if (!config) {
        return { ready: false, reason: `no feed config at config/feeds/${configName}.json` };
      }
      if (isPlaceholderFeedUrl(config.feedUrl)) {
        return { ready: false, reason: `feed URL not set in config/feeds/${configName}.json` };
      }
      const products = await db.select().from(ticketProducts).where(eq(ticketProducts.active, true));
      if (!products.some((p) => feedSkuOf(p.collectorConfig))) {
        return {
          ready: false,
          reason: "no ticket product has a collectorConfig.feedSku to match feed rows",
        };
      }
      return { ready: true };
    },

    async run(ctx: CollectorContext) {
      const { db, stats, logger } = ctx;

      const config = await loadTicketFeedConfig(configName);
      if (!config || isPlaceholderFeedUrl(config.feedUrl)) {
        stats.notes.skipped = "feed not configured";
        return;
      }

      const products = await db.select().from(ticketProducts).where(eq(ticketProducts.active, true));
      const bySku = new Map<string, ProductRow>();
      for (const p of products) {
        const sku = feedSkuOf(p.collectorConfig);
        if (sku) bySku.set(sku, p);
      }
      if (bySku.size === 0) {
        stats.notes.skipped = "no product feedSku configured";
        return;
      }

      stats.requestCount++;
      const res = await politeFetch(config.feedUrl, { headers: config.headers, rpm: 6 });
      if (res.skipped) return; // dry run
      if (!res.body) {
        logger.warn("feed returned an empty body");
        return;
      }

      const rows = parseFeed(config, res.body);
      let matched = 0;

      for (const row of rows) {
        const product = bySku.get(row.sku);
        if (!product) continue; // a feed row for a product we don't track
        matched++;
        stats.parsedCount++;

        await persistFeedTicketPrice(ctx, {
          productId: product.id,
          guestCategory: guestCategoryOf(product.collectorConfig) ?? config.defaultGuestCategory,
          priceCents: row.priceCents,
          available: row.available,
          merchant: config.merchant,
          validDate: normalizeDate(row.validDate ?? ""),
        });

        if (row.buyUrl) await storeBookingUrl(ctx, product, config.merchant, row.buyUrl);
      }

      stats.notes.matched = matched;
      stats.notes.feedRows = rows.length;
      logger.info(`${configName}: matched ${matched} of ${rows.length} feed rows to tracked products`);
    },
  };
}

/**
 * Write-on-change persistence for a feed price.
 *
 * A dedicated path rather than the storefront collector's `persistTicketPrice`
 * because CJ feeds are product-level and date-less: `validDate` is null, and a
 * Postgres unique index treats nulls as distinct, so `onConflictDoUpdate` can't
 * be relied on. This does an explicit update-or-insert keyed with `IS NULL`.
 */
async function persistFeedTicketPrice(
  ctx: CollectorContext,
  reading: {
    productId: string;
    guestCategory: GuestCategory;
    priceCents: number;
    available: boolean;
    merchant: string;
    validDate: string | null;
  }
): Promise<void> {
  const { db, stats } = ctx;
  const source = "affiliate" as const;

  const dateCond =
    reading.validDate === null
      ? sql`${ticketPriceCurrent.validDate} is null`
      : eq(ticketPriceCurrent.validDate, reading.validDate);

  const existing = await db
    .select({ priceCents: ticketPriceCurrent.priceCents, source: ticketPriceCurrent.source })
    .from(ticketPriceCurrent)
    .where(
      and(
        eq(ticketPriceCurrent.productId, reading.productId),
        dateCond,
        eq(ticketPriceCurrent.guestCategory, reading.guestCategory)
      )
    )
    .limit(1);

  const prev = existing[0];
  const changed = !prev || prev.priceCents !== reading.priceCents || prev.source !== source;

  if (changed) {
    await db.insert(ticketPriceObservations).values({
      productId: reading.productId,
      validDate: reading.validDate,
      guestCategory: reading.guestCategory,
      priceCents: reading.priceCents,
      totalCents: null,
      available: reading.available,
      source,
      isEstimated: false,
      merchant: reading.merchant,
    });
    stats.writtenCount++;
  }

  if (prev) {
    await db
      .update(ticketPriceCurrent)
      .set({
        priceCents: reading.priceCents,
        available: reading.available,
        source,
        isEstimated: false,
        merchant: reading.merchant,
        previousCents: changed ? prev.priceCents : sql`${ticketPriceCurrent.previousCents}`,
        observedAt: new Date(),
      })
      .where(
        and(
          eq(ticketPriceCurrent.productId, reading.productId),
          dateCond,
          eq(ticketPriceCurrent.guestCategory, reading.guestCategory)
        )
      );
  } else {
    await db.insert(ticketPriceCurrent).values({
      productId: reading.productId,
      validDate: reading.validDate,
      guestCategory: reading.guestCategory,
      priceCents: reading.priceCents,
      totalCents: null,
      previousCents: null,
      available: reading.available,
      source,
      isEstimated: false,
      merchant: reading.merchant,
      observedAt: new Date(),
    });
  }
}

/**
 * Store the affiliate deep link on the product's collectorConfig (Rui's chosen
 * home for it). Only writes when the link actually changed, so the product row
 * isn't churned on every feed run.
 */
async function storeBookingUrl(
  ctx: CollectorContext,
  product: ProductRow,
  merchant: string,
  buyUrl: string
): Promise<void> {
  const cfg = (product.collectorConfig ?? {}) as Record<string, unknown>;
  if (cfg.bookingUrl === buyUrl && cfg.bookingMerchant === merchant) return;

  await ctx.db
    .update(ticketProducts)
    .set({
      collectorConfig: {
        ...cfg,
        bookingUrl: buyUrl,
        bookingMerchant: merchant,
        bookingUrlUpdatedAt: new Date().toISOString(),
      },
    })
    .where(eq(ticketProducts.id, product.id));
}

/** The Undercover Tourist feed, delivered via CJ. */
export const undercoverTouristTicketFeed = createTicketFeedCollector("undercover-tourist");
