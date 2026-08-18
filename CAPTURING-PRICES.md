# Turning on hotel, ticket and Express Pass prices

Wait times work with no setup because two public APIs hand them over freely.
Prices are different: Universal and Loews have no public price API, so the only
way to see a price is to ask their booking page the same question a customer
would — and to do that, you have to know what their page actually sends.

That's what this is. You do one capture per source, in your own browser, and
paste the result into a config file. About 15 minutes each. You only do it once
per source, though you'll redo it whenever they change their site.

---

## Read this first

Automated querying of a booking engine is very likely contrary to Universal's
and Loews' terms of service, even though the passholder rate comes from a public
promo-code field and needs no login. **That is a business risk you are choosing
to take, not a technical detail.** Nobody can promise you it's fine.

Things that materially reduce it, all already built in:

- **12 requests/minute per host.** A full 365-day pass across 11 hotels is
  ~32,000 requests spread over many hours — less traffic than one enthusiastic
  human comparison-shopping.
- **An honest, contactable `User-Agent`.** If you're causing a problem, let them
  email you rather than discovering it as a silent IP ban.
- **`Retry-After` respected**, full-jitter backoff on 429.
- **Dry run on by default.** Nothing is fetched until you deliberately switch it
  off.

Worth doing in parallel: Loews and Universal both run affiliate programmes.
Sanctioned access is slower to get and far more durable than this.

---

## The one mistake that matters

Booking engines routinely accept a promo code they don't honour and quietly
return the **public** rate instead, with no error.

If you don't detect that, you store standard prices labelled `APH` and show
families a passholder discount that doesn't exist. That is worse than showing
nothing, because they'll act on it — book a room believing they saved $200 a
night when they didn't.

Every capture below has a step for this. Don't skip it.

---

## Source 1 — Universal Orlando hotels

This is the big one: 11 hotels, and the reason the site exists.

### Capture

1. Open `universalorlando.com`, go to **Hotels**, and start a booking search for
   one hotel — say Cabana Bay — with **2 adults**, a date about 45 days out.
2. Before you hit search: press **F12** → **Network** tab → click the **Fetch/XHR**
   filter. Tick **Preserve log**.
3. Run the search. You'll see a burst of requests.
4. Run it **again**, this time with `APH` typed into the promo/rate code field.
5. Find the request that returned the room prices. It's usually the largest JSON
   response — click through the biggest few and look at the **Response** tab
   until you see room names and dollar amounts.
6. Right-click that request → **Copy** → **Copy as HAR**.

   > If you only see "Save all as HAR", that's fine too — just make sure it's
   > *with content*. A HAR without response bodies is useless here.

7. Save it on the server as `har/loews.har`:

   ```bash
   mkdir -p /home/ratecoaster/app/har
   nano /home/ratecoaster/app/har/loews.har     # paste, then Ctrl+O, Ctrl+X
   ```

   `har/` is gitignored — HAR files contain your session cookies.

### Generate the config

```bash
cd /home/ratecoaster/app
npm run -w @ratecoaster/api har:import -- har/loews.har loews-universal
```

It finds the response that looks most like a list of room offers, guesses the
paths, and writes `config/endpoints/loews-universal.json`. It prints a sample
offer so you can check its guesses.

### Fix up the config

Open `config/endpoints/loews-universal.json` and do three things:

**1. Replace the literal values in `urlTemplate` with placeholders.** The
capture has real dates and numbers baked in:

```
...&arrive=2026-10-01&depart=2026-10-02&adults=2&promo=APH
```

becomes:

```
...&arrive={checkIn}&depart={checkOut}&adults={adults}&promo={rateCode}
```

Available: `{hotelCode} {checkIn} {checkOut} {nights} {adults} {children} {rateCode} {currency}`

**2. Check the field paths** against the sample offer it printed. `nightly` must
point at the per-night price, not the total.

