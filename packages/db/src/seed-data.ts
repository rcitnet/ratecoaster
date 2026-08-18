/**
 * Reference data for the three destinations.
 *
 * IMPORTANT — verify before launch: hotel `tier` and `includesExpressPass` are
 * marketing classifications that Universal changes, and the Epic Universe
 * hotels are new enough that public sources disagree about them. These values
 * are the starting point, not gospel. `includesExpressPass` in particular is
 * the single most valuable field on the page — a guest deciding between a $550
 * Premier room and a $250 Prime Value room is really deciding whether free
 * Express Unlimited for their party is worth $300 a night — so get it right
 * before you show it to anyone.
 */

export type PropertySeed = {
  destination: "universal-orlando" | "universal-hollywood" | "universal-kids-frisco";
  slug: string;
  name: string;
  tier: "premier" | "preferred" | "universal-classic" | "prime-value" | "value" | "partner";
  operator: string;
  onSite: boolean;
  includesExpressPass: boolean;
  earlyParkAdmission: boolean;
  roomCount: number | null;
  latitude: number | null;
  longitude: number | null;
  collectorConfig: Record<string, unknown>;
};

/** Properties deliberately removed from the public hotel product. */
export const RETIRED_PROPERTY_SLUGS = [
  "hilton-universal-city",
  "sheraton-universal",
  "garland",
] as const;

/**
 * `collectorConfig.hotelCode` is the operator's own identifier for the property
 * in its booking engine. Fill these in from a HAR capture — see
 * `apps/api/src/collectors/hotels/README.md`. Collectors skip any property
 * whose code is still null, so you can bring hotels online one at a time.
 */
