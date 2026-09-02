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
-- Theft window and the floor on its numerator. Five years holds ~6 745 thefts;
-- at a floor of 20 that leaves 43 publishable models, at 30 it leaves 24. Below
-- that a "rate" is two or three events wearing a decimal point.
\if :{?theft_from}
\else
  \set theft_from '2021-01-01'
\endif
\if :{?theft_to}
\else
  \set theft_to '2026-01-01'
\endif
\if :{?theft_min}
\else
  \set theft_min 20
\endif

\if :{?max_age_years}
\else
  \set max_age_years 30
\endif

BEGIN;

-- SAMPLE_BRAND: restrict the base cohort to one brand, for exercising the script
-- against a LOCAL fixture database (scripts/test-compute-stats.sh).
--
-- NEVER pass this against production. The script TRUNCATEs stats_model, so a run
-- that commits with a sample filter publishes that brand and deletes every other
-- one. It is only safe because the whole thing is one transaction — a run killed
-- partway rolls back, which is what saved production on 2026-08-20 when this was
-- pointed at it by mistake. Do not rely on that twice.
\if :{?sample_brand}
\else
  \set sample_brand ''
\endif

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
-- Brand-alias fold, as a function so the theft blocks below key on exactly the
-- same canonical brand as _base. It used to be an inline CASE; duplicating
-- sixteen WHEN clauses in a second place is how two lists drift apart.
CREATE OR REPLACE FUNCTION pg_temp.brand_fold(b text) RETURNS text AS $bf$
  SELECT CASE upper(btrim($1))
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
  ELSE btrim($1)
  END
$bf$ LANGUAGE sql IMMUTABLE;

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
  pg_temp.brand_fold(tovarni_znacka)                          AS brand,
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
  AND btrim(obchodni_oznaceni) <> ''
  AND (:'sample_brand' = '' OR upper(btrim(tovarni_znacka)) LIKE :'sample_brand' || '%');
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
GROUP BY GROUPING SETS ((brand, model), (brand))
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
  GROUP BY GROUPING SETS ((b.brand, b.model, b.fuel), (b.brand, b.fuel))
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
    GROUP BY GROUPING SETS ((b.brand, b.model, b.color), (b.brand, b.color))
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
GROUP BY GROUPING SETS ((b.brand, b.model), (b.brand));

-- % imported (per vehicle, not per import row).
CREATE TEMP TABLE _imp ON COMMIT DROP AS
SELECT b.brand, b.model,
       round(avg(CASE WHEN im.pcv IS NOT NULL THEN 1 ELSE 0 END)::numeric, 3) AS pct_imported
FROM _base b
LEFT JOIN (SELECT DISTINCT pcv FROM vehicle_imports) im USING (pcv)
GROUP BY GROUPING SETS ((b.brand, b.model), (b.brand));

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
GROUP BY GROUPING SETS ((b.brand, b.model), (b.brand));

-- STK failure rate: share of REAL inspections (excl. synthetic kod_stk 9999)
-- ending in defects/unfit (stav B/C). Keep the denominator for honesty on the page.
--
-- Origin split (see migration 013): the same rate for German imports (_de) vs
-- domestic cars (_domestic, no import record at all). Other-country imports are
-- in neither bucket, so the two are NOT a partition of the cohort. The two
-- LEFT JOINs each hash `vehicle_imports` (~3.4M rows) once and reuse it, so this
-- costs a couple of hash builds, not a second pass over the inspection join.
CREATE TEMP TABLE _stk ON COMMIT DROP AS
SELECT b.brand, b.model,
       count(*) FILTER (WHERE coalesce(i.kod_stk,'') <> '9999')                             AS stk_inspections,
       round(100.0 * count(*) FILTER (WHERE i.stav IN ('B','C') AND coalesce(i.kod_stk,'') <> '9999')
             / nullif(count(*) FILTER (WHERE coalesce(i.kod_stk,'') <> '9999'), 0), 1)       AS stk_fail_pct,
       -- German imports.
       count(*) FILTER (WHERE de.pcv IS NOT NULL AND coalesce(i.kod_stk,'') <> '9999')       AS stk_inspections_de,
       round(100.0 * count(*) FILTER (WHERE i.stav IN ('B','C') AND de.pcv IS NOT NULL AND coalesce(i.kod_stk,'') <> '9999')
             / nullif(count(*) FILTER (WHERE de.pcv IS NOT NULL AND coalesce(i.kod_stk,'') <> '9999'), 0), 1) AS stk_fail_pct_de,
       -- Domestic (no import record).
       count(*) FILTER (WHERE imp.pcv IS NULL AND coalesce(i.kod_stk,'') <> '9999')          AS stk_inspections_domestic,
       round(100.0 * count(*) FILTER (WHERE i.stav IN ('B','C') AND imp.pcv IS NULL AND coalesce(i.kod_stk,'') <> '9999')
             / nullif(count(*) FILTER (WHERE imp.pcv IS NULL AND coalesce(i.kod_stk,'') <> '9999'), 0), 1) AS stk_fail_pct_domestic
