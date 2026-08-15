# RateCoaster

Hotel rates, dynamic ticket pricing, Express Pass prices, and live ride wait
times for **Universal Orlando**, **Universal Studios Hollywood**, and
**Universal Kids Resort** (Frisco, TX) — with annual-passholder rates tracked
alongside public rates across a full 365-day lookahead.

Free for users. API-first, so an iOS/Android companion app is additive rather
than a rewrite.

---

## What works right now, and what needs you

Being precise about this matters more than a feature list.

| Feature | State |
|---|---|
| Live ride wait times | **Working.** Free public APIs, no auth, no scraping. Verified against live Epic Universe and Hollywood responses. |
| Rate/ticket/Express collectors | **Complete but unconfigured.** Every piece — scheduling, rate limiting, parsing, storage, change detection — is built and tested. Each source needs one endpoint capture from your browser (~10 min each). |
| Database schema, API, web UI | **Working.** Typechecked, tested, builds clean. |
| Mobile app | Not built. The API and shared types are shaped so it slots in. |

The collectors ship with no third-party endpoint URLs. That is deliberate — see
[Legal and ethical posture](#legal-and-ethical-posture).

## Architecture

```
ratecoaster/
├── apps/
│   ├── api/          Hono API + collectors + scheduled jobs
│   └── web/          Next.js 15 (App Router), server components
└── packages/
    ├── shared/       Zod schemas + typed API client  ← web and mobile both import this
    └── db/           Drizzle schema + seed data
```

The one decision everything else follows from: **the API is a standalone
service, and the web app is just a client of it.** Next.js never touches
Postgres directly. That is what makes a companion app cheap later — every screen
the web renders, a phone can render, because there is no privileged path.

`packages/shared` holds the Zod schemas *and* the API client, so a response-shape
change becomes a compile error in every client at once instead of a runtime
surprise in one of them.

### The storage decision that matters

Prices are stored **append-only, written only on change**.

`rate_current` holds the latest price for every tracked combination.
`rate_observations` gains a row only when a price actually moves.

The arithmetic: 11 hotels × 365 dates × 4 occupancies × ~6 room types × 2 rate
codes ≈ 193k combinations. Crawled every six hours and written unconditionally,
that is ~23 million rows a month, nearly all byte-identical to the row before.
Written on change, it is a few thousand rows that each mean something — and a
price-history chart becomes `SELECT … ORDER BY observed_at` with no
deduplication.

Retrofitting this later is painful; getting it right on day one is free.

## Quick start

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run db:push        # create tables
npm run db:seed        # 16 properties, 6 parks, 8 ticket products

# Wait times need no configuration — this works immediately:
npm run -w @ratecoaster/api collect -- --only wait-times

npm run dev            # API on :8787, web on :3000
```

Visit `/waits` for live data and `/status` to see the health of every collector.

## Bringing the pricing collectors online

Full walkthrough: [`apps/api/src/collectors/hotels/README.md`](apps/api/src/collectors/hotels/README.md).

```bash
# 1. Capture the booking request from your browser (DevTools → Network → Copy as HAR)
npm run -w @ratecoaster/api har:import -- har/loews.har loews-universal

# 2. Review config/endpoints/loews-universal.json, then test ONE request
npm run -w @ratecoaster/api verify:endpoint -- loews-universal PBH APH

# 3. When the parsed output looks right
COLLECTOR_DRY_RUN=0 npm run -w @ratecoaster/api collect -- --only hotel-rates
```

`COLLECTOR_DRY_RUN=1` is the default. The first thing you do with a new adapter
should not be firing 16,000 requests at someone's booking engine because of a
typo in a loop bound.

### The one bug worth guarding against

Booking engines routinely accept an inapplicable promo code and silently return
the **public** rate. If you do not detect that, you store standard prices
labelled `APH` and show users a passholder discount that does not exist — worse
than showing nothing, because they will act on it.

Set `rateCodeAppliedPath` in your endpoint config to the field that echoes the
applied rate plan. Readings that fail the check are discarded, and the count
surfaces on `/status`.

## Crawl volume

You asked for all room types and occupancies. The useful correction: booking
engines return **every room type in one response**, so room types are free.

```
11 hotels × 365 dates × 4 occupancies × 2 rate codes ≈ 32,000 requests/full pass
```

At the default 12 req/min per host that is ~44 hours, so `sliceFraction` splits
it across runs, with near-term and holiday dates crawled first
(`prioritizeDates`). An interrupted crawl still leaves next month accurate,
which is what people are actually booking.

Ticket and Express collectors are far cheaper — storefronts return a whole
calendar per response, so ~12 requests covers a year.

## Scheduled jobs

| Job | Cadence | Command |
|---|---|---|
| Wait times | 5 min | `collect -- --only wait-times` |
| Hotel rates | 6 h | `collect -- --only hotel-rates` |
| Ticket prices | 12 h | `collect -- --only ticket-prices` |
| Express Pass | 4 h | `collect -- --only express-pass` |
| Rollup + prune | daily | `npm run -w @ratecoaster/api rollup` |

Drive these from cron or your platform's scheduler rather than a long-lived
process — a crashed scheduler nobody notices is a worse failure mode than a cron
job that visibly did not run.

The rollup job matters: ~250 attractions every 5 minutes is ~26M rows/year. It
folds raw samples into hourly percentiles by day-of-week, then prunes what it
rolled up. Only `operating` samples count — folding closed rides in as zeros is
what makes other sites' "average wait" numbers untrustworthy.

## Testing

```bash
npm run -w @ratecoaster/api test    # 24 tests
npm run typecheck                 # all packages
```

Parser tests run against **real captured payloads**, not hand-written fixtures —
trademark symbols, curly apostrophes, single-rider queues modelled as separate
rides, closed rides reporting `wait_time: 0`. Those are the things that break
parsers, and they are not things you would invent.

## Legal and ethical posture

Wait times use [Queue-Times](https://queue-times.com/pages/api) and
[ThemeParks.wiki](https://themeparks.wiki/api) — free, unauthenticated, offered
for exactly this purpose. Queue-Times requires visible attribution, which the
API returns in every response so no client can forget it.

Hotel, ticket, and Express pricing is different. Automated querying of those
booking engines is very likely contrary to the operators' terms of service, even
though the passholder rate needs no login and comes from a public promo-code
field. **That is a business risk you are choosing to take, not a technical
detail.** The code is built to minimise impact:

- Conservative default rate limits (12 req/min/host), token-bucket paced
- Honest, contactable `User-Agent` — no browser spoofing
- `Retry-After` respected, full-jitter exponential backoff
- Dry-run by default
- No third-party endpoint URLs committed to this repo

Worth pursuing in parallel: Loews and Universal both run affiliate programs.
Sanctioned access is slower to obtain and far more durable.

## Notes on the data

- **Verify `includesExpressPass` before launch.** It is the highest-value field
  on the site — a guest choosing between a $550 Premier room and a $250 Prime
  Value room is really deciding whether free Express Unlimited is worth $300 a
  night. Universal changes these classifications, and the Epic Universe hotels
  (Helios Grand, Stella Nova, Terra Luna) are new enough that public sources
  disagree. Seed values are a starting point, flagged in `seed-data.ts`.
- **Universal Kids Resort (Frisco) opened 1 July 2026** and is seeded with a
  300-room hotel. Neither wait-time provider covers it yet, so its park row has
  null provider IDs and the collector skips it — it will start working with no
  code change once coverage lands.
- **Hollywood has no Universal-operated on-site hotels.** The partner hotels
  (Hilton, Sheraton, The Garland) run on separate booking engines and need their
  own endpoint captures.

## Adding the mobile app

```
apps/mobile/    Expo + React Native
```

Import `RateCoasterClient` from `@ratecoaster/shared`, point it at the same
`API_BASE_URL`, and every endpoint is available with full types. Push
notifications register through `POST /v1/push/register`, which already accepts
the `expo-push` channel — the watch and alert schema was designed for it rather
than retrofitted.