export const PROPERTIES: PropertySeed[] = [
  // ---- Universal Orlando: Premier (Express Unlimited included) ----
  {
    destination: "universal-orlando",
    slug: "portofino-bay",
    name: "Loews Portofino Bay Hotel",
    tier: "premier",
    operator: "Loews Hotels",
    onSite: true,
    includesExpressPass: true,
    earlyParkAdmission: true,
    roomCount: 750,
    latitude: 28.4657,
    longitude: -81.4713,
    collectorConfig: { adapter: "universal-ibe", hotelId: 14841, hotelGroupId: 641 },
  },
  {
    destination: "universal-orlando",
    slug: "hard-rock-hotel",
    name: "Hard Rock Hotel at Universal Orlando",
    tier: "premier",
    operator: "Loews Hotels",
    onSite: true,
    includesExpressPass: true,
    earlyParkAdmission: true,
    roomCount: 650,
    latitude: 28.4715,
    longitude: -81.4676,
    collectorConfig: { adapter: "universal-ibe", hotelId: 14842, hotelGroupId: 641 },
  },
  {
    destination: "universal-orlando",
    slug: "royal-pacific",
    name: "Loews Royal Pacific Resort",
    tier: "premier",
    operator: "Loews Hotels",
    onSite: true,
    includesExpressPass: true,
    earlyParkAdmission: true,
    roomCount: 1000,
    latitude: 28.4649,
    longitude: -81.4696,
    collectorConfig: { adapter: "universal-ibe", hotelId: 14843, hotelGroupId: 641 },
  },

  // ---- Universal Orlando: Preferred ----
  {
    destination: "universal-orlando",
    slug: "helios-grand",
    name: "Universal Helios Grand Hotel",
    tier: "preferred",
    // VERIFY: Helios Grand sits inside Epic Universe with a private park
    // entrance. Whether that comes with Express Unlimited has been reported
    // inconsistently; confirm against the official hotel page before relying on it.
    operator: "Loews Hotels",
    onSite: true,
    includesExpressPass: false,
    earlyParkAdmission: true,
    roomCount: 500,
    latitude: 28.4414,
    longitude: -81.4487,
    collectorConfig: { adapter: "universal-ibe", hotelId: 17424, hotelGroupId: 705 },
  },
  {
    destination: "universal-orlando",
    slug: "sapphire-falls",
    name: "Loews Sapphire Falls Resort",
    tier: "preferred",
    operator: "Loews Hotels",
    onSite: true,
    includesExpressPass: false,
    earlyParkAdmission: true,
    roomCount: 1000,
    latitude: 28.4632,
    longitude: -81.4708,
    collectorConfig: { adapter: "universal-ibe", hotelId: 14845, hotelGroupId: 641 },
  },

  // ---- Universal Orlando: Prime Value ----
  {
    destination: "universal-orlando",
    slug: "stella-nova",
    name: "Universal Stella Nova Resort",
    tier: "prime-value",
    operator: "Loews Hotels",
    onSite: true,
    includesExpressPass: false,
    earlyParkAdmission: true,
    roomCount: 750,
    latitude: 28.4356,
    longitude: -81.4534,
    collectorConfig: { adapter: "universal-ibe", hotelId: 17425, hotelGroupId: 705 },
  },
  {
    destination: "universal-orlando",
    slug: "terra-luna",
    name: "Universal Terra Luna Resort",
    tier: "prime-value",
    operator: "Loews Hotels",
    onSite: true,
    includesExpressPass: false,
    earlyParkAdmission: true,
    roomCount: 750,
    latitude: 28.4348,
    longitude: -81.4551,
    collectorConfig: { adapter: "universal-ibe", hotelId: 17426, hotelGroupId: 705 },
  },
  {
    destination: "universal-orlando",
    slug: "aventura",
    name: "Universal Aventura Hotel",
    tier: "prime-value",
    operator: "Loews Hotels",
    onSite: true,
    includesExpressPass: false,
    earlyParkAdmission: true,
    roomCount: 600,
    latitude: 28.4619,
    longitude: -81.4696,
    collectorConfig: { adapter: "universal-ibe", hotelId: 14856, hotelGroupId: 641 },
  },
  {
    destination: "universal-orlando",
    slug: "cabana-bay",
    name: "Universal Cabana Bay Beach Resort",
    tier: "prime-value",
    operator: "Loews Hotels",
    onSite: true,
    includesExpressPass: false,
    earlyParkAdmission: true,
    roomCount: 2200,
    latitude: 28.4606,
    longitude: -81.4738,
    collectorConfig: { adapter: "universal-ibe", hotelId: 14844, hotelGroupId: 641 },
  },

  // ---- Universal Orlando: Value ----
  {
    destination: "universal-orlando",
    slug: "endless-summer-surfside",
    name: "Universal Endless Summer Resort – Surfside Inn and Suites",
    tier: "value",
    operator: "Loews Hotels",
    onSite: true,
    includesExpressPass: false,
    earlyParkAdmission: true,
    roomCount: 750,
    latitude: 28.4419,
    longitude: -81.4633,
    collectorConfig: { adapter: "universal-ibe", hotelId: 15346, hotelGroupId: 641 },
  },
  {
    destination: "universal-orlando",
    slug: "endless-summer-dockside",
    name: "Universal Endless Summer Resort – Dockside Inn and Suites",
    tier: "value",
    operator: "Loews Hotels",
    onSite: true,
    includesExpressPass: false,
    earlyParkAdmission: true,
    roomCount: 2050,
    latitude: 28.4408,
    longitude: -81.4645,
    collectorConfig: { adapter: "universal-ibe", hotelId: 15783, hotelGroupId: 641 },
  },

  // ---- Universal Kids Resort, Frisco TX (opened 2026-07-01) ----
  {
    destination: "universal-kids-frisco",
    slug: "universal-kids-hotel",
    name: "Universal Kids Resort Hotel",
    tier: "partner",
    operator: "Universal Destinations & Experiences",
    onSite: true,
    includesExpressPass: false,
    earlyParkAdmission: true,
    roomCount: 300,
    latitude: 33.1507,
    longitude: -96.8236,
    collectorConfig: { adapter: "universal-kids-commerce", hotelId: "UNI012" },
  },
];

export type ParkSeed = {
  destination: PropertySeed["destination"];
  slug: string;
  name: string;
  timezone: string;
  queueTimesId: number | null;
  themeParksWikiId: string | null;
};

/**
 * Provider IDs verified live against queue-times.com/parks.json and
 * api.themeparks.wiki/v1/destinations. Both are free and unauthenticated.
 *
 * Universal Kids Resort is absent from both providers as of August 2026 — it
 * opened on 1 July 2026 and neither has added it. Its row is seeded with null
 * IDs so the park exists in the UI; the wait collector skips it until an ID is
 * filled in, at which point it starts working with no code change.
 */
