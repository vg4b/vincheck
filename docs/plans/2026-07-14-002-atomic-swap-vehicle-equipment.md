# Plan: eliminate the refresh blackout window (atomic table swap)

**Status:** Phase A implemented + verified 2026-07-15 (`feat/equipment-atomic-swap`).
Phase B **gated on a volume resize** — see the measured disk numbers under Scope.
Created 2026-07-14, right after `feat/vehicle-equipment` shipped (`edaf36f`).

**Phase A verification (local, real load + concurrent reader):** a poller sampling
`count(*)` every 50ms across a live swap saw only the old count (13) then the new
(599999) — **never 0, never a partial value**, i.e. the blackout is gone. Also
confirmed: the 80%-of-previous guard refuses a truncated CSV and keeps the live
table; the swapped-in table keeps its canonical index name and its
`vincheck_api` SELECT grant (`has_table_privilege` = t — the silent-failure mode);
and `SAMPLE_LINES` falls back to TRUNCATE+COPY (never swaps a sample over real
data).

## The problem this fixes

`scripts/ingest-vehicle-cache.sh` loads every dataset as **TRUNCATE → COPY**:

```bash
"${PSQL[@]}" -c "TRUNCATE $table;"
...
"\copy $table FROM '$file' WITH (FORMAT csv, HEADER, ENCODING 'UTF8')"
```

Both statements run in **autocommit**, so the truncation is visible to readers
the instant it commits. For the whole duration of the COPY, the table is empty
and then progressively half-full.

That was tolerable for the pre-existing tables, and the script's own header says
so — *"Brief unavailability during the load is acceptable: api/vehicle.js falls
back to the live API on a cache miss."* **`vehicle_equipment` breaks that
assumption.** The fallback only rescues a *registry* miss: if `vehicle_registry`
is mid-load, the VIN isn't found, the cache reports a miss, and the request goes
to the live API. But `vehicle_equipment` is a companion table read *after* the
registry row is found. An empty companion table is not a miss — it's a
successful lookup that returns **zero equipment**.

So during each monthly refresh, for as long as the equipment COPY runs
(**measured: 1m17s** against Scaleway on 2026-07-14, 12.48M rows), every visitor
silently sees:

- no "Doplňkové vybavení zapsané v registru" card at all (the card is gated on
  `equipment.length > 0`), and
- **no ex-autoškola / ex-IZS / LPG usage flags** — the most valuable signals we
  have, absent with no error and no visible degradation.

Worse than the web: a **certificate purchased during that window freezes the
empty snapshot into the DB forever** (`api/_certificate.ts` stores the whole
`VehicleCacheResult`; the PDF is rendered from it later). The buyer pays 99 Kč
for a document that permanently omits equipment the registry does hold, and
nothing about it looks broken. That is the real reason to fix this — the web
self-heals in 77 seconds, a sold PDF does not.

Note the same argument applies to `vehicle_inspections`, `vehicle_owners`,
`vehicle_deregistration` and `vehicle_imports` — they are all companion tables
read after the registry hit, and all TRUNCATE-then-COPY. The equipment table just
made it obvious. **Consider generalising the fix to all companion tables** (see
"Scope" below).

## The fix

Load into a new table, then swap it in with a rename **inside a transaction**.
DDL is transactional in Postgres, so readers see either the old table or the new
one, never an empty one. The swap takes milliseconds.

```sql
BEGIN;
-- Both renames + the drop commit together; readers block only for the swap.
ALTER TABLE vehicle_equipment          RENAME TO vehicle_equipment_old;
ALTER TABLE vehicle_equipment_new      RENAME TO vehicle_equipment;
ALTER INDEX vehicle_equipment_pcv_idx     RENAME TO vehicle_equipment_pcv_idx_old;
ALTER INDEX vehicle_equipment_new_pcv_idx RENAME TO vehicle_equipment_pcv_idx;
DROP TABLE vehicle_equipment_old;
COMMIT;
```

### Sequence

1. `DROP TABLE IF EXISTS vehicle_equipment_new` (clean up any aborted run).
2. `CREATE TABLE vehicle_equipment_new (LIKE vehicle_equipment INCLUDING ALL)` —
   inherits the column types; indexes are created *after* the COPY, not before.
3. `COPY` the CSV into `vehicle_equipment_new`. Nothing reads it, so this can
   take as long as it likes.
4. `CREATE INDEX vehicle_equipment_new_pcv_idx ON vehicle_equipment_new (pcv)` —
   building the index on the unswapped table costs nothing in availability, and
   is *faster* than loading into an indexed table.
5. `GRANT SELECT ON vehicle_equipment_new TO vincheck_api` — **easy to forget and
   silent when wrong.** The grant does NOT follow the rename automatically from
   `ALTER DEFAULT PRIVILEGES`; that only covers tables at creation time by the
   admin role. Verify with `has_table_privilege` before swapping (see below).
6. `ANALYZE vehicle_equipment_new`.
7. The transactional swap above.

### Guardrails

- **Refuse to swap in a table that is obviously wrong.** A truncated download or
  a half-written CSV must not silently replace 12.5M good rows with 200 bad ones.
  Before the swap, assert the new table has at least, say, 80% of the row count
  the old one had (`cache_meta.row_count`), and abort loudly otherwise. This is
  the single most valuable thing in this plan — TRUNCATE-then-COPY has the same
  hazard today and no such check.
- **Verify the grant before swapping**, not after:
  `SELECT has_table_privilege('vincheck_api','vehicle_equipment_new','SELECT')`
  must be `t`. If it's false and we swap anyway, the read path catches `42501`,
  degrades to an empty section, and the feature disappears permanently with no
  error — the exact silent failure the release plan warned about.
