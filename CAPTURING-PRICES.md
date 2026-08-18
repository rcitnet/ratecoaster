# Turning on hotel, ticket and Express Pass prices

Wait times work with no setup because two public APIs hand them over freely.
Prices are different: Universal and Loews have no public price API, so the only
way to see a price is to ask their booking pages the same question a customer
would — and to do that, you have to know what their pages actually contain.

> **Rewritten August 2026.** The hotel section below was corrected after
> inspecting `universalorlando.com` directly. Three things this guide previously
> told you were wrong: that the passholder rate comes from a promo-code field,
> that a JSON pricing API sits behind the page, and that the headline price is a
> nightly rate. All three are covered in *What's actually there*. If you read the
> old version, re-read that section before capturing anything.

---

## Read this first

Automated querying of a booking engine is very likely contrary to Universal's
and Loews' terms of service. **That is a business risk you are choosing to take,
not a technical detail.** Nobody can promise you it's fine.

Things that materially reduce it, all already built in:

- **12 requests/minute per host**, spread over hours.
- **An honest, contactable `User-Agent`.** If you're causing a problem, let them
  email you rather than discovering it as a silent IP ban.
- **`Retry-After` respected**, full-jitter backoff on 429.
- **Dry run on by default.** Nothing is fetched until you deliberately switch it
  off, per collector.

**Current direction.** Standard and Annual Passholder rates are both observed
directly from Universal's reservation engine. Affiliate support remains a
dormant adapter seam that can be configured later; it is not required for the
hotel product and no derived APH estimates are used.

---

## What's actually there (verified August 2026)

Checked against Universal Cabana Bay Beach Resort, 13–19 October 2026, 2 guests.

### The passholder rate is a separate link, not a promo code

There is no promo/rate-code box to type `APH` into. The passholder context is
carried by the URL itself:

```
/hotels/en/us/hotel-details/<searchId>|1/<hotelCode>
```

`UECBB` is Cabana Bay. `<searchId>` (e.g. `2929478715945930566`) encodes the
dates and occupancy and is minted by the search that created it.

### Both rates appear together, per room

Each of the 28 room types on that page renders as:

```html
<p class="price" data-aui="Standard 2 Queen Beds-price-per-stay-amount"> $187.47 </p>
<s class="strike-through-price"> $261.17 </s>
<p class="average-text">Average per night</p>
<p class="savings">Annual Passholder Rate Discount</p>
```

Passholder price, public price struck through, and a label naming the discount.
**One request gives you both sides and therefore the discount** — you do not need
to query twice and diff, which is what the sampling design assumed.

### The marketing page is not the source of truth

The public marketing page did not expose pricing JSON, but the underlying SHR
Windsurfer reservation engine does. Its search flow posts to
`xml/setSearchCriteria.aspx` and then `xml/getresultd.aspx`. For RateCoaster's
one-night STANDARD and APH collection, the simpler source is the server-rendered
`ibe/details.aspx` rate page: every room's booking button contains the room code,
rate code, nightly amount, tax, and access marker in stable attributes.

Use `rate=0RACW` for the Flexible/standard rate and
`rate=3APHW&access=APH` for Annual Passholder. The `dt1` parameter is the number
of days since 2000-01-01. One request returns all available room types for that
hotel, date, occupancy, and rate plan.

### The headline price is an average, not a nightly rate

This is the one most likely to corrupt the dataset silently. `$187.47` is the
average across the whole stay. The checkout breaks the same booking out per
night:

| Night | Rate |
|---|---|
| Tue 13 Oct | $146.30 |
| Wed 14 Oct | $154.85 |
| Thu 15 Oct | $201.40 |
| Fri 16 Oct | $231.80 |
| Sat 17 Oct | $263.15 |
| Sun 18 Oct | $127.30 |

$1,124.80 over six nights ÷ 6 = $187.47. Saturday is **2.07×** Sunday.

Note the contradiction on the page: the `data-aui` attribute says
`price-per-stay-amount` while the visible label says "Average per night". The
label is correct. Trust the arithmetic, not the attribute name.

### The cart is session-bound

The details URL renders for anyone. `/hotels/en/us/shopping-cart/<searchId>|1`
redirects to the generic hotel listing without the cookies from the search that
created it. Read-only price viewing works from a cold start; checkout state does
not.

---

## The two mistakes that matter

### 1. Storing an average as a nightly rate

`rate_current` and `rate_observations` are keyed per `stayDate`. Write $187.47
against all six dates above and you are wrong on five of them — and you erase
precisely the signal this site exists to surface, which nights are cheap.

**Query one night at a time.** With `nights: 1`, the average *is* that night's
rate, and the problem disappears. The collector already defaults to this. That
default is load-bearing: anyone who later "optimises" it to 7-night queries for
7× fewer requests will silently corrupt every row without a single error.

If you want the nightly curve cheaply, the checkout is where it lives — one cart
request exposed six nights individually. That would be a ~7× volume saving over
one-request-per-night. Two things to establish first: it needs a live session,
and it is **not yet confirmed** whether cart nightly figures stay
passholder-discounted or revert to public rates. Verify before relying on it.

