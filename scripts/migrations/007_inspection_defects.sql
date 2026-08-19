-- Per-inspection defect codes + two enum fields from the ISTP open data.
--
-- ADDITIVE ONLY. Seven nullable columns on an existing table — no TRUNCATE, no
-- index changes, no rewrite of the other cache tables. On PostgreSQL 11+ adding
-- a nullable column with no default is a catalog-only change, so this does NOT
-- rewrite the ~90.7M-row heap and does not block the live lookup path
-- (api/_vehicleCache.ts). Verified server version: 17.10.
--
-- No new grant is needed: vincheck_api holds a TABLE-level SELECT on this
-- table, which automatically covers columns added later.
--
-- Storage shape (variant C — widen the row rather than add a ~139M-row table):
--   zavady_a/b/c      counts by severity. ALWAYS written for a parsed record,
--                     0 included — these are the "we have a record" signal.
--   zavady_kody       defect codes, in document order. NULL when there were no
--                     defects; an empty array would cost ~16 B on each of the
--                     52.9M clean inspections (~0.8 GB) to say nothing.
--   zavady_zavaznosti severity letters as a compact string, one char per defect,
--                     POSITIONALLY ALIGNED with zavady_kody: "BBA" means the
--                     1st code is B, the 2nd B, the 3rd A. A second TEXT[] would
--                     add a 24 B array header + 4 B/element padding per row
--                     (~1.3 GB) to carry one character each.
--
-- INVARIANT: length(zavady_zavaznosti) = array_length(zavady_kody, 1), and both
-- are written together in a single UPSERT from one parse loop.
--
-- Severity must travel WITH the code: ~27% of historical codes are absent from
-- the vyhláška catalog, so their severity could not be recovered from it.
--
-- Reading "no record" vs "no defects" — the read layer depends on this:
--   zavady_a IS NULL      = no ISTP record for this inspection (not backfilled)
--                           → UI must say "závady neuvedeny".
--   zavady_a = 0 AND
--     zavady_kody IS NULL = inspection recorded, zero defects → "bez závad".
-- Never conflate the two.
--
-- Apply as the ADMIN user (the ingest script can also apply it via
-- --apply-schema):
--   psql '<ADMIN connection string>' -f scripts/migrations/007_inspection_defects.sql

ALTER TABLE vehicle_inspection_odometer
  ADD COLUMN IF NOT EXISTS zavady_a          SMALLINT,
  ADD COLUMN IF NOT EXISTS zavady_b          SMALLINT,
  ADD COLUMN IF NOT EXISTS zavady_c          SMALLINT,
  ADD COLUMN IF NOT EXISTS zavady_kody       TEXT[],
  ADD COLUMN IF NOT EXISTS zavady_zavaznosti TEXT,
  ADD COLUMN IF NOT EXISTS rozsah            TEXT,
  ADD COLUMN IF NOT EXISTS emisni_system     TEXT;
