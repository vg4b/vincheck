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
  - Children (6442): the parent's `dcat:distribution` → `dcat:downloadURL` list.
  - Schema: https://istp.data.md.gov.cz/resources/istp/opendata/schemas/istp-opendata-schemas-ProhlidkaSeznam-v1.xsd
- Bash/`COPY` can't parse XML and there are many files → odometer needs its own
  ingest path (Node/tsx, streaming).

## Step 0 — Spike first (de-risks everything; ~half a day)

Pull a handful of distributions and confirm:
1. **Snapshot vs delta** — is each station file a *full* protocol list (replace)
   or a *daily delta* (accumulate)? Determines TRUNCATE-reload vs upsert.
2. **Field paths** — exact XSD path to odometer (`StavPocitadla`/`Najezd` km),
   `VIN`, `CisloProtokolu`, inspection date, result, station.
3. **Join hit-rate** — does ISTP `CisloProtokolu` match our
   `vehicle_inspections.cislo_protokolu` cleanly (formatting/leading zeros)?
   VIN→registry `pcv` is the fallback join. Report the % match on a sample.

## Step 1 — Schema (`scripts/migrations/004_vehicle_odometer.sql`)

New Scaleway cache table, mirroring cache conventions (TEXT-heavy, `pcv` typed):

```
vehicle_inspection_odometer (
  cislo_protokolu  TEXT,      -- join key to vehicle_inspections
  vin              TEXT,      -- fallback join + direct lookup
  pcv              BIGINT,    -- resolved at ingest where possible
  odometer_km      INTEGER,
  inspection_date  TEXT,
  result           TEXT,
  station_kod      TEXT
)
```

Indexes: `(cislo_protokolu)`, `(pcv, inspection_date)`, `(vin)`.
(Distinct from the existing Vercel-Postgres `odometer_readings` table, which is
the user's *manual* mileage log in the client zone — different system.)

## Step 2 — Ingest (`scripts/ingest-odometer.ts`, streaming)

A Node/tsx script (not bash — XML):
- Enumerate the ~6442 distribution URLs from the DCAT catalog JSON (parent →
  `dcat:distribution` → `dcat:downloadURL`) so we don't hardcode links.
- Stream-parse each XML (`sax`/`fast-xml-parser`), extract rows, bulk insert into
  a staging table, then resolve `pcv` (join `vehicle_registry` by VIN and/or
  `vehicle_inspections` by `cislo_protokolu`).
- Concurrency-limited fetch with retries; idempotent (replace vs upsert per the
  spike result).
- Stamp a `cache_meta` row (`dataset='odometer'`) for staleness tracking.

## Step 3 — Cadence

- **Monthly:** RSV CSVs via the existing skill (unchanged).
- **Daily:** ISTP odometer via a **GitHub Action cron** running
  `scripts/ingest-odometer.ts` (the `.github/workflows/ingest-vehicles.yml` stub
  referenced in the cache doc is the home for this). Daily keeps mileage current
  as fresh inspections land; the per-VIN view changes only ~yearly, but daily is
  cheap for a delta/upsert load.

## Step 4 — Read layer (`api/_vehicleCache.ts`)

- Extend the STK history query to `LEFT JOIN vehicle_inspection_odometer USING
  (cislo_protokolu)`; add `odometerKm` to each `inspections.history[]` entry and
  to `VehicleHistory`.
- Add a derived `mileage` block: `latestKm`, `readings[]`,
  `rollbackSuspected` (any later-dated reading lower than an earlier one, with
  tolerance), `avgKmPerYear`.

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