### 2. Recording a discount that didn't apply

The old guard, `rateCodeAppliedPath`, was built for a promo code the engine might
silently ignore. **That failure cannot happen when the rate is selected by URL**,
so the guard is watching the wrong thing. The real check is simpler and stronger:

- `s.strike-through-price` is present, **and**
- `p.savings` reads "Annual Passholder Rate Discount"

Both present → you have passholder pricing. Either missing → you are looking at
public rates; discard rather than store them as `APH`.

The reasoning is unchanged even though the mechanism is: a wrong discount is
worse than no data, because families act on it. Someone books believing they
saved $200 a night when they didn't.

---

## Source 1 — Universal Orlando hotels

### Implemented request shape

No browser capture or affiliate feed is required. Each property is configured
with Universal's numeric `hotelId` and `hotelGroupId`. The dedicated
`universal-ibe` adapter requests both rate plans for every selected one-night
date:

- Standard/Flexible: `rate=0RACW`
- Annual Passholder: `rate=3APHW&access=APH`

The adapter requires the returned booking button to identify the exact expected
rate code and, for APH, the `access=APH` marker. This prevents a public fallback
from being stored as a passholder quote. Missing rooms are transitioned to
`available=false`; an unfamiliar page with no recognized offers is treated as a
parser error rather than sold-out inventory.

All eleven Orlando hotel IDs are in `packages/db/src/seed-data.ts`. Re-run the
idempotent seed after pulling configuration changes:

```bash
npm run db:seed
```

Then inspect the generated URLs without sending them:

```bash
npm run collect -- --only hotel-rates --dry-run
```

Set `COLLECTOR_DRY_RUN=0` only after the request scope and contactable user-agent
have been reviewed. The collector keeps the next fourteen dates hot and rotates
through the rest of the 365-day window instead of repeating the same slice.

---

## Source 2 — Ticket prices

> **Unverified.** The hotel findings above came from direct inspection. The
> ticket and Express sections below still assume a JSON storefront API and have
> **not** been re-checked since. Treat the shape as a hypothesis: if the ticket
> store also renders server-side, the same DOM-adapter conclusion applies.
>
> Note also that tickets are the one product an affiliate feed *does* cover —
> Undercover Tourist via CJ. Wiring that up (`CONFIGURING-AFFILIATE-FEEDS.md`) is
> sanctioned, durable and probably less work than capturing this.

If you do capture it, storefronts are much cheaper to poll than hotels: they
usually return a **whole calendar** in one response, so ~12 requests covers a
year.

1. Open the ticket store and pick a multi-day ticket.
2. Open the date picker — that is what triggers the pricing call.
3. In **Network → Fetch/XHR**, find the response containing a list of dates with
   prices.
4. Copy as HAR, save as `har/tickets.har`, then:

   ```bash
   npm run -w @ratecoaster/api har:import -- har/tickets.har universal-orlando-tickets
   ```

In the config, `roomsPath` points at the array of **dates**, and the `roomCode`
field holds the **date** rather than a room code. That is a deliberate abuse of
the field names — it kept one config format for both instead of two nearly
identical ones.

Set `productCode` for each ticket in `seed-data.ts`, same as `hotelCode`.

## Source 3 — Express Pass

Same process and the same caveat. The Express purchase page has its own
date-priced calendar.

```bash
npm run -w @ratecoaster/api har:import -- har/express.har universal-orlando-express
```

No reseller carries Express, so there is no affiliate alternative here — if you
want this data, capture is the only route. It is also the most volatile price on
the property, which is why its collector runs every 4 hours rather than every 12.

---

## Going live

Only when `verify:endpoint` gives you sensible output.

Dry run is per collector, so you no longer edit `COLLECTOR_DRY_RUN` in `.env` for
this. Go to **`/admin/collectors`** and switch the one collector you have just
verified off dry run, leaving the others muzzled. Then run it by hand and watch:

```bash
cd /home/ratecoaster/app && set -a && . ./.env && set +a && npm run collect -- --only hotel-rates
```

### Watch `/admin/status` for the first few days

That page is the early warning system. Two things to look for:

- **"Parsed nothing"** — the run completed but returned no rows. That is what a
  changed page structure looks like: no error, no crash, just silence. It is the
  failure most likely to go unnoticed for weeks.
- **Discount-confirmation failures climbing** — the passholder markers are
  missing, so readings are being discarded rather than stored as fake discounts.
  Either the rate genuinely is not published for those dates, or the page changed
  and your selectors need re-checking.

### Sanity-check the numbers once, by hand

Before you trust a single row: take one date the collector stored, open the same
search in a browser, and confirm the nightly figure matches. This is the only
check that catches an average-vs-nightly error, because that failure produces
perfectly plausible numbers.

---

## When it breaks

It will, eventually — booking engines change without warning. The symptom is
almost always `/admin/status` showing "parsed nothing" rather than an error.

Recapture, update the selectors or paths in the config, and you are done: no code
changes, no deploy. That is the entire reason these live in config rather than in
TypeScript.
