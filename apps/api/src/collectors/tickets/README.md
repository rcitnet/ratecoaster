# Universal Orlando ticket prices

The Orlando ticket collector reads Universal's own SAP Commerce calendar API.
It does not parse prices from rendered HTML.

The public storefront loads a guest commerce token, then posts adult and child
variant numbers to:

```text
/occ/v2/uor_b2c/products/fetchCalendarDatesWithPriceAndInventory
```

RateCoaster batches every configured product into 45-day requests, so a full
year takes one guest-token request plus nine calendar requests. The shared HTTP
path still enforces dry-run behavior, identification, throttling, retry limits,
and timeouts.

## Configuration

Set these in the production `.env`:

```text
UNIVERSAL_ORLANDO_COMMERCE_CLIENT_ID=mobile_android
UNIVERSAL_ORLANDO_COMMERCE_CLIENT_SECRET=
```

The client credential is the guest application credential published by the
official storefront bundle; it is not a Universal customer login. Do not commit
its value. Deployments that already configured the same guest application for
Universal Kids may omit the Orlando secret because that value is used as a
fallback.

After deployment, seed the product mappings and test without sending requests:

```bash
npm run db:seed
npm run -w @ratecoaster/api collect -- --only ticket-prices --dry-run
```

Then enable `ticket-prices` in the admin collector settings and run the same
command without `--dry-run`.

The collector stores the displayed per-day amount in `price_cents` and the
exact full-ticket amount in `total_cents`. For one-day tickets these are nearly
the same; for multi-day tickets the distinction is essential.
