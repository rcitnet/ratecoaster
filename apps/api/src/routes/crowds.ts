import { Hono } from "hono";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { parks, properties, rateCurrent, ticketPriceCurrent, ticketProducts } from "@ratecoaster/db/schema";
import { CrowdCalendarQuery } from "@ratecoaster/shared";
import { gateDateWindow, tierOf } from "../lib/entitlements.js";
import { buildCrowdCalendar } from "../lib/crowds.js";

export const crowdsRouter = new Hono();

const TICKET_PRODUCT_FOR_PARK: Record<string, string> = {
  "universal-studios-florida": "uor-1-day-1-park",
  "islands-of-adventure": "uor-1-day-1-park",
  "epic-universe": "uor-1-day-epic-universe",
  "volcano-bay": "uor-1-day-volcano-bay",
};

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle];
}

function expressSupportsPark(config: Record<string, unknown> | null, parkSlug: string): boolean {
  const parkSlugs = config?.parkSlugs;
  return Array.isArray(parkSlugs) && parkSlugs.includes(parkSlug);
}

/**
 * GET /v1/crowds/calendar
 *
 * A demand-based crowd outlook for the Universal Orlando parks. It combines
 * the resort's published one-day admission, park-specific Express and on-site
 * hotel signals; it is intentionally a relative 1–10 planning score, not a
 * made-up future wait time.
 */
