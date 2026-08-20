-- Precompute per-brand+model aggregate statistics into stats_model.
--
-- Run AFTER the monthly ingest, on/near the DB host (single-pass aggregations over
-- the full registry + companion tables — too heavy for request time; see the plan
-- doc). Idempotent: rebuilds stats_model from scratch each run.
--
--   psql '<ADMIN_URL>' -v min_count=500 -f scripts/compute-stats.sql
--
-- min_count (default 500) is the publish floor: statistical honesty, k-anonymity,
-- and crawl budget. Raised from 100 on 2026-08-20 — GSC showed 2 180 of 2 273
-- urls discovered and never crawled, so fewer, richer pages beat more thin ones.
-- At 500 the set is 749 pages covering 96.4% of vehicles; 500 cars still carry
-- ~2 500 inspections behind stk_fail_pct, so this is not honesty traded for size.
-- Nothing below it lands in the table, so nothing below it can ever be served.

\if :{?min_count}
\else
  \set min_count 500
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
-- Fold engine/drivetrain variants of the same car into one cohort.
--
-- The registry's obchodni_oznaceni mixes the model name with whatever the
-- importer typed: "OCTAVIA", "OCTAVIA 1.9 TDI", "BERLINGO 1.6 HDI". Published
-- separately those are near-duplicate pages that split one car's search signal
-- and spend crawl budget Google is already rationing (GSC 2026-08-19: 2 180 of
-- 2 273 URLs discovered and never crawled).
--
-- Body styles are deliberately NOT folded. "A4 AVANT" holds more vehicles than
-- "A4" (19 044 vs 16 100) and is searched as its own car; merging them would
-- destroy a cohort rather than consolidate one.
CREATE OR REPLACE FUNCTION pg_temp.fold_model(m text) RETURNS text AS $$
DECLARE
  s text := btrim(regexp_replace(coalesce(m, ''), '\s+', ' ', 'g'));
  t text;
BEGIN
  t := s;
  -- Drivetrain with power and fuel glued on: XDRIVE30D, 4MATIC250, QUATTRO...
  t := regexp_replace(t, '\y(XDRIVE|4MATIC|QUATTRO)[0-9]+[A-Z]?\y', ' ', 'gi');
  -- Displacement, optionally with the fuel letters attached: 1.6, 1.4I, 2.0HDI
  t := regexp_replace(t, '\y[0-9]\.[0-9]+[A-Z]{0,4}\y', ' ', 'gi');
  -- Valve count and power figures: 16V, 150CV, 210KW
  t := regexp_replace(t, '\y[0-9]{1,2}V\y', ' ', 'gi');
  t := regexp_replace(t, '\y[0-9]{2,4}(CV|KW|PS|HP)\y', ' ', 'gi');
  -- Engine family codes and drivetrain markers standing alone. The trailing
  -- group (TD..D5) are maker-specific engine designations — Volvo's D5 in
  -- "XC90 D5 AWD", Land Rover's TD4/SD4 — not model names.
  t := regexp_replace(t,
    '\y(TDI|TDCI|CDTI|DTI|HDI|JTD|JTDM|JTDM2|CDI|CRDI|CRDTI|TSI|TFSI|DCI|MPI|BLUETEC|BLUEHDI|ECOTEC|MULTIJET|D4D|DID|TD|TD4|SD4|D2|D3|D4|D5)\y',
    ' ', 'gi');
  -- The trailing (\+|\y) matters: Mercedes writes "4MATIC+" and even
  -- "4MATIC+COUPE", where a plain \y boundary strips 4MATIC and leaves a
  -- dangling "+". Anchoring on the plus OR a boundary handles both, while the
  -- leading \y keeps real names safe — QUATTROPORTE must not become "PORTE".
  t := regexp_replace(t, '\y(XDRIVE|4MATIC|4-MATIC|QUATTRO|AWD|4WD|4X4|ALL4)(\+|\y)', ' ', 'gi');
  t := btrim(regexp_replace(t, '\s+', ' ', 'g'));

  -- Spacing is not consistent in the registry: 58 cohorts write "320D" and 48
  -- write "320 D" for the same car. Normalise to the spaced form so they group.
  t := regexp_replace(t, '\y([0-9]{3})([DI])\y', '\1 \2', 'gi');

  -- A trailing lone D or I is a fuel marker only when something else was already
  -- stripped: "X5 3.0 D" is an X5. But when it follows a three-digit model
  -- number it IS the name — BMW's "320 D" and "320 I" are different cars — so
  -- that shape is exempt. This matters after the normalisation above, which
  -- turns "320D XDRIVE" into "320 D" and would otherwise lose the D.
  IF t <> s AND t ~* '\s[DI]$' AND t !~* '\y[0-9]{3}\s+[DI]$' THEN
    t := btrim(regexp_replace(t, '\s+[DI]$', '', 'i'));
  END IF;

  -- Never fold a name out of existence.
  IF t = '' THEN RETURN s; END IF;
  RETURN t;
