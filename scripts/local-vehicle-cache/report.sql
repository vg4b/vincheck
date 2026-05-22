-- Final size report after ingest + indexes.

\echo
\echo '=== Per-table sizes ==='
SELECT
  relname                                                AS table_name,
  to_char(reltuples::BIGINT, 'FM999,999,999')            AS approx_rows,
  pg_size_pretty(pg_relation_size(c.oid))                AS heap_size,
  pg_size_pretty(pg_indexes_size(c.oid))                 AS indexes_size,
  pg_size_pretty(pg_total_relation_size(c.oid))          AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC;

\echo
\echo '=== Database total ==='
SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;

\echo
\echo '=== Spot checks ==='
SELECT 'vehicle_registry rows' AS metric, count(*) AS value FROM vehicle_registry
UNION ALL SELECT 'unique pcv in registry',           count(DISTINCT pcv)         FROM vehicle_registry
UNION ALL SELECT 'rows with VIN',                    count(*)                    FROM vehicle_registry WHERE vin IS NOT NULL
UNION ALL SELECT 'inspections rows',                 count(*)                    FROM vehicle_inspections
UNION ALL SELECT 'avg inspections per vehicle (x10)',(10 * count(*) / NULLIF((SELECT count(*) FROM vehicle_registry), 0))::BIGINT FROM vehicle_inspections
UNION ALL SELECT 'owners rows',                      count(*)                    FROM vehicle_owners
UNION ALL SELECT 'deregistration rows',              count(*)                    FROM vehicle_deregistration;

\echo
\echo '=== Sample lookup latency (by VIN) ==='
\timing on
SELECT pcv, vin, tovarni_znacka, obchodni_oznaceni, status
FROM vehicle_registry
WHERE vin = 'WVWZZZ1KZDP015799';
\timing off
