-- Local Postgres schema for the RSV vehicle-data cache (P0 + P1).
--
-- All non-PČV columns are TEXT during ingest to make COPY robust against any
-- inconsistency in the source CSVs. PČV is BIGINT (the cross-dataset join key,
-- always present, fits comfortably; see docs/VEHICLE_DATA_CACHE.md). Type
-- promotion (DATE / BOOLEAN / SMALLINT) is a follow-up ALTER once we've
-- measured real on-disk size.
--
-- Tables are dropped + recreated on every run so the script is idempotent.

DROP TABLE IF EXISTS vehicle_registry CASCADE;
DROP TABLE IF EXISTS vehicle_inspections CASCADE;
DROP TABLE IF EXISTS vehicle_owners CASCADE;
DROP TABLE IF EXISTS vehicle_deregistration CASCADE;

-- vypis_vozidel.csv: 99 columns. Order MUST match the CSV header.
CREATE TABLE vehicle_registry (
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
CREATE TABLE vehicle_inspections (
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
CREATE TABLE vehicle_owners (
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
CREATE TABLE vehicle_deregistration (
  pcv       BIGINT,
  datum_od  TEXT,
  datum_do  TEXT,
  duvod     TEXT,
  rm_kod    TEXT,
  rm_nazev  TEXT
);