FROM _base b JOIN vehicle_inspections i USING (pcv)
LEFT JOIN (SELECT DISTINCT pcv FROM vehicle_imports)                              imp USING (pcv)
-- `stat` is the registry's full official country name, not a short label: the
-- German cohort is "Spolková republika Německo" (~2.0M rows), NOT "Německo".
-- (An older "Německá demokratická republika" GDR value exists too, ~22k, but
-- that defunct state is not what "dovoz z Německa" means for a used car today.)
LEFT JOIN (SELECT DISTINCT pcv FROM vehicle_imports WHERE btrim(stat) = 'Spolková republika Německo') de USING (pcv)
GROUP BY GROUPING SETS ((b.brand, b.model), (b.brand));

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
  GROUP BY GROUPING SETS ((b.brand, b.model, age), (b.brand, age))
) a
WHERE age BETWEEN 1 AND 25 AND n >= 20
GROUP BY brand, model;

-- Assemble.
TRUNCATE stats_model;
INSERT INTO stats_model (
  brand, model, vehicle_count, first_year, last_year, avg_age_years,
  fuel_split, avg_owners, pct_imported, pct_lpg, pct_towbar,
  stk_fail_pct, stk_inspections,
  stk_fail_pct_de, stk_inspections_de, stk_fail_pct_domestic, stk_inspections_domestic,
  median_km_by_age, color_split, computed_at
)
SELECT
  c.brand, c.model, c.vehicle_count, c.first_year, c.last_year, c.avg_age_years,
  f.fuel_split, o.avg_owners, im.pct_imported, eq.pct_lpg, eq.pct_towbar,
  s.stk_fail_pct, s.stk_inspections,
  s.stk_fail_pct_de, s.stk_inspections_de, s.stk_fail_pct_domestic, s.stk_inspections_domestic,
  od.median_km_by_age, cl.color_split, now()
FROM (SELECT * FROM _cohort WHERE model IS NOT NULL) c
LEFT JOIN _fuel   f  USING (brand, model)
LEFT JOIN _owners o  USING (brand, model)
LEFT JOIN _imp    im USING (brand, model)
LEFT JOIN _eq     eq USING (brand, model)
LEFT JOIN _stk    s  USING (brand, model)
LEFT JOIN _odo    od USING (brand, model)
LEFT JOIN _color  cl USING (brand, model);

-- Brand hubs. Every input already carries a brand-level row from its GROUPING
-- SETS, so this costs a scan of small temp tables rather than a second pass over
-- the inspection joins.
-- NOTE on scope: vehicle_count, stk_* and median_km_by_age cover the WHOLE
-- brand, because their blocks aggregate _base directly. fuel_split and
-- color_split come from blocks that join _cohort, so at brand level they cover
-- only the PUBLISHED models. The difference is small and the splits stay
-- representative, but do not present them as "all vehicles of this brand".
TRUNCATE stats_brand;
INSERT INTO stats_brand (
  brand, vehicle_count, model_count, first_year, last_year, avg_age_years,
  fuel_split, avg_owners, pct_imported, pct_lpg, pct_towbar,
  stk_fail_pct, stk_inspections, median_km_by_age, color_split, computed_at
)
SELECT
  c.brand, c.vehicle_count,
  (SELECT count(*) FROM stats_model m WHERE m.brand = c.brand),
  c.first_year, c.last_year, c.avg_age_years,
  f.fuel_split, o.avg_owners, im.pct_imported, eq.pct_lpg, eq.pct_towbar,
  s.stk_fail_pct, s.stk_inspections, od.median_km_by_age, cl.color_split, now()
