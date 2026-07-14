-- Canonical schema for the RSV vehicle-data cache (Phase 1: P0 + P1 datasets).
--
-- Design notes:
--   * Data tables mirror the CSV columns 1:1 (snake_case slugs of the Czech
--     header names) so `COPY ... FROM <csv>` needs no explicit column list.
--   * Only PČV is typed (BIGINT) — it's the cross-dataset join key, 100% present
--     and unique in vehicle_registry. Everything else stays TEXT: most registry
--     fields are composite strings ("164 / 114 / 134", "5 / 5 / 0") that aren't
--     clean scalars, and ISO-8601 date strings sort lexically, so TEXT is enough
--     for the "latest STK" / "owner interval" ordering the lookup layer needs.
--   * Snapshot metadata lives in cache_meta (one row per dataset), NOT per data
--     row — saves overhead across 190M+ rows and keeps COPY column-list-free.
--
-- Idempotent: safe to re-run. The ingest script (scripts/ingest-vehicle-cache.sh)
-- TRUNCATEs + reloads these tables monthly.
--
-- See docs/VEHICLE_DATA_CACHE.md.

-- vypis_vozidel.csv: 99 columns. Order matches the CSV header.
CREATE TABLE IF NOT EXISTS vehicle_registry (
  datum_prvni_registrace                       TEXT,
  datum_prvni_registrace_v_cr                  TEXT,
  ztp                                          TEXT,
  es_eu                                        TEXT,
  druh_vozidla                                 TEXT,
  druh_vozidla_2r                              TEXT,
  kategorie_vozidla                            TEXT,
  tovarni_znacka                               TEXT,
  typ                                          TEXT,
  varianta                                     TEXT,
  verze                                        TEXT,
  vin                                          TEXT,
  obchodni_oznaceni                            TEXT,
  vyrobce_vozidla                              TEXT,
  vyrobce_motoru                               TEXT,
  typ_motoru                                   TEXT,
  max_vykon                                    TEXT,
  palivo                                       TEXT,
  zdvihovy_objem                               TEXT,
  plne_elektricke_vozidlo                      TEXT,
  hybridni_vozidlo                             TEXT,
  trida_hybridniho_vozidla                     TEXT,
  emisni_limit                                 TEXT,
  stupen_plneni_emisni_urovne                  TEXT,
  korigovany_soucinitel_absorbce               TEXT,
  co2_mesto_mimo_kombi                         TEXT,
  specificke_co2                               TEXT,
  snizeni_emisi_nedc                           TEXT,
  snizeni_emisi_wltp                           TEXT,
  spotreba_predpis                             TEXT,
  spotreba_mesto_mimo_kombi                    TEXT,
  spotreba_pri_rychlosti                       TEXT,
  spotreba_el_mobil                            TEXT,
  dojezd_zr                                    TEXT,
  vyrobce_karoserie                            TEXT,
  karoserie_druh_typ                           TEXT,
  vyrobni_cislo_karoserie                      TEXT,
  barva                                        TEXT,
  barva_doplnkova                              TEXT,
  pocet_mist                                   TEXT,
  celkova_delka_sirka_vyska                    TEXT,
  rozvor                                       TEXT,
  rozchod                                      TEXT,
  provozni_hmotnost                            TEXT,
  max_hmotnost_kg                              TEXT,
  max_hmotnost_na_napravu                      TEXT,
  max_hmotnost_pripoj_brzdene                  TEXT,
  max_hmotnost_pripoj_nebrzdene                TEXT,
  max_hmotnost_jizdni_soupravy                 TEXT,
  hmotnosti_wltp                               TEXT,
  prumer_uzitecne_zatizeni                     TEXT,
  spojovaci_zarizeni_druh                      TEXT,
  pocet_naprav_pohanene                        TEXT,
  kola_pneumatiky                              TEXT,
  vnejsi_hluk_stojici                          TEXT,
  hluk_za_jizdy                                TEXT,
  nejvyssi_rychlost                            TEXT,
  pomer_vykon_hmotnost                         TEXT,
  inovativni_technologie                       TEXT,
  stupen_dokonceni                             TEXT,
  faktor_odchylky_de                           TEXT,
  faktor_verifikace_vf                         TEXT,
  ucel_vozidla                                 TEXT,
  dalsi_zaznamy                                TEXT,
  alternativni_provedeni                       TEXT,
  cislo_tp                                     TEXT,
  cislo_orv                                    TEXT,
  druh_rz                                      TEXT,
  zarazeni_vozidla                             TEXT,
  status                                       TEXT,
  pcv                                          BIGINT,
  abs                                          TEXT,
  airbag                                       TEXT,
  asr                                          TEXT,
  brzdy_nouzova                                TEXT,
  brzdy_odlehcovaci                            TEXT,
  brzdy_parkovaci                              TEXT,
  brzdy_provozni                               TEXT,
  doplnkovy_text_tp                            TEXT,
  hmotnosti_provozni_do                        TEXT,
  hmotnosti_zatizeni_sz                        TEXT,
  hmotnosti_zatizeni_sz_typ                    TEXT,
  hydropohon                                   TEXT,
  objem_cisterny                               TEXT,
  zatizeni_strechy                             TEXT,
  cislo_motoru                                 TEXT,
  nejvyssi_rychlost_omezeni                    TEXT,
  ovladani_brzd_sz                             TEXT,
  ovladani_brzd_sz_druh                        TEXT,
  retarder                                     TEXT,
  rok_vyroby                                   TEXT,
  delka_do                                     TEXT,
  lozna_delka                                  TEXT,
  lozna_sirka                                  TEXT,
  vyska_do                                     TEXT,
  typ_kod                                      TEXT,
  rm_zaniku                                    TEXT,
  stupen_autonomity_vozidla                    TEXT,
  varianta_rz                                  TEXT
);

