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
- Threads and Bluesky use their official APIs. X is never automated: the admin
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

## Enabling and testing

Deploy first so `npm run db:push` creates the queue tables. Then open
`/admin/social`:

1. Enable one platform.
2. Leave it in dry run and select **Generate now**.
3. Review the copy in the publishing queue.
4. For Threads or Bluesky, select **Go live**, then **Publish eligible now**.
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