FROM      (SELECT * FROM _cohort WHERE model IS NULL) c
LEFT JOIN (SELECT * FROM _fuel   WHERE model IS NULL) f  USING (brand)
LEFT JOIN (SELECT * FROM _owners WHERE model IS NULL) o  USING (brand)
LEFT JOIN (SELECT * FROM _imp    WHERE model IS NULL) im USING (brand)
LEFT JOIN (SELECT * FROM _eq     WHERE model IS NULL) eq USING (brand)
LEFT JOIN (SELECT * FROM _stk    WHERE model IS NULL) s  USING (brand)
LEFT JOIN (SELECT * FROM _odo    WHERE model IS NULL) od USING (brand)
LEFT JOIN (SELECT * FROM _color  WHERE model IS NULL) cl USING (brand)
-- A brand with no published model would be a hub linking to nothing.
WHERE EXISTS (SELECT 1 FROM stats_model m WHERE m.brand = c.brand);

-- Every raw registry spelling that ended up in a published cohort, counted.
-- Two things need this and it is a join over the whole base, so compute it once:
-- the retired-slug aliases below, and the per-model motorisation breakdown that
-- the model page renders as a section (S5).
CREATE TEMP TABLE _variants ON COMMIT DROP AS
SELECT b.brand,
       b.model,
       btrim(regexp_replace(r.obchodni_oznaceni, '\s+', ' ', 'g')) AS variant,
       count(*) AS n
FROM _base b
JOIN vehicle_registry r ON r.pcv = b.pcv
JOIN stats_model sm ON sm.brand = b.brand AND sm.model = b.model
GROUP BY 1, 2, 3;

-- The motorisations the fold merged away. The fold decides what gets a URL, not
-- what gets computed: 2 180 of our urls are already discovered-and-never-crawled,
-- so a URL per motorisation would add thousands more of exactly what Google is
-- declining. Rendered inside the model page instead.
--
-- Spelling variants are NOT motorisations. Grouping the raw strings directly
-- would list "i 30 / I 30 / i30" under a heading that says Motorizace, which
-- reads as broken data rather than detail. Collapse on the same separator-free
-- slug used for the cohorts, keep the most common spelling as the label, and
-- emit nothing at all when that leaves a single group — a model with one
-- motorisation has no breakdown to show.
UPDATE stats_model m
SET motorisations = v.j
FROM (
  SELECT brand, model, jsonb_agg(obj ORDER BY cnt DESC) AS j
  FROM (
    SELECT brand, model,
           (array_agg(variant ORDER BY n DESC))[1] AS label,
           sum(n) AS cnt,
           jsonb_build_object('name', (array_agg(variant ORDER BY n DESC))[1],
                              'count', sum(n)) AS obj
    FROM _variants
    GROUP BY brand, model, replace(pg_temp.slugify(variant), '-', '')
    HAVING sum(n) >= 20
  ) grouped
  GROUP BY brand, model
  HAVING count(*) > 1
) v
WHERE v.brand = m.brand AND v.model = m.model;

-- Most frequent STK defect codes per cohort.
--
-- Joins the odometer table (which since migration 007 carries the defect codes)
-- the same way _odo does. Codes only — the Czech text comes from the vendored
-- catalog at read time, so a better catalog never means a re-ingest.
--
-- The share is out of inspections that HAVE a defect record, not out of all
-- inspections: 41.5% of records carry defects and pre-2009 ones carry none, so
-- dividing by everything would understate every code by roughly half.
CREATE TEMP TABLE _defects ON COMMIT DROP AS
WITH exploded AS (
  SELECT b.brand, b.model, unnest(o.zavady_kody) AS code
  FROM _base b
  JOIN vehicle_inspection_odometer o USING (vin)
  WHERE o.zavady_kody IS NOT NULL
),
counted AS (
  SELECT brand, model, code, count(*) AS n,
         sum(count(*)) OVER (PARTITION BY brand, model) AS total
  FROM exploded GROUP BY 1, 2, 3
),
ranked AS (
  SELECT brand, model, code, n, total,
         row_number() OVER (PARTITION BY brand, model ORDER BY n DESC) AS rn
  FROM counted
)
SELECT brand, model,
       jsonb_agg(jsonb_build_object('code', code, 'count', n,
                                    'share', round(n::numeric / total, 4))
                 ORDER BY n DESC) AS top_defects
