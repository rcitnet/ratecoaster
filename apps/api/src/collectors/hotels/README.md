# Capturing a booking-engine endpoint

> **Corrected August 2026 — read `CAPTURING-PRICES.md` first.**
> Direct inspection of `universalorlando.com` disproved three assumptions that
> still shape parts of this file. For Universal Orlando specifically:
> the passholder rate is selected by **URL, not a promo code**; the underlying
> reservation engine has JSON endpoints but its server-rendered rate page is
> sufficient for one-night collection; and
> the headline price is a **stay average, not a nightly rate**.
> The generic JSON workflow below still applies to any operator that *does*
> expose a JSON endpoint, which the Hollywood partner engines may.

Universal Orlando is implemented directly through the `universal-ibe` adapter
for both STANDARD and APH. Its eleven property IDs ship in seed data. The generic
capture workflow below is only for other operators whose endpoints are not
already represented by a dedicated adapter.

This takes about ten minutes per operator. Four operators cover everything:
`universal-ibe` (all 11 Orlando hotels), `universal-kids-commerce` (the Frisco
hotel), `hilton`, `marriott`, and `synxis` (Hollywood partners).

The Frisco hotel uses a separate SAP Commerce site and property id `UNI012`.
Its public guest API currently exposes the `RACK` Standard rate only—there is
no APH plan to infer or relabel. Set `UNIVERSAL_KIDS_COMMERCE_CLIENT_SECRET` to
the guest client key published by that booking app before enabling collection.

## Before you start — read this

Automated querying of a booking engine is very likely contrary to the operator's
terms of service, even though the annual-passholder rate needs no login and is
reachable from a public link. That is a business risk you are choosing to take,
not a technical detail. Some things that materially reduce it:

- **Stay slow.** The default is 12 requests/minute per host. A full 365-day pass
  across 11 hotels and two rate plans is roughly 8,000 requests spread over many hours. That is
  less traffic than a single enthusiastic human comparison-shopping.
- **Identify yourself.** `COLLECTOR_USER_AGENT` should name your bot and carry a
  contact address. If you are causing a problem, let them tell you instead of
  discovering it as a silent IP ban.
- **Honour the signals.** The HTTP client already respects `Retry-After` and
  backs off on 429. Do not tune that out.
- **Review the operator's terms.** Public visibility does not automatically
  grant permission for automated collection.

## Steps

1. Open the hotel's booking page in Chrome and search a date with **two adults**.
2. DevTools → **Network** → filter **Fetch/XHR**.
3. Run the search again in the discounted context. For Universal Orlando that
   means entering through the **separate passholder link** — there is no promo
   field. For operators that do use a promo box, enter the code there.
4. Find the request that returns room rates — usually the largest JSON response.
   Right-click it → **Copy** → **Copy as HAR** (or *Save all as HAR with content*).
5. Save it as `har/operator.har` in the repo root (the `har/` directory is
   gitignored — HAR files contain your cookies).
6. Generate a config skeleton:

   ```bash
   npm run -w @ratecoaster/api har:import -- har/operator.har captured-operator
   ```

   The importer finds candidate rate responses, guesses `roomsPath` and the
   price fields, and writes `config/endpoints/captured-operator.json`.
7. Open that file and fix up the placeholders. Replace the literal dates,
   occupancy, and promo code in `urlTemplate` with `{checkIn}`, `{checkOut}`,
   `{adults}`, `{children}`, `{rateCode}`, `{hotelCode}`.
8. Put each hotel's own code into `collectorConfig.hotelCode` in
   `packages/db/src/seed-data.ts`, then re-run `npm run db:seed`.
9. Verify against the live endpoint **without writing anything**:

   ```bash
   npm run -w @ratecoaster/api collect -- --only hotel-rates --dry-run
   npm run -w @ratecoaster/api verify:endpoint -- captured-operator
   ```

10. When the parsed output looks right, set `COLLECTOR_DRY_RUN=0`.

## Confirming the discount actually applied

This is the check worth spending time on, whatever form it takes.

**Universal Orlando does not use a promo code**, so `rateCodeAppliedPath` cannot
protect you there — the equivalent check is that `s.strike-through-price` and the
`p.savings` "Annual Passholder Rate Discount" label are both present. If either
is missing you are looking at public rates. See `CAPTURING-PRICES.md`.

For operators that *do* take a promo code, the original hazard stands: booking
engines routinely accept an invalid or inapplicable promo code and silently
return the **public** rate, with no error. If you do not detect that,
you will store standard prices labelled `APH` and show users a passholder
discount that does not exist — which is worse than showing nothing, because they
will act on it.

Look in the response for the field that echoes the applied rate plan (often
`ratePlanCode`, `promoApplied`, `rateCategory`, or a `messages[]` entry saying
the code was not valid). Set:

```json
"rateCodeAppliedPath": "data.ratePlan.code",
"rateCodeAppliedEquals": "APH"
```

Offers from a response that fails this check are discarded, and the run records
a `rateCodeRejected` count you can see on the status page. A sudden spike there
usually means the passholder rate simply is not published yet for those dates —
which is normal, and is itself worth surfacing to users.

## Config reference

```json
{
  "name": "captured-operator",
  "capturedAt": "2026-08-06",
  "request": {
    "method": "GET",
    "urlTemplate": "https://example-booking-host/api/availability?hotel={hotelCode}&arrive={checkIn}&depart={checkOut}&adults={adults}&children={children}&promo={rateCode}",
    "headers": { "accept": "application/json" },
    "rpm": 12
  },
  "response": {
    "roomsPath": "data.roomRates[*]",
    "fields": {
      "roomCode": "roomTypeCode",
      "roomName": "roomTypeName",
      "nightly": "rates[0].nightlyRate",
      "total": "rates[0].totalAmount",
      "available": "isAvailable",
      "maxOccupancy": "maxOccupancy"
    },
    "rateCodeAppliedPath": "data.appliedRatePlan",
    "rateCodeAppliedEquals": "APH",
    "pricesAreCents": false
  }
}
```

Paths support `a.b.c`, `a[0].b`, and `a[*].b`. Prices may be numbers or strings
like `"$249.00"` — both parse.
