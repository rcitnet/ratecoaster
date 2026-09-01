# Turning on flight prices

The trip planner adds up flights, hotel and tickets for every possible start
date. Hotels and tickets you already have. This is the flights part.

Unlike the hotel collectors, there is **no HAR capture and no endpoint config**.
The flight data comes from a documented API that wants our traffic. You need a
free account and about ten minutes.

---

## 1. Get a token

1. Sign up at [travelpayouts.com](https://www.travelpayouts.com) — free, no card.
2. In the dashboard, join the **Aviasales** programme. Approval is usually
   automatic; occasionally it takes a day.
3. Copy two things from the dashboard:
   - the **API token** (a long hex string)
   - your **marker** (a short number — your affiliate ID)

These do different jobs and you need both. The token reads prices. The marker
attributes the click when a family books. Without the marker, RateCoaster hides
the outbound booking links entirely rather than sending traffic away for free.

## 2. Put them in `.env`

On the server:

```bash
sudo -u ratecoaster -H nano /home/ratecoaster/app/.env
```

Set:

```
AVIASALES_API_TOKEN=your_real_token_here
TRAVELPAYOUTS_PARTNER_ID=your_partner_id_here
```

Then restart the API:

```bash
sudo systemctl restart ratecoaster-api
```

✅ **Checkpoint.** A placeholder value (anything starting `CHANGE_ME`, `your_`,
`todo`, `xxx`) is treated as *not set*, not as a bad token — so the collector
will tell you it is unconfigured rather than failing with someone else's error
message.

## 3. Check the parser against a real response

**Do this before turning the collector loose.** The parser was written from the
published API documentation, not from a live response, and documented shapes
drift from served shapes. This is the single most common way a collector goes
quietly wrong: no exception, no error log, just a calendar that stops filling.

```bash
sudo -u ratecoaster -H bash -c 'cd /home/ratecoaster/app && set -a && . ./.env && set +a && npm run -w @ratecoaster/api flights:probe -- NYC MCO 5'
```

That sends **one** real request — New York to Orlando, 5-night trips, two months
out — and prints the raw response first, then what the parser made of it.

✅ **Checkpoint.** You want a table of dates and plausible fares. If it prints
`Parsed 0 entries` while the raw body above clearly contains prices, the shape
has changed and `parseCalendar()` in
`apps/api/src/collectors/flights/travelpayouts.ts` needs updating. Do not
continue until this prints rows.

## 4. Create the tables

```bash
cd /home/ratecoaster/app && npm run db:push
```

This adds `flight_quote_observations` and `flight_quote_current`.

## 5. Go live

In the admin portal: **Collectors → flight-prices → Go live**, then **Run now**.

Or from the shell:

```bash
sudo -u ratecoaster -H bash -c 'cd /home/ratecoaster/app && set -a && . ./.env && set +a && npm run collect -- --only flight-prices'
```

The first full pass takes a while — roughly 30 origins × 5 trip lengths × 12
months per destination, at a deliberately polite 120 requests a minute. Leave it
running.

## 6. Schedule it

Already in `deploy/ratecoaster.cron` — daily at 02:52. Install the crontab if you
haven't:

```bash
sudo crontab -u ratecoaster /home/ratecoaster/app/deploy/ratecoaster.cron
```

Daily, not hourly, on purpose: the upstream data is itself a cache that
refreshes on its own schedule, so polling harder returns the same numbers and
spends the rate limit learning nothing.

---

## What the numbers mean, and what they don't

These are **cached "from" prices, not live availability.** Nobody at our scale
sells live fare shopping for free. A quote means "this fare existed on this
route recently", which is exactly right for answering *which week should we go?*
and exactly wrong for *book me this seat*.

Three things follow, and they're built in rather than left to remember:

- Every quote carries the upstream `expires_at`. Past it, the API marks the row
  `stale: true` instead of hiding it — an empty calendar reads as "no data",
  which is a different and more damaging claim than "old data".
- The planner never totals a trip with a missing leg. A date with no fare shows
  a dash, not a hotel-and-tickets subtotal wearing a total's clothing.
- Every page carrying affiliate links says so.

## Tuning the volume

| Variable | Default | Effect |
|---|---|---|
| `FLIGHT_TRIP_LENGTHS` | `3,4,5,6,7` | Nights offered by the planner. Each is a direct multiplier on job size. |
| `FLIGHT_MONTHS_AHEAD` | `12` | Months to fill. 12 = the full 365-day catalogue. |

Origins live in `packages/shared/src/schemas/flights.ts` (`ORIGINS`). Thirty US
markets, chosen for Orlando leisure traffic. Add a city and it is picked up on
the next run — but remember every origin multiplies the job.

## Troubleshooting

**"AVIASALES_API_TOKEN is not set"** — either genuinely missing, or still a
placeholder. Reopen `.env` and confirm both flight settings are populated; do
not print the token into a terminal transcript or support message.

**Probe returns HTTP 401** — the token is wrong, or the Aviasales programme
hasn't been approved yet. Check the dashboard.

**Collector runs `partial` with 0 parsed** — the response shape changed. Run the
probe and compare the raw body against `parseCalendar()`.

**Planner shows dashes everywhere** — that's the missing-leg rule working. Check
`/status`: you need hotel rates *and* ticket prices *and* fares before a date can
be totalled. Flights alone don't make a trip.

**Booking links don't appear** — `TRAVELPAYOUTS_PARTNER_ID` isn't set. Deliberate:
an unattributed outbound click is traffic given away for nothing.
