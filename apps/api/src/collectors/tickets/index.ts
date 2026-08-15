import { and, eq, sql } from "drizzle-orm";
import { parseMoneyToCents } from "@ratecoaster/shared";
import {
  expressPassPrices,
  parks,
  ticketPriceCurrent,
  ticketPriceObservations,
  ticketProducts,
} from "@ratecoaster/db/schema";
import { fetchJson } from "../framework/http.js";
import { dateRange, todayInTimezone } from "../framework/dates.js";
import {
  extractOne,
  extractPath,
  loadEndpointConfig,
  renderTemplate,
} from "../hotels/endpoint-config.js";
import type { Collector, CollectorContext } from "../framework/types.js";

const TIMEZONES: Record<string, string> = {
  "universal-orlando": "America/New_York",
  "universal-hollywood": "America/Los_Angeles",
  "universal-kids-frisco": "America/Chicago",
};

/**
 * Ticket and Express Pass pricing share the endpoint-config machinery with the
 * hotel collector, because the problem is identical: an undocumented storefront
 * API returning a date-keyed price list.
 *
 * The one structural difference is that ticket storefronts almost always return
 * a *whole calendar* in a single response — a month or a year of dates at once.
 * That makes this collector far cheaper than the hotel one: roughly a dozen
 * requests covers a full year, instead of 16,000.
 */

const GUEST_CATEGORIES = ["adult", "child"] as const;

export function createTicketPriceCollector(options: { lookaheadDays?: number } = {}): Collector {
  const lookaheadDays = options.lookaheadDays ?? 365;

  return {
    name: "ticket-prices",
    description: `Dynamic ticket pricing, ${lookaheadDays}-day calendar`,
    intervalMinutes: 720,

    async isConfigured({ db }) {
      const rows = await db
        .select()
        .from(ticketProducts)
        .where(and(eq(ticketProducts.active, true), sql`${ticketProducts.kind} <> 'express-pass'`));

      for (const p of rows) {
        const cfg = (p.collectorConfig ?? {}) as Record<string, unknown>;
        if (typeof cfg.adapter === "string" && cfg.productCode) {
          if (await loadEndpointConfig(cfg.adapter)) return { ready: true };
        }
      }
      return {
        ready: false,
        reason:
          "no ticket product has both a product code and an endpoint config — see apps/api/src/collectors/hotels/README.md",
      };
    },

    async run(ctx: CollectorContext) {
      const { db, stats, logger } = ctx;
      const products = await db
        .select()
        .from(ticketProducts)
        .where(and(eq(ticketProducts.active, true), sql`${ticketProducts.kind} <> 'express-pass'`));

      for (const product of products) {
        const cfg = (product.collectorConfig ?? {}) as Record<string, unknown>;
        const adapterName = typeof cfg.adapter === "string" ? cfg.adapter : null;
        const productCode = cfg.productCode ? String(cfg.productCode) : null;
        if (!adapterName || !productCode) {
          stats.notes[`${product.slug}.skipped`] = "missing adapter or product code";
          continue;
        }

        const endpoint = await loadEndpointConfig(adapterName);
        if (!endpoint) {
          stats.notes[`${product.slug}.skipped`] = `no endpoint config for ${adapterName}`;
          continue;
        }

        const timezone = TIMEZONES[product.destination] ?? "America/New_York";
        const today = todayInTimezone(timezone);
        const window = dateRange(today, lookaheadDays);
        const from = window[0]!;
        const to = window[window.length - 1]!;

        for (const guestCategory of GUEST_CATEGORIES) {
          try {
            stats.requestCount++;
            const url = renderTemplate(endpoint.request.urlTemplate, {
              hotelCode: productCode,
              productCode,
              checkIn: from,
              checkOut: to,
              from,
              to,
              adults: guestCategory === "adult" ? 1 : 0,
              children: guestCategory === "child" ? 1 : 0,
              rateCode: "",
              currency: "USD",
            });

            const json = await fetchJson(url, {
              method: endpoint.request.method,
              headers: endpoint.request.headers,
              rpm: endpoint.request.rpm,
            });
            if (json === null) continue;

            const entries = extractPath(json, endpoint.response.roomsPath);
            for (const entry of entries) {
              const validDate = normalizeDate(extractOne(entry, endpoint.response.fields.roomCode));
              const priceCents = endpoint.response.pricesAreCents
                ? Number(extractOne(entry, endpoint.response.fields.nightly))
                : parseMoneyToCents(
                    extractOne(entry, endpoint.response.fields.nightly) as string | number
                  );

              if (!validDate || priceCents === null || !Number.isFinite(priceCents) || priceCents <= 0) {
                continue;
              }

              stats.parsedCount++;
              await persistTicketPrice(ctx, {
                productId: product.id,
                validDate,
                guestCategory,
                priceCents: Math.round(priceCents),
                totalCents: endpoint.response.fields.total
                  ? parseMoneyToCents(
                      extractOne(entry, endpoint.response.fields.total) as string | number
                    )
                  : null,
                available: Boolean(
                  extractOne(entry, endpoint.response.fields.available ?? "") ?? true
                ),
              });
            }
          } catch (err) {
            stats.errorCount++;
            logger.warn(`${product.slug} (${guestCategory}): ${String(err)}`);
          }
        }
      }
    },
  };
}

/**
 * Express Pass gets its own collector because guests shop it as a calendar
 * rather than as a product: "which day this month is Express cheapest?" It is
 * also the most volatile price on property — a holiday Saturday can be several
 * times a slow Tuesday — so it is polled more often than admission tickets.
 */
