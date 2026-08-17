import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ *
 * Enums
 * ------------------------------------------------------------------ */

export const destinationEnum = pgEnum("destination", [
  "universal-orlando",
  "universal-hollywood",
  "universal-kids-frisco",
]);

export const rateCodeEnum = pgEnum("rate_code", [
  "STANDARD",
  "APH",
  "FLR",
  "CAR",
  "TXR",
  "AAA",
  "AARP",
  "GOV",
  "MIL",
]);

/**
 * Where a price came from — the pivot from scraping to affiliate feeds.
 *
 *   observed  — read directly from a booking/storefront engine (the original
 *               scraper). Authoritative; not estimated.
 *   affiliate — sourced from a commercial feed (Undercover Tourist, an OTA API).
 *               Authoritative for what it covers; carries a `merchant`.
 *   derived   — reconstructed, e.g. an APH rate computed by applying a sampled
 *               passholder discount to an affiliate public rate. Always
 *               `is_estimated = true`.
 *
 * Provenance is a column rather than a separate table because
 * `rate_observations` / `rate_current` don't otherwise care where a number came
 * from — the write-on-change rule and the read paths are identical regardless.
 */
export const rateSourceEnum = pgEnum("rate_source", ["observed", "affiliate", "derived"]);

export const propertyTierEnum = pgEnum("property_tier", [
  "premier",
  "preferred",
  "universal-classic",
  "prime-value",
  "value",
  "partner",
]);

export const attractionStatusEnum = pgEnum("attraction_status", [
  "operating",
  "down",
  "closed",
  "refurbishment",
  "unknown",
]);

export const attractionKindEnum = pgEnum("attraction_kind", [
  "ride",
  "show",
  "meet-and-greet",
  "other",
]);

export const ticketKindEnum = pgEnum("ticket_kind", [
  "single-park-1-day",
  "park-to-park-1-day",
  "single-park-multi-day",
  "park-to-park-multi-day",
  "seasonal-pass",
  "annual-pass",
  "express-pass",
  "early-park-admission",
  "add-on",
]);

export const guestCategoryEnum = pgEnum("guest_category", ["adult", "child", "senior"]);
export const expressTierEnum = pgEnum("express_tier", ["standard", "unlimited"]);
export const alertChannelEnum = pgEnum("alert_channel", ["email", "web-push", "expo-push"]);
export const platformEnum = pgEnum("platform", ["ios", "android", "web"]);
export const runStatusEnum = pgEnum("run_status", ["running", "ok", "partial", "failed"]);

/* ------------------------------------------------------------------ *
 * Properties & rooms
 * ------------------------------------------------------------------ */

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    destination: destinationEnum("destination").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tier: propertyTierEnum("tier").notNull(),
    operator: text("operator").notNull(),
    onSite: boolean("on_site").notNull().default(true),
    includesExpressPass: boolean("includes_express_pass").notNull().default(false),
    earlyParkAdmission: boolean("early_park_admission").notNull().default(false),
    roomCount: integer("room_count"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    /**
     * Per-property collector configuration: which adapter to use and the
     * operator-specific identifiers it needs (hotel code, brand code, booking
     * host). Kept as JSON so adding a Hollywood partner hotel is a seed change,
     * not a migration.
     */
    collectorConfig: jsonb("collector_config").$type<Record<string, unknown>>(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("properties_slug_uq").on(t.slug), index("properties_dest_idx").on(t.destination)]
);

export const roomTypes = pgTable(
  "room_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    externalCode: text("external_code").notNull(),
    name: text("name").notNull(),
    maxOccupancy: smallint("max_occupancy"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("room_types_prop_code_uq").on(t.propertyId, t.externalCode)]
);

/* ------------------------------------------------------------------ *
 * Hotel rates
 * ------------------------------------------------------------------ */

/**
 * Append-only price history.
 *
 * The collector writes here ONLY when the observed price differs from the value
 * currently in `rate_current`. A 365-day x 11-hotel x 4-occupancy crawl running
 * every few hours would otherwise write tens of millions of identical rows a
 * month; writing on change turns that into a few thousand meaningful ones and
 * makes the history charts trivially cheap to query.
 *
 * `observedAt` is the moment we saw the price. Combined with the change-only
 * write rule, a row means "the price became X at time T and stayed there until
 * the next row", which is exactly the shape a step chart wants.
 */
