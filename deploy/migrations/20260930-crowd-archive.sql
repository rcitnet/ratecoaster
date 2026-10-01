BEGIN;
CREATE TABLE IF NOT EXISTS crowd_daily_history (
  park_slug text NOT NULL,
  date date NOT NULL,
  park jsonb NOT NULL,
  estimate jsonb NOT NULL,
  sources jsonb NOT NULL,
  model_version text NOT NULL,
  reconstructed boolean NOT NULL DEFAULT false,
  captured_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  CONSTRAINT crowd_daily_history_has_signal CHECK (jsonb_array_length(estimate->'signals') > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS crowd_daily_history_park_date_uq ON crowd_daily_history (park_slug, date);
CREATE TABLE IF NOT EXISTS crowd_archive_health (
  park_slug text PRIMARY KEY,
  park_name text NOT NULL,
  checked_at timestamptz NOT NULL,
  issues jsonb NOT NULL
);
COMMIT;
