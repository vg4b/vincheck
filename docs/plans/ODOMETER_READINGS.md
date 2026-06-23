# Plan: Official STK odometer (mileage) history

Status: **planned** (not started). Decisions locked with the user:
- **Cadence:** monthly RSV CSVs (existing pipeline) **+ daily ISTP XML** ingest
  for odometer (its own cron).
- **Free vs. paid:** mileage history is shown **blurred** in the free vehicle
  view; the full, legible table is unlocked by the paid certificate.

## Why this matters

`vehicle_inspections` already stores `cislo_protokolu` for every STK record but
holds **no mileage**. The ISTP open-data feed provides `VIN + CisloProtokolu +
odometer reading` per inspection. Joining the two yields a **verifiable
mileage-per-inspection history straight from the official source**, which lets us
detect rollbacks ourselves — currently the single most valuable thing the Cebia
upsell provides. It also becomes the headline differentiator of the paid
certificate.

## Data source

- **Today:** 5 RSV datasets, one big monthly CSV each → bash `COPY` ingest
  (`scripts/ingest-vehicle-cache.sh`) into Scaleway Postgres.
- **ISTP odometer:** ~6442 per-station XML distributions (DCAT, under one parent
  dataset), **updated daily**, schema `ProhlidkaSeznam-v1.xsd`.
  - Catalog (parent): https://data.gov.cz/datová-sada?iri=…/9c95ebdba1dc7a2fbcfc5b6c07d25705
  - Children listing (~6442 daily datasets): https://data.gov.cz/datové-sady?nadřazený-dataset=https%3A%2F%2Fdata.gov.cz%2Fzdroj%2Fdatové-sady%2F66003008%2F9c95ebdba1dc7a2fbcfc5b6c07d25705
  - **No local archive** (confirmed with user 2026-06-23) — the ~6442 daily files
    must be enumerated + downloaded day-by-day from the catalog (one dataset per
    day, each with its own `dcat:distribution` → `dcat:downloadURL`).
  - Schema: https://istp.data.md.gov.cz/resources/istp/opendata/schemas/istp-opendata-schemas-ProhlidkaSeznam-v1.xsd
- Bash/`COPY` can't parse XML and there are many files → odometer needs its own
  ingest path (Node/tsx, streaming).

## Step 0 — Spike ✅ DONE (analysed `ProhlidkaSeznam_20260526-20260526.xml`)

Confirmed against a real daily file (53 MB, 35,299 records):

1. **Daily DELTA, national.** `DatovyObsahInfo/CasovePokryti{Zacatek,Konec}` =
   the single day. So ingest must **accumulate** (upsert), not TRUNCATE-reload.
   ~35k inspections/day ⇒ ~8–9M/year. The ~6442 distributions are the daily
   archive → backfill = download them all once, then append each new day.
