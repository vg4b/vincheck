#!/usr/bin/env bash
#
# Production ingest for the RSV vehicle-data cache.
#
# Host-agnostic: connects via DATABASE_URL if set, otherwise standard libpq env
# (PGHOST / PGPORT / PGUSER / PGDATABASE / PGPASSWORD). Run it anywhere with
# enough disk + time: the DB host itself, a CI runner, or locally. NOT a Vercel
# function — the full snapshot is ~40 GB and takes 30-60 min.
#
# Per dataset the flow is: ensure schema → (optionally drop indexes) → TRUNCATE
# → COPY the CSV → record snapshot in cache_meta. Indexes are rebuilt at the end.
# Brief unavailability during the load is acceptable: api/vehicle.js falls back
# to the live API on a cache miss.
#
# Usage:
#   DATABASE_URL=postgres://user:pass@host:5432/db \
#     CSV_DIR="$HOME/Desktop/datova kostka" \
#     bash scripts/ingest-vehicle-cache.sh
#
#   DOWNLOAD=1 ...        fetch fresh CSVs from the open-data portal first
#   SNAPSHOT=2026-05-02   override the snapshot date (else parsed from filename / today)
#   SAMPLE_LINES=100000   load only the first N lines of each CSV (dev/testing)
#   KEEP_INDEXES=1        don't drop+rebuild indexes around the load (skip the optimisation)
#   ONLY=vozidla_dovoz    load only one dataset (key from DATASETS below) without
#                         touching the big tables or rebuilding their indexes
#
# See docs/VEHICLE_DATA_CACHE.md.

set -euo pipefail

CSV_DIR="${CSV_DIR:-$HOME/Desktop/datova kostka}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"

PORTAL_BASE="https://download.dataovozidlech.cz/vypiszregistru"

# dataset key | portal slug | local filename glob | target table
DATASETS=(
  "vypis_vozidel|vypisvozidel|RSV_vypis_vozidel_*.csv|vehicle_registry"
  "technicke_prohlidky|technickeprohlidky|RSV_technicke_prohlidky_*.csv|vehicle_inspections"
  "vlastnik_provozovatel|vlastnikprovozovatelvozidla|RSV_vlastnik_provozovatel_vozidla_*.csv|vehicle_owners"
  "vozidla_vyrazena|vozidlavyrazenazprovozu|RSV_vozidla_vyrazena_z_provozu_*.csv|vehicle_deregistration"
  "vozidla_dovoz|vozidladovoz|RSV_vozidla_dovoz_*.csv|vehicle_imports"
  "vozidla_doplnkove_vybaveni|vozidladoplnkovevybaveni|RSV_vozidla_doplnkove_vybaveni_*.csv|vehicle_equipment"
)

# --- Optional: restrict to a single dataset (ONLY=<dataset key>) ---
# Refresh just one table (e.g. ONLY=vozidla_dovoz) without touching the big
# tables or rebuilding their indexes. Only that CSV is loaded; the startup
# migration (002) creates its index if missing, and the global index drop is
# skipped (see DROP_INDEXES below).
if [ -n "${ONLY:-}" ]; then
  filtered=()
  for spec in "${DATASETS[@]}"; do
    [ "${spec%%|*}" = "$ONLY" ] && filtered+=("$spec")
  done
  if [ "${#filtered[@]}" -eq 0 ]; then
    echo "ERROR: ONLY='$ONLY' matched no dataset. Valid keys:" >&2
    for spec in "${DATASETS[@]}"; do echo "  - ${spec%%|*}" >&2; done
    exit 1
  fi
  DATASETS=("${filtered[@]}")
  echo "→ ONLY mode: loading just '$ONLY'"
fi

# --- psql wrapper (DATABASE_URL takes precedence over libpq env) ---
if [ -n "${DATABASE_URL:-}" ]; then
  PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)
else
  PSQL=(psql -v ON_ERROR_STOP=1 -q)
fi

command -v psql >/dev/null 2>&1 || { echo "ERROR: psql not found." >&2; exit 1; }
"${PSQL[@]}" -c "SELECT 1;" >/dev/null || { echo "ERROR: cannot connect to Postgres." >&2; exit 1; }

# --- Resolve the CSV for a dataset (download if requested) ---
resolve_csv() {
  local slug="$1" glob="$2"
  if [ "${DOWNLOAD:-0}" = "1" ]; then
    local out="$CSV_DIR/${glob/\*/$(date +%Y%m%d)}"
    mkdir -p "$CSV_DIR"
    echo "→ downloading $PORTAL_BASE/$slug" >&2
    curl -fSL --retry 3 -o "$out" "$PORTAL_BASE/$slug"
    echo "$out"
  else
    ls -1 "$CSV_DIR"/$glob 2>/dev/null | sort | tail -1
  fi
}

