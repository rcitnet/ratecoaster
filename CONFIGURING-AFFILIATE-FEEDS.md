# Configuring affiliate product feeds

RateCoaster can source ticket prices from an affiliate product feed instead of
scraping a storefront. The first feed is **Undercover Tourist, delivered through
CJ (Commission Junction)**. The collector is config-driven — pointing it at the
real feed is editing one JSON file and tagging a few products, no code change.

## 1. Get the CJ product feed

In your CJ publisher account, join the **Undercover Tourist** advertiser program,
then create a **Product Feed** subscription for it. CJ gives you an HTTPS
download URL (some plans embed a personal access token, or want an
`Authorization: Bearer …` header). You want a **CSV** export.

## 2. Fill in `apps/api/config/feeds/undercover-tourist.json`

```jsonc
{
  "feedUrl": "https://<your real CJ product-feed URL>",
  "headers": {},                    // e.g. { "Authorization": "Bearer <cj-token>" } if required
  "columns": { "sku": "SKU", "price": "SALEPRICE", "buyUrl": "BUYURL", ... },
  "filter": { "column": "ADVERTISERNAME", "equals": "Undercover Tourist" }
}
```

**Verify the `columns` against your feed's real header row.** The defaults follow
CJ's product-catalog naming (`SKU`, `NAME`, `SALEPRICE`, `PRICE`, `CURRENCY`,
`BUYURL`, `INSTOCK`), but header casing varies by advertiser — open the first
line of the CSV and match names exactly. `price` should point at the column you
want to record (usually the discounted `SALEPRICE`).

The `filter` keeps only rows for one advertiser, in case the feed is a combined
export. Remove it if your feed is already Undercover-Tourist-only.

## 3. Tag the ticket products with their feed SKU

Each ticket product is matched to a feed row by SKU. On every product you want
priced from the feed, set `collectorConfig.feedSku` to the CJ `SKU` for that
product (optionally `feedGuestCategory: "child"` for a child-priced SKU). This is
an admin/seed edit on `ticket_products`. Products with no `feedSku` are ignored
by this collector and keep whatever other source they use.

The collector writes the affiliate deep link back to each matched product's
`collectorConfig.bookingUrl` (with `bookingMerchant`), which is what the Book
button will link to.

## 4. Turn it on

The collector ships **dry-run and enabled by default**, so its first scheduled
run only logs the request. When you're ready, in the admin panel flip
`ticket-feed-undercover-tourist` off dry-run (or run it manually). Prices land in
`ticket_price_current` / `ticket_price_observations` with `source = affiliate`
and `merchant = undercover-tourist`, following the same write-on-change rule as
every other collector.

## Adding another feed later

The collector is merchant-generic. A second feed — a hotel OTA CSV, another
ticket reseller — is a new `config/feeds/<name>.json` plus one line in
`apps/api/src/jobs/registry.ts`:

```ts
export const someFeed = createTicketFeedCollector("some-name");
```