END $$ LANGUAGE plpgsql IMMUTABLE;


-- URL slug, character-for-character identical to slugSql() in api/_statsData.ts
-- and slugify() in the same file. All three must agree or an emitted alias will
-- point at a URL that does not resolve; there is a cross-check in the run notes.
CREATE OR REPLACE FUNCTION pg_temp.slugify(s text) RETURNS text AS $slug$
  SELECT btrim(regexp_replace(
    translate(lower($1),
      'àáâãäåçèéêëìíîïðñòóôõöùúûüýÿčďěňřšťůž',
      'aaaaaaceeeeiiiidnooooouuuuyycdenrstuz'),
    '[^a-z0-9]+', '-', 'g'), '-')
$slug$ LANGUAGE sql IMMUTABLE;

CREATE TEMP TABLE _base ON COMMIT DROP AS
SELECT
  -- Brand-alias normalisation: the registry's free-text tovarni_znacka carries
  -- the same maker under several strings (sub-brands, legal names, diacritic and
  -- OEM-service variants). Fold them to one canonical brand BEFORE grouping so
  -- their cohorts merge (e.g. CITROEN + CITROËN → one CITROËN, VW → VOLKSWAGEN).
  -- NOTE: retired source-brand slugs (e.g. mercedes-amg -> mercedes-benz) are
  -- 308-redirected to their canonical target in vercel.json -> "redirects", so
  -- URLs indexed before a fold keep their ranking. Keep the two lists in sync:
  -- add/remove a redirect there whenever this CASE changes (skip folds whose
  -- source and target slugify identically, e.g. CITROEN -> CITROEN = "citroen").
  CASE upper(btrim(tovarni_znacka))
    WHEN 'BMW I'                          THEN 'BMW'
    WHEN 'CITROEN'                        THEN 'CITROËN'
    WHEN 'TESLA MOTORS'                   THEN 'TESLA'
    WHEN 'VW'                             THEN 'VOLKSWAGEN'
    WHEN 'VOLKSWAGEN/FD SERVIS'           THEN 'VOLKSWAGEN'
    WHEN 'FORD-CNG-TECHNIK'               THEN 'FORD'
    WHEN 'ŠKODA OCTAVIA'                  THEN 'ŠKODA'
    WHEN 'VAZ'                            THEN 'LADA'
    WHEN 'LADA - VAZ'                     THEN 'LADA'
    WHEN 'GM DAEWOO'                      THEN 'DAEWOO'
    WHEN 'MCC'                            THEN 'SMART'
    WHEN 'MICRO COMPACT CAR SMART'        THEN 'SMART'
    WHEN 'KG MOBILITY'                    THEN 'SSANGYONG'
    WHEN 'MERCEDES-AMG'                   THEN 'MERCEDES-BENZ'
    WHEN 'AUTOMOBILI LAMBORGHINI S.P.A.'  THEN 'LAMBORGHINI'
    ELSE btrim(tovarni_znacka)
  END                                                        AS brand,
  -- Model-variant fold (see pg_temp.fold_model above): engine and drivetrain
  -- tokens are stripped so "OCTAVIA 1.9 TDI" and "OCTAVIA" are one cohort.
  -- Body styles are NOT folded — "A4 AVANT" is its own car. Measured effect on
  -- the 2026-08 snapshot: 2 273 cohorts -> 1 769.
  -- NOTE: retired model slugs are 308-redirected by api/stats.ts, which applies
  -- the same fold to an unmatched slug rather than listing them in vercel.json.
  pg_temp.fold_model(obchodni_oznaceni)                      AS model,
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

-- S0a: collapse spelling variants of the same model onto one canonical name.
--
-- STK and registry data is typed by people with no enum to pick from, so the
-- same car arrives spelled several ways: "i 30" / "I 30" / "i30", "cee-d" /
-- "ceed", "XC60" / "XC-60". Two separate problems fall out of that:
--
--   1. Variants that slugify identically ("i 30" and "I 30" are both "i-30")
--      used to produce TWO cohorts sharing ONE url. getModelStatsBySlug matches
--      with LIMIT 1 and no ORDER BY, so one was served and the other's vehicles
--      appeared nowhere. Measured 2026-08-19: 25 such urls, 53 cohorts.
--   2. Variants whose slugs differ only by separators ("cee-d" vs "ceed") stayed
--      apart entirely — two full pages for one car, 29 750 vehicles on the
--      lesser duplicate across 27 groups.
--
-- Both vanish if the grouping key is the slug with separators removed, because
-- that key IS the url space: anything colliding in it is the same page by
-- definition, so no list of normalisation rules has to be kept complete.
-- The canonical display name is the variant with the most vehicles, so the url
-- that already carries the traffic and the crawl history keeps its address.
CREATE TEMP TABLE _canon ON COMMIT DROP AS
SELECT brand, key, (array_agg(model ORDER BY n DESC, model))[1] AS canon
FROM (
  SELECT brand,
         replace(pg_temp.slugify(model), '-', '') AS key,
         model,
         count(*) AS n
  FROM _base
  GROUP BY 1, 2, 3
) x
GROUP BY brand, key;
CREATE INDEX ON _canon (brand, key);

