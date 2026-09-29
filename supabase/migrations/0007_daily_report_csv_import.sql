-- Tracks whether a daily report has already been bulk-filled from a CSV
-- upload, so office accounts (unlike admins) can only do that once per day —
-- a business rule the app enforces client-side, this column just gives it
-- something to check. Nullable so existing rows are unaffected.
alter table public.daily_reports add column if not exists csv_imported_at timestamptz;
