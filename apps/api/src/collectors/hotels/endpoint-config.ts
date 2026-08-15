import { z } from "zod";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Declarative description of a booking-engine endpoint.
 *
 * Why config instead of hand-written code per operator:
 *
 * Booking engines are undocumented and they change. If each operator's request
 * shape and JSON layout lives in TypeScript, every upstream tweak is a code
 * change, a review, and a deploy. Here it is a JSON edit — and, critically, it
 * is an edit someone can make from a browser HAR capture without understanding
 * the collector at all. That is the difference between this project surviving
 * its first breakage and quietly dying.
 *
 * It also keeps the sharp edges in one place: nothing in the codebase hardcodes
 * a third party's URL.
 */

export const FieldPath = z.string().min(1);

export const EndpointConfig = z.object({
  /** Matches `collectorConfig.adapter` on the property row. */
  name: z.string(),
  /** Free-text note about where this capture came from and when. */
  capturedAt: z.string().optional(),
  notes: z.string().optional(),

  request: z.object({
    method: z.enum(["GET", "POST"]).default("GET"),
    /**
     * Placeholders substituted at request time:
     *   {hotelCode} {checkIn} {checkOut} {nights}
     *   {adults} {children} {rateCode} {currency}
     * A placeholder that resolves to an empty value removes the whole query
     * parameter, which is how "no promo code" (the STANDARD rate) is expressed.
     */
    urlTemplate: z.string().url().or(z.string().startsWith("https://")),
    headers: z.record(z.string()).default({}),
    /** For POST endpoints. Same placeholder substitution applies. */
    bodyTemplate: z.string().optional(),
    /** Requests per minute for this origin. Keep it low and boring. */
    rpm: z.number().int().positive().default(12),
  }),

  response: z.object({
    /**
     * Path to the array of room offers, e.g. `data.hotel.roomRates` or
     * `results[*].rooms`. Supports dots, `[n]`, and `[*]`.
     */
    roomsPath: FieldPath,
    /** Paths relative to each element of `roomsPath`. */
    fields: z.object({
      roomCode: FieldPath,
      roomName: FieldPath,
      /** Nightly rate. May be a number or a string like "$249.00". */
      nightly: FieldPath,
      total: FieldPath.optional(),
      available: FieldPath.optional(),
      maxOccupancy: FieldPath.optional(),
    }),
    /**
     * Path to a flag or message indicating the requested rate code was not
     * honoured. Booking engines commonly fall back to the public rate silently,
     * which would otherwise record standard prices as passholder prices — the
     * single most damaging bug this project could ship.
     */
    rateCodeAppliedPath: FieldPath.optional(),
    /** Expected value at `rateCodeAppliedPath` when the code *was* applied. */
    rateCodeAppliedEquals: z.union([z.string(), z.boolean()]).optional(),
    /** Prices already in cents rather than dollars. */
    pricesAreCents: z.boolean().default(false),
  }),
});

export type EndpointConfig = z.infer<typeof EndpointConfig>;

const cache = new Map<string, EndpointConfig | null>();

/**
 * Loads `config/endpoints/<name>.json`. Returns null when the file is absent,
 * which the collector treats as "not configured yet" rather than an error —
 * that is what lets the project run end to end with only the wait-time
 * collector live.
 */
export async function loadEndpointConfig(name: string): Promise<EndpointConfig | null> {
  if (cache.has(name)) return cache.get(name) ?? null;

  const path = join(process.cwd(), "config", "endpoints", `${name}.json`);
  try {
    const raw = await readFile(path, "utf8");
    const parsed = EndpointConfig.parse(JSON.parse(raw));
    cache.set(name, parsed);
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      cache.set(name, null);
      return null;
    }
    throw new Error(`endpoint config ${name} is present but invalid: ${String(err)}`);
  }
}

export function clearEndpointConfigCache() {
  cache.clear();
}

/* ------------------------------------------------------------------ *
 * Template substitution and path extraction
 * ------------------------------------------------------------------ */

export type TemplateVars = Record<string, string | number | null | undefined>;

/**
 * Fills `{placeholders}`. Query parameters whose value resolves to empty are
 * dropped entirely — sending `&promo=` is not the same request as omitting the
 * parameter, and some engines reject the former.
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  const filled = template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    return value === null || value === undefined ? "" : encodeURIComponent(String(value));
  });

  if (!filled.includes("?")) return filled;

  const [base, query] = filled.split("?", 2);
  const kept = (query ?? "")
    .split("&")
    .filter((pair) => {
      const [, v] = pair.split("=", 2);
      return v !== undefined && v !== "";
    })
    .join("&");
  return kept ? `${base}?${kept}` : (base ?? filled);
}

/**
 * Minimal JSONPath: `a.b[0].c`, and `[*]` to fan out over arrays.
 *
 * Deliberately not a full JSONPath implementation — the grammar is bigger than
 * this problem needs, and a dependency that can evaluate arbitrary expressions
 * against untrusted upstream JSON is a liability, not a convenience.
 */
export function extractPath(root: unknown, path: string): unknown[] {
  const segments = path
    .replace(/\[(\*|\d+)\]/g, ".[$1]")
    .split(".")
    .filter(Boolean);

  let current: unknown[] = [root];

  for (const segment of segments) {
    const next: unknown[] = [];
    for (const node of current) {
      if (node === null || node === undefined) continue;

      if (segment === "[*]") {
        if (Array.isArray(node)) next.push(...node);
        continue;
      }

      const indexMatch = /^\[(\d+)\]$/.exec(segment);
      if (indexMatch) {
        if (Array.isArray(node)) {
          const item = node[Number(indexMatch[1])];
          if (item !== undefined) next.push(item);
        }
        continue;
      }

      if (typeof node === "object" && segment in (node as Record<string, unknown>)) {
        next.push((node as Record<string, unknown>)[segment]);
      }
    }
    current = next;
  }

  return current;
}

/** First match at a path, or null. */
export function extractOne(root: unknown, path: string | undefined): unknown {
  if (!path) return null;
  const results = extractPath(root, path);
  return results.length > 0 ? results[0] : null;
}
