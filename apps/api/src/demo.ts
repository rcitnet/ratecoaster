import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { ENTITLEMENTS, TripQuote, TripQuoteQuery, type Tier } from "@ratecoaster/shared";
import { PARKS, PROPERTIES, TICKET_PRODUCTS } from "@ratecoaster/db/src/seed-data.js";
import { gateDateWindow, tierOf } from "./lib/entitlements.js";
import { fetchThemeParksWiki } from "./collectors/waits/providers.js";
import {
  QUEUE_TIMES_ATTRIBUTION,
  THEMEPARKS_WIKI_ATTRIBUTION,
} from "./collectors/waits/providers.js";
import { addDays, daysBetween, dayOfWeek, todayInTimezone } from "./collectors/framework/dates.js";
import { eligibleTicketRows, recommendTicket, type TicketQuoteRow } from "./routes/trips.js";

/**
 * DEMO MODE — no database required.
 *
 * Wait times here are REAL: fetched live from ThemeParks.wiki on each request.
 * Hotel, ticket, and Express pricing is SYNTHETIC, generated below, and every
 * response carries a `demo: true` flag so it can never be mistaken for
 * collected data. The point is to let you see and click the actual UI before
 * standing up Postgres and capturing booking endpoints.
 *
 * Nothing in this file is used when DEMO_MODE is off.
 */

const DEMO_ATTRIBUTION = {
  source: "demo",
  text: "Hotel, ticket and Express prices on this page are SAMPLE DATA, not collected rates",
  url: "https://ratecoaster.net/demo",
};

/** Deterministic hash so the same date always yields the same sample price. */
function seed(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const part of parts.join("|")) {
    h ^= part.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const TIER_BASE_CENTS: Record<string, number> = {
  premier: 51000,
  preferred: 36000,
  "universal-classic": 28000,
  "prime-value": 21000,
  value: 13500,
  partner: 24000,
};

/**
 * Sample rates shaped like real ones: weekend premiums, a summer/holiday
 * curve, and a passholder discount that varies by date rather than being a
 * flat percentage. Realistic shape matters — a demo with flat pricing would
 * make the calendar and history views look broken.
 */
function sampleRate(propertySlug: string, tier: string, date: string, rateCode: string) {
  const base = TIER_BASE_CENTS[tier] ?? 25000;
  const dow = dayOfWeek(date);
  const weekend = dow === 5 || dow === 6 ? 1.28 : dow === 0 ? 1.1 : 1.0;
  const month = Number(date.slice(5, 7));
  const seasonal = month === 12 || month === 7 || month === 3 ? 1.22 : month === 9 ? 0.84 : 1.0;
  const noise = 0.9 + seed(propertySlug, date) * 0.25;

  const standard = Math.round((base * weekend * seasonal * noise) / 100) * 100;
  if (rateCode === "STANDARD") return standard;

  const discount = 0.14 + seed(propertySlug, date, rateCode) * 0.18;
  return Math.round((standard * (1 - discount)) / 100) * 100;
}

const DEMO_TIER_COOKIE = "rc_demo_tier";

/**
 * Stand-in for the real session middleware while running without Postgres.
 * Reads a plain cookie instead of a hashed session record — adequate for
 * demonstrating the paywall, and never mounted outside demo mode.
 */
export const demoAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const raw = getCookie(c, DEMO_TIER_COOKIE);
  const tier: Tier = raw === "free" || raw === "pro" ? raw : "anonymous";
  c.set("tier", tier);
  c.set(
    "user",
    tier === "anonymous"
      ? null
      : { userId: "demo-user", email: "you@ratecoaster.net", displayName: null, createdAt: new Date() }
  );
  await next();
};

export const demoApp = new Hono();

demoApp.get("/v1/auth/me", (c) => {
  const tier = tierOf(c);
  const user = c.get("user");
  return c.json({
    user: user
      ? {
          id: user.userId,
          email: user.email,
          tier,
          displayName: null,
          createdAt: user.createdAt.toISOString(),
        }
      : null,
    entitlements: ENTITLEMENTS[tier],
  });
});

