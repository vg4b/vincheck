-- Per-IČO fleet aggregates, powering the true dashboard on the /firma/:ico page
-- (api/_vehicleCache.ts -> lookupVehiclesByIco reads this).
--
-- ADDITIVE ONLY. Populated by scripts/compute-fleet-stats.sql after the monthly
-- ingest. A big leasing fleet (e.g. ARVAL, IČO 26726998) has ~118k vehicles;
-- joining owners->registry over the whole fleet at request time needs 100k+
-- random heap reads and times out, so the page reads the true total / current /
-- year-range / brand mix from here instead. One row per IČO (a few hundred k
-- rows) — tiny next to vehicle_owners (90M) / vehicle_registry (19M).
--
-- Until this table is built the page degrades gracefully: it shows the exact
-- total (a cheap index-only distinct count) plus a newest-first sample, and
-- omits the current/year/brand breakdown.

CREATE TABLE IF NOT EXISTS fleet_stats (
  ico             TEXT PRIMARY KEY,
  total           INTEGER NOT NULL,          -- distinct vehicles ever tied to the IČO
  current         INTEGER NOT NULL,          -- of those, currently owned/operated
  min_rok         SMALLINT,                  -- earliest year of manufacture seen
  max_rok         SMALLINT,
  brands          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{"znacka":"ŠKODA","n":424}, ...] top 8
  source_snapshot DATE,                      -- registry snapshot the numbers reflect
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Read-only app user (created in 003). Role-guarded so this file is safe to apply
-- against a local dev DB that has no vincheck_api role (bare GRANT would abort).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vincheck_api') THEN
    GRANT SELECT ON fleet_stats TO vincheck_api;
  END IF;
END
$$;
