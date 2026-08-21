# Affiliate links

How ticket links are stored, tracked and rendered — and the one thing you must
verify before switching them on.

---

## The shape

Nothing outbound is a raw network URL in the markup. Every click goes:

```
Book button  →  /go/ticket/:slug   (our domain)
             →  GET /v1/outbound/ticket/:slug   (resolves + logs)
             →  https://www.anrdoezrs.net/click-101861754-15733832?url=…&sid=…
             →  undercovertourist.com/…
```

Four reasons it's built this way:

1. **Links change without a deploy.** The destination is a row in the database.
2. **We learn which page earned.** Every product deep-links through a single
   evergreen creative, so the network's reporting sees one link for the whole
   site. Our own click log plus a matching `sid` is what turns "$40 this month"
   into "the 3-day park-to-park row made $40 this month."
3. **`rel="sponsored"` and the FTC disclosure live in one component**, not in
   every page that shows a price.
4. **The publisher ID stays out of the HTML.**

## What's stored

`ticket_products` gains two columns:

| Column | Example |
|---|---|
| `affiliate_url` | `https://www.undercovertourist.com/orlando/universal-orlando-resort/3-day-park-to-park/` |
| `affiliate_merchant` | `undercover-tourist` |

**A plain merchant URL, not a tracking link.** The network wrapper is applied at
render time from the merchant key. Storing pre-baked tracking links would weld
Commission Junction into the data — switching programmes, or running two
merchants for the same product, would become a migration instead of a config
change.

## ⚠️ Verify deep linking first

Everything above depends on one assumption: that Undercover Tourist has **deep
linking enabled** on their CJ programme. If they haven't, `?url=` is ignored and
every visitor lands on their homepage instead of the product page. It looks like
it works. It converts far worse. You will not notice unless you check.

**Check it by hand, once:**

1. Take any link the seed job prints.
2. Open it in a private window.
3. Confirm you land on *that product page*, not undercovertourist.com's homepage.

If you land on the homepage, deep linking is off — ask CJ to enable it for the
advertiser, and until then drop `affiliate_url` and let every product fall back
to the plain merchant link (the code already does this when the column is null).

## Setting it up

```bash
# See what would be written — writes nothing
npm run -w @ratecoaster/api affiliate:seed

# Apply it
npm run -w @ratecoaster/api affiliate:seed -- --apply
```

Then `npm run db:push` for the new columns and the `outbound_clicks` table.

## Why the "Save $53 on…" links aren't used

The CJ catalogue has ~140 creatives for this advertiser. We use exactly one:
**15733832**, the Evergreen link. Two reasons:

**It's the only deep-linkable one.** Its own description says so. Ordinary
creatives ignore `url=`.

**The specific promo creatives are stale and earn less.** Nearly all were last
updated in April 2023, so their dollar claims are three years old. And the EPC
data says the generic links earn several times more anyway:

| 3-month EPC | Link |
|---|---|
| **$144.40** | 15733832 Evergreen (deep-link enabled) |
| $15.77 | 5516693 Tickets – Orlando |
| $15.38 | 12540860 Orlando + LA tickets |
| $14.48 | 10723176 Undercover Tourist (Cart) |
| $4.75 | 13012456 Universal Studios Hollywood Discount Tickets |
| $0.00 | 13012440 Universal Orlando Discount Tickets |
| $0.00 / N/A | most "Save $X on…" creatives |

A site built on *we don't show you stale prices* cannot go around quoting
three-year-old discounts. Here the honest choice and the profitable one are the
same choice.

## Express Pass

**No affiliate link.** Universal sells Express Pass itself; Undercover Tourist
doesn't carry it. The seed job skips `kind = 'express-pass'` deliberately — a
Book button there would send a family to a dead end, which costs more in trust
than it could ever earn.

## The open-redirect guard

`/go/` sits on our own domain, which is exactly what would make it valuable to a
phisher. `buildAffiliateLink()` therefore checks every destination against a
per-merchant host allowlist and **throws** rather than degrading:

- must be `https:`
- hostname must be exactly `undercovertourist.com` or `www.undercovertourist.com`
- lookalikes like `undercovertourist.com.evil.example` are rejected

A destination that fails returns a 500 and logs loudly. That's correct: it's a
data problem, and following it would be worse than failing.

## What gets logged

`outbound_clicks` holds a `sid`, a merchant, a path, and a timestamp. No IP, no
user agent, no user id. A click log isn't worth building a tracking profile for,
and the less it holds the less there is to disclose or leak.

## Adding another merchant

1. Add an `AffiliateNetwork` entry in `packages/shared/src/affiliate.ts`.
2. Add its hosts to `ALLOWED_DESTINATIONS`.
3. Set `affiliate_merchant` on the relevant rows.

No route, component or page changes.
