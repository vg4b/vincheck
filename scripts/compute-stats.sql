-- Precompute per-brand+model aggregate statistics into stats_model.
--
-- Run AFTER the monthly ingest, on/near the DB host (single-pass aggregations over
-- the full registry + companion tables — too heavy for request time; see the plan
-- doc). Idempotent: rebuilds stats_model from scratch each run.
--
--   psql '<ADMIN_URL>' -v min_count=100 -f scripts/compute-stats.sql
--
-- min_count (default 100) is the publish floor: statistical honesty + k-anonymity.
-- Nothing below it lands in the table, so nothing below it can ever be served.

\if :{?min_count}
\else
  \set min_count 100
\endif

-- Rolling age window for the cohort. Vehicles older than this are excluded — both
-- because the SEO/used-buyer value is in recent cars, and because model names
-- collide across eras (e.g. the 1960s Škoda Octavia and the modern one share the
-- name "OCTAVIA"; blending them makes avg_age and median-km meaningless). A 30-year
-- window keeps every published cohort commercially and statistically coherent.
\if :{?max_age_years}
\else
  \set max_age_years 30
\endif

BEGIN;

-- Base cohort: operated passenger cars (M1*) with a plausible first-registration
-- year and a non-empty model string. This is the join spine for every metric.
CREATE TEMP TABLE _base ON COMMIT DROP AS
SELECT
  tovarni_znacka                                             AS brand,
  btrim(regexp_replace(obchodni_oznaceni, '\s+', ' ', 'g'))  AS model,
  pcv,
  vin,
  substring(datum_prvni_registrace FROM '^(\d{4})')::int     AS reg_year,
  -- Fuel is stored as raw registry codes (BA, NM, "BA 95 B", "BA + LPG", junk
  -- ".") — fold into buyer-facing categories. LPG/CNG first so bi-fuel ("BA + LPG")
  -- lands there; NM (incl. "BIO NM") = diesel; BA* = petrol.
  CASE
    WHEN palivo IS NULL OR btrim(palivo) IN ('', '.') THEN 'Neuvedeno'
    WHEN upper(palivo) LIKE '%LPG%' THEN 'LPG'
    WHEN upper(palivo) LIKE '%CNG%' THEN 'CNG'
    WHEN upper(palivo) = 'EL' OR upper(palivo) LIKE 'EL %' THEN 'Elektro'
    WHEN upper(palivo) LIKE '%NM%' THEN 'Nafta'
    WHEN upper(palivo) LIKE 'BA%' THEN 'Benzín'
    ELSE 'Ostatní'
  END                                                        AS fuel,
  nullif(btrim(barva), '')                                   AS color
FROM vehicle_registry
WHERE status = 'PROVOZOVANÉ'
  AND kategorie_vozidla LIKE 'M1%'                    -- passenger cars only
  AND datum_prvni_registrace ~ '^(19[5-9]\d|20\d\d)' -- plausible year, drops sentinels
  AND substring(datum_prvni_registrace FROM '^(\d{4})')::int
      >= EXTRACT(YEAR FROM now())::int - :max_age_years  -- rolling age window
  AND btrim(obchodni_oznaceni) <> '';
CREATE INDEX ON _base (pcv);
CREATE INDEX ON _base (vin);
CREATE INDEX ON _base (brand, model);

-- Cohorts that clear the publish floor. Everything else is dropped here, so no
-- sub-threshold row is ever computed further or served.
CREATE TEMP TABLE _cohort ON COMMIT DROP AS
SELECT brand, model, count(*) AS vehicle_count,
       min(reg_year) AS first_year, max(reg_year) AS last_year,
       round(avg(EXTRACT(YEAR FROM now())::int - reg_year), 1) AS avg_age_years
FROM _base
GROUP BY brand, model
HAVING count(*) >= :min_count;
CREATE INDEX ON _cohort (brand, model);

-- Fuel split (fractions, rounded).
CREATE TEMP TABLE _fuel ON COMMIT DROP AS
SELECT brand, model, jsonb_object_agg(fuel, frac ORDER BY frac DESC) AS fuel_split
FROM (
  -- Fractions over vehicles with a KNOWN fuel, so the junk/unknown bucket doesn't
  -- show as a "0 %" row on the page.
  SELECT b.brand, b.model, b.fuel,
         round(count(*)::numeric / sum(count(*)) OVER (PARTITION BY b.brand, b.model), 3) AS frac
  FROM _base b JOIN _cohort c USING (brand, model)
  WHERE b.fuel <> 'Neuvedeno'
  GROUP BY b.brand, b.model, b.fuel
) x
GROUP BY brand, model;

-- Colour split — top 8 colours per cohort (the long tail is noise on a page).
CREATE TEMP TABLE _color ON COMMIT DROP AS
SELECT brand, model, jsonb_object_agg(color, frac ORDER BY frac DESC) AS color_split
FROM (
  SELECT brand, model, color, frac,
         row_number() OVER (PARTITION BY brand, model ORDER BY frac DESC) AS rn
  FROM (
    SELECT b.brand, b.model, b.color,
           round(count(*)::numeric / sum(count(*)) OVER (PARTITION BY b.brand, b.model), 3) AS frac
    FROM _base b JOIN _cohort c USING (brand, model)
    WHERE b.color IS NOT NULL
    GROUP BY b.brand, b.model, b.color
  ) y
) z
WHERE rn <= 8
GROUP BY brand, model;