/**
 * In demo mode the magic link is skipped entirely — signing in is instant, so
 * the 45-day wall and what lies past it can both be seen in one sitting.
 */
demoApp.post("/v1/auth/magic-link", async (c) => {
  const body = await c.req.json().catch(() => ({}) as { email?: string });
  setCookie(c, DEMO_TIER_COOKIE, "free", { path: "/", maxAge: 86_400 });
  return c.json({
    ok: true,
    demo: true,
    message: `Demo mode: signed in as ${body.email ?? "you@ratecoaster.net"} with no email sent.`,
  });
});

demoApp.post("/v1/auth/logout", (c) => {
  deleteCookie(c, DEMO_TIER_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

demoApp.get("/v1/properties", (c) => {
  const destination = c.req.query("destination");
  const rows = PROPERTIES.filter((p) => !destination || p.destination === destination);
  return c.json(
    rows.map((p, i) => ({
      id: `demo-${i}`,
      destination: p.destination,
      slug: p.slug,
      name: p.name,
      tier: p.tier,
      operator: p.operator,
      onSite: p.onSite,
      includesExpressPass: p.includesExpressPass,
      earlyParkAdmission: p.earlyParkAdmission,
      roomCount: p.roomCount,
      latitude: p.latitude,
      longitude: p.longitude,
    }))
  );
});

function demoRoomTypes(propertySlug: string) {
  const propertyIndex = Math.max(0, PROPERTIES.findIndex((property) => property.slug === propertySlug));
  return [
    { name: "Standard Room", maxOccupancy: 4 },
    { name: "Pool View", maxOccupancy: 4 },
    { name: "Suite", maxOccupancy: 6 },
  ].map((room, roomIndex) => ({
    id: `00000000-0000-4000-8000-${String(propertyIndex * 10 + roomIndex + 1).padStart(12, "0")}`,
    propertyId: `demo-${propertyIndex}`,
    externalCode: `DEMO-${roomIndex + 1}`,
    ...room,
  }));
}

demoApp.get("/v1/rates/options", (c) => {
  const propertySlug = c.req.query("propertySlug");
  const destination = c.req.query("destination");
  const property = propertySlug
    ? PROPERTIES.find((candidate) => candidate.slug === propertySlug)
    : undefined;
  const resolvedDestination = property?.destination ?? destination;
  return c.json({
    rateCodes: resolvedDestination === "universal-kids-frisco" ? ["STANDARD"] : ["STANDARD", "APH"],
    roomTypes: property ? demoRoomTypes(property.slug) : [],
  });
});

demoApp.get("/v1/rates", (c) => {
  const destination = c.req.query("destination") ?? "universal-orlando";
  const propertySlug = c.req.query("propertySlug");
  const roomTypeId = c.req.query("roomTypeId");
  const rateCode = c.req.query("rateCode") ?? "APH";
  const today = todayInTimezone("America/New_York");

  const props = PROPERTIES.filter(
    (p) => (!propertySlug && p.destination === destination) || p.slug === propertySlug
  );

  // Same gate the real route uses, so the paywall behaves identically here.
  const gate = gateDateWindow(tierOf(c), c.req.query("from"), c.req.query("to"));
  const span = Math.min(gate.info.visibleDays, propertySlug ? 90 : 60);

  const items = [];
  for (const p of props) {
    const roomType = demoRoomTypes(p.slug).find((room) => room.id === roomTypeId)
      ?? demoRoomTypes(p.slug)[0]!;
    for (let i = 0; i < span; i++) {
      const stayDate = addDays(today, i);
      const nightly = sampleRate(p.slug, p.tier, stayDate, rateCode);
      const standard = sampleRate(p.slug, p.tier, stayDate, "STANDARD");
      const low = Math.round(nightly * 0.86);
      items.push({
        propertyId: `demo-${p.slug}`,
        propertySlug: p.slug,
        propertyName: p.name,
        stayDate,
        rateCode,
        nightlyCents: nightly,
        totalCents: Math.round(nightly * 1.19),
        roomTypeName: roomType.name,
        available: seed(p.slug, stayDate, "avail") > 0.08,
        observedAt: new Date(Date.now() - 1000 * 60 * 37).toISOString(),
        standardNightlyCents: rateCode === "STANDARD" ? null : standard,
        savingsCents: rateCode === "STANDARD" ? null : standard - nightly,
        historicalLowCents: low,
        changeCents: Math.round((seed(p.slug, stayDate, "delta") - 0.5) * 4000),
      });
    }
  }
  return c.json({ items, attribution: [DEMO_ATTRIBUTION], gate: gate.info });
});

demoApp.get("/v1/deals", (c) => {
  const today = todayInTimezone("America/New_York");
  const gate = gateDateWindow(tierOf(c), today, undefined);
  const span = Math.min(gate.info.visibleDays, 120);
  const deals = PROPERTIES.filter((p) => p.destination === "universal-orlando").map((p) => {
    let best = { date: today, cents: Number.MAX_SAFE_INTEGER };
    for (let i = 0; i < span; i++) {
      const d = addDays(today, i);
      const cents = sampleRate(p.slug, p.tier, d, "APH");
      if (cents < best.cents) best = { date: d, cents };
    }
    const low = Math.round(best.cents * 0.94);
    return {
      propertyId: `demo-${p.slug}`,
      propertySlug: p.slug,
      propertyName: p.name,
      destination: p.destination,
      tier: p.tier,
      stayDate: best.date,
      nights: 1,
      rateCode: "APH" as const,
      nightlyCents: best.cents,
      totalCents: Math.round(best.cents * 1.19),
      savingsCents: null,
      savingsPercent: null,
      percentileOfHistory: Math.min(100, ((best.cents - low) / low) * 100),
      includesExpressPass: p.includesExpressPass,
      source: "observed" as const,
      isEstimated: false,
      merchant: null,
    };
  });
  deals.sort((a, b) => (a.percentileOfHistory ?? 999) - (b.percentileOfHistory ?? 999));
  return c.json(deals);
});

demoApp.get("/v1/rates/:slug/history", (c) => {
  const slug = c.req.param("slug");
  const stayDate = c.req.query("stayDate") ?? todayInTimezone("America/New_York");
  const prop = PROPERTIES.find((p) => p.slug === slug);
  if (!prop) return c.json([]);

  // A believable history: a handful of real moves over the last few weeks,
  // which is exactly what write-on-change storage produces.
  const points = [];
  let cents = Math.round(sampleRate(slug, prop.tier, stayDate, "APH") * 1.16);
  for (let i = 9; i >= 0; i--) {
    const drift = (seed(slug, stayDate, i) - 0.45) * 0.07;
    cents = Math.max(8000, Math.round((cents * (1 + drift)) / 100) * 100);
    points.push({
      observedAt: new Date(Date.now() - i * 3 * 24 * 3600 * 1000).toISOString(),
      nightlyCents: cents,
      available: true,
    });
  }
  return c.json(points);
});

demoApp.get("/v1/tickets/products", (c) => {
  const destination = c.req.query("destination");
  return c.json(
    TICKET_PRODUCTS.filter(
      (t) => t.kind !== "express-pass" && (!destination || t.destination === destination)
    ).map((t, i) => ({
      id: `demo-t-${i}`,
      destination: t.destination,
      slug: t.slug,
      name: t.name,
      kind: t.kind,
      days: t.days,
      parkCount: t.parkCount,
      externalId: null,
    }))
  );
});

demoApp.get("/v1/tickets/calendar", (c) => {
  const productSlug = c.req.query("productSlug");
  const product = TICKET_PRODUCTS.find((t) => t.slug === productSlug);
  if (!product) return c.json([]);

  const today = todayInTimezone("America/New_York");
  const base = 18900 + (product.days ?? 1) * 9500;
  const gate = gateDateWindow(tierOf(c), c.req.query("from"), c.req.query("to"));
  const days = [];
  for (let i = 0; i < Math.min(gate.info.visibleDays, 90); i++) {
    const validDate = addDays(today, i);
    const dow = dayOfWeek(validDate);
    const weekend = dow === 5 || dow === 6 ? 1.18 : 1.0;
    const month = Number(validDate.slice(5, 7));
    const seasonal = month === 12 || month === 7 ? 1.15 : month === 9 ? 0.88 : 1.0;
    const totalCents = Math.round(
      (base * weekend * seasonal * (0.95 + seed(productSlug!, validDate) * 0.12)) / 100
    ) * 100;
    days.push({
      validDate,
      priceCents: Math.round(totalCents / (product.days ?? 1)),
      totalCents,
      available: true,
    });
  }
  const sorted = days.map((d) => d.priceCents).sort((a, b) => a - b);
  const lowCut = sorted[Math.floor(sorted.length / 3)]!;
  const highCut = sorted[Math.floor((sorted.length * 2) / 3)]!;
  const min = sorted[0]!;

  return c.json(
    days.map((d) => ({
      ...d,
      band: d.priceCents <= lowCut ? "low" : d.priceCents >= highCut ? "high" : "mid",
      isWindowLow: d.priceCents === min,
    }))
  );
});

demoApp.get("/v1/trips/quote", (c) => {
  const parsed = TripQuoteQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      { error: { code: "invalid_query", message: "Enter valid trip dates and party details." } },
      400
    );
  }
  const query = parsed.data;
  const today = todayInTimezone("America/New_York");
  const nights = daysBetween(query.checkIn, query.checkOut);
  if (query.checkIn < today || nights < 1 || nights > 30) {
    return c.json(
      { error: { code: "invalid_query", message: "Choose a future trip between 1 and 30 nights." } },
      400
    );
  }

  const tier = tierOf(c);
  const gate = gateDateWindow(tier, today, undefined);
  const visibleThrough = gate.info.visibleThrough ?? today;
  if (addDays(query.checkOut, -1) > visibleThrough) {
    if (tier !== "anonymous") {
      return c.json(
        {
          error: {
            code: "date_unavailable",
            message: `Collected pricing currently runs through ${visibleThrough}.`,
          },
        },
        400
      );
    }
    return c.json(
      {
        error: {
          code: "upgrade_required",
          message: `Create a free account to plan trips after ${visibleThrough}.`,
          details: {
            requiredTier: "free",
            visibleThrough,
            visibleDays: gate.info.visibleDays,
            withheldDays: gate.info.withheldDays,
          },
        },
      },
      402
    );
  }

  const hotels = PROPERTIES.filter((property) => property.destination === "universal-orlando")
    .map((property) => {
      let nightlySum = 0;
      let totalSum = 0;
      for (let i = 0; i < nights; i++) {
        const nightly = sampleRate(property.slug, property.tier, addDays(query.checkIn, i), query.rateCode);
        nightlySum += nightly;
        totalSum += Math.round(nightly * 1.19);
      }
      return {
        propertySlug: property.slug,
        propertyName: property.name,
        tier: property.tier,
        roomTypeName: "Standard Room",
        includesExpressPass: property.includesExpressPass,
        nights,
        rooms: query.rooms,
        averageNightlyCents: Math.round(nightlySum / nights),
        subtotalCents: totalSum * query.rooms,
      };
    })
    .sort((a, b) => a.subtotalCents - b.subtotalCents);

  const tripDays = nights + 1;
  const ticketRows: TicketQuoteRow[] = [];
  for (const product of TICKET_PRODUCTS.filter(
    (candidate) =>
      candidate.destination === "universal-orlando" &&
      candidate.kind !== "express-pass" &&
      candidate.days !== null
  )) {
    const base = 18900 + product.days! * 9500;
    const adultTotal = Math.round(
      (base * (0.95 + seed(product.slug, query.checkIn) * 0.12)) / 100
    ) * 100;
    ticketRows.push({
      productSlug: product.slug,
      productName: product.name,
      ticketDays: product.days!,
      parkCount: product.parkCount,
      guestCategory: "adult",
      priceCents: Math.round(adultTotal / product.days!),
      totalCents: adultTotal,
    });
    ticketRows.push({
      productSlug: product.slug,
      productName: product.name,
      ticketDays: product.days!,
      parkCount: product.parkCount,
      guestCategory: "child",
      priceCents: Math.round((adultTotal * 0.95) / product.days!),
      totalCents: Math.round(adultTotal * 0.95),
    });
  }
  const ticket = recommendTicket(
    eligibleTicketRows(ticketRows, query.rateCode),
    tripDays,
    query.adults,
    query.children,
    query.checkIn
  );
  const hotel = hotels[0] ?? null;

  return c.json(
    TripQuote.parse({
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      nights,
      tripDays,
      rooms: query.rooms,
      adults: query.adults,
      children: query.children,
      rateCode: query.rateCode,
      hotel,
      hotelAlternatives: hotels.slice(1, 7),
      ticket,
      combinedTotalCents: hotel && ticket ? hotel.subtotalCents + ticket.subtotalCents : null,
      assumptions: [
        "Hotel estimates use one room type for the entire stay and the tracked two-adult occupancy, multiplied by the number of rooms.",
        query.rateCode === "APH"
          ? "Annual Passholder estimates add only one day of Epic Universe admission; eligible admission at the other parks is assumed to be covered by the Annual Pass."
          : "Ticket estimates assume the first park day is check-in day and favor the widest park access for the closest available duration.",
        "Demo prices are sample data. Always confirm availability and the final price before booking.",
      ],
    })
  );
});

function demoExpressProducts(destination = "universal-orlando") {
  return TICKET_PRODUCTS.filter(
    (product) => product.kind === "express-pass" && product.destination === destination
  ).flatMap((product, index) => {
    const config = product.collectorConfig;
    const parkSlugs = Array.isArray(config.parkSlugs)
      ? config.parkSlugs.filter((value): value is string => typeof value === "string")
      : [];
    const passType = config.passType;
    if (
      !product.days ||
      !product.parkCount ||
      parkSlugs.length === 0 ||
      (passType !== "standard" && passType !== "unlimited" && passType !== "plus")
    ) return [];
    return [{
      id: `demo-express-${index}`,
      destination: product.destination,
      slug: product.slug,
      name: product.name,
      days: product.days,
      parkCount: product.parkCount,
      parkSlugs,
      passType,
    }];
  });
}

demoApp.get("/v1/express-pass/products", (c) =>
  c.json(demoExpressProducts(c.req.query("destination") ?? "universal-orlando"))
);

demoApp.get("/v1/express-pass", (c) => {
  const destination = c.req.query("destination") ?? "universal-orlando";
  const productSlug = c.req.query("productSlug");
  const parkSlug = c.req.query("parkSlug");
  const passType = c.req.query("passType");
  const days = Number(c.req.query("days"));
  const products = demoExpressProducts(destination).filter(
    (product) =>
      (!productSlug || product.slug === productSlug) &&
      (!parkSlug || product.parkSlugs.includes(parkSlug)) &&
      (!passType || product.passType === passType) &&
      (!Number.isInteger(days) || days < 1 || product.days === days)
  );
  const today = todayInTimezone("America/New_York");
  const gate = gateDateWindow(tierOf(c), c.req.query("from"), c.req.query("to"));
  const out = [];
  for (const product of products) {
    for (let i = 0; i < gate.info.visibleDays; i++) {
      const validDate = addDays(today, i);
      const dow = dayOfWeek(validDate);
      // Express is the most volatile price on property — the demo reflects that.
      const weekend = dow === 5 || dow === 6 ? 1.75 : dow === 0 ? 1.35 : 1.0;
      const typeMultiplier = product.passType === "unlimited" ? 1.45 : product.passType === "plus" ? 1.25 : 1;
      const parkMultiplier = 0.8 + product.parkCount * 0.25;
      const perDay = Math.round(
        (9900 * weekend * typeMultiplier * parkMultiplier * (0.85 + seed(product.slug, validDate) * 0.5)) / 100
      ) * 100;
      out.push({
        productSlug: product.slug,
        productName: product.name,
        destination,
        days: product.days,
        parkCount: product.parkCount,
        parkSlugs: product.parkSlugs,
        passType: product.passType,
        validDate,
        priceCents: perDay,
        totalCents: perDay * product.days - 1,
        currency: "USD",
        available: seed(product.slug, validDate, "availability") > 0.03,
        source: "observed" as const,
        isEstimated: false,
        merchant: null,
        observedAt: new Date(Date.now() - 1000 * 60 * 52).toISOString(),
      });
    }
  }
  return c.json(out);
});

/**
 * The one endpoint serving genuinely real data in demo mode. Hits
 * ThemeParks.wiki live, so what you see is what the parks are posting now.
 */
demoApp.get("/v1/waits/live", async (c) => {
  const destination = c.req.query("destination");
  const ridesOnly = c.req.query("ridesOnly") === "true";
  const targets = PARKS.filter(
    (p) => p.themeParksWikiId && (!destination || p.destination === destination)
  );

  const parks = await Promise.all(
    targets.map(async (park) => {
      let waits: Awaited<ReturnType<typeof fetchThemeParksWiki>> = [];
      try {
        waits = await fetchThemeParksWiki(park.themeParksWikiId!);
      } catch (err) {
        console.error(`[demo] ${park.slug} wait fetch failed:`, err);
      }
      const filtered = ridesOnly ? waits.filter((w) => w.kind === "ride") : waits;
      return {
        park: {
          id: `demo-${park.slug}`,
          destination: park.destination,
          slug: park.slug,
          name: park.name,
          timezone: park.timezone,
          queueTimesId: park.queueTimesId,
          themeParksWikiId: park.themeParksWikiId,
        },
        waits: filtered.map((w) => ({
          attractionId: `demo-${w.externalId}`,
          attractionSlug: w.externalId,
          attractionName: w.name,
          parkSlug: park.slug,
          parkName: park.name,
          land: w.land,
          kind: w.kind,
          waitMinutes: w.waitMinutes,
          singleRiderMinutes: w.singleRiderMinutes,
          status: w.status,
          observedAt: w.observedAt,
          typicalMinutes: null,
          vsTypicalMinutes: null,
        })),
        hours: null,
      };
    })
  );

  return c.json({
    parks,
    attribution: [THEMEPARKS_WIKI_ATTRIBUTION, QUEUE_TIMES_ATTRIBUTION],
    fetchedAt: new Date().toISOString(),
  });
});

demoApp.get("/v1/waits/:slug/typical", (c) => c.json([]));

demoApp.get("/v1/status", (c) =>
  c.json({
    collectors: [
      {
        name: "wait-times",
        description: "Live ride wait times (REAL — fetched from ThemeParks.wiki)",
        intervalMinutes: 5,
        lastRun: {
          status: "ok",
          startedAt: new Date(Date.now() - 120000).toISOString(),
          finishedAt: new Date().toISOString(),
          parsedCount: 214,
          writtenCount: 214,
          errorCount: 0,
          ageMinutes: 2,
          stale: false,
        },
      },
      ...["hotel-rates", "ticket-prices", "express-pass"].map((name) => ({
        name,
        description: "DEMO MODE — sample data, no endpoint config captured",
        intervalMinutes: name === "hotel-rates" ? 360 : name === "ticket-prices" ? 720 : 240,
        lastRun: null,
      })),
    ],
  })
);