export const rateObservations = pgTable(
  "rate_observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    roomTypeId: uuid("room_type_id").references(() => roomTypes.id, { onDelete: "set null" }),
    rateCode: rateCodeEnum("rate_code").notNull(),
    stayDate: date("stay_date").notNull(),
    nights: smallint("nights").notNull().default(1),
    adults: smallint("adults").notNull().default(2),
    children: smallint("children").notNull().default(0),
    nightlyCents: integer("nightly_cents").notNull(),
    totalCents: integer("total_cents"),
    currency: text("currency").notNull().default("USD"),
    available: boolean("available").notNull().default(true),
    source: rateSourceEnum("source").notNull().default("observed"),
    isEstimated: boolean("is_estimated").notNull().default(false),
    /** Feed/OTA the price came from (e.g. "expedia", "undercover-tourist"). Null for observed. */
    merchant: text("merchant"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Drives the price-history chart for one property/date/code.
    index("rate_obs_series_idx").on(
      t.propertyId,
      t.stayDate,
      t.rateCode,
      t.roomTypeId,
      t.observedAt
    ),
    // Drives "what changed in the last hour" for the alert dispatcher.
    index("rate_obs_recent_idx").on(t.observedAt),
    index("rate_obs_date_idx").on(t.stayDate, t.rateCode),
  ]
);

/**
 * The current price for every tracked combination. One row per query key,
 * updated in place. This is what nearly every read hits, so it stays narrow and
 * fully indexed while the history table absorbs the writes.
 */
