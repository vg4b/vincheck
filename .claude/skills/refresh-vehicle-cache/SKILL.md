---
name: refresh-vehicle-cache
description: >
  Monthly refresh of the Scaleway vehicle-data cache from the open-data portal
  (download.dataovozidlech.cz). Use when the user wants to update the vehicle
  registry cache, ingest new monthly CSV snapshots, or asks "refresh the vehicle
  DB / cache". Downloads the 5 RSV datasets, scales the Scaleway node up for the
  load, runs the bulk ingest, smoke-tests, and scales back down.
---

# Refresh the vehicle-data cache

The cache mirrors the Czech vehicle registry into Scaleway Postgres so VIN/TP/ORV
lookups are served from our DB with the live API as fallback. See
`docs/VEHICLE_DATA_CACHE.md` for the full design. This skill is the **monthly
operational refresh** — it does NOT change schema or code.

## When it runs

The portal publishes a **full monthly snapshot** (not deltas) on the **12th of
the following month**. Refresh any time after that. Each refresh TRUNCATEs and
reloads all five tables — there is no incremental/append mode.

## The 4 datasets (this is the answer to "what to download")

The ingest script's `DATASETS` array drives everything. Base URL:
`https://download.dataovozidlech.cz/vypiszregistru/<slug>`

| Portal slug | → table | filename glob |
|---|---|---|
| `vypisvozidel` | `vehicle_registry` | `RSV_vypis_vozidel_*.csv` |
| `technickeprohlidky` | `vehicle_inspections` | `RSV_technicke_prohlidky_*.csv` |
| `vlastnikprovozovatelvozidla` | `vehicle_owners` | `RSV_vlastnik_provozovatel_vozidla_*.csv` |
| `vozidlavyrazenazprovozu` | `vehicle_deregistration` | `RSV_vozidla_vyrazena_z_provozu_*.csv` |
| `vozidladovoz` | `vehicle_imports` | `RSV_vozidla_dovoz_*.csv` |

The other registry datasets (`zpravyvyrobcezastupce`,
`vozidladoplnkovevybaveni`) are intentionally NOT ingested. Don't add them here
without first extending the schema + `DATASETS` array.

## Prerequisites

- `psql` installed.
- `<ADMIN_URL>` — the read+write Scaleway admin connection string (needed for
  ingest). Never commit it; pass it inline at the prompt. The app's read-only
  `vincheck_api` string is in `.env` as `VEHICLE_CACHE_DATABASE_URL`.
- Disk for ~40 GB of CSVs in `CSV_DIR` (default `$HOME/Desktop/datova kostka`).
- These are long, idle-heavy ops — if running over a flaky link, keep the
  session alive (the cache was historically hand-applied; use keepalives).

## Procedure

1. **(Recommended) Scale the node up for the load.** `DB-DEV-S` (2 GB) does the
   index rebuild via slow on-disk merge sort (~2–3 h). Temporarily scaling to
   `DB-GP-XS` (16 GB, ≈ €0.19/h) cuts it to ~30–45 min and costs cents because
   Scaleway bills hourly. Console → instance → scale to `DB-GP-XS`. Verify the
   user wants this before doing it, then remember to scale back in step 4.

2. **Run the ingest with `DOWNLOAD=1`** — fetches fresh CSVs, then
   TRUNCATE → COPY → rebuild indexes → ANALYZE, stamping `cache_meta`:

   ```bash
   DATABASE_URL='<ADMIN_URL>' \
     CSV_DIR="$HOME/Desktop/datova kostka" \
     DOWNLOAD=1 \
     bash scripts/ingest-vehicle-cache.sh
   ```

   The script prints a `cache_meta` table at the end (dataset, snapshot,
   row_count). Sanity-check the row counts are in the expected ballpark
   (registry ~19M, inspections ~80M+, owners ~90M+, deregistration ~2M,
   imports a few M). A
   sharp drop means a truncated download — investigate, don't deploy.

   Dev/dry-run variant (first N lines, keeps indexes, no download):
   ```bash
   DATABASE_URL='<ADMIN_URL>' SAMPLE_LINES=100000 bash scripts/ingest-vehicle-cache.sh
   ```

   **Refresh just one dataset** with `ONLY=<key>` — loads only that CSV without
   touching the big tables or rebuilding their indexes (fast; no node scale-up
   needed). Keys: `vypis_vozidel`, `technicke_prohlidky`, `vlastnik_provozovatel`,
   `vozidla_vyrazena`, `vozidla_dovoz`. Example (imports only):
   ```bash
   DATABASE_URL='<ADMIN_URL>' CSV_DIR="$HOME/Desktop/datova kostka" \
     DOWNLOAD=1 ONLY=vozidla_dovoz bash scripts/ingest-vehicle-cache.sh
   ```
   The full `DOWNLOAD=1` run already includes `vozidla_dovoz`, so the monthly
   refresh keeps imports current automatically — `ONLY` is for a targeted
   bootstrap or a single-table re-pull.

3. **Smoke test** as the read-only app user (`.env` must hold
   `VEHICLE_CACHE_DATABASE_URL`):

   ```bash
   npx tsx scripts/test-cache-lookup.ts                    # auto-finds a HIT + probes canonical VIN
   npx tsx scripts/test-cache-lookup.ts WVWZZZ1KZDP015799  # known vehicle, PČV 12365572 — expect HIT
   ```

4. **Scale the node back down** to `DB-DEV-S` if you scaled up in step 1.
   Console → instance → scale to `DB-DEV-S`.

5. **Report** the new snapshot date + row counts to the user. No deploy needed —
   the live endpoint reads the DB directly; the new snapshot is served
   immediately once `cache_meta.source_snapshot` updates.

## Notes / gotchas

- The script connects via `DATABASE_URL` if set, else libpq env vars.
- Snapshot date is parsed from the `RSV_..._YYYYMMDD.csv` filename, or pass
  `SNAPSHOT=2026-06-12` to override.
- Network ACL is `0.0.0.0/0`; encryption + credentials are the only gate.
- The CSV download itself is the backup — no manual DB snapshot needed.
- If you want this fully automated, `.github/workflows/ingest-vehicles.yml` is
  the unbuilt cron stub referenced in the design doc.
