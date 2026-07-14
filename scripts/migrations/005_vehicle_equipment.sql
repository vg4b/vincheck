-- Additional equipment / modifications per vehicle (RSV_vozidla_doplnkove_vybaveni).
--
-- ADDITIVE ONLY. A brand-new table — it never TRUNCATEs, ALTERs, or drops indexes
-- on the existing cache tables, so applying it cannot affect the live lookup path
-- (api/_vehicleCache.ts). The read layer tolerates a missing table (42P01), so
-- this is safe to apply before or after the code that reads it.
--
-- ~12.5M rows / 8.5M distinct PČV, 1-8 rows per vehicle. Column order matches the
-- CSV header (PČV, Typ, Od, Do) so COPY needs no column list.
--
-- ABS / AIRBAG / ASR rows (35% of the file) are loaded but never displayed:
-- vehicle_registry already carries them as dedicated columns in a better form
-- (abs/asr are explicit True/False, airbag is a count). A missing row here means
-- "no record", not "no ABS" — see docs/plans/2026-07-14-001-*.md.
--
-- Apply as the ADMIN user:
--   psql '<ADMIN connection string>' -f scripts/migrations/005_vehicle_equipment.sql

CREATE TABLE IF NOT EXISTS vehicle_equipment (
  pcv       BIGINT,
  typ       TEXT,
  -- Fitted / removed dates. `do` is a reserved word, hence the trailing
  -- underscore; TEXT (not DATE) to match the ingest's COPY-robustness convention.
  od        TEXT,
  do_       TEXT
);

-- Per-vehicle lookup (the only read pattern we need).
CREATE INDEX IF NOT EXISTS vehicle_equipment_pcv_idx
  ON vehicle_equipment (pcv);

-- Read-only app user (created in 003). ALTER DEFAULT PRIVILEGES already covers
-- new tables, but grant explicitly for clarity. Guarded because the ingest script
-- applies this file on every run, including against local dev databases that have
-- no vincheck_api role (a bare GRANT would abort the run under ON_ERROR_STOP).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vincheck_api') THEN
    GRANT SELECT ON vehicle_equipment TO vincheck_api;
  END IF;
END
$$;