# --- Derive snapshot date from a filename (RSV_..._YYYYMMDD.csv) or today ---
derive_snapshot() {
  local file="$1"
  local digits
  digits="$(basename "$file" | grep -oE '[0-9]{8}' | head -1 || true)"
  if [ -n "$digits" ]; then
    echo "${digits:0:4}-${digits:4:2}-${digits:6:2}"
  else
    date +%Y-%m-%d
  fi
}

# --- 1. Ensure schema exists ---
echo "→ applying schema migrations"
"${PSQL[@]}" -f "$MIGRATIONS_DIR/001_vehicle_cache.sql"
"${PSQL[@]}" -f "$MIGRATIONS_DIR/002_vehicle_cache_indexes.sql"
"${PSQL[@]}" -f "$MIGRATIONS_DIR/005_vehicle_equipment.sql"

# --- 2. Optionally drop indexes for a faster bulk load (full loads only) ---
DROP_INDEXES=0
if [ -z "${SAMPLE_LINES:-}" ] && [ "${KEEP_INDEXES:-0}" != "1" ] && [ -z "${ONLY:-}" ]; then
  DROP_INDEXES=1
fi
if [ "$DROP_INDEXES" = "1" ]; then
  echo "→ dropping indexes for bulk load"
  "${PSQL[@]}" <<'SQL'
DROP INDEX IF EXISTS vehicle_registry_pcv_idx;
DROP INDEX IF EXISTS vehicle_registry_vin_idx;
DROP INDEX IF EXISTS vehicle_registry_cislo_tp_idx;
DROP INDEX IF EXISTS vehicle_registry_cislo_orv_idx;
DROP INDEX IF EXISTS vehicle_registry_brand_idx;
DROP INDEX IF EXISTS vehicle_registry_status_idx;
DROP INDEX IF EXISTS vehicle_inspections_pcv_idx;
DROP INDEX IF EXISTS vehicle_owners_pcv_idx;
DROP INDEX IF EXISTS vehicle_owners_ico_idx;
DROP INDEX IF EXISTS vehicle_owners_ico_pcv_idx;
DROP INDEX IF EXISTS vehicle_deregistration_pcv_idx;
DROP INDEX IF EXISTS vehicle_imports_pcv_idx;
DROP INDEX IF EXISTS vehicle_equipment_pcv_idx;
SQL
fi

# --- 3. Load each dataset ---
SNAPSHOT_OVERRIDE="${SNAPSHOT:-}"
LOADED_TABLES=()

for spec in "${DATASETS[@]}"; do
  IFS='|' read -r dataset slug glob table <<<"$spec"
  LOADED_TABLES+=("$table")

  file="$(resolve_csv "$slug" "$glob")"
  if [ -z "$file" ] || [ ! -f "$file" ]; then
    echo "ERROR: no CSV for $dataset (glob: $glob in $CSV_DIR)" >&2
    exit 1
  fi

  snapshot="${SNAPSHOT_OVERRIDE:-$(derive_snapshot "$file")}"

  echo
  echo "→ $dataset → $table   (snapshot $snapshot)"
  echo "    file: $file"

  "${PSQL[@]}" -c "TRUNCATE $table;"

  if [ -n "${SAMPLE_LINES:-}" ]; then
    echo "    sampling: first $SAMPLE_LINES lines"
    time head -n "$SAMPLE_LINES" "$file" \
      | "${PSQL[@]}" -c "\copy $table FROM stdin WITH (FORMAT csv, HEADER, ENCODING 'UTF8')"
  else
    time "${PSQL[@]}" -c \
      "\copy $table FROM '$file' WITH (FORMAT csv, HEADER, ENCODING 'UTF8')"
  fi

  "${PSQL[@]}" -c "
    INSERT INTO cache_meta (dataset, source_snapshot, imported_at, row_count)
    VALUES ('$dataset', '$snapshot', now(), (SELECT count(*) FROM $table))
    ON CONFLICT (dataset) DO UPDATE
      SET source_snapshot = EXCLUDED.source_snapshot,
          imported_at     = EXCLUDED.imported_at,
          row_count       = EXCLUDED.row_count;
  "
done

# --- 4. Rebuild indexes ---
if [ "$DROP_INDEXES" = "1" ]; then
  echo
  echo "→ rebuilding indexes"
  time "${PSQL[@]}" -f "$MIGRATIONS_DIR/002_vehicle_cache_indexes.sql"
fi

# --- 5. ANALYZE + report ---
# Scope to the tables we loaded — a bare `ANALYZE` walks every table in the
# database, including system catalogs the ingest user can't touch (noisy
# "permission denied to analyze pg_*" warnings).
echo
echo "→ ANALYZE"
analyze_list="$(IFS=,; echo "${LOADED_TABLES[*]}")"
"${PSQL[@]}" -c "ANALYZE $analyze_list;"

echo
echo "=== cache_meta ==="
"${PSQL[@]}" -c "SELECT dataset, source_snapshot, imported_at, row_count FROM cache_meta ORDER BY dataset;"

echo
echo "✓ Ingest complete."
