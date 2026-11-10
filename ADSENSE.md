# Getting RateCoaster approved for AdSense

What was changed in the code and content, and the steps only you can do.

Last updated: 2026-11-09.

---

## Why the site was likely refused

The technical setup was already correct: `ads.txt`, the AdSense tag, the privacy
policy's advertising section, `robots.txt` and the sitemap. What a reviewer saw
was a data tool with very little original writing:

- nine guides of 255–484 words, with no author, no dates and no figures;
- data pages that were about 95% numbers;
- no About page and no Contact page;
- a third-party script (Travelpayouts Drive) rewriting links on every page.

That combination is what AdSense calls "low value content". The fix is content,
and it is now in the repository.

---

## What changed

| Area | Before | Now |
|---|---|---|
| Guides | 9, about 3,000 words in total | 21, about 23,700 words, 800–1,400 each |
| Byline and dates | None | Author, published and updated dates on every guide, and in Article markup |
| Original data in guides | None | Eight guides carry a table computed from tracked prices at request time |
| Guide FAQs | None | Visible FAQ on every guide, with matching FAQ markup |
| Data pages | A sentence or two of prose | A written explainer and FAQ under hotels, tickets, Express, waits, crowd calendar and the trip planner |
| Hotel pages | Rate table only | A written profile of each of the 12 hotels |
| Home page | No description of the site | "What RateCoaster is" and six featured guides |
| About / Contact | Mailto link only | `/about` and `/contact`, linked from the footer and in the sitemap |
| Travelpayouts Drive | Loaded on every public page | Off unless `TRAVELPAYOUTS_DRIVE_ENABLED=1` |
| Hotel category labels | "Premier", "Preferred" | "Signature Collection", Universal's current name |
| Image credits | Hotels page only | Footer, About, waits pages, guides index |

### Where things live

- Guides: `apps/web/src/content/guides/*.ts`, one file per topic. Types and
  lookups are in `apps/web/src/lib/guides.ts`.
- Live data boxes in guides: `apps/web/src/components/GuideLive.tsx`. A guide
  opts in with `live: "hotel-months"` and so on.
- Data-page explainers: `apps/web/src/content/explainers.ts`.
- Hotel profiles: `apps/web/src/content/hotel-profiles.ts`.
- Byline wording: `apps/web/src/content/site.ts`.

### Adding or revising a guide

Add an entry to the right file in `content/guides/`. Routing, the sitemap, the
byline, structured data, the index and "read next" all follow. When you revise
a guide, change its `updated` date. That date is printed on the page and sent
to Google as `dateModified` and as the sitemap's `lastModified`, so it must be
true.

Do not type prices into guide text. A hand-typed price is wrong within the
week. Use a `live` box, or describe the method and link the calendar.

---

## What you need to do

### 1. Read the guides and correct anything you know to be wrong

The guides were checked against Universal's published rules and recent
reporting on 2026-11-09, but you are the passholder. Read them as someone who
has stayed in these hotels. Where you have first-hand detail, add it: a
specific observation from a real stay is worth more to a reviewer, and to a
reader, than any amount of general advice. Things worth a second look because
Universal changes them often:

- which attractions accept Express (Hagrid's left on 2026-07-01);
- the Epic Universe early-entry line-up;
- annual pass rules for Epic Universe;
- Volcano Bay's reopening date (stated as on or before 2027-03-24);
- hotel transport details in `hotel-profiles.ts`.

### 2. Deploy, and leave Travelpayouts Drive off

Deploy as usual. Do not set `TRAVELPAYOUTS_DRIVE_ENABLED`. The hand-placed
affiliate buttons (Undercover Tourist and the flight links) are unaffected.
If you want Drive back after approval, set the variable to `1` and restart the
web service.

Leave the `NEXT_PUBLIC_ADSENSE_SLOT_*` variables blank until you are approved.
Blank slots render nothing; an empty ad box during review counts against you.

### 3. Turn on Google's consent message

The privacy policy says a consent message is shown where required. Nothing
shows one yet. This is configured in the AdSense dashboard, not in code:

1. AdSense → **Privacy & messaging**.
2. **European regulations** → create a message → choose the three-option
   layout (Consent / Do not consent / Manage options) → add `ratecoaster.net`
   → set the privacy policy URL to `https://www.ratecoaster.net/privacy` →
   Publish.
3. **US state regulations** → create a message → Publish.

Menu labels in the dashboard change from time to time, so the wording may differ slightly. The message is served by the AdSense script that is already on the page. No
code change is needed. Google requires a certified consent platform for
personalised ads in the EEA, UK and Switzerland, and its own message is one.

### 4. Replace the ride and hotel images

You chose to keep the current images, so credits were added and nothing was
removed. The risk remains: the ride thumbnails are Universal's own website
assets and the hotel photos are Loews press images. Copyrighted material is an
AdSense policy issue and a takedown risk in its own right. When you can,
replace them with your own photographs, starting with the home-page hero and
the hotel photos, which appear on the most pages. `ride-images.json` and
`hotel-images.json` control which images are used; removing an entry falls
back to a placeholder.

### 5. Check indexing in Search Console

1. **Sitemaps** → confirm `sitemap.xml` was read after the deploy and lists
   about 46 URLs (13 static, 21 guides, 12 hotel pages).
2. **URL inspection** → test the live URL for `/guides`, two guides, `/about`
   and one hotel page. The rendered HTML should contain the article text.
3. **Pages** → wait until the new guides move from "Discovered" or "Crawled"
   to "Indexed". Request indexing for `/about`, `/contact`, `/guides` and the
   four or five guides you think are strongest.

### 6. Reapply

Wait until most of the new pages are indexed, which usually takes one to three
weeks, then request review in AdSense → Sites. Reapplying before Google has
crawled the new content gets the old content reviewed again.

---

## Pre-submission checklist

- [ ] Every guide opens, shows a byline and two dates, and has no empty tables.
- [ ] `/about` and `/contact` open and are linked in the footer.
- [ ] `https://www.ratecoaster.net/ads.txt` still returns the Google line.
- [ ] View source on the home page: no `emrld.ltd` script (Drive is off).
- [ ] A consent message appears when the site is opened from an EU location.
- [ ] No "Advertisement" boxes are visible anywhere.
- [ ] No page shows the demo-mode banner in production.
- [ ] Search Console shows the guides as indexed.

---

## Things that will not help

- Publishing many short pages to raise the page count. Thin pages are the
  problem being fixed.
- Splitting one guide into several near-duplicates by year or keyword.
- Buying traffic or links before review.
- Adding FAQ markup for questions that are not printed on the page.
