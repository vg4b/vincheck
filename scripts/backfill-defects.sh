#!/usr/bin/env bash
#
# U3 of docs/plans/2026-08-17-001-feat-stk-defect-codes-plan.md: backfill the
# defect columns (migration 007) across the whole ISTP archive, in slices.
#
# Why sliced: this rewrites all 90.7M rows of vehicle_inspection_odometer. Every
# UPSERT leaves a dead tuple behind (MVCC), so an unsliced run would grow the
# volume by the whole table again before anything could be reclaimed. Slices of
# ~2-3M rows with an explicit VACUUM between them keep the peak flat, because
# each VACUUM returns that slice's dead space to the free space map for the next
# slice to reuse.
#
# Autovacuum will NOT do this for us: it has never run on this table
# (autovacuum_count = 0, it has only ever been INSERTed into), and at
# autovacuum_work_mem = 150MB against 90.7M rows it is far too slow to keep up.
#
# Idempotent: the load UPSERTs on cislo_protokolu, and progress is recorded in a
# state file, so an interrupted run resumes at the first unfinished slice.
#
# Usage:
#   caffeinate -i env DATABASE_URL='<ADMIN_URL>' \
#     bash scripts/backfill-defects.sh 2>&1 | tee /tmp/backfill-defects.log
#
#   DRY_RUN=1 ...          print the slice plan and exit; touches nothing
#   MIGRATE_ONLY=1 ...     apply migration 007 and stop
#   SKIP_MIGRATE=1 ...     assume 007 is already applied
#   MAX_BYTES=...          hard stop threshold (default 85 GB)
#   MAX_SLICES=1           stop after N newly-loaded slices (the plan's
#                          "run one slice first, then measure" step)
#   VACUUM_DEAD_THRESHOLD  dead tuples before a VACUUM runs (default 8000000)
#   THROTTLE=25            ms pause between ingest batches (eases the shared node)
#   STATE=<path>           progress file (default scripts/.backfill-defects.state)
#   XML_DIR=<path>         archive location (default ~/Desktop/datova kostka/odometer-xml)
#
# Password characters: `/`, `#` and `?` MUST be percent-encoded in the URL (%2F,
# %23, %3F) — Node's URL parser rejects the string outright otherwise. `!`, `@`,
# `=`, `[` and `%` parse fine as-is. Note that `!` still trips zsh history
# expansion even inside double quotes, so prefer editing .env directly over
# echoing the URL into it.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE="${STATE:-$SCRIPT_DIR/.backfill-defects.state}"
XML_DIR="${XML_DIR:-$HOME/Desktop/datova kostka/odometer-xml}"
THROTTLE="${THROTTLE:-25}"
TABLE="vehicle_inspection_odometer"

# Scaleway flips an instance to read-only `disk_full` when the volume fills,
# which would take the live lookup path down with it. Stop well before that.
MAX_BYTES="${MAX_BYTES:-91268055040}"   # 85 GB of the 100 GB volume

# Vacuum once this many dead tuples have piled up. At ~280 B/row, 8M dead rows
# is ~2.2 GB of reclaimable space — small against the 20 GB of headroom the
# sizing leaves, and it cuts the number of vacuum passes from 48 to ~11.
VACUUM_DEAD_THRESHOLD="${VACUUM_DEAD_THRESHOLD:-8000000}"

# --- connection -------------------------------------------------------------
# Fall back to .env (gitignored) so the admin URL never has to be pasted into a
# shell history. Only DATABASE_URL is read from it; nothing is printed.
if [[ -z "${DATABASE_URL:-}" && -f "$REPO_DIR/.env" ]]; then
  # `|| true`: grep exits 1 when the key is absent, which pipefail would turn
  # into a fatal error before the friendlier check below can report it.
  # Tolerates optional whitespace and either quote style, matching
  # loadEnvFromFile() in ingest-odometer.ts so both read the same file the same
  # way. `cut -d= -f2-` keeps everything after the FIRST `=`, so a password
  # containing `=` survives.
  DATABASE_URL="$(grep -E '^[[:space:]]*DATABASE_URL[[:space:]]*=' "$REPO_DIR/.env" \
    | head -1 | cut -d= -f2- \
    | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/' || true)"
fi
if [[ -z "${DATABASE_URL:-}" && -z "${DRY_RUN:-}" ]]; then
  echo "DATABASE_URL is not set (admin connection string required)." >&2
  echo "Add it to .env or pass it inline; see the usage block above." >&2
  exit 1
fi

# A slice takes minutes and psql sits idle while tsx works. Without keepalives
# the connection dies silently mid-run and psql hangs forever.
psql_url() {
  local u="$1"
  [[ "$u" == *keepalives=* ]] || u="${u}$([[ "$u" == *\?* ]] && echo '&' || echo '?')keepalives=1&keepalives_idle=15"
  printf '%s' "$u"
}
PSQL_URL="$(psql_url "${DATABASE_URL:-}")"
psql_q() { psql "$PSQL_URL" -qtAX -c "$1"; }

human() { awk -v b="$1" 'BEGIN{printf "%.1f GB", b/1073741824}'; }

# Files whose filename date falls in [from, to] — both bounds inclusive, matching
# the --from/--to filter in ingest-odometer.ts.
count_files() {
  ls "$XML_DIR"/prohlidky_*.xml.gz 2>/dev/null \
    | sed -E 's#.*prohlidky_([0-9-]+)\.xml\.gz#\1#' \
    | awk -v a="$1" -v b="$2" '$1>=a && $1<=b' | wc -l | tr -d ' '
}

