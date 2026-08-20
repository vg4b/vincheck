#!/usr/bin/env bash
#
# Run compute-stats.sql end to end against a local fixture database.
#
# The production run takes 2h12m against 19.3M registry rows and 91.9M
# inspections, which is far too slow a loop to develop the SQL against — and the
# script TRUNCATEs stats_model, so "just try it on prod" risks publishing a
# partial rebuild. This builds a few hundred rows with the same column shapes and
# the awkward cases baked in, so correctness is checked in seconds. Performance
# still has to be measured on the real thing; this only proves the SQL is right.
#
# Usage:  bash scripts/test-compute-stats.sh
set -euo pipefail

DB="${DB:-compute_stats_fixture}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

dropdb --if-exists "$DB" 2>/dev/null || true
createdb "$DB"
trap 'dropdb --if-exists "$DB" 2>/dev/null || true' EXIT

# Schema comes from the real migrations, never a hand-copied CREATE TABLE — a
# fixture with its own schema drifts from production and starts proving nothing.
psql -qX -d "$DB" -v ON_ERROR_STOP=1 \
  -f "$SCRIPT_DIR/migrations/001_vehicle_cache.sql" \
  -f "$SCRIPT_DIR/migrations/004_vehicle_odometer.sql" \
  -f "$SCRIPT_DIR/migrations/005_vehicle_equipment.sql" \
  -f "$SCRIPT_DIR/migrations/006_stats_tables.sql" \
  -f "$SCRIPT_DIR/migrations/008_stats_model_alias.sql" \
  -f "$SCRIPT_DIR/migrations/009_stats_brand.sql" >/dev/null 2>&1

psql -qX -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
-- Cases chosen to exercise every rule the script implements:
--   spelling variants that slugify the same     (i 30 / I 30 / i30)
--   variants split only by a separator          (cee-d / ceed)
--   engine variants that must fold              (OCTAVIA 1.9 TDI)
--   body styles that must NOT fold              (A4 AVANT)
--   BMW's trailing letter, which is the name    (320 D vs 320 I)
--   a model string that is pure engine spec     (1.2 16V)
CREATE TEMP TABLE spec(brand text, model text, fuel text, n int);
INSERT INTO spec VALUES
  ('HYUNDAI','i 30','NM',700), ('HYUNDAI','I 30','BA',200), ('HYUNDAI','i30','BA',150),
  ('KIA','cee-d','NM',600),    ('KIA','ceed','NM',400),
  ('ŠKODA','OCTAVIA','NM',900),('ŠKODA','OCTAVIA 1.9 TDI','NM',300),
  ('ŠKODA','OCTAVIA COMBI','NM',550),
  ('AUDI','A4','NM',500),      ('AUDI','A4 AVANT','NM',650),
  ('BMW','320 D','NM',520),    ('BMW','320 I','BA',510),
  ('OPEL','1.2 16V','BA',300),
  -- Below the publish floor: gets no page, but must still count toward its
  -- brand's total. Without this the brand-total check passes trivially.
  ('ŠKODA','RAPID SPACEBACK','BA',40);

INSERT INTO vehicle_registry
  (pcv, vin, tovarni_znacka, obchodni_oznaceni, datum_prvni_registrace,
   kategorie_vozidla, status, palivo, barva)
SELECT row_number() OVER ()::bigint,
       'VIN' || row_number() OVER ()::text,
       s.brand, s.model, '2015-01-01', 'M1', 'PROVOZOVANÉ', s.fuel, 'Šedá'
FROM spec s, LATERAL generate_series(1, s.n) g;

INSERT INTO vehicle_inspections (pcv, stav, kod_stk)
SELECT pcv, CASE WHEN (pcv % 10) = 0 THEN 'B' ELSE 'A' END, '1234'
FROM vehicle_registry;

INSERT INTO vehicle_inspection_odometer (cislo_protokolu, vin, odometer_km, inspection_date)
SELECT 'CZ-' || pcv, vin, 100000 + (pcv % 50000)::int, DATE '2024-06-01'
FROM vehicle_registry;

INSERT INTO vehicle_owners (pcv, vztah_k_vozidlu)
SELECT pcv, '1' FROM vehicle_registry;
SQL

echo "== running compute-stats.sql =="
psql -qX -d "$DB" -v ON_ERROR_STOP=1 -v min_count=100 -f "$SCRIPT_DIR/compute-stats.sql"

echo
echo "== model cohorts =="
psql -qX -d "$DB" -c "SELECT brand, model, vehicle_count FROM stats_model ORDER BY brand, vehicle_count DESC"
echo "== aliases =="
psql -qX -d "$DB" -c "SELECT brand_slug, old_slug, model_slug FROM stats_model_alias ORDER BY 1,2"
echo "== motorisations on the model page (S5 data) =="
psql -qX -d "$DB" -c "
SELECT brand, model, jsonb_array_length(coalesce(motorisations,'[]'::jsonb)) AS variants,
       left(motorisations::text, 70) AS sample
FROM stats_model WHERE motorisations IS NOT NULL ORDER BY 1,2"
echo "== brand hubs =="
psql -qX -d "$DB" -c "SELECT brand, vehicle_count, model_count, stk_fail_pct, stk_inspections FROM stats_brand ORDER BY vehicle_count DESC"
echo "== brand totals must cover the WHOLE brand, incl. below-floor models =="
psql -qX -d "$DB" -c "
SELECT b.brand, b.vehicle_count AS brand_total,
       (SELECT sum(vehicle_count) FROM stats_model m WHERE m.brand=b.brand) AS sum_of_models,
       CASE WHEN b.vehicle_count >= (SELECT sum(vehicle_count) FROM stats_model m WHERE m.brand=b.brand)
            THEN 'ok' ELSE 'BROKEN' END AS check
FROM stats_brand b ORDER BY 1"
