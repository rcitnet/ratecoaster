# RateCoaster social publishing

RateCoaster prepares one fresh park update per hour while a covered park is
open, plus one rotating Orlando hotel-category deal at 8 AM Eastern. The job
reads the existing database; it never scrapes a social network.

## Safety model

- Every platform starts disabled and in dry run.
- Wait posts require three operating rides observed in the last 15 minutes and
  authoritative published park hours showing the park is open.
- A deterministic hourly rotation provides variety without duplicate-prone
  randomness.
- A database fingerprint makes cron retries idempotent.
- Posts expire: wait updates after 50 minutes, hotel deals after 24 hours.
- Threads, Bluesky, Facebook Pages and Instagram use their official APIs. X is never automated: the admin
  opens X's official composer and a person confirms the post.
- A failed or ambiguous delivery is not retried automatically.

## Threads setup

1. Create a Meta developer app with the Threads use case.
2. Authorize the RateCoaster Threads account with `threads_basic` and
   `threads_content_publish`.
3. Exchange the short-lived token for a long-lived token.
4. Put the Threads user id, token and expiration date in `.env`:

   ```text
   THREADS_USER_ID=...
   THREADS_ACCESS_TOKEN=...
   THREADS_TOKEN_EXPIRES_AT=2026-10-24T00:00:00Z
   ```

Threads long-lived tokens expire. Refresh the token before the date displayed
in the admin panel, then update `.env` and restart the API service.

## Bluesky setup

1. Create the RateCoaster Bluesky account.
2. In account settings, create a dedicated app password. Do not use the main
   account password.
3. Add the handle and app password to `.env`:

   ```text
   BLUESKY_IDENTIFIER=ratecoaster.bsky.social
   BLUESKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
   BLUESKY_PDS_URL=https://bsky.social
   ```

## Facebook Page setup

1. Use the RateCoaster Facebook **Page**, with a Meta app authorized to publish
   as that Page. Personal-profile posting is not supported by this integration.
2. Obtain a Page access token with `pages_manage_posts` and
   `pages_read_engagement`, authorized by someone with the Page's content creation
   task. `pages_show_list` is used when selecting the Page during authorization.
3. Set `FACEBOOK_PAGE_ID` and `FACEBOOK_PAGE_ACCESS_TOKEN` in the server `.env`.
   Optionally record `FACEBOOK_TOKEN_EXPIRES_AT` as an ISO timestamp. Expired or
   malformed recorded expirations block publishing. Revoked tokens fail at Meta.
4. Restart the API and use the admin dry run before going live.

Facebook publishes the saved text and a link preview via `/{page-id}/feed`.
See [Meta's Pages publishing documentation](https://developers.facebook.com/docs/pages-api/posts/).

## Instagram setup and images

1. Use a Business or Creator Instagram account and configure **Instagram API
   with Instagram Login** in the Meta app. This integration uses
   `graph.instagram.com`; it does not use Facebook Login tokens.
2. Authorize `instagram_business_basic` and `instagram_business_content_publish`.
   Set `INSTAGRAM_USER_ID` and `INSTAGRAM_ACCESS_TOKEN` in the server `.env`.
   Use a long-lived token and record `INSTAGRAM_TOKEN_EXPIRES_AT` if known.
   Renew it through Meta before expiry and restart the API after replacement;
   this integration does not refresh tokens automatically.
3. Set `SOCIAL_PUBLIC_API_URL=https://ratecoaster.net/api` (or your public API
   base). The `/api` suffix is required with the supplied Caddy configuration.
   A localhost URL or a URL behind login will not work for Meta's media fetcher.
4. Enable Instagram in dry run, generate a post and open **Preview Instagram
   image**. Verify that the link also opens without signing in.

Each Instagram delivery uses a 1080 × 1080 JPEG card rendered from the saved
post's exact wait-time or hotel-deal snapshot, with RateCoaster branding and
the source attribution. The caption includes the saved post and destination
URL; Instagram captions do not provide ordinary clickable link previews.
There is no photo upload or separate image service to configure. The public
image endpoint is `/v1/social/posts/{post-id}/image.jpg`; only generated editorial
copy is exposed, with no public listing. Cards remain available after the queue
item expires. The publisher still refuses expired queue items.

The publisher creates a media container, checks readiness, and publishes it
once. Processing errors and ambiguous timeouts require inspection before
manual retry. A failed permalink lookup does not retry an already published
post. This first integration supports image feed posts, not Reels or Stories.

Both Meta integrations pin `META_GRAPH_API_VERSION=v25.0`; change this setting
when upgrading to a tested Graph API version. Credentials stay on the server.
Meta may require App Review/Advanced Access for accounts outside your app's
roles; complete the access requirements shown in your Meta app dashboard.
See [Meta's Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api).

## X and a desktop companion

The existing **Review on X** button opens an official Web Intent with the draft
filled in. A person submits it and then marks it posted in RateCoaster.

A desktop companion could show the queue, remind you about drafts and open
the same composer. It would still require the final click. An unattended
browser-clicking app is technically possible, but
[X's automation rules](https://help.x.com/en/rules-and-policies/x-automation)
explicitly prohibit non-API automation and warn of permanent suspension.
No desktop app or unattended X publisher is included in this change.

For supported fully automatic X posting, use the official API. As checked on
September 9, 2026, [X's pricing page](https://docs.x.com/x-api/getting-started/pricing)
lists pay-per-use pricing: $0.015 per post creation and $0.200 for a post
containing a URL. RateCoaster's current drafts include URLs, so budget using
the latter: 10 posts/day for 30 days would be approximately $60 in posting
charges, excluding reads and other actions. Verify the current Developer
Console price before enabling a paid integration. No X API spending is enabled.

## Enabling and testing

Deploy first so `npm run db:push` creates the queue tables and adds the
`facebook` and `instagram` values to the existing `social_platform` enum. No
existing queue data needs to be removed. Install dependencies with `npm ci`
(the API now directly depends on Sharp for JPEG generation). The supplied
bootstrap/update scripts install `fontconfig` and `fonts-dejavu-core`; install
those packages too if deploying manually to a minimal Linux server. Then open
`/admin/social`:

1. Enable one platform.
2. Leave it in dry run and select **Generate now**.
3. Review the copy in the publishing queue.
4. For Threads, Bluesky, Facebook or Instagram, select **Go live**, then **Publish eligible now**.
5. For X, select **Review on X** and confirm the post in X's composer. Return to
   RateCoaster and select **Mark posted**.

The production cron runs the publisher at eight minutes past every hour. Logs
are written to `/home/ratecoaster/logs/social.log`.

## Manual command

Preview only:

```bash
npm run -w @ratecoaster/api social:publish
```

Honor live admin settings and publish eligible automatic deliveries:

```bash
npm run -w @ratecoaster/api social:publish -- --send
```
