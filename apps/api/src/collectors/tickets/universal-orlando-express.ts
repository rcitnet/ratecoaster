import { ticketProducts } from "@ratecoaster/db/schema";
import { dateRange, todayInTimezone } from "../framework/dates.js";
import { politeFetch } from "../framework/http.js";
import type { CollectorContext } from "../framework/types.js";
import { persistTicketPrice } from "./persist.js";
import {
  buildUniversalOrlandoCalendarUrl,
  parseUniversalOrlandoTicketCalendar,
} from "./universal-orlando-commerce.js";

const EXPRESS_CATEGORY = "uo_ice_default_pb_express";
const COMMERCE_BASE = "https://comm-api.universaldestinationsandexperiences.com";
const BASE_SITE = "uor_b2c";
const CALENDAR_CHUNK_DAYS = 45;

type TicketProductRow = typeof ticketProducts.$inferSelect;
export type ExpressPassType = "standard" | "unlimited" | "plus";

export interface UniversalExpressConfig {
  productCode: string;
  partNumber: string;
  parkSlugs: string[];
  passType: ExpressPassType;
}

export interface UniversalExpressCatalogProduct {
  productCode: string;
  partNumber: string;
  name: string;
}

function objectOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function universalExpressConfigOf(
  product: Pick<TicketProductRow, "collectorConfig">
): UniversalExpressConfig | null {
  const cfg = (product.collectorConfig ?? {}) as Record<string, unknown>;
  if (cfg.adapter !== "universal-orlando-express") return null;
  const productCode = typeof cfg.productCode === "string" ? cfg.productCode.trim() : "";
  const partNumber = typeof cfg.partNumber === "string" ? cfg.partNumber.trim() : "";
  const parkSlugs = Array.isArray(cfg.parkSlugs)
    ? cfg.parkSlugs.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];
  const passType = cfg.passType;
  if (
    !productCode ||
    !partNumber ||
    parkSlugs.length === 0 ||
    (passType !== "standard" && passType !== "unlimited" && passType !== "plus")
  ) {
    return null;
  }
  return { productCode, partNumber, parkSlugs, passType };
}

export function hasUniversalOrlandoExpressConfig(product: TicketProductRow): boolean {
  return universalExpressConfigOf(product) !== null;
}

export function buildUniversalOrlandoExpressCatalogUrl(): string {
  const url = new URL(`/occ/v2/${BASE_SITE}/products/search`, COMMERCE_BASE);
  url.searchParams.set(
    "fields",
    "products(code,name,variantOptions(code,name,ageCategory,startingPrice)),pagination"
  );
  url.searchParams.set("query", `:recommended:allCategories:${EXPRESS_CATEGORY}`);
  url.searchParams.set("lang", "en");
  url.searchParams.set("curr", "USD");
  url.searchParams.set("pageSize", "100");
  return url.toString();
}

/** Read the product/variant identity without depending on the very large marketing payload. */
export function parseUniversalOrlandoExpressCatalog(
  payload: unknown
): UniversalExpressCatalogProduct[] {
  const root = objectOf(payload);
  if (!root || !Array.isArray(root.products)) {
    throw new Error("Universal Orlando Express catalog did not contain products");
  }

  const products: UniversalExpressCatalogProduct[] = [];
  for (const rawProduct of root.products) {
    const product = objectOf(rawProduct);
    const productCode = typeof product?.code === "string" ? product.code : "";
    const productName = typeof product?.name === "string" ? product.name : "";
    const variants = Array.isArray(product?.variantOptions) ? product.variantOptions : [];
    const variant = objectOf(variants[0]);
    const partNumber = typeof variant?.code === "string" ? variant.code : "";
    const name = typeof variant?.name === "string" ? variant.name : productName;
    if (productCode && partNumber) products.push({ productCode, partNumber, name });
  }
  return products;
}

/** Collect every current Express product in nine batched requests for a full year. */
export async function collectUniversalOrlandoExpress(
  ctx: CollectorContext,
  products: TicketProductRow[],
  lookaheadDays: number
): Promise<void> {
  const configured = products
    .map((product) => ({ product, config: universalExpressConfigOf(product) }))
    .filter((entry): entry is { product: TicketProductRow; config: UniversalExpressConfig } =>
      entry.config !== null
    );
  if (configured.length === 0) return;

  // The catalog check is deliberately advisory: a temporary search failure
  // should not stop known product codes from collecting valid calendars.
  try {
    ctx.stats.requestCount++;
    const catalogResponse = await politeFetch(buildUniversalOrlandoExpressCatalogUrl(), {
      rpm: 12,
      headers: { accept: "application/json" },
      requestKey: "universal-orlando-express:catalog",
    });
    if (!catalogResponse.skipped) {
      const live = parseUniversalOrlandoExpressCatalog(JSON.parse(catalogResponse.body));
      const configuredCodes = new Set(configured.map(({ config }) => config.productCode));
      const liveCodes = new Set(live.map((product) => product.productCode));
      const unmapped = live.filter((product) => !configuredCodes.has(product.productCode));
      const missing = configured.filter(({ config }) => !liveCodes.has(config.productCode));
      if (unmapped.length > 0) {
        ctx.stats.notes["universal-orlando-express.unmapped"] = unmapped
          .map((product) => `${product.productCode}:${product.partNumber}`)
          .join(", ");
      }
      if (missing.length > 0) {
        ctx.stats.notes["universal-orlando-express.missing"] = missing
          .map(({ config }) => config.productCode)
          .join(", ");
      }
    }
  } catch (error) {
    ctx.logger.warn(`Universal Orlando Express catalog check: ${String(error)}`);
  }

  const targets = new Map(configured.map(({ product, config }) => [config.partNumber, product.id]));
  const dates = dateRange(todayInTimezone("America/New_York"), lookaheadDays);
  const url = buildUniversalOrlandoCalendarUrl();

  for (let offset = 0; offset < dates.length; offset += CALENDAR_CHUNK_DAYS) {
    const chunk = dates.slice(offset, offset + CALENDAR_CHUNK_DAYS);
    const from = chunk[0]!;
    const to = chunk[chunk.length - 1]!;
    const events = [...targets.keys()].map((partNumber) => ({
      partNumber,
      startDate: from,
      endDate: to,
      quantity: 1,
    }));

    ctx.stats.requestCount++;
    const response = await politeFetch(url, {
      method: "POST",
      rpm: 12,
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ currency: "USD", events }),
      requestKey: `universal-orlando-express:${from}:${to}`,
    });
    if (response.skipped) continue;

    const readings = parseUniversalOrlandoTicketCalendar(JSON.parse(response.body));
    for (const reading of readings) {
      const productId = targets.get(reading.partNumber);
      if (!productId) continue;
      ctx.stats.parsedCount++;
      await persistTicketPrice(ctx, {
        productId,
        validDate: reading.validDate,
        guestCategory: "all-ages",
        priceCents: reading.priceCents,
        totalCents: reading.totalCents,
        available: reading.available,
      });
    }
  }

  ctx.logger.info(
    `Universal Orlando: covered ${dates.length} dates for ${configured.length} Express products (all ages)`
  );
}