# --- slice plan -------------------------------------------------------------
# Sized so one slice's dead tuples stay well under a gigabyte. The archive is
# not uniform: a 2010 year-file is ~0.26 GB but a 2024 one is ~0.86 GB, so the
# slice length shrinks as inspection volume grows. Target is 2-3M rows each.
#   2008-2015  yearly     (<= 0.33 GB/yr)
#   2016-2017  half-yearly
#   2018-2026  quarterly
slices() {
  local y
  for y in $(seq 2008 2015); do echo "$y-01-01 $y-12-31"; done
  for y in 2016 2017; do
    echo "$y-01-01 $y-06-30"
    echo "$y-07-01 $y-12-31"
  done
  for y in $(seq 2018 2026); do
    echo "$y-01-01 $y-03-31"
    echo "$y-04-01 $y-06-30"
    echo "$y-07-01 $y-09-30"
    echo "$y-10-01 $y-12-31"
  done
}

if [[ -n "${DRY_RUN:-}" ]]; then
  echo "Slice plan ($(slices | wc -l | tr -d ' ') slices):"
  while read -r from to; do
    n=$(count_files "$from" "$to")
    [[ "$n" == "0" ]] && continue
    printf '  %s .. %s  %4s files\n' "$from" "$to" "$n"
  done < <(slices)
  exit 0
fi

# --- migration --------------------------------------------------------------
if [[ -z "${SKIP_MIGRATE:-}" ]]; then
  echo "==> applying migration 007 (additive, nullable, no default)"
  psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/migrations/007_inspection_defects.sql"
  cols=$(psql_q "SELECT count(*) FROM information_schema.columns
                 WHERE table_name='$TABLE'
                   AND column_name IN ('zavady_a','zavady_b','zavady_c',
                       'zavady_kody','zavady_zavaznosti','rozsah','emisni_system')")
  if [[ "$cols" != "7" ]]; then
    echo "expected 7 new columns, found $cols — aborting" >&2
    exit 1
  fi
  echo "    7/7 columns present"
fi
[[ -n "${MIGRATE_ONLY:-}" ]] && { echo "MIGRATE_ONLY set — stopping."; exit 0; }

# --- backfill ---------------------------------------------------------------
touch "$STATE"
baseline=$(psql_q "SELECT pg_database_size(current_database())")
echo "==> baseline database size: $(human "$baseline")"
echo "==> hard stop at $(human "$MAX_BYTES")"

total=$(slices | wc -l | tr -d ' ')
i=0
loaded=0
while read -r from to; do
  i=$((i + 1))
  key="$from..$to"
  if grep -qxF "$key" "$STATE"; then
    echo "[$i/$total] $key — already done, skipping"
    continue
  fi

  # An empty slice would still trigger a full-table VACUUM below, which costs
  # minutes on 90.7M rows for no benefit. Record it as done and move on.
  n=$(count_files "$from" "$to")
  if [[ "$n" == "0" ]]; then
    echo "[$i/$total] $key — no files, skipping"
    echo "$key" >> "$STATE"
    continue
  fi

  echo "[$i/$total] $key — loading $n files"
  started=$(date +%s)
  ( cd "$REPO_DIR" && DATABASE_URL="$DATABASE_URL" npx tsx scripts/ingest-odometer.ts \
      --dir "$XML_DIR" --from "$from" --to "$to" --throttle "$THROTTLE" )
  load_done=$(date +%s)

  # VACUUM only once enough dead tuples have accumulated. The point of vacuuming
  # between slices is to return dead space to the free space map so the next
  # slice reuses it instead of extending the heap — that goal is met by
  # vacuuming per N million dead rows, not per slice. Vacuuming every slice
  # would pay the scan 48 times for no extra headroom.
  dead=$(psql_q "SELECT n_dead_tup FROM pg_stat_user_tables WHERE relname='$TABLE'")
  if (( dead > VACUUM_DEAD_THRESHOLD )); then
    echo "[$i/$total] $key — VACUUM ($dead dead tuples)"
    psql "$PSQL_URL" -qX -c "VACUUM $TABLE"
  else
    echo "[$i/$total] $key — VACUUM skipped ($dead dead < $VACUUM_DEAD_THRESHOLD)"
  fi
  vac_done=$(date +%s)

  size=$(psql_q "SELECT pg_database_size(current_database())")
  echo "[$i/$total] $key — done · load $(( (load_done - started) / 60 ))m$(( (load_done - started) % 60 ))s · vacuum $(( vac_done - load_done ))s · db $(human "$size")"
  echo "$key" >> "$STATE"

  loaded=$((loaded + 1))
  if [[ -n "${MAX_SLICES:-}" ]] && (( loaded >= MAX_SLICES )); then
    echo "==> MAX_SLICES=$MAX_SLICES reached · db $(human "$size") (baseline $(human "$baseline"))"
    echo "==> re-run to continue; progress is in $STATE"
    exit 0
  fi

  if (( size > MAX_BYTES )); then
    echo "STOP: database at $(human "$size") exceeds the $(human "$MAX_BYTES") threshold." >&2
    echo "Re-run to resume after reassessing; progress is in $STATE." >&2
    exit 1
  fi
done < <(slices)

echo "==> final VACUUM ANALYZE"
psql "$PSQL_URL" -qX -c "VACUUM ANALYZE $TABLE"

final=$(psql_q "SELECT pg_database_size(current_database())")
echo "==> backfill complete · $(human "$baseline") -> $(human "$final")"
echo "==> run the U3 verification queries next (see the plan)"
