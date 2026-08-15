import { z } from "zod";

/**
 * A calendar date with no time component, as `YYYY-MM-DD`.
 *
 * Hotel stay dates and ticket validity dates are *local* to the resort and must
 * never be round-tripped through a JS `Date`, which would shift them across a
 * timezone boundary. A guest checking in on 2026-12-24 in Orlando checks in on
 * 2026-12-24 regardless of where the server runs, so we keep these as strings
 * end to end.
 */
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
export type IsoDate = z.infer<typeof IsoDate>;

/** An absolute instant, serialized as an ISO-8601 UTC timestamp. */
export const IsoInstant = z.string().datetime({ offset: true });
export type IsoInstant = z.infer<typeof IsoInstant>;

/**
 * Money in minor units (cents). Never store money as a float — `0.1 + 0.2`
 * problems turn into wrong prices and wrong "cheaper than before" alerts.
 */
export const Cents = z.number().int().nonnegative();
export type Cents = z.infer<typeof Cents>;

export const Currency = z.enum(["USD"]);
export type Currency = z.infer<typeof Currency>;

/** The three Universal destinations this project tracks. */
export const DestinationSlug = z.enum([
  "universal-orlando",
  "universal-hollywood",
  "universal-kids-frisco",
]);
export type DestinationSlug = z.infer<typeof DestinationSlug>;

export const Destination = z.object({
  slug: DestinationSlug,
  name: z.string(),
  timezone: z.string(),
  currency: Currency,
});
export type Destination = z.infer<typeof Destination>;

export const DESTINATIONS: Record<DestinationSlug, Destination> = {
  "universal-orlando": {
    slug: "universal-orlando",
    name: "Universal Orlando Resort",
    timezone: "America/New_York",
    currency: "USD",
  },
  "universal-hollywood": {
    slug: "universal-hollywood",
    name: "Universal Studios Hollywood",
    timezone: "America/Los_Angeles",
    currency: "USD",
  },
  "universal-kids-frisco": {
    slug: "universal-kids-frisco",
    name: "Universal Kids Resort",
    timezone: "America/Chicago",
    currency: "USD",
  },
};

/** Cursor-free page envelope. Small result sets; offset paging is fine here. */
export const Paginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  });

export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

/**
 * Attribution required by upstream data providers. Surfaced through the API so
 * that *every* client — web, iOS, Android — is handed the notices it must
 * display, rather than each client hardcoding its own and drifting.
 */
export const Attribution = z.object({
  source: z.string(),
  text: z.string(),
  url: z.string().url(),
});
export type Attribution = z.infer<typeof Attribution>;