export const PARKS: ParkSeed[] = [
  {
    destination: "universal-orlando",
    slug: "universal-studios-florida",
    name: "Universal Studios Florida",
    timezone: "America/New_York",
    queueTimesId: 65,
    themeParksWikiId: "eb3f4560-2383-4a36-9152-6b3e5ed6bc57",
  },
  {
    destination: "universal-orlando",
    slug: "islands-of-adventure",
    name: "Universal Islands of Adventure",
    timezone: "America/New_York",
    queueTimesId: 64,
    themeParksWikiId: "267615cc-8943-4c2a-ae2c-5da728ca591f",
  },
  {
    destination: "universal-orlando",
    slug: "epic-universe",
    name: "Universal Epic Universe",
    timezone: "America/New_York",
    queueTimesId: 334,
    themeParksWikiId: "12dbb85b-265f-44e6-bccf-f1faa17211fc",
  },
  {
    destination: "universal-orlando",
    slug: "volcano-bay",
    name: "Universal Volcano Bay",
    timezone: "America/New_York",
    queueTimesId: 67,
    themeParksWikiId: "fe78a026-b91b-470c-b906-9d2266b692da",
  },
  {
    destination: "universal-hollywood",
    slug: "universal-studios-hollywood",
    name: "Universal Studios Hollywood",
    timezone: "America/Los_Angeles",
    queueTimesId: 66,
    themeParksWikiId: "bc4005c5-8c7e-41d7-b349-cdddf1796427",
  },
  {
    destination: "universal-kids-frisco",
    slug: "universal-kids-resort",
    name: "Universal Kids Resort",
    timezone: "America/Chicago",
    queueTimesId: null,
    themeParksWikiId: null,
  },
];

export type TicketProductSeed = {
  destination: PropertySeed["destination"];
  slug: string;
  name: string;
  kind:
    | "single-park-1-day"
    | "park-to-park-1-day"
    | "single-park-multi-day"
    | "park-to-park-multi-day"
    | "seasonal-pass"
    | "annual-pass"
    | "express-pass"
    | "early-park-admission"
    | "add-on";
  days: number | null;
  parkCount: number | null;
  collectorConfig: Record<string, unknown>;
};

export const TICKET_PRODUCTS: TicketProductSeed[] = [
  {
    destination: "universal-orlando",
    slug: "uor-1-day-1-park",
    name: "1-Day, 1-Park Ticket",
    kind: "single-park-1-day",
    days: 1,
    parkCount: 1,
    collectorConfig: { adapter: "universal-orlando-tickets", productCode: null },
  },
  {
    destination: "universal-orlando",
    slug: "uor-1-day-park-to-park",
    name: "1-Day Park-to-Park Ticket",
    kind: "park-to-park-1-day",
    days: 1,
    parkCount: 3,
    collectorConfig: { adapter: "universal-orlando-tickets", productCode: null },
  },
  {
    destination: "universal-orlando",
    slug: "uor-2-day-park-to-park",
    name: "2-Day Park-to-Park Ticket",
    kind: "park-to-park-multi-day",
    days: 2,
    parkCount: 3,
    collectorConfig: { adapter: "universal-orlando-tickets", productCode: null },
  },
  {
    destination: "universal-orlando",
    slug: "uor-3-day-park-to-park",
    name: "3-Day Park-to-Park Ticket",
    kind: "park-to-park-multi-day",
    days: 3,
    parkCount: 3,
    collectorConfig: { adapter: "universal-orlando-tickets", productCode: null },
  },
  {
    destination: "universal-orlando",
    slug: "uor-express-pass",
    name: "Universal Express Pass",
    kind: "express-pass",
    days: 1,
    parkCount: null,
    collectorConfig: { adapter: "universal-orlando-express", productCode: null },
  },
  {
    destination: "universal-hollywood",
    slug: "ush-1-day-general",
    name: "1-Day General Admission",
    kind: "single-park-1-day",
    days: 1,
    parkCount: 1,
    collectorConfig: { adapter: "universal-hollywood-tickets", productCode: null },
  },
  {
    destination: "universal-hollywood",
    slug: "ush-universal-express",
    name: "Universal Express",
    kind: "express-pass",
    days: 1,
    parkCount: 1,
    collectorConfig: { adapter: "universal-hollywood-express", productCode: null },
  },
  {
    destination: "universal-kids-frisco",
    slug: "ukr-1-day",
    name: "1-Day Admission",
    kind: "single-park-1-day",
    days: 1,
    parkCount: 1,
    collectorConfig: { adapter: "universal-frisco-tickets", productCode: null },
  },
];