export function createExpressPassCollector(options: { lookaheadDays?: number } = {}): Collector {
  const lookaheadDays = options.lookaheadDays ?? 180;

  return {
    name: "express-pass",
    description: `Express Pass pricing calendar, ${lookaheadDays}-day lookahead`,
    intervalMinutes: 240,

    async isConfigured({ db }) {
      const rows = await db
        .select()
        .from(ticketProducts)
        .where(and(eq(ticketProducts.active, true), eq(ticketProducts.kind, "express-pass")));

      for (const p of rows) {
        const cfg = (p.collectorConfig ?? {}) as Record<string, unknown>;
        if (typeof cfg.adapter === "string" && cfg.productCode) {
          if (await loadEndpointConfig(cfg.adapter)) return { ready: true };
        }
      }
      return { ready: false, reason: "no Express Pass endpoint config captured yet" };
    },

    async run(ctx: CollectorContext) {
      const { db, stats, logger } = ctx;
      const products = await db
        .select()
        .from(ticketProducts)
        .where(and(eq(ticketProducts.active, true), eq(ticketProducts.kind, "express-pass")));

      const parkRows = await db.select().from(parks);

      for (const product of products) {
        const cfg = (product.collectorConfig ?? {}) as Record<string, unknown>;
        const adapterName = typeof cfg.adapter === "string" ? cfg.adapter : null;
        const productCode = cfg.productCode ? String(cfg.productCode) : null;
        if (!adapterName || !productCode) continue;

        const endpoint = await loadEndpointConfig(adapterName);
        if (!endpoint) continue;

        const timezone = TIMEZONES[product.destination] ?? "America/New_York";
        const today = todayInTimezone(timezone);
        const window = dateRange(today, lookaheadDays);

        const park = parkRows.find((p) => p.destination === product.destination) ?? null;

        try {
          stats.requestCount++;
          const url = renderTemplate(endpoint.request.urlTemplate, {
            productCode,
            from: window[0]!,
            to: window[window.length - 1]!,
            currency: "USD",
          });

          const json = await fetchJson(url, {
            method: endpoint.request.method,
            headers: endpoint.request.headers,
            rpm: endpoint.request.rpm,
          });
          if (json === null) continue;

          for (const entry of extractPath(json, endpoint.response.roomsPath)) {
            const validDate = normalizeDate(extractOne(entry, endpoint.response.fields.roomCode));
            const priceCents = parseMoneyToCents(
              extractOne(entry, endpoint.response.fields.nightly) as string | number
            );
            if (!validDate || priceCents === null || priceCents <= 0) continue;

            // Express tier is inferred from the product name because storefronts
            // rarely expose it as a field. "Unlimited" is the meaningful
            // distinction — it is usually close to double the standard price.
            const tier = /unlimited/i.test(product.name) ? "unlimited" : "standard";

            stats.parsedCount++;
            await db.insert(expressPassPrices).values({
              destination: product.destination,
              parkId: park?.id ?? null,
              validDate,
              tier,
              priceCents,
              available: true,
            });
            stats.writtenCount++;
          }
        } catch (err) {
          stats.errorCount++;
          logger.warn(`${product.slug}: ${String(err)}`);
        }
      }
    },
  };
}

async function persistTicketPrice(
  ctx: CollectorContext,
  reading: {
    productId: string;
    validDate: string;
    guestCategory: "adult" | "child";
    priceCents: number;
    totalCents: number | null;
    available: boolean;
  }
) {
  const { db, stats } = ctx;

  const existing = await db
    .select({ priceCents: ticketPriceCurrent.priceCents })
    .from(ticketPriceCurrent)
    .where(
      and(
        eq(ticketPriceCurrent.productId, reading.productId),
        eq(ticketPriceCurrent.validDate, reading.validDate),
        eq(ticketPriceCurrent.guestCategory, reading.guestCategory)
      )
    )
    .limit(1);

  const prev = existing[0];
  const changed = !prev || prev.priceCents !== reading.priceCents;

  // Same write-on-change rule as hotel rates: a year of dates re-read twice a
  // day is ~700 identical rows daily per product otherwise, none of which say
  // anything a chart could use.
  if (changed) {
    await db.insert(ticketPriceObservations).values({
      productId: reading.productId,
      validDate: reading.validDate,
      guestCategory: reading.guestCategory,
      priceCents: reading.priceCents,
      totalCents: reading.totalCents,
      available: reading.available,
    });
    stats.writtenCount++;
  }

  await db
    .insert(ticketPriceCurrent)
    .values({
      productId: reading.productId,
      validDate: reading.validDate,
      guestCategory: reading.guestCategory,
      priceCents: reading.priceCents,
      totalCents: reading.totalCents,
      previousCents: prev?.priceCents ?? null,
      available: reading.available,
      observedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        ticketPriceCurrent.productId,
        ticketPriceCurrent.validDate,
        ticketPriceCurrent.guestCategory,
      ],
      set: {
        priceCents: reading.priceCents,
        totalCents: reading.totalCents,
        available: reading.available,
        previousCents: changed
          ? (prev?.priceCents ?? null)
          : sql`${ticketPriceCurrent.previousCents}`,
        observedAt: new Date(),
      },
    });
}

/** Accepts `2026-12-24`, `12/24/2026`, or an ISO timestamp; returns `YYYY-MM-DD`. */
export function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (iso) return iso[1]!;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (us) {
    return `${us[3]}-${us[1]!.padStart(2, "0")}-${us[2]!.padStart(2, "0")}`;
  }
  return null;
}

export const ticketPriceCollector = createTicketPriceCollector();
export const expressPassCollector = createExpressPassCollector();