export const rateCurrent = pgTable(
  "rate_current",
  {
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    roomTypeId: uuid("room_type_id").references(() => roomTypes.id, { onDelete: "cascade" }),
    rateCode: rateCodeEnum("rate_code").notNull(),
    stayDate: date("stay_date").notNull(),
    nights: smallint("nights").notNull().default(1),
    adults: smallint("adults").notNull().default(2),
    children: smallint("children").notNull().default(0),
    nightlyCents: integer("nightly_cents").notNull(),
    totalCents: integer("total_cents"),
    currency: text("currency").notNull().default("USD"),
    available: boolean("available").notNull().default(true),
    source: rateSourceEnum("source").notNull().default("observed"),
    isEstimated: boolean("is_estimated").notNull().default(false),
    /** Feed/OTA the price came from (e.g. "expedia", "undercover-tourist"). Null for observed. */
    merchant: text("merchant"),
    /** Lowest nightly rate ever recorded for this key. Powers "all-time low" badges. */
    historicalLowCents: integer("historical_low_cents"),
    /** Previous distinct price, so the UI can show a delta without a second query. */
    previousCents: integer("previous_cents"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("rate_current_key_uq").on(
      t.propertyId,
      t.roomTypeId,
      t.rateCode,
      t.stayDate,
      t.nights,
      t.adults,
      t.children
    ),
    index("rate_current_lookup_idx").on(t.rateCode, t.stayDate, t.nightlyCents),
    index("rate_current_property_idx").on(t.propertyId, t.stayDate),
  ]
);

/* ------------------------------------------------------------------ *
 * Parks, attractions, waits
 * ------------------------------------------------------------------ */

export const parks = pgTable(
  "parks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    destination: destinationEnum("destination").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull(),
    queueTimesId: integer("queue_times_id"),
    themeParksWikiId: text("themeparks_wiki_id"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("parks_slug_uq").on(t.slug), index("parks_dest_idx").on(t.destination)]
);

export const attractions = pgTable(
  "attractions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parkId: uuid("park_id")
      .notNull()
      .references(() => parks.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: attractionKindEnum("kind").notNull().default("ride"),
    land: text("land"),
    externalId: text("external_id"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("attractions_slug_uq").on(t.slug),
    index("attractions_park_idx").on(t.parkId),
    index("attractions_external_idx").on(t.externalId),
  ]
);

/**
 * Raw wait samples. This is the highest-cardinality table in the system —
 * ~250 attractions polled every 5 minutes is ~72k rows/day — so it is subject
 * to a retention policy (see `retention.ts`): raw rows older than 45 days are
 * dropped once they have been folded into `waitRollups`.
 */
export const waitObservations = pgTable(
  "wait_observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attractionId: uuid("attraction_id")
      .notNull()
      .references(() => attractions.id, { onDelete: "cascade" }),
    waitMinutes: smallint("wait_minutes"),
    singleRiderMinutes: smallint("single_rider_minutes"),
    status: attractionStatusEnum("status").notNull().default("unknown"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("wait_obs_attraction_time_idx").on(t.attractionId, t.observedAt),
    index("wait_obs_time_idx").on(t.observedAt),
  ]
);

export const waitCurrent = pgTable(
  "wait_current",
  {
    attractionId: uuid("attraction_id")
      .primaryKey()
      .references(() => attractions.id, { onDelete: "cascade" }),
    waitMinutes: smallint("wait_minutes"),
    singleRiderMinutes: smallint("single_rider_minutes"),
    status: attractionStatusEnum("status").notNull().default("unknown"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

/**
 * Hourly rollups by day-of-week, which is what "typical wait" actually means to
 * a guest: a Saturday at 2pm is nothing like a Tuesday at 2pm.
 */
export const waitRollups = pgTable(
  "wait_rollups",
  {
    attractionId: uuid("attraction_id")
      .notNull()
      .references(() => attractions.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(),
    hour: smallint("hour").notNull(),
    avgMinutes: doublePrecision("avg_minutes"),
    p50Minutes: smallint("p50_minutes"),
    p90Minutes: smallint("p90_minutes"),
    sampleCount: integer("sample_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wait_rollups_key_uq").on(t.attractionId, t.dayOfWeek, t.hour)]
);

export const parkHours = pgTable(
  "park_hours",
  {
    parkId: uuid("park_id")
      .notNull()
      .references(() => parks.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    earlyEntryAt: timestamp("early_entry_at", { withTimezone: true }),
    kind: text("kind").notNull().default("operating"),
  },
  (t) => [uniqueIndex("park_hours_key_uq").on(t.parkId, t.date, t.kind)]
);

/* ------------------------------------------------------------------ *
 * Tickets & Express Pass
 * ------------------------------------------------------------------ */

export const ticketProducts = pgTable(
  "ticket_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    destination: destinationEnum("destination").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: ticketKindEnum("kind").notNull(),
    days: smallint("days"),
    parkCount: smallint("park_count"),
    externalId: text("external_id"),
    collectorConfig: jsonb("collector_config").$type<Record<string, unknown>>(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("ticket_products_slug_uq").on(t.slug)]
);

export const ticketPriceObservations = pgTable(
  "ticket_price_observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => ticketProducts.id, { onDelete: "cascade" }),
    validDate: date("valid_date"),
    guestCategory: guestCategoryEnum("guest_category").notNull().default("adult"),
    priceCents: integer("price_cents").notNull(),
    totalCents: integer("total_cents"),
    currency: text("currency").notNull().default("USD"),
    available: boolean("available").notNull().default(true),
    source: rateSourceEnum("source").notNull().default("observed"),
    isEstimated: boolean("is_estimated").notNull().default(false),
    /** Affiliate feed the price came from (e.g. "undercover-tourist"). Null for observed. */
    merchant: text("merchant"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ticket_obs_series_idx").on(t.productId, t.validDate, t.guestCategory, t.observedAt),
    index("ticket_obs_recent_idx").on(t.observedAt),
  ]
);

export const ticketPriceCurrent = pgTable(
  "ticket_price_current",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => ticketProducts.id, { onDelete: "cascade" }),
    validDate: date("valid_date"),
    guestCategory: guestCategoryEnum("guest_category").notNull().default("adult"),
    priceCents: integer("price_cents").notNull(),
    totalCents: integer("total_cents"),
    previousCents: integer("previous_cents"),
    available: boolean("available").notNull().default(true),
    source: rateSourceEnum("source").notNull().default("observed"),
    isEstimated: boolean("is_estimated").notNull().default(false),
    /** Affiliate feed the price came from (e.g. "undercover-tourist"). Null for observed. */
    merchant: text("merchant"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ticket_current_key_uq").on(t.productId, t.validDate, t.guestCategory)]
);

export const expressPassPrices = pgTable(
  "express_pass_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    destination: destinationEnum("destination").notNull(),
    parkId: uuid("park_id").references(() => parks.id, { onDelete: "set null" }),
    validDate: date("valid_date").notNull(),
    tier: expressTierEnum("tier").notNull().default("standard"),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    available: boolean("available").notNull().default(true),
    source: rateSourceEnum("source").notNull().default("observed"),
    isEstimated: boolean("is_estimated").notNull().default(false),
    /** Feed the price came from, when not first-party. Null for observed. */
    merchant: text("merchant"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("express_series_idx").on(t.destination, t.validDate, t.tier, t.observedAt),
    index("express_recent_idx").on(t.observedAt),
  ]
);

/* ------------------------------------------------------------------ *
 * Users, watches, notifications
 * ------------------------------------------------------------------ */

export const tierEnum = pgEnum("tier", ["anonymous", "free", "pro", "admin"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    displayName: text("display_name"),
    /**
     * Stored on the user rather than derived from a subscriptions join, so an
     * auth check is one indexed read. When billing arrives, the webhook writes
     * here and every gate downstream keeps working unchanged.
     */
    tier: tierEnum("tier").notNull().default("free"),
    /** Anonymous device/browser identity, so watches work before signup. */
    anonymousId: text("anonymous_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email), uniqueIndex("users_anon_uq").on(t.anonymousId)]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * SHA-256 of the cookie value, never the value itself. A leaked database
     * dump then yields no usable sessions.
     */
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash), index("sessions_user_idx").on(t.userId)]
);

export const magicLinkTokens = pgTable(
  "magic_link_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Set the moment it is redeemed, making the link strictly single-use. */
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    redirectTo: text("redirect_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("magic_token_uq").on(t.tokenHash),
    index("magic_email_idx").on(t.email, t.createdAt),
  ]
);

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("oauth_provider_uq").on(t.provider, t.providerAccountId)]
);

export const watches = pgTable(
  "watches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }),
    destination: destinationEnum("destination"),
    rateCode: rateCodeEnum("rate_code").notNull().default("APH"),
    checkIn: date("check_in").notNull(),
    checkOut: date("check_out").notNull(),
    adults: smallint("adults").notNull().default(2),
    children: smallint("children").notNull().default(0),
    thresholdCents: integer("threshold_cents"),
    bookedNightlyCents: integer("booked_nightly_cents"),
    channels: jsonb("channels").$type<string[]>().notNull().default(["email"]),
    active: boolean("active").notNull().default(true),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
    lastNotifiedCents: integer("last_notified_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("watches_user_idx").on(t.userId),
    // The dispatcher scans active watches by date range after each crawl.
    index("watches_active_idx").on(t.active, t.checkIn),
  ]
);

export const pushRegistrations = pgTable(
  "push_registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: alertChannelEnum("channel").notNull(),
    token: text("token").notNull(),
    platform: platformEnum("platform").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("push_token_uq").on(t.token)]
);

export const alertEvents = pgTable(
  "alert_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    watchId: uuid("watch_id")
      .notNull()
      .references(() => watches.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    previousCents: integer("previous_cents"),
    currentCents: integer("current_cents").notNull(),
    message: text("message").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("alert_events_watch_idx").on(t.watchId, t.sentAt)]
);

/* ------------------------------------------------------------------ *
 * Collector observability
 * ------------------------------------------------------------------ */

/**
 * Every collector run is recorded. When a booking engine silently changes its
 * response shape — which it will — the symptom is a run that reports 0 parsed
 * rows rather than an exception. Tracking counts per run is what turns that
 * from "the site quietly went stale for a week" into an alert.
 */
export const collectorRuns = pgTable(
  "collector_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    collector: text("collector").notNull(),
    status: runStatusEnum("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    requestCount: integer("request_count").notNull().default(0),
    parsedCount: integer("parsed_count").notNull().default(0),
    writtenCount: integer("written_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    notes: jsonb("notes").$type<Record<string, unknown>>(),
  },
  (t) => [index("collector_runs_idx").on(t.collector, t.startedAt)]
);

/**
 * Raw upstream payloads, kept briefly. When a parser breaks you need the bytes
 * that broke it; re-requesting is both slow and unkind to the upstream host.
 */
export const rawSnapshots = pgTable(
  "raw_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    collector: text("collector").notNull(),
    url: text("url").notNull(),
    requestKey: text("request_key").notNull(),
    statusCode: integer("status_code"),
    body: text("body"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("raw_snapshots_idx").on(t.collector, t.capturedAt)]
);


/* ------------------------------------------------------------------ *
 * Admin-managed operational state
 * ------------------------------------------------------------------ */

/**
 * Endpoint configurations, moved out of files on disk and into the database.
 *
 * They started as `config/endpoints/*.json`, which was right when only a human
 * with SSH could edit them. Once the admin UI can write them, files become the
 * wrong home: a deploy overwrites them, permissions get fiddly, and there is no
 * history of who changed what. These are operational data, not source code.
 *
 * The loader still falls back to the JSON files when no row exists, so an
 * existing file-based setup keeps working untouched.
 */
export const endpointConfigs = pgTable(
  "endpoint_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Matches `collectorConfig.adapter` on a property or ticket product. */
    name: text("name").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    notes: text("notes"),
    /** Result of the last single-request test, so the UI can show it. */
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    lastTestOk: boolean("last_test_ok"),
    lastTestMessage: text("last_test_message"),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("endpoint_configs_name_uq").on(t.name)]
);

/**
 * Per-collector operational settings.
 *
 * Dry-run used to be one global environment variable, which meant enabling a
 * verified hotel collector also un-muzzled the unverified ticket one. Per
 * collector, it becomes a safe switch you can flip one source at a time.
 */
export const collectorSettings = pgTable(
  "collector_settings",
  {
    collector: text("collector").primaryKey(),
    enabled: boolean("enabled").notNull().default(true),
    /** True = log intended requests, send nothing. Defaults to safe. */
    dryRun: boolean("dry_run").notNull().default(true),
    /** Overrides the collector's built-in interval when set. */
    intervalMinutes: integer("interval_minutes"),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

/**
 * Every admin action, recorded.
 *
 * This panel controls a scraper and the prices shown to the public. When
 * something goes wrong at 2am — dry-run switched off against an unverified
 * endpoint, a hotel code mistyped — the first question is what changed and who
 * changed it. Without this the answer is unavailable.
 */
export const adminAudit = pgTable(
  "admin_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email"),
    action: text("action").notNull(),
    target: text("target"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_audit_at_idx").on(t.at)]
);