- Keep `SAMPLE_LINES` working: a sampled load must **not** swap (it would replace
  the real table with a 200k-row sample). Either skip the swap under
  `SAMPLE_LINES`, or make the row-count guard reject it naturally.

## Scope — how far to take it

Two options, in increasing order of value and risk:

**A. Equipment only (minimal).** Special-case `vehicle_equipment` in the ingest
script. Smallest diff; fixes the table where a stale read gets frozen into a paid
PDF. Leaves the other companion tables with the same (smaller) hole.

**B. All companion tables (recommended, but do it deliberately).** Generalise the
load to `<table>_new` + swap for `vehicle_inspections`, `vehicle_owners`,
`vehicle_deregistration`, `vehicle_imports` and `vehicle_equipment`.
`vehicle_registry` can stay TRUNCATE-then-COPY — a miss there *does* fall back to
the live API, which is the designed behaviour — though swapping it too would
remove the fallback traffic spike entirely.

Cost of B: **disk** — and it doesn't fit today. The swap holds the old and new
copies of a table at once, so peak = current usage + the largest table being
swapped (the loop drops each `_old` before the next `_new`, so it's the largest,
not the sum). Measured on Scaleway 2026-07-15:

| | |
|---|---|
| Volume capacity | 85 GB |
| Current usage | 69.38 GB → **~15.6 GB free** |
| `vehicle_inspections` (largest in-scope companion) | **14.30 GB** total (heap+idx) |
| `vehicle_owners` | 11.47 GB |
| `vehicle_equipment` (Phase A) | **0.95 GB** |
| `vehicle_imports` / `vehicle_deregistration` | 0.29 / 0.20 GB |

- **Phase A fits with room to spare:** peak 69.38 + 0.95 = **70.3 GB** (~14.7 GB
  free). Safe now, before or after any ingest.
- **Phase B does NOT fit:** swapping `vehicle_inspections` peaks at 69.38 + 14.30 =
  **83.7 GB against the 85 GB cap — 1.3 GB headroom**, which index-build temp space
  + WAL can exceed. Running the volume out of disk mid-swap is a bad failure.

Excluded from B on purpose: `vehicle_registry` (18.83 GB — a miss falls back to the
live API) and `vehicle_inspection_odometer` (18.57 GB — separate weekly cron,
UPSERT-keyed, never truncated, so no blackout).

The disk-free alternative (TRUNCATE + COPY inside one transaction, no second copy)
was rejected: TRUNCATE holds an ACCESS EXCLUSIVE lock for the whole COPY, so
readers **block** for a minute+ instead of seeing empty data — worse than today.
The swap's rename lock is milliseconds, which is why it's the right tool; it just
costs the disk.

**Recommendation / sequencing decision (2026-07-15):**
1. **Phase A now** — shipped on `feat/equipment-atomic-swap`. Deploy before the
   next ingest so the next refresh already runs zero-blackout.
2. **Live with Phase A; do NOT resize the volume just for Phase B.** Scaleway block
   volumes **cannot be shrunk** ([docs](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/manage-volumes/)),
   so bumping 85 → 120 GB is a permanent, irreversible cost. Phase B only buys the
   elimination of a *rare* risk (a certificate sold during the ~10–15 min/month
   window while inspections/owners reload), which does not justify a forever cost
   increase at current certificate volume.

   Cheap mitigations instead, no disk cost:
   - **Run the monthly ingest off-peak (≈ 3–4 AM CET)** — collapses the probability
     of a sale landing in the window; a page view self-heals anyway, only a *sold
     cert* freezes bad data. (Now documented in the refresh-vehicle-cache skill.)
   - *Optional, later:* a `refresh_in_progress` flag in `cache_meta` that the
     certificate **purchase** path checks and briefly defers — closes the only hole
     that truly matters (a permanently-wrong paid PDF). Hold until cert volume
     justifies it.

3. **The natural trigger for Phase B: the next capacity-driven resize.** The volume
   is already **~82% full (69.38 / 85 GB) and grows every month** — the odometer
   table appends weekly, and the monthly snapshots creep up as the fleet grows. A
   resize for *capacity* is likely coming within months regardless. When it does,
   size it generously and **Phase B rides along for free** — the headroom will
   already be there and the irreversible cost is one you were going to pay anyway.
   Don't spend an irreversible resize *on Phase B*; fold Phase B into the resize
   you'll be forced into. Revisit sooner only if certificate volume grows enough
   that a ~15 min/month window starts catching real sales.

## Verification

- Dry-run the whole flow against a local Postgres with `SAMPLE_LINES`, asserting
  the swap is skipped and the real table is untouched.
- Load the real 12.5M-row CSV locally, and **hold a `SELECT` open in another
  session across the swap** to prove no reader ever sees an empty table:
  ```bash
  # session 1: poll continuously during the ingest
  while true; do psql -X -t -A -c \
    "SELECT count(*) FROM vehicle_equipment WHERE pcv = 1039592;"; sleep 0.2; done
  ```
  This must print `4` continuously and never `0`. That single check is the whole
  point of the change — if it ever prints `0`, the swap isn't atomic.
- Verify the row-count guard aborts on a deliberately truncated CSV.
- Confirm `vincheck_api` can still SELECT after the swap (`has_table_privilege`).

## Not doing

- **`REFRESH MATERIALIZED VIEW CONCURRENTLY`** — wrong tool: this is a plain
  table loaded from a CSV, not a view over other tables.
- **Loading into the live table with `DELETE` instead of `TRUNCATE`** — MVCC would
  keep readers consistent, but it writes 12.5M dead tuples and needs a VACUUM;
  far more expensive than a rename.
- **Taking the site down for the refresh.** The window is ~1 minute; the fix is
  cheap enough that downtime is not warranted.
