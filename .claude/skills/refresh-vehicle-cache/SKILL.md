---
name: refresh-vehicle-cache
description: >
  Monthly refresh of the Scaleway vehicle-data cache from the open-data portal
  (download.dataovozidlech.cz). Use when the user wants to update the vehicle
  registry cache, ingest new monthly CSV snapshots, or asks "refresh the vehicle
  DB / cache". Handles the 5 RSV datasets — downloading them if needed — runs the
  bulk ingest (TRUNCATE + COPY + index rebuild), and smoke-tests the result.
---

# Refresh the vehicle-data cache

The cache mirrors the Czech vehicle registry into Scaleway Postgres so VIN/TP/ORV
lookups are served from our DB with the live API as fallback. See
`docs/VEHICLE_DATA_CACHE.md` for the full design. This skill is the **monthly
operational refresh** — it does NOT change schema or code.

## When it runs

The portal publishes a **full monthly snapshot** (not deltas) on the **12th of
the following month**. Refresh any time after that. Each refresh TRUNCATEs and
reloads all six tables — there is no incremental/append mode.

## The 6 datasets (this is the answer to "what to download")

The ingest script's `DATASETS` array drives everything. Base URL:
`https://download.dataovozidlech.cz/vypiszregistru/<slug>`

| Portal slug | → table | filename glob |
|---|---|---|
| `vypisvozidel` | `vehicle_registry` | `RSV_vypis_vozidel_*.csv` |
| `technickeprohlidky` | `vehicle_inspections` | `RSV_technicke_prohlidky_*.csv` |
| `vlastnikprovozovatelvozidla` | `vehicle_owners` | `RSV_vlastnik_provozovatel_vozidla_*.csv` |
| `vozidlavyrazenazprovozu` | `vehicle_deregistration` | `RSV_vozidla_vyrazena_z_provozu_*.csv` |
| `vozidladovoz` | `vehicle_imports` | `RSV_vozidla_dovoz_*.csv` |
| `vozidladoplnkovevybaveni` | `vehicle_equipment` | `RSV_vozidla_doplnkove_vybaveni_*.csv` |

`zpravyvyrobcezastupce` (manufacturer messages) is intentionally NOT ingested —
1.1% coverage, text truncated at 65 chars, and 32% of rows carry clerk names
(GDPR). Assessed and dropped 2026-07-14; see
docs/plans/2026-07-14-001-feat-equipment-and-manufacturer-messages.md. Don't add
it here without re-reading that decision.

## Prerequisites

- `psql` installed.
- `<ADMIN_URL>` — the read+write Scaleway admin connection string (needed for
  ingest). Never commit it; pass it inline at the prompt. The app's read-only
  `vincheck_api` string is in `.env` as `VEHICLE_CACHE_DATABASE_URL`.
- Disk for ~40 GB of CSVs in `CSV_DIR` (default `$HOME/Desktop/datova kostka`).
- These are long, idle-heavy ops — if running over a flaky link, keep the
  session alive (the cache was historically hand-applied; use keepalives).

## Procedure

1. **(Optional) Scale the node up for the load.** `DB-DEV-S` (2 GB) is fine —
   measured 2026-07-13 (before `vehicle_equipment` was added; the 345 MB /
   12.5M-row equipment CSV adds to this): **~75 min total** (31 min COPY across
   the five CSVs,
   43 min index rebuild). Default to staying on `DB-DEV-S`; don't scale up out
   of habit. Only if you need the window shorter, temporarily scale to
   `DB-GP-XS` (16 GB, ≈ €0.19/h — cents, since Scaleway bills hourly) via
   Console → instance → scale. Ask the user first, and scale back in step 4.

2. **Run the ingest.** TRUNCATE → COPY → rebuild indexes → ANALYZE, stamping
   `cache_meta`.

   **(a) CSVs already on disk** (the user downloaded them by hand — the common
   case, since the portal files are big and often fetched ahead of time). Omit
   `DOWNLOAD=1`, or it will re-fetch ~40 GB and overwrite them:

   ```bash
   cd /Users/vgabriel/repos/vincheck
   caffeinate -i env DATABASE_URL='<ADMIN_URL>' \
     CSV_DIR="$HOME/Desktop/datova kostka" \
     bash scripts/ingest-vehicle-cache.sh 2>&1 | tee /tmp/ingest.log
   ```

   `caffeinate -i` stops the Mac sleeping mid-load; `tee` keeps a log to check
   the counts against afterwards. This is a long foreground run — have the user
   start it in their own terminal rather than blocking the agent session.

   **(b) Let the script fetch the CSVs** with `DOWNLOAD=1`:

   ```bash
   DATABASE_URL='<ADMIN_URL>' \
     CSV_DIR="$HOME/Desktop/datova kostka" \
     DOWNLOAD=1 \
     bash scripts/ingest-vehicle-cache.sh
   ```

   The script prints a `cache_meta` table at the end (dataset, snapshot,
   row_count). Sanity-check the row counts against the last known-good run
   (2026-07-01/03 snapshot): registry 19.3M, inspections 83.5M, owners 90.7M,
   deregistration 1.9M, imports 3.4M — each grows slowly month over month. A
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

4. **Scale the node back down** to `DB-DEV-S` — only if you scaled up in step 1.

5. **Report** the new snapshot date + row counts to the user. No deploy needed —
   the live endpoint reads the DB directly; the new snapshot is served
   immediately once `cache_meta.source_snapshot` updates.

## Notes / gotchas

- The script connects via `DATABASE_URL` if set, else libpq env vars.
- Snapshot date is parsed from the `RSV_..._YYYYMMDD.csv` filename, or pass
  `SNAPSHOT=2026-06-12` to override. The datasets are published on slightly
  different days, so `cache_meta` legitimately ends up with mixed
  `source_snapshot` dates (e.g. 2026-07-13: inspections 2026-07-03, the other
  four 2026-07-01). Not an error.
- Startup noise is expected on a refresh: `relation "…" already exists,
  skipping` from the idempotent migrations, and `index "vehicle_owners_ico_idx"
  does not exist, skipping` from the index-drop step (owners uses the composite
  `vehicle_owners_ico_pcv_idx`). Both are harmless.
- The `odometer` row in `cache_meta` is NOT part of this ingest — it's owned by
  the weekly `.github/workflows/ingest-odometer.yml` (ISTP) job and lags
  independently. Don't read its stale snapshot as a failed refresh.
- Network ACL is `0.0.0.0/0`; encryption + credentials are the only gate.
- The CSV download itself is the backup — no manual DB snapshot needed.
- If you want this fully automated, `.github/workflows/ingest-vehicles.yml` is
  the unbuilt cron stub referenced in the design doc.