UPDATE _base b
SET model = c.canon
FROM _canon c
WHERE c.brand = b.brand
  AND c.key = replace(pg_temp.slugify(b.model), '-', '')
  AND b.model <> c.canon;

-- Cohorts that clear the publish floor. Everything else is dropped here, so no
-- sub-threshold row is ever computed further or served.
CREATE TEMP TABLE _cohort ON COMMIT DROP AS
SELECT brand, model, count(*) AS vehicle_count,
       min(reg_year) AS first_year, max(reg_year) AS last_year,
       round(avg(EXTRACT(YEAR FROM now())::int - reg_year), 1) AS avg_age_years
FROM _base
-- Some registry rows carry an engine spec where the model name belongs
-- ("1.0 12V", "1.3CDTI 16V" — 3 cohorts, ~1 000 Opels in the 2026-08 snapshot).
-- After the fold those strings are empty of any name, and a page titled
-- "Opel 1.0 12V" helps nobody. Excluded HERE rather than in _base on purpose:
-- the vehicles are still Opels and must keep counting toward brand-level
-- aggregates, they just do not deserve a model page of their own.
WHERE model ~ '[A-Za-z0-9]'
  AND btrim(regexp_replace(
        regexp_replace(model, '\y[0-9]\.[0-9]+[A-Z]{0,4}\y|\y[0-9]{1,2}V\y', ' ', 'gi'),
        '\s+', ' ', 'g')) <> ''
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

-- Record every slug the fold retired, so api/stats.ts can 308 instead of 404.
-- Source rows are the RAW registry strings from the same cohort definition as
-- _base; a row is emitted only when folding actually changed the slug, and only
-- when the target survived the publish floor (an alias pointing at an unpublished
-- cohort would redirect a crawler to a 404, which is worse than the 404 itself).
TRUNCATE stats_model_alias;
INSERT INTO stats_model_alias (brand_slug, old_slug, model_slug)
SELECT DISTINCT
  pg_temp.slugify(b.brand),
  pg_temp.slugify(btrim(regexp_replace(r.obchodni_oznaceni, '\s+', ' ', 'g'))),
  pg_temp.slugify(b.model)
FROM _base b
JOIN vehicle_registry r ON r.pcv = b.pcv
JOIN stats_model sm ON sm.brand = b.brand AND sm.model = b.model
WHERE pg_temp.slugify(btrim(regexp_replace(r.obchodni_oznaceni, '\s+', ' ', 'g')))
      <> pg_temp.slugify(b.model)
ON CONFLICT (brand_slug, old_slug) DO NOTHING;

-- Assert the url space is sound before committing. Both checks are inside the
-- transaction, so a violation rolls the whole rebuild back rather than shipping
-- a table where some cohort is unreachable. This is cheap (hundreds of rows) and
-- guards the exact failure S0a was written to remove.
DO $check$
DECLARE
  dupes int;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT pg_temp.slugify(brand) AS b, pg_temp.slugify(model) AS m
    FROM stats_model GROUP BY 1, 2 HAVING count(*) > 1
  ) x;
  IF dupes > 0 THEN
    RAISE EXCEPTION
      'stats_model has % url(s) served by more than one cohort — getModelStatsBySlug would pick one arbitrarily and hide the rest', dupes;
  END IF;

  SELECT count(*) INTO dupes FROM (
    SELECT pg_temp.slugify(brand) AS b,
           replace(pg_temp.slugify(model), '-', '') AS k
    FROM stats_model GROUP BY 1, 2 HAVING count(*) > 1
  ) y;
  IF dupes > 0 THEN
    RAISE EXCEPTION
      'stats_model has % model(s) still split across separator spellings (e.g. cee-d vs ceed) — the canonicalisation did not run or did not cover them', dupes;
  END IF;
END
$check$;

COMMIT;

ANALYZE stats_model;

\echo '--- stats_model row count ---'
SELECT count(*) AS cohorts_published FROM stats_model;