**3. Set `rateCodeAppliedPath`** — the important one. Find the field in the
response that echoes which rate plan was applied. Often `ratePlanCode`,
`appliedRatePlan`, `rateCategory`, or a `messages[]` entry saying the code was
invalid. Then:

```json
"rateCodeAppliedPath": "data.ratePlan.code",
"rateCodeAppliedEquals": "APH"
```

Compare your two captures — the one with `APH` and the one without. Whatever
differs between them is the field you want.

### Add the hotel codes

Each hotel has its own identifier in the booking engine. You'll see it in the
captured URL. Put them in `packages/db/src/seed-data.ts`:

```ts
collectorConfig: { adapter: "loews-universal", hotelCode: "CABANA" },
```

Then re-seed:

```bash
set -a && . ./.env && set +a && npm run db:seed
```

**Do one hotel first.** Get it working end to end before filling in the other
ten — a mistake repeated across 11 hotels is 11 times the cleanup.

### Test with a single request

```bash
npm run -w @ratecoaster/api verify:endpoint -- loews-universal CABANA APH
```

This sends **one** request and prints what the parser made of it. Nothing is
written to the database. You want a list of room types with sensible nightly
prices.

If it warns the rate code wasn't applied, your `rateCodeAppliedPath` is wrong —
or the passholder rate genuinely isn't published for that date, which is normal
further out. Try a date 30–60 days ahead.

---

## Source 2 — Ticket prices

Same process, different page, and much cheaper to run: ticket storefronts return
a **whole calendar** in one response, so ~12 requests covers a year.

1. Go to Universal Orlando's ticket store and pick a multi-day ticket.
2. Open the date picker — that's what triggers the pricing call.
3. In **Network → Fetch/XHR**, find the response containing a list of dates with
   prices.
4. Copy as HAR, save as `har/tickets.har`, then:

   ```bash
   npm run -w @ratecoaster/api har:import -- har/tickets.har universal-orlando-tickets
   ```

The config shape is the same, with one difference in meaning: `roomsPath` points
at the array of **dates**, and the `roomCode` field holds the **date** rather
than a room code. That's a slight abuse of the field names — it kept one config
format for both instead of two nearly identical ones.

Set `productCode` for each ticket in `seed-data.ts`, same as `hotelCode`.

---

## Source 3 — Express Pass

Identical to tickets. The Express Pass purchase page has its own date-priced
calendar.

```bash
npm run -w @ratecoaster/api har:import -- har/express.har universal-orlando-express
```

Express is the most volatile price on the property — it can more than double
between a quiet Tuesday and a holiday Saturday, and it re-prices during the day.
That's why its collector runs every 4 hours rather than every 12.

---

## Going live

Only when `verify:endpoint` gives you sensible output:

```bash
nano /home/ratecoaster/app/.env
```

Change:

```
COLLECTOR_DRY_RUN=0
```

Then run one collector by hand and watch it:

```bash
cd /home/ratecoaster/app && set -a && . ./.env && set +a && npm run collect -- --only hotel-rates
```

Restart the API so it picks up the change:

```bash
sudo systemctl restart ratecoaster-api
```

### Watch `/admin/status` for the first few days

That page is the early warning system. Two things to look for:

- **"Parsed nothing"** — the run completed but returned no rows. That's what a
  changed response shape looks like: no error, no crash, just silence. It's the
  failure most likely to go unnoticed for weeks.
- **`rateCodeRejected` counts climbing** — the engine is ignoring your promo
  code. Either the passholder rate isn't published for those dates, or your
  detection is misconfigured. Either way, those readings are discarded rather
  than shown as fake discounts.

---

## When it breaks

It will, eventually — booking engines change without warning. The symptom is
almost always `/admin/status` showing "parsed nothing" rather than an error.

Recapture the HAR and re-run `har:import`. Nothing else needs touching: no code
changes, no deploy. That's the entire reason the endpoints live in config
instead of in TypeScript.
