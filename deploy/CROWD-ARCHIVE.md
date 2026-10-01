# Permanent crowd history

The hourly `crowds:archive` job stores a park/date estimate, its source values
and observation times, park metadata, and model version. Past dates are never
overwritten. Future dates refresh until they become historical. The tables have
no automatic expiry and no catalogue foreign keys, so retiring or removing a
hotel, ticket product, or park cannot remove saved history.

Scores are demand estimates from pricing, not measured attendance. The initial
`--backfill` reconstructs older dates only where real retained pricing exists.
Reconstructed records are marked separately. Missing dates are not invented.
Monthly normalization matches the calendar's normal month view.

## Deployment

1. Apply `deploy/migrations/20260930-crowd-archive.sql`. This additive migration
   creates only the archive tables; do not run a broad schema push for this release.
2. Load the production environment and run
   `npm run -w @ratecoaster/api crowds:archive -- --backfill` before activating
   the new API, so historical requests immediately have saved records.
3. Install the single hourly line from `deploy/ratecoaster.cron`, preserving
   any other jobs already on the host. The database advisory lock and `flock`
   prevent overlapping runs. Server cron runs at minute 54 of each hour.

Exit 0 means healthy or an overlapping run was skipped. Exit 2 means archiving
succeeded but coverage/freshness warnings were saved. Exit 1 means the archive
failed. Neither a failed run nor a warning deletes previously saved history.

## Admin warnings

The admin overview highlights parks needing attention. `/admin/status` shows
saved and finalized date counts, ranges, last check, missing dates, and stale
signals. No emails are sent.

Checks cover yesterday plus the next 30 dates. Freshness checks cover the next
seven dates and use 48 hours for ticket prices, 12 hours for Express, and 24
hours for hotels. An archive check older than three hours raises a separate
warning even if the scheduler stopped completely. Fix the relevant collector
or job, then rerun the archive; healthy checks clear the active warnings.

The application account can update live forecasts but the job's conflict guard
prevents overwriting completed dates. There are no user-facing edit/delete
routes for archived estimates. Include both archive tables in database backups.
