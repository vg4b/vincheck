-- Precomputed aggregate statistics per brand+model, powering the public
-- programmatic-SEO pages (/znacky/:brand/:model, ranking lists).
--
-- ADDITIVE ONLY. Populated by scripts/compute-stats.sql after the monthly ingest.
-- Everything here is an AGGREGATE over >= STATS_MIN_COUNT vehicles — no VIN, no
-- owner, no individual vehicle ever lands in this table. That min-count is both a
-- statistical-honesty floor (a "failure rate" over 12 cars is noise) and a
-- k-anonymity guard. See docs/plans/2026-07-15-001-aggregate-seo-pages.md.
--
-- Small table (hundreds of rows), so ranking pages ("nejporuchovější vozy") are
-- just ORDER BY over it at render time — no separate ranking snapshot needed.

CREATE TABLE IF NOT EXISTS stats_model (
  brand             TEXT NOT NULL,   -- e.g. "ŠKODA"
  model             TEXT NOT NULL,   -- normalised, e.g. "OCTAVIA"
  vehicle_count     INT  NOT NULL,   -- operated vehicles in the cohort
  first_year        INT,             -- earliest first-registration year seen
  last_year         INT,
  avg_age_years     NUMERIC(4,1),
  fuel_split        JSONB,           -- {"Nafta":0.62,"Benzín":0.31,...} fractions
  avg_owners        NUMERIC(4,2),
  pct_imported      NUMERIC(4,3),    -- 0..1
  pct_lpg           NUMERIC(4,3),
  pct_towbar        NUMERIC(4,3),
  stk_fail_pct      NUMERIC(4,1),    -- % of real inspections ending in B/C
  stk_inspections   INT,             -- denominator behind stk_fail_pct (honesty)
  median_km_by_age  JSONB,           -- {"5":78000,"10":142000,...} age->median km
  color_split       JSONB,           -- {"Šedá":0.21,...} fractions, top colours
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (brand, model)
);

-- Read-only app user (created in 003). Role-guarded so this file is safe to apply
-- against a local dev DB that has no vincheck_api role (bare GRANT would abort).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vincheck_api') THEN
    GRANT SELECT ON stats_model TO vincheck_api;
  END IF;
END
$$;