crowdsRouter.get("/calendar", async (c) => {
  const parsed = CrowdCalendarQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: { code: "invalid_query", message: "bad crowd calendar parameters" } }, 400);
  }

  const db = getDb();
  const parkSlug = parsed.data.parkSlug ?? "universal-studios-florida";
  const [park] = await db
    .select()
    .from(parks)
    .where(
      and(
        eq(parks.slug, parkSlug),
        eq(parks.destination, "universal-orlando"),
        eq(parks.active, true)
      )
    )
    .limit(1);
  if (!park) {
    return c.json({ error: { code: "not_found", message: "no Universal Orlando park with that name" } }, 404);
  }

  const gate = gateDateWindow(tierOf(c), parsed.data.from, parsed.data.to, park.timezone);
  const { from, to } = gate;
  const ticketProductSlug = TICKET_PRODUCT_FOR_PARK[park.slug];

  const expressProducts = await db
    .select({
      id: ticketProducts.id,
      days: ticketProducts.days,
      parkCount: ticketProducts.parkCount,
      collectorConfig: ticketProducts.collectorConfig,
    })
    .from(ticketProducts)
    .where(
      and(
        eq(ticketProducts.destination, "universal-orlando"),
        eq(ticketProducts.kind, "express-pass"),
        eq(ticketProducts.active, true)
      )
    );

  // Prefer the one-park, one-day pass: a multi-park product's price reflects
  // more than the demand of the park the guest has selected.
  const expressProduct = expressProducts
    .filter((product) => product.days === 1 && expressSupportsPark(product.collectorConfig, park.slug))
    .sort((a, b) => (a.parkCount ?? 99) - (b.parkCount ?? 99))[0];

  const [ticketRows, expressRows, hotelRows] = await Promise.all([
    ticketProductSlug
      ? db
          .select({
            date: ticketPriceCurrent.validDate,
            price: ticketPriceCurrent.totalCents,
            fallbackPrice: ticketPriceCurrent.priceCents,
            available: ticketPriceCurrent.available,
            observedAt: ticketPriceCurrent.observedAt,
          })
          .from(ticketPriceCurrent)
          .innerJoin(ticketProducts, eq(ticketPriceCurrent.productId, ticketProducts.id))
          .where(
            and(
              eq(ticketProducts.slug, ticketProductSlug),
              eq(ticketPriceCurrent.guestCategory, "adult"),
              gte(ticketPriceCurrent.validDate, from),
              lte(ticketPriceCurrent.validDate, to)
            )
          )
          .orderBy(asc(ticketPriceCurrent.validDate))
      : Promise.resolve([]),
    expressProduct
      ? db
          .select({
            date: ticketPriceCurrent.validDate,
            price: ticketPriceCurrent.totalCents,
            fallbackPrice: ticketPriceCurrent.priceCents,
            available: ticketPriceCurrent.available,
            observedAt: ticketPriceCurrent.observedAt,
          })
          .from(ticketPriceCurrent)
          .where(
            and(
              eq(ticketPriceCurrent.productId, expressProduct.id),
              eq(ticketPriceCurrent.guestCategory, "all-ages"),
              gte(ticketPriceCurrent.validDate, from),
              lte(ticketPriceCurrent.validDate, to)
            )
          )
          .orderBy(asc(ticketPriceCurrent.validDate))
      : Promise.resolve([]),
    db
      .select({
        date: rateCurrent.stayDate,
        propertyId: rateCurrent.propertyId,
        nightlyCents: rateCurrent.nightlyCents,
        observedAt: rateCurrent.observedAt,
      })
      .from(rateCurrent)
      .innerJoin(properties, eq(rateCurrent.propertyId, properties.id))
      .where(
        and(
          eq(properties.destination, "universal-orlando"),
          eq(properties.active, true),
          eq(rateCurrent.rateCode, "STANDARD"),
          eq(rateCurrent.nights, 1),
          eq(rateCurrent.adults, 2),
          eq(rateCurrent.children, 0),
          eq(rateCurrent.available, true),
          gte(rateCurrent.stayDate, from),
          lte(rateCurrent.stayDate, to)
        )
      ),
  ]);

  const ticketByDate = new Map<string, { value: number; available: boolean }>();
  for (const row of ticketRows) {
    const value = row.price ?? row.fallbackPrice;
    if (row.date && value !== null) {
      ticketByDate.set(row.date, { value, available: row.available });
    }
  }

  const expressByDate = new Map<string, { value: number; available: boolean }>();
  for (const row of expressRows) {
    const value = row.price ?? row.fallbackPrice;
    if (row.date && value !== null) {
      expressByDate.set(row.date, { value, available: row.available });
    }
  }

  // First retain the cheapest room for each hotel/date, then use the median
  // across hotels. That keeps one suite or one Value resort from distorting the
  // resort-wide hotel-demand signal.
  const cheapestByHotelDate = new Map<string, number>();
  const hotelObservedAt: Date[] = [];
  for (const row of hotelRows) {
    const key = `${row.date}|${row.propertyId}`;
    const existing = cheapestByHotelDate.get(key);
    if (existing === undefined || row.nightlyCents < existing) {
      cheapestByHotelDate.set(key, row.nightlyCents);
    }
    hotelObservedAt.push(row.observedAt);
  }
  const hotelValuesByDate = new Map<string, number[]>();
  for (const [key, price] of cheapestByHotelDate) {
    const [date] = key.split("|");
    if (!date) continue;
    const values = hotelValuesByDate.get(date) ?? [];
    values.push(price);
    hotelValuesByDate.set(date, values);
  }
  const hotelByDate = new Map<string, number>();
  for (const [date, values] of hotelValuesByDate) {
    const value = median(values);
    if (value !== undefined) hotelByDate.set(date, value);
  }

  const observations = [
    ...ticketRows.map((row) => row.observedAt),
    ...expressRows.map((row) => row.observedAt),
    ...hotelObservedAt,
  ];
  const latest = observations.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return c.json({
    park: {
      id: park.id,
      destination: park.destination,
      slug: park.slug,
      name: park.name,
      timezone: park.timezone,
      queueTimesId: park.queueTimesId,
      themeParksWikiId: park.themeParksWikiId,
    },
    days: buildCrowdCalendar({ from, to, ticketByDate, expressByDate, hotelByDate }),
    updatedAt: latest?.toISOString() ?? null,
    gate: gate.info,
  });
});