FROM ranked WHERE rn <= 8
GROUP BY brand, model;

UPDATE stats_model m SET top_defects = d.top_defects
FROM _defects d WHERE d.brand = m.brand AND d.model = m.model;

-- Theft rate: thefts in a fixed window over the fleet that existed during it.
--
-- Deliberately computed OUTSIDE _base. _base is restricted to
-- status = 'PROVOZOVANÉ', and a stolen car gets deregistered — 17 924 of the
-- 19 355 'Odcizeno' rows sit on VYŘAZENO Z PROVOZU vehicles, so joining through
-- _base saw 4.4% of them and measured "stolen and still on the road", which is
-- nearer a recovery rate. Both sides of the fraction come from vehicle_registry
-- directly, with the same folds applied so the keys match published cohorts.
CREATE TEMP TABLE _gone ON COMMIT DROP AS
SELECT pcv, min(datum_od) AS gone
FROM vehicle_deregistration
WHERE duvod <> 'Odcizeno' AND datum_od IS NOT NULL
GROUP BY pcv;
CREATE INDEX ON _gone (pcv);

-- Fleet at risk: registered before the window ended, not already deregistered
-- for a non-theft reason when it began. A car deregistered mid-window counts as
-- fully at risk — a simplification the page states rather than models away.
--
-- _gone is pre-aggregated on purpose. The obvious form, a correlated LATERAL
-- against vehicle_deregistration for each of 19.3M registry rows, does not
-- finish inside seven minutes; this is the shape _owners and _imp already use.
CREATE TEMP TABLE _theft_fleet ON COMMIT DROP AS
SELECT c.brand, c.canon AS model, count(*) AS fleet
FROM vehicle_registry r
LEFT JOIN _gone g USING (pcv)
JOIN _canon c
  ON c.brand = pg_temp.brand_fold(r.tovarni_znacka)
 AND c.key = replace(pg_temp.slugify(pg_temp.fold_model(r.obchodni_oznaceni)), '-', '')
WHERE r.kategorie_vozidla LIKE 'M1%'
  AND r.datum_prvni_registrace < :'theft_to'
  AND (g.gone IS NULL OR g.gone >= :'theft_from')
GROUP BY 1, 2;

CREATE TEMP TABLE _theft ON COMMIT DROP AS
SELECT c.brand, c.canon AS model, count(*) AS theft_count
FROM vehicle_deregistration d
JOIN vehicle_registry r USING (pcv)
JOIN _canon c
  ON c.brand = pg_temp.brand_fold(r.tovarni_znacka)
 AND c.key = replace(pg_temp.slugify(pg_temp.fold_model(r.obchodni_oznaceni)), '-', '')
WHERE d.duvod = 'Odcizeno'
  AND d.datum_od >= :'theft_from' AND d.datum_od < :'theft_to'
GROUP BY 1, 2;

UPDATE stats_model m
SET theft_count = t.theft_count,
    theft_fleet = f.fleet,
    -- NULL below the floor. Keeping the rate absent is what holds an
    -- unpublishable figure off the ranking, rather than a WHERE clause in the
    -- read layer that somebody could later drop.
    theft_per_1000 = CASE
      WHEN t.theft_count >= :theft_min AND f.fleet > 0
        THEN round(1000.0 * t.theft_count / f.fleet, 2)
      ELSE NULL
    END
FROM _theft t
JOIN _theft_fleet f USING (brand, model)
WHERE t.brand = m.brand AND t.model = m.model;

-- Record every slug the fold or the canonicalisation retired, so api/stats.ts
-- can 308 instead of 404. A row is emitted only when the spelling actually
-- resolves to a different url than its cohort's.
TRUNCATE stats_model_alias;
INSERT INTO stats_model_alias (brand_slug, old_slug, model_slug)
SELECT DISTINCT
  pg_temp.slugify(brand),
  pg_temp.slugify(variant),
  pg_temp.slugify(model)
FROM _variants
WHERE pg_temp.slugify(variant) <> pg_temp.slugify(model)
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