-- Average owner count per vehicle (owner-type relations: 1 owner, 3 co-owner,
-- 4 acquirer; 2 is operator, excluded).
CREATE TEMP TABLE _owners ON COMMIT DROP AS
SELECT b.brand, b.model, round(avg(coalesce(oc.n, 0)), 2) AS avg_owners
FROM _base b
LEFT JOIN (
  SELECT pcv, count(*) AS n FROM vehicle_owners
  WHERE vztah_k_vozidlu IN ('1','3','4') GROUP BY pcv
) oc USING (pcv)
GROUP BY b.brand, b.model;

-- % imported (per vehicle, not per import row).
CREATE TEMP TABLE _imp ON COMMIT DROP AS
SELECT b.brand, b.model,
       round(avg(CASE WHEN im.pcv IS NOT NULL THEN 1 ELSE 0 END)::numeric, 3) AS pct_imported
FROM _base b
LEFT JOIN (SELECT DISTINCT pcv FROM vehicle_imports) im USING (pcv)
GROUP BY b.brand, b.model;

-- % on LPG/CNG, % with a tow bar (per vehicle; whitespace-normalised match, and a
-- removed tow bar still counts — the fitting happened). ABS/AIRBAG/ASR irrelevant.
CREATE TEMP TABLE _eq ON COMMIT DROP AS
SELECT b.brand, b.model,
       round(avg(CASE WHEN e.lpg THEN 1 ELSE 0 END)::numeric, 3) AS pct_lpg,
       round(avg(CASE WHEN e.tow THEN 1 ELSE 0 END)::numeric, 3) AS pct_towbar
FROM _base b
LEFT JOIN (
  SELECT pcv,
    bool_or(upper(regexp_replace(typ, '\s+', ' ', 'g')) = 'POHON PLYNEM') AS lpg,
    bool_or(upper(regexp_replace(typ, '\s+', ' ', 'g')) IN ('TAŽNÉ ZAŘÍZENÍ','ZÁVĚS')) AS tow
  FROM vehicle_equipment GROUP BY pcv
) e USING (pcv)
GROUP BY b.brand, b.model;

-- STK failure rate: share of REAL inspections (excl. synthetic kod_stk 9999)
-- ending in defects/unfit (stav B/C). Keep the denominator for honesty on the page.
CREATE TEMP TABLE _stk ON COMMIT DROP AS
SELECT b.brand, b.model,
       count(*) FILTER (WHERE coalesce(i.kod_stk,'') <> '9999')                             AS stk_inspections,
       round(100.0 * count(*) FILTER (WHERE i.stav IN ('B','C') AND coalesce(i.kod_stk,'') <> '9999')
             / nullif(count(*) FILTER (WHERE coalesce(i.kod_stk,'') <> '9999'), 0), 1)       AS stk_fail_pct
FROM _base b JOIN vehicle_inspections i USING (pcv)
GROUP BY b.brand, b.model;

-- Median mileage by vehicle age (years since first registration). Only ages with
-- enough readings (>= 20) so a page never shows a median off 3 cars.
CREATE TEMP TABLE _odo ON COMMIT DROP AS
SELECT brand, model, jsonb_object_agg(age::text, median_km ORDER BY age) AS median_km_by_age
FROM (
  SELECT b.brand, b.model,
         (substring(o.inspection_date::text FROM '^(\d{4})')::int - b.reg_year) AS age,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY o.odometer_km)::int        AS median_km,
         count(*) AS n
  FROM _base b JOIN vehicle_inspection_odometer o USING (vin)
  WHERE o.odometer_km BETWEEN 1 AND 3000000
  GROUP BY b.brand, b.model, age
) a
WHERE age BETWEEN 1 AND 25 AND n >= 20
GROUP BY brand, model;

-- Assemble.
TRUNCATE stats_model;
INSERT INTO stats_model (
  brand, model, vehicle_count, first_year, last_year, avg_age_years,
  fuel_split, avg_owners, pct_imported, pct_lpg, pct_towbar,
  stk_fail_pct, stk_inspections, median_km_by_age, color_split, computed_at
)
SELECT
  c.brand, c.model, c.vehicle_count, c.first_year, c.last_year, c.avg_age_years,
  f.fuel_split, o.avg_owners, im.pct_imported, eq.pct_lpg, eq.pct_towbar,
  s.stk_fail_pct, s.stk_inspections, od.median_km_by_age, cl.color_split, now()
FROM _cohort c
LEFT JOIN _fuel   f  USING (brand, model)
LEFT JOIN _owners o  USING (brand, model)
LEFT JOIN _imp    im USING (brand, model)
LEFT JOIN _eq     eq USING (brand, model)
LEFT JOIN _stk    s  USING (brand, model)
LEFT JOIN _odo    od USING (brand, model)
LEFT JOIN _color  cl USING (brand, model);

COMMIT;

ANALYZE stats_model;

\echo '--- stats_model row count ---'
SELECT count(*) AS cohorts_published FROM stats_model;