2. **Fields per `<Prohlidka>`** (root `DatovaSada/DatovyObsah/ProhlidkaSeznam`):
   - `CisloProtokolu` — **unique key** (35,299 distinct = 35,299 records, 0 dups).
     Format `CZ-<station>-<YY>-<MM>-<seq>`.
   - `Vozidlo/Vin` — **100% present**. Also Znacka, ObchodniOznaceni, Druh, Kategorie.
   - `Vysledek/Odometr` — km integer, **94.5% present** (median 163k, range
     1–4.3M; missing mostly on some Pravidelná + admin types). `Vysledek/
     VysledekCelkovy` (result code, 1 = pass), `Vysledek/DatumPristiProhlidky`.
   - `DatumProhlidky`, `DruhProhlidky` (Pravidelná/Opakovaná/Evidenční/…),
     `Stanice/{Cislo,Kraj,ORP,Obec}`, `Registrace/{DatumPrvniRegistrace,Stat}`.
   - **Odometer lives only under `Vysledek`** — the nested `EmisniCast` repeats
     `CisloProtokolu` but has NO odometer (don't double-count).
   - Streams fine with `xml.etree.iterparse` (clear each element).
3. **Join key format matches RSV exactly** (RSV `CZ-3117-10-10-0277` ↔ ISTP
   `CZ-180502-26-05-0553`). Caveat: RSV only records `cislo_protokolu` from
   ~2012+, so older inspections have none — odometer enrichment is naturally
   limited to the modern era (fine; rollback detection only needs ≥2 recent
   readings).
4. **ISTP is self-sufficient** — VIN is on every record, so we can build a
   VIN-keyed odometer history **without** the RSV join. The `cislo_protokolu`
   match is optional enrichment/idempotency, not a dependency.
5. **Same VIN often has 2 same-day protocols** (technical STK + emissions ME, at
   different stations, odometer a few km apart). Each is a legit distinct
   protocol → key by `cislo_protokolu`, but **de-dup per (VIN, date)** in the
   read layer so the UI shows one reading per day.

## Step 1 — Schema (`scripts/migrations/004_vehicle_odometer.sql`)

New Scaleway cache table. `cislo_protokolu` is the natural PK (enables idempotent
upserts as daily deltas accumulate); reads are by VIN (ISTP is self-sufficient):

```
vehicle_inspection_odometer (
  cislo_protokolu  TEXT PRIMARY KEY,   -- CZ-<station>-<YY>-<MM>-<seq>
  vin              TEXT NOT NULL,
  odometer_km      INTEGER,            -- ~5.5% of rows have none
  inspection_date  DATE,
  druh             TEXT,               -- DruhProhlidky
  result_code      TEXT,              -- VysledekCelkovy
  station_kod      TEXT
)
```

Indexes: `(vin, inspection_date)` for per-vehicle history. `pcv` is intentionally
omitted — we key by VIN and resolve to the vehicle via the existing registry
lookup; add it later only if an RSV-row join proves useful.
(Distinct from the existing Vercel-Postgres `odometer_readings` table, which is
the user's *manual* mileage log in the client zone — different system.)

## Step 2 — Ingest (`scripts/ingest-odometer.ts`, streaming)

A Node/tsx script (not bash — XML):
- Enumerate the ~6442 daily distribution URLs from the DCAT catalog JSON (parent
  → `dcat:distribution` → `dcat:downloadURL`) so we don't hardcode links.
- Stream-parse each XML (`sax`/streaming, like the Python spike used `iterparse`),
  pulling `CisloProtokolu`, `Vozidlo/Vin`, `Vysledek/Odometr`, `DatumProhlidky`,
  `DruhProhlidky`, `Vysledek/VysledekCelkovy`, `Stanice/Cislo`. Ignore the
  `EmisniCast` block (no odometer there).
- **UPSERT on `cislo_protokolu`** (`ON CONFLICT DO NOTHING/UPDATE`) so daily
  deltas accumulate idempotently — re-running a day is safe.
- Backfill = iterate all archived daily files once; the daily cron then ingests
  just the newest file.
- Concurrency-limited fetch with retries; stamp a `cache_meta` row
  (`dataset='odometer'`, latest covered day) for staleness tracking.

## Step 3 — Cadence

- **Monthly:** RSV CSVs via the existing skill (unchanged).
- **Daily:** ISTP odometer via a **GitHub Action cron** running
  `scripts/ingest-odometer.ts` (the `.github/workflows/ingest-vehicles.yml` stub
  referenced in the cache doc is the home for this). Daily keeps mileage current
  as fresh inspections land; the per-VIN view changes only ~yearly, but daily is
  cheap for a delta/upsert load.

## Step 4 — Read layer (`api/_vehicleCache.ts`)

- Query `vehicle_inspection_odometer` **by VIN** (we already have the VIN in the
  lookup), ordered by `inspection_date`. Optionally also `LEFT JOIN` on
  `cislo_protokolu` to attach km to existing `inspections.history[]` rows.
- **De-dup per `inspection_date`** (collapse the same-day STK+ME pair, which
  differ by a few km — keep max/first) before presenting.
- Add a derived `mileage` block to `VehicleHistory`: `latestKm`, `readings[]`
  (date+km), `rollbackSuspected` (any later-dated reading lower than an earlier
  one, beyond a small tolerance), `avgKmPerYear`.

## Step 5 — Frontend (free = blurred)

- **`VehicleHistoryPanel.tsx`** — show km next to each STK row, but **blurred**
  (CSS blur + "odemkněte v certifikátu" overlay) for free users; a rollback
  **warning banner** when `rollbackSuspected` (the *fact* of a rollback can be
  shown un-blurred as the hook; exact figures stay blurred). Drop the "Tento
  výpis neobsahuje stav tachometru" line.
- **`VehicleInfo.tsx`** — replace the "Stav tachometru / Není ve veřejném
  registru → partner" callout with the (blurred) mileage trend, and re-aim the
  partner CTA at what we still lack (accidents, liens, foreign history).

## Step 6 — Certificate product (`api/_certificatePdf.ts`)

Add a **"Historie stavu tachometru"** section (km per inspection + rollback
flag) — fully legible (this is the unlock). Update the sample snapshot and the
landing/comparison copy to lead with verifiable official mileage history.

## Step 7 — Docs

Update `docs/VEHICLE_DATA_CACHE.md` (new dataset + daily cadence) and the
`refresh-vehicle-cache` skill (note odometer is a separate daily job).

## Sequencing

Spike (0) → schema + ingest (1–2) → daily cron (3) → read layer (4) → frontend
blur (5) → certificate unlock (6). Ship 4–5 first to validate join quality at
scale, then 6 once the data is trusted.

## Notes / open items

- The bulk ingest is a local/admin op (like the monthly cache refresh) — not a
  Vercel function. Scripts + parser can be written here; the actual load runs
  against Scaleway with the admin connection string.
- Confirm ISTP `CisloProtokolu` ↔ RSV `cislo_protokolu` join rate in the spike;
  fall back to VIN-based linkage where protocol numbers don't match.
