# Analytics

Three sources, answering different questions. None of them is optional reading
before you act on a number, because they disagree by design.

| Source | Question it answers | Cost |
| --- | --- | --- |
| nginx logs | Who requested what, including bots | Free, already running |
| Cloudflare Web Analytics | How many real people, and how fast the site felt | Free, cookieless |
| Google Analytics 4 | Behaviour, and search queries via Search Console | Free, cookies |
| `/admin/clicks` | Which page produced an affiliate click | Ours |

## Why more than one

Cloudflare and GA4 will not agree, and neither is broken when they don't. GA4
misses anyone running an ad blocker — a double-digit share of the audience for a
deals site, because the people who install blockers are the people who research
prices. Cloudflare's beacon is blocked less often but still sometimes. nginx
logs miss nobody and count every bot, so they are the ceiling rather than the
truth.

Read them as a range, not a number. If you need one figure for a decision, use
Cloudflare for humans and nginx for load.

## Setup

Both tags are off until configured, and stay off if the value looks like a
placeholder. There is no half-configured state where a tag loads and records
nothing — that failure mode reads as "no traffic" on the dashboard, which is
indistinguishable from a site nobody visits.

Add to `/home/ratecoaster/app/.env`:

```
CLOUDFLARE_ANALYTICS_TOKEN=<32 hex characters>
GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Then restart — **no rebuild needed**. These are read at runtime by the layout,
deliberately not `NEXT_PUBLIC_*`, which Next inlines at build time and which
would leave the tag silently absent until someone remembered to rebuild.

```bash
sudo systemctl restart ratecoaster-web
```

Confirm with `curl -s https://ratecoaster.net/ | grep -o 'cloudflareinsights\|gtag/js'`.
Nothing back means nothing loaded.

### Getting a Cloudflare token

Cloudflare dashboard → Analytics & Logs → Web Analytics → Add a site. You do
**not** need your DNS on Cloudflare; choose the manual beacon option and copy the
token out of the snippet it shows you.

### Getting a GA4 measurement ID

analytics.google.com → Admin → Data streams → Add stream → Web. The ID is on the
stream's detail page. While you're there, link Search Console — that link is the
main reason to run GA4 alongside Cloudflare, since it puts the queries people
searched next to what they did after landing.

## Consent

GA4 sets cookies. The site currently has no consent banner, and AdSense is
already setting cookies too, so GA4 does not change the site's category — but it
does add a second reason to need one. If EU or UK traffic becomes more than
incidental, add Google Consent Mode and a banner before it matters. Cloudflare's
beacon needs neither and can stay as-is.

## What `/admin/clicks` is for

The affiliate network reports revenue per creative, and every link deep-links
through one evergreen creative. Their dashboard can tell you that you earned
$40; it cannot tell you which page earned it, because the click leaves for their
domain and attribution dies at the boundary. GA4 cannot tell you either, for the
same reason.

We log the click first-party on the way out, so this page can. Combined with the
network's payout, it gives you the only number that matters for deciding what to
build next: what a click from each page is worth.

The log is deliberately thin — a slug, a timestamp, a source path. No IP, no
user agent, no user id.

## nginx logs

Already on disk, already covering every week since launch, which no client-side
tool can ever backfill.

```bash
sudo apt install -y goaccess
sudo goaccess /var/log/nginx/access.log --log-format=COMBINED -o /tmp/report.html
```

Expect the numbers to be much higher than Cloudflare's. Most of the gap is bots.
