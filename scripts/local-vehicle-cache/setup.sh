#!/usr/bin/env bash
#
# Local Postgres bootstrap for the RSV vehicle-data cache.
#
# Loads the 4 monthly snapshot CSVs from CSV_DIR into a local Postgres database
# to measure real on-disk size and validate the ingest pipeline before
# committing to a managed-DB bill.
#
# Defaults assume CSVs sit in ~/Desktop/datova kostka/ and Postgres is reachable
# via the current $USER. Override with env vars.
#
# Usage:
#   bash scripts/local-vehicle-cache/setup.sh
#   SAMPLE_LINES=100000 bash scripts/local-vehicle-cache/setup.sh   # top-N rows only
#
# Env:
#   CSV_DIR        path containing the 4 RSV_*.csv files
#   DB_NAME        database to create / load into
#   SAMPLE_LINES   if set, only load the first N lines (including header) of
#                  each CSV via `head -n N | \copy FROM stdin`. Validates the
#                  pipeline on tight-disk machines; extrapolate sizes from the
#                  per-table numbers in the final report.
#   PGHOST / PGPORT / PGUSER  standard libpq env, honored as-is
#
# See docs/VEHICLE_DATA_CACHE.md for context.

set -euo pipefail

CSV_DIR="${CSV_DIR:-$HOME/Desktop/datova kostka}"
DB_NAME="${DB_NAME:-vincheck_cache}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Preflight ---

if ! command -v psql >/dev/null 2>&1; then
  cat >&2 <<'EOF'
ERROR: psql not found. Install Postgres first:

  brew install postgresql@16
  brew services start postgresql@16

(Or use Postgres.app — https://postgresapp.com — and run its "Initialize" step.)
EOF
  exit 1
fi

if ! pg_isready -q; then
  cat >&2 <<'EOF'
ERROR: Postgres is not accepting connections.

  brew services start postgresql@16

If you installed via Postgres.app, click "Start" in the app UI.
EOF
  exit 1
fi

if [ ! -d "$CSV_DIR" ]; then
  echo "ERROR: CSV_DIR not found: $CSV_DIR" >&2
  exit 1
fi

# Pick latest snapshot for each dataset (sort alphabetically; filenames carry
# the YYYYMMDD date so this is also chronological).
pick_latest() {
  local pattern="$1"
  ls -1 "$CSV_DIR"/$pattern 2>/dev/null | sort | tail -1
}

F_VOZIDLA="$(pick_latest 'RSV_vypis_vozidel_*.csv')"
F_PROHLIDKY="$(pick_latest 'RSV_technicke_prohlidky_*.csv')"
F_VLASTNICI="$(pick_latest 'RSV_vlastnik_provozovatel_vozidla_*.csv')"
F_VYRAZENA="$(pick_latest 'RSV_vozidla_vyrazena_z_provozu_*.csv')"

for label in F_VOZIDLA F_PROHLIDKY F_VLASTNICI F_VYRAZENA; do
  eval "value=\"\${$label}\""
  if [ -z "$value" ]; then
    echo "ERROR: no file matches $label in $CSV_DIR" >&2
    exit 1
  fi
done

echo "→ CSVs selected:"
printf '    %s\n' "$F_VOZIDLA" "$F_PROHLIDKY" "$F_VLASTNICI" "$F_VYRAZENA"
echo

# --- Create database if missing ---

if ! psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  echo "→ Creating database '$DB_NAME'"
  createdb "$DB_NAME"
else
  echo "→ Database '$DB_NAME' already exists"
fi

# --- Tune for bulk load (reload-time settings only; shared_buffers needs restart) ---

echo "→ Tuning for bulk load (session-level + reloadable cluster settings)"
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
ALTER SYSTEM SET maintenance_work_mem = '2GB';
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET synchronous_commit = off;
ALTER SYSTEM SET wal_compression = on;
SELECT pg_reload_conf();
SQL

# --- Schema ---

echo "→ Creating schema (drops + recreates all 4 tables)"
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/schema.sql"

# --- COPY ---
#
# Run each \copy in its own psql invocation so we get per-file timing and don't
# blow up the whole pipeline on a single bad row.

copy_one() {
  local table="$1" file="$2" label="$3"
  echo
  echo "→ Loading $label → $table"
  echo "    file: $file"
  if [ -n "${SAMPLE_LINES:-}" ]; then
    echo "    sampling: first $SAMPLE_LINES lines (header included)"
    time head -n "$SAMPLE_LINES" "$file" \
      | psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
        "\\copy $table FROM stdin WITH (FORMAT csv, HEADER, ENCODING 'UTF8')"
  else
    time psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
      "\\copy $table FROM '$file' WITH (FORMAT csv, HEADER, ENCODING 'UTF8')"
  fi
}

copy_one vehicle_registry        "$F_VOZIDLA"   "vypis_vozidel"
copy_one vehicle_inspections     "$F_PROHLIDKY" "technicke_prohlidky"
copy_one vehicle_owners          "$F_VLASTNICI" "vlastnik_provozovatel"
copy_one vehicle_deregistration  "$F_VYRAZENA"  "vozidla_vyrazena"

# --- Indexes (after load) ---

echo
echo "→ Building indexes"
time psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/indexes.sql"

# --- ANALYZE so the planner has stats ---

echo
echo "→ ANALYZE"
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "ANALYZE;"

# --- Report ---

echo
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/report.sql"

echo
echo "✓ Done. Connect: psql $DB_NAME"
