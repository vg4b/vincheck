-- Precompute per-IČO fleet aggregates into fleet_stats (see migration 012).
--
-- Run AFTER the monthly ingest, on/near the DB host with the ADMIN user (the
-- read-only app user cannot write). Single-pass aggregation over the whole
-- owners->registry graph — far too heavy for request time (a big fleet needs
-- 100k+ random heap reads), so it is materialised here once a month. Idempotent:
-- rebuilds fleet_stats from scratch each run.
--
--   psql '<ADMIN connection string>' -f scripts/compute-fleet-stats.sql
--
-- This is a large batch: `veh` groups ~90M owner rows and joins the 19M-row
-- registry, so it wants temp space and a few minutes. Wrapped in a transaction —
-- on failure the previous contents survive (nothing is served stale because the
-- TRUNCATE only commits with the successful INSERT).
--
-- Keep TOP_BRANDS (8) in sync with TOP_BRANDS in src/pages/FleetPage.tsx.

BEGIN;

-- This build joins the whole owners->registry graph; a server/role default
-- statement_timeout would kill it mid-run. Belt-and-suspenders with the
-- PGOPTIONS='-c statement_timeout=0' the refresh skill passes on the CLI.
SET LOCAL statement_timeout = 0;

TRUNCATE fleet_stats;

INSERT INTO fleet_stats (ico, total, current, min_rok, max_rok, brands, source_snapshot)
WITH veh AS MATERIALIZED (
  -- One row per (IČO, vehicle), with a "currently owned/operated" flag folded
  -- across the subject's owner+operator+co-owner rows for that vehicle.
  SELECT o.ico, o.pcv, bool_or(o.aktualni = 'True') AS current
  FROM vehicle_owners o
  WHERE o.ico IS NOT NULL AND o.ico <> ''
  GROUP BY o.ico, o.pcv
),
j AS MATERIALIZED (
  -- Attach the vehicle attributes we aggregate on. Bad year strings -> NULL.
  SELECT veh.ico,
         veh.current,
         CASE WHEN r.rok_vyroby ~ '^[0-9]{4}$' THEN r.rok_vyroby::int END AS rok,
         NULLIF(r.tovarni_znacka, '') AS znacka
  FROM veh
  JOIN vehicle_registry r ON r.pcv = veh.pcv
),
agg AS (
  SELECT ico,
         count(*)::int AS total,
         count(*) FILTER (WHERE current)::int AS current,
         min(rok)::smallint AS min_rok,
         max(rok)::smallint AS max_rok
  FROM j
  GROUP BY ico
),
brand_counts AS (
  SELECT ico,
         znacka,
         count(*)::int AS n,
         row_number() OVER (PARTITION BY ico ORDER BY count(*) DESC, znacka) AS rn
  FROM j
  WHERE znacka IS NOT NULL
  GROUP BY ico, znacka
),
brands AS (
  SELECT ico,
         jsonb_agg(
           jsonb_build_object('znacka', znacka, 'n', n)
           ORDER BY n DESC, znacka
         ) AS brands
  FROM brand_counts
  WHERE rn <= 8
  GROUP BY ico
)
SELECT a.ico,
       a.total,
       a.current,
       a.min_rok,
       a.max_rok,
       COALESCE(b.brands, '[]'::jsonb),
       (SELECT source_snapshot::date FROM cache_meta WHERE dataset = 'vlastnik_provozovatel')
FROM agg a
LEFT JOIN brands b ON b.ico = a.ico;

COMMIT;

ANALYZE fleet_stats;
