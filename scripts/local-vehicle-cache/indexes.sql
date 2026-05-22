-- Indexes built AFTER bulk COPY (faster than maintaining them during load).
--
-- vehicle_registry: PČV is the canonical PK; VIN / Číslo TP / Číslo ORV are
-- the user-facing lookup keys. Brand + status are useful for analytical queries.
-- Companion tables: composite (pcv, …) for chronological per-vehicle scans.

ALTER TABLE vehicle_registry ADD PRIMARY KEY (pcv);

CREATE INDEX vehicle_registry_vin_idx
  ON vehicle_registry (vin)
  WHERE vin IS NOT NULL;

CREATE INDEX vehicle_registry_cislo_tp_idx
  ON vehicle_registry (cislo_tp)
  WHERE cislo_tp IS NOT NULL;

CREATE INDEX vehicle_registry_cislo_orv_idx
  ON vehicle_registry (cislo_orv)
  WHERE cislo_orv IS NOT NULL;

CREATE INDEX vehicle_registry_brand_idx
  ON vehicle_registry (tovarni_znacka);

CREATE INDEX vehicle_registry_status_idx
  ON vehicle_registry (status);

CREATE INDEX vehicle_inspections_pcv_idx
  ON vehicle_inspections (pcv, platnost_do DESC);

CREATE INDEX vehicle_owners_pcv_idx
  ON vehicle_owners (pcv, datum_od DESC);

CREATE INDEX vehicle_deregistration_pcv_idx
  ON vehicle_deregistration (pcv);