-- technicke_prohlidky.csv: 9 cols. Many rows per PČV.
CREATE TABLE IF NOT EXISTS vehicle_inspections (
  pcv              BIGINT,
  typ              TEXT,
  stav             TEXT,
  kod_stk          TEXT,
  nazev_stk        TEXT,
  platnost_od      TEXT,
  platnost_do      TEXT,
  cislo_protokolu  TEXT,
  aktualni         TEXT
);

-- vlastnik_provozovatel_vozidla.csv: 9 cols. Many rows per PČV.
CREATE TABLE IF NOT EXISTS vehicle_owners (
  pcv              BIGINT,
  typ_subjektu     TEXT,
  vztah_k_vozidlu  TEXT,
  aktualni         TEXT,
  ico              TEXT,
  nazev            TEXT,
  adresa           TEXT,
  datum_od         TEXT,
  datum_do         TEXT
);

-- vozidla_vyrazena_z_provozu.csv: 6 cols.
CREATE TABLE IF NOT EXISTS vehicle_deregistration (
  pcv       BIGINT,
  datum_od  TEXT,
  datum_do  TEXT,
  duvod     TEXT,
  rm_kod    TEXT,
  rm_nazev  TEXT
);

-- vozidla_dovoz.csv: 3 cols. Import country + date per PČV. Column order
-- matches the CSV header (PČV, Stát, Datum dovozu) so COPY needs no column list.
CREATE TABLE IF NOT EXISTS vehicle_imports (
  pcv           BIGINT,
  stat          TEXT,
  datum_dovozu  TEXT
);

-- vozidla_doplnkove_vybaveni.csv: 4 cols. Additional equipment / modifications,
-- many rows per PČV. `do` is a reserved word, hence do_. See 005 for the detail.
CREATE TABLE IF NOT EXISTS vehicle_equipment (
  pcv  BIGINT,
  typ  TEXT,
  od   TEXT,
  do_  TEXT
);

-- One row per ingested dataset. Drives staleness checks in the lookup layer.
CREATE TABLE IF NOT EXISTS cache_meta (
  dataset          TEXT PRIMARY KEY,
  source_snapshot  DATE NOT NULL,
  imported_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_count        BIGINT
);
