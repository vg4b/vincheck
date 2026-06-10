-- Indexes for the vehicle-data cache. Kept separate from the table DDL so the
-- ingest script can optionally drop them before a bulk COPY and rebuild after
-- (faster bootstrap). All idempotent.
--
-- vehicle_registry: PČV is the canonical lookup id; VIN / Číslo TP / Číslo ORV
-- are the user-facing keys. brand + status support analytical (Phase 2) queries.
-- Companion tables: composite (pcv, <date>) for chronological per-vehicle scans.

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_registry_pcv_idx
  ON vehicle_registry (pcv);

CREATE INDEX IF NOT EXISTS vehicle_registry_vin_idx
  ON vehicle_registry (vin) WHERE vin IS NOT NULL;

CREATE INDEX IF NOT EXISTS vehicle_registry_cislo_tp_idx
  ON vehicle_registry (cislo_tp) WHERE cislo_tp IS NOT NULL;

CREATE INDEX IF NOT EXISTS vehicle_registry_cislo_orv_idx
  ON vehicle_registry (cislo_orv) WHERE cislo_orv IS NOT NULL;

CREATE INDEX IF NOT EXISTS vehicle_registry_brand_idx
  ON vehicle_registry (tovarni_znacka);

CREATE INDEX IF NOT EXISTS vehicle_registry_status_idx
  ON vehicle_registry (status);

CREATE INDEX IF NOT EXISTS vehicle_inspections_pcv_idx
  ON vehicle_inspections (pcv, platnost_do DESC);

CREATE INDEX IF NOT EXISTS vehicle_owners_pcv_idx
  ON vehicle_owners (pcv, datum_od DESC);

-- Reverse lookup: vehicles owned/operated by a legal entity (IČO). Powers the
-- "fleet by IČO" endpoint. Composite (ico, pcv) so DISTINCT pcv streams from the
-- ordered index and the LIMIT short-circuits; a plain (ico) index forces a
-- hash-distinct over the whole fleet (~1M rows for big leasers => seconds).
-- NOTE: superseded the earlier plain `vehicle_owners_ico_idx (ico)` — the ingest
-- drops both names, so the redundant (ico) index disappears on the next refresh.
CREATE INDEX IF NOT EXISTS vehicle_owners_ico_pcv_idx
  ON vehicle_owners (ico, pcv) WHERE ico IS NOT NULL;

CREATE INDEX IF NOT EXISTS vehicle_deregistration_pcv_idx
  ON vehicle_deregistration (pcv);

CREATE INDEX IF NOT EXISTS vehicle_imports_pcv_idx
  ON vehicle_imports (pcv);
