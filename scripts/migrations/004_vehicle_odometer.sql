-- Odometer / mileage readings from the ISTP daily open data (ProhlidkaSeznam).
--
-- ADDITIVE ONLY. This is a brand-new table — it never TRUNCATEs, ALTERs, or
-- drops indexes on the existing cache tables (vehicle_registry,
-- vehicle_inspections, …), so applying it and loading it CANNOT affect the live
-- lookup path (api/_vehicleCache.ts). No deployed code reads this table yet; the
-- read layer is wired separately, later.
--
-- Keyed by cislo_protokolu (globally unique per inspection protocol) so the daily
-- deltas accumulate idempotently via UPSERT. Reads are by VIN — the ISTP feed
-- carries the VIN on every record, so we don't need to join through the registry.
--
-- Apply as the ADMIN user (the ingest script can also create it via --apply-schema):
--   psql '<ADMIN connection string>' -f scripts/migrations/004_vehicle_odometer.sql

CREATE TABLE IF NOT EXISTS vehicle_inspection_odometer (
  cislo_protokolu  TEXT PRIMARY KEY,
  vin              TEXT NOT NULL,
  odometer_km      INTEGER,
  inspection_date  DATE,
  druh             TEXT,
  result_code      TEXT,
  station_kod      TEXT
);

-- Per-vehicle chronological scans (the only read pattern we need).
CREATE INDEX IF NOT EXISTS vehicle_inspection_odometer_vin_idx
  ON vehicle_inspection_odometer (vin, inspection_date);

-- Read-only app user (created in 003). ALTER DEFAULT PRIVILEGES already covers
-- new tables, but grant explicitly for clarity. Harmless to prod: nothing queries
-- this table until the read layer ships.
GRANT SELECT ON vehicle_inspection_odometer TO vincheck_api;
