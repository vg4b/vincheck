-- Brand-level aggregates, powering the /znacky/:brand hub pages.
--
-- Mirrors stats_model (006). Same k-anonymity story: every row is an aggregate
-- over at least min_count vehicles and no VIN or owner is ever stored.
--
-- Why a table rather than aggregating stats_model at read time: two of the
-- metrics do not compose. median_km_by_age is a median, and a median of medians
-- is not a median; stk_fail_pct would need weighting by stk_inspections or a
-- 500-car model would count as much as a 700 000-car one. Both are only correct
-- when recomputed from the base cohort, which compute-stats.sql already has open.
--
-- NOTE: a brand's vehicle_count covers the WHOLE brand, including models below
-- the publish floor, so it is larger than the sum of the models listed on the
-- page. That is the honest number; the page says "nejčastější modely", never
-- "všechny modely".
--
-- ADDITIVE ONLY. Rebuilt wholesale by compute-stats.sql inside its transaction.

CREATE TABLE IF NOT EXISTS stats_brand (
  brand             TEXT PRIMARY KEY,
  vehicle_count     INT  NOT NULL,   -- whole brand, not the sum of published models
  model_count       INT  NOT NULL,   -- published cohorts on the hub
  first_year        INT,
  last_year         INT,
  avg_age_years     NUMERIC(4,1),
  fuel_split        JSONB,
  avg_owners        NUMERIC(4,2),
  pct_imported      NUMERIC(4,3),
  pct_lpg           NUMERIC(4,3),
  pct_towbar        NUMERIC(4,3),
  stk_fail_pct      NUMERIC(4,1),
  stk_inspections   INT,
  median_km_by_age  JSONB,
  color_split       JSONB,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-model motorisation breakdown (S5). The variant fold decides which cohorts
-- get a URL; it must not decide what gets computed. This keeps the engine
-- variants the fold merged, so the model page can show them as a section
-- instead of needing a URL level Google is already declining to crawl.
ALTER TABLE stats_model
  ADD COLUMN IF NOT EXISTS motorisations JSONB;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vincheck_api') THEN
    GRANT SELECT ON stats_brand TO vincheck_api;
  END IF;
END
$$;
