# Getting RateCoaster into Google

What's built, and the four things only you can do.

---

## Set expectations first

**A brand-new domain takes weeks to months to rank for anything competitive.** Not
days. Google has to find the site, crawl it, decide it's trustworthy, and then
work out what it's about. Nothing below changes that timeline; it removes the
reasons a site *never* gets there.

The realistic first wins are long-tail queries — "cabana bay passholder rate",
"cheapest week universal orlando" — not "universal orlando tickets".

---

## What's already done

| | |
|---|---|
| `sitemap.xml` | Generated from live data. Hotels come from the API, so a new property appears automatically |
| `robots.txt` | Points at the sitemap; blocks admin, account, auth and `/go/` |
| Per-page titles | All 16 public pages have their own. Previously seven shared one |
| Descriptions | Written per page, not templated |
| Canonicals | Self-referencing on every page, stripping query strings |
| Structured data | Organization + WebSite sitewide; Article + Breadcrumb on guides; Hotel + Breadcrumb on properties |
| Social cards | Generated Open Graph image at `/opengraph-image` |
| Noindex | Admin, account, join, auth, and affiliate redirects |
| Guides | 9 articles |

### The one that mattered most

Seven pages — the homepage, hotels, tickets, Express Pass, wait times and both
planners — all inherited a single title from the root layout. To Google that
reads as seven copies of the same page, and it picks at most one to show. No
amount of content or links fixes a site that presents itself as duplicates.

### A trap worth knowing about

A `canonical` set on the root layout is **inherited by every page that doesn't
set its own**. Three pages had their own metadata block without a canonical, so
they were each declaring "I am the homepage" — an explicit instruction to drop
them from the index. Caught by fetching the rendered HTML rather than reading
the code.

**If you add a page, use `pageMetadata()` from `@/lib/seo`.** It sets the
canonical from the path, so this can't recur.

---

## What you need to do

### 1. Google Search Console

This is how you see whether any of the above worked.

1. Go to [search.google.com/search-console](https://search.google.com/search-console)
2. Click **Add property** → choose **Domain** (the left option, not URL prefix)
3. Enter `ratecoaster.net`
4. Google gives you a **TXT record**. Add it wherever you manage DNS for the
   domain — same place you pointed it at the server
5. Wait a few minutes, click **Verify**

✅ **Then:** left menu → **Sitemaps** → enter `sitemap.xml` → **Submit**

Nothing will appear for a few days. That's normal.

### 2. Bing Webmaster Tools

Ten percent-ish of US search, and it feeds ChatGPT's browsing.

1. [bing.com/webmasters](https://www.bing.com/webmasters)
2. Sign in and choose **Import from Google Search Console** — it copies the
   verification and sitemap across in about thirty seconds

### 3. Check the rendered output

Once deployed, confirm these load:

- `https://ratecoaster.net/sitemap.xml` — should list ~31 URLs
- `https://ratecoaster.net/robots.txt` — should end with a `Sitemap:` line

Then run any page through Google's
[Rich Results Test](https://search.google.com/test/rich-results). The guides
should report Article and Breadcrumb; hotel pages should report Hotel.

### 4. Set `NEXT_PUBLIC_SITE_URL`

Add to `.env` on the server:

```
NEXT_PUBLIC_SITE_URL=https://ratecoaster.net
```

It defaults to that, so this is belt-and-braces — but if you ever run a staging
copy, this is what stops it publishing canonicals pointing at production.

---

## What will actually move the needle

Ranked by effect, most first. None of it is technical.

**1. Get the collectors running.** Every page here is a container for price
data. A hotel page with no prices is thin content, and Google is good at
recognising that. This matters more than anything else on this list.

**2. Publish more guides.** The nine articles are the only pages that can rank
*today*, because they don't depend on collected data. They're also what earns
links. `apps/web/src/lib/guides.ts` — add an entry and the sitemap, metadata,
structured data and routing all follow automatically.

**3. Get a few real links.** Theme-park forums, Reddit, Facebook planning
groups. Not spam — answer a question, and link the specific calendar that
answers it. Ten genuine links beat a thousand bought ones, which now actively
hurt.

**4. Be patient with the hotel pages.** They're the biggest long-tail
opportunity and the slowest to pay off, because they need data before they
deserve to rank.

---

## Things not to do

- **Don't buy links.** It's the fastest route to a manual penalty.
- **Don't write thin pages per keyword.** "Universal Orlando hotel deals 2027"
  as a separate page from "…2026" is the pattern Google's helpful-content
  system targets.
- **Don't add FAQ schema for questions not visible on the page.** Google checks,
  and mismatched markup gets structured data ignored sitewide.
- **Don't resubmit the sitemap repeatedly.** Once is enough; it's re-read
  automatically.

---

## Adding a page later

```tsx
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Short and specific — the brand is appended automatically",
  description: "One or two sentences. Written for a human, roughly 150 chars.",
  path: "/your-path",
});
```

Then add the path to `apps/web/src/app/sitemap.ts`. Guides and hotels are
already automatic.
