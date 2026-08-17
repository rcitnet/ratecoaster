import { z } from "zod";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseMoneyToCents } from "@ratecoaster/shared";
import { csvToObjects } from "../framework/csv.js";

/**
 * Declarative description of an affiliate product feed.
 *
 * Same philosophy as the booking-engine endpoint configs: the network's column
 * layout is data, not code, so pointing at a new feed — or surviving a column
 * rename — is a JSON edit, not a deploy. The default column map targets CJ's
 * (Commission Junction) product-catalog feed, which carries Undercover Tourist;
 * every name is overridable because feed header casing varies by advertiser.
 */
export const TicketFeedConfig = z.object({
  name: z.string(),
  /** Stamped onto every price row and used for the Book button. */
  merchant: z.string(),
  /** Informational: which affiliate network delivers this feed (e.g. "cj"). */
  network: z.string().optional(),
  /** HTTPS URL of the CSV/TSV feed. Left as a placeholder until signup. */
  feedUrl: z.string(),
  format: z.enum(["csv", "tsv"]).default("csv"),
  currency: z.string().default("USD"),
  /** Extra request headers, e.g. a CJ personal access token: { "Authorization": "Bearer …" }. */
  headers: z.record(z.string()).default({}),
  /** Feed column names, keyed by the meaning we need. */
  columns: z.object({
    /** Match key against a ticket product's `collectorConfig.feedSku`. */
    sku: z.string(),
    name: z.string().optional(),
    /** The price to record — CJ's discounted SALEPRICE for most advertisers. */
    price: z.string(),
    /** List/strike price, kept for a future "was $X" display. */
    retailPrice: z.string().optional(),
    currency: z.string().optional(),
    /** The affiliate deep link — the whole point of the feed. */
    buyUrl: z.string(),
    available: z.string().optional(),
    validDate: z.string().optional(),
  }),
  /** Keep only rows where this column equals this value (e.g. advertiser name). */
  filter: z.object({ column: z.string(), equals: z.string() }).optional(),
  defaultGuestCategory: z.enum(["adult", "child", "senior"]).default("adult"),
});
export type TicketFeedConfig = z.infer<typeof TicketFeedConfig>;

/**
 * A feed URL that has not been filled in yet. Mirrors the email module's
 * placeholder check: an unconfigured feed should report "not switched on", not
 * fail mid-fetch.
 */
export function isPlaceholderFeedUrl(url: string): boolean {
  if (!url || !/^https:\/\//i.test(url)) return true;
  return /CHANGE_ME|YOUR[_-]|PLACEHOLDER|<[^>]+>|example\.(com|net|org)/i.test(url);
}

/** Loads `config/feeds/<name>.json`. Returns null when absent (not configured). */
export async function loadTicketFeedConfig(name: string): Promise<TicketFeedConfig | null> {
  const path = join(process.cwd(), "config", "feeds", `${name}.json`);
  try {
    const raw = await readFile(path, "utf8");
    return TicketFeedConfig.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(`feed config ${name} is present but invalid: ${String(err)}`);
  }
}

export interface FeedTicketRow {
  sku: string;
  name: string;
  priceCents: number;
  retailCents: number | null;
  currency: string;
  buyUrl: string;
  available: boolean;
  /** Raw date string from the feed, or null — CJ product feeds are date-less. */
  validDate: string | null;
}

/** Absent/empty availability means "in stock"; otherwise interpret common flags. */
function truthy(v: string | undefined): boolean {
  if (v === undefined || v.trim() === "") return true;
  return /^(1|y|yes|true|in[ _-]?stock|available)$/i.test(v.trim());
}

/**
 * Map raw feed records to ticket rows, applying the advertiser filter and
 * dropping rows with no SKU or no parseable positive price. Pure and
 * product-agnostic — the collector matches SKUs to tracked products afterwards.
 */
export function mapFeedRecords(
  config: TicketFeedConfig,
  records: Array<Record<string, string>>
): FeedTicketRow[] {
  const col = config.columns;
  const out: FeedTicketRow[] = [];

  for (const rec of records) {
    if (config.filter) {
      const actual = (rec[config.filter.column] ?? "").trim().toLowerCase();
      if (actual !== config.filter.equals.trim().toLowerCase()) continue;
    }

    const sku = (rec[col.sku] ?? "").trim();
    if (!sku) continue;

    const priceCents = parseMoneyToCents(rec[col.price] ?? "");
    if (priceCents === null || priceCents <= 0) continue;

    out.push({
      sku,
      name: col.name ? (rec[col.name] ?? "").trim() : sku,
      priceCents,
      retailCents: col.retailPrice ? parseMoneyToCents(rec[col.retailPrice] ?? "") : null,
      currency: (col.currency && rec[col.currency]) || config.currency,
      buyUrl: (rec[col.buyUrl] ?? "").trim(),
      available: col.available ? truthy(rec[col.available]) : true,
      validDate: col.validDate ? (rec[col.validDate] ?? "").trim() || null : null,
    });
  }

  return out;
}

/** Parse raw feed text straight into mapped rows. */
export function parseFeed(config: TicketFeedConfig, text: string): FeedTicketRow[] {
  const delimiter = config.format === "tsv" ? "\t" : ",";
  return mapFeedRecords(config, csvToObjects(text, delimiter).records);
}
