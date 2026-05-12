# Plan — Vehicle Data Cache (Bulk CSV → DB, API as Fallback)

## Context

Today every VIN/TP/ORV lookup hits the Czech government registry API at `api.dataovozidlech.cz` in real time (see `src/utils/vehicleApi.ts` → `fetchVehicleInfo`). The endpoint returns ~90 fields per vehicle. The same dataset is published as **public bulk CSVs**, refreshed periodically (the open-data portal exports the full registry at regular intervals).

By **ingesting the CSVs into our own Postgres** and serving lookups from there with the live API as a **fallback for cache misses**, we gain:

1. **Speed** — sub-50ms DB query versus ~300–1500ms upstream API call. Faster home-page UX, better Core Web Vitals, fewer abandoned searches.
2. **Resilience** — when the upstream is slow or down (it's a government service; outages happen), we still answer most lookups.
3. **Cost / rate-limit headroom** — bulk CSV ingest is one large operation per refresh window; live calls scale with traffic. We avoid surprise rate-limiting.
4. **Richer queries** — once the data is in Postgres, we can index/search/aggregate in ways the upstream API doesn't support (e.g., "show me all 2018 Octavias registered in Prague" — competitor differentiator).
5. **Historical snapshots** — by keeping each refresh as a dated snapshot, we can show "your STK status as of last sync" and surface changes (e.g., "STK validity extended on 2026-04-12").

The downside is **scope** — this is a real backend/data project, not a styling tweak. Plan accordingly.

## What the data looks like (must verify before planning further)

**Investigation step 1.** The plan below assumes the bulk CSV mirrors the API response, with a row per vehicle, keyed by VIN. **Before committing**, verify:

- The CSV download URL(s) and update cadence (daily? weekly? monthly?).
- Row count (likely tens of millions across all CZ vehicles — sizing matters).
- Whether VIN, CisloTp, CisloOrv are all stable primary keys across snapshots.
- Whether the CSV contains every field the live API returns or a strict subset.
- License / terms of use (Datová kostka / open data — should be permissive, but confirm).

`docs/DATA_OVOZIDLECH_SCHEMA.md` already exists in this repo — read it first; it likely answers most of the above.

If the CSV is a strict subset of API fields, the architecture is still valuable: cache the subset, hit API for any field not in cache.

## Proposed architecture

### 1. New table — `vehicle_registry_cache`

```sql
CREATE TABLE vehicle_registry_cache (
  vin            TEXT PRIMARY KEY,         -- 17 chars, alphanumeric
  cislo_tp       TEXT,
  cislo_orv      TEXT,
  data           JSONB NOT NULL,           -- full record as key/value
  source_snapshot DATE NOT NULL,           -- date of the CSV import that produced this row
  imported_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- generated columns or partial indexes for the hot lookup paths
  tovarni_znacka TEXT GENERATED ALWAYS AS (data->>'TovarniZnacka') STORED,
  typ            TEXT GENERATED ALWAYS AS (data->>'Typ') STORED,
  datum_prvni_registrace DATE GENERATED ALWAYS AS ((data->>'DatumPrvniRegistrace')::DATE) STORED,
  stk_do         DATE GENERATED ALWAYS AS ((data->>'PravidelnaTechnickaProhlidkaDo')::DATE) STORED
);

CREATE INDEX vehicle_registry_cache_cislo_tp_idx ON vehicle_registry_cache(cislo_tp) WHERE cislo_tp IS NOT NULL;
CREATE INDEX vehicle_registry_cache_cislo_orv_idx ON vehicle_registry_cache(cislo_orv) WHERE cislo_orv IS NOT NULL;
CREATE INDEX vehicle_registry_cache_stk_do_idx ON vehicle_registry_cache(stk_do) WHERE stk_do IS NOT NULL;
CREATE INDEX vehicle_registry_cache_brand_idx ON vehicle_registry_cache(tovarni_znacka);
```

**Why JSONB for the bulk data:** flexible — when the registry adds a new field, no migration needed. Generated columns expose the hot-query fields for fast indexed lookups.

**Sizing concern:** if there are ~8M vehicles in CZ and each JSONB record is ~2KB, that's ~16GB. Vercel Postgres pricing is per-storage — confirm budget. Alternatives: store only common fields as columns, lean keys (e.g., short codes), or move to a dedicated Postgres provider (Supabase / Neon free tier handles this scale fine).

### 2. Ingest pipeline — `scripts/ingest-vehicle-csv.ts`

A standalone script (not a Vercel function — too long-running) that:

1. Downloads the latest CSV(s) from the open-data source.
2. Streams parsing (don't load into memory).
3. Upserts rows in batches of ~1000 using `INSERT ... ON CONFLICT (vin) DO UPDATE`.
4. Stamps `source_snapshot = <CSV publication date>`.
5. After successful import, deletes rows with `source_snapshot` older than the previous snapshot (configurable — keep last N snapshots if historical comparison is wanted).

Run via:

- **Manual:** `npm run ingest:vehicles` from a beefy local box or a dedicated VM. Initial bootstrap.
- **Scheduled:** GitHub Actions cron, daily or weekly depending on registry refresh cadence. Or a long-running Vercel cron with chunked execution (Vercel functions have ~5min timeout — would need chunking).

Use `pg-copy-streams` for max throughput (Postgres COPY beats INSERT batches by ~10×).

### 3. Lookup logic — `src/utils/vehicleApi.ts`

Current `fetchVehicleInfo(vin, tp, orv)` calls the upstream directly. Refactor to:

```ts
async function fetchVehicleInfo(vin, tp, orv) {
  // 1. Try cache first
  const cached = await fetchFromCache(vin, tp, orv)
  if (cached && !isStale(cached)) return cached

  // 2. Cache miss or stale → fall back to live API
  try {
    const live = await fetchFromLiveAPI(vin, tp, orv)
    // 3. Write-through: write the live result back to cache
    await upsertCache(live)
    return live
  } catch (err) {
    // 4. Live API failed but we have stale cache → return stale with warning flag
    if (cached) return { ...cached, _stale: true, _source: 'cache_fallback' }
    throw err
  }
}
```

The `_source` field lets the frontend show "data from last sync (2026-05-10)" when serving stale.

"Stale" definition is a judgment call:
- **Aggressive (preferred):** `source_snapshot` within last 30 days → fresh; older → re-fetch.
- **Conservative:** never stale (cache always wins, periodic background refresh keeps it current).

Start aggressive, observe live-API call rates, dial down if too chatty.

### 4. New endpoint behaviour — no new endpoint needed

The lookup is already routed through `api/vehicle.js`. The cache lookup happens transparently inside that function. No client-side change required for v1.

### 5. UI surface — show "extra" cached fields

Once data is in our DB, we can display fields the live API skips OR present aggregations the user can't get elsewhere. Examples:

- **"Other vehicles with this brand/model"** — same-make analytics.
- **"Average mileage at first STK"** for the make/model/year combo.
- **STK due-soon list** — proactive "10 vehicles in your fleet expire next month".
- **Brand profile pages** — `/znacka/skoda` lists features extracted from cached data.

This is the differentiator vs. competitors who only proxy the live API. Build these incrementally in Phase 2 of this initiative.

## Phased rollout

### Phase 1 — Cache hot path (highest value, lowest risk)

**Scope:**

- Create `vehicle_registry_cache` table.
- Build ingest script. Bootstrap with one full CSV download.
- Add cache-lookup wrapping the existing live API call. Pure addition — live API is the source of truth, cache is a speed/resilience layer.
- Frontend unchanged.

**Outcome:** every hot-path lookup returns from cache. Live API only triggered for genuine cache misses (vehicles not in CZ registry, vehicles registered between snapshots). User-visible improvement: noticeably faster `/vin/XXX` page loads, fewer timeouts during upstream incidents.

**Effort:** ~2–3 days including ingest tuning, monitoring, smoke testing.

**Risk:** Medium. The ingest script is the riskiest part (long-running, must handle failures, idempotent). If it bugs out, we ship a stale or partial cache. Mitigation: stage to a non-prod table first, swap in atomically when verified.

### Phase 2 — Differentiation

After Phase 1 stabilises (~1 month of clean operation):

- Brand/model index pages.
- Aggregated stats ("Top 10 nejhledanějších značek").
- STK due-soon dashboard for logged-in users with multiple vehicles.

**Effort:** weeks; each surface is its own project.

### Phase 3 — Historical snapshots / change detection

Keep ≥2 snapshots, diff per-vehicle to detect changes ("Your STK validity was extended on …"). High product value but real engineering investment.

## What this plan does NOT solve

- **Vehicles registered after the last snapshot.** Live API fallback handles these, but they're not in cache, so first-time loads still hit the API. Acceptable.
- **Privacy of bulk data.** The dataset is public, but storing it at this scale means you're now a target — confirm hosting region complies with Czech / EU data protection rules. Talk to your hosting provider.
- **Real-time changes between snapshots.** STK extensions, new owners, etc. — the live API handles these; cache may be stale. Acceptable as long as `_stale` flag is exposed.

## Files to create / modify

| File | Purpose |
|---|---|
| `api/_vehicleCache.ts` (new) | Cache read/write helpers. |
| `src/utils/vehicleApi.ts` | Wrap live API with cache lookup. |
| `scripts/ingest-vehicle-csv.ts` (new) | Bulk CSV → DB ingest. |
| `scripts/migrations/vehicle_registry_cache.sql` (new) | Schema for the cache table. |
| `package.json` | Add `ingest:vehicles` script, deps for streaming CSV parse + COPY. |
| `.github/workflows/ingest-vehicles.yml` (new, optional) | Cron to refresh nightly/weekly. |
| `docs/DATA_OVOZIDLECH_SCHEMA.md` | Update / cross-reference. |

## Pre-implementation investigation (gate)

Before writing any code, answer:

1. **CSV download URL and exact format.** Read `docs/DATA_OVOZIDLECH_SCHEMA.md` first.
2. **Row count and average row size.** Multiply for total storage. Compare to current DB plan limits.
3. **Refresh cadence at the source.** Determines our cache freshness floor.
4. **Are VIN, CisloTp, CisloOrv unique within a single snapshot?** If not, what disambiguates? Probably an `IdVozidla` internal key.
5. **License terms.** Confirm we're allowed to cache and re-serve.

Answers from these dictate Phase 1 scope and effort.

## Verification

Once Phase 1 ships:

- `GET /vin/<known-vin>` p50 latency drops from ~500ms to <100ms (measure via Vercel Analytics).
- During a manufactured outage (block egress to `api.dataovozidlech.cz` in a staging env), the page still loads from cache.
- A vehicle known to be absent from the snapshot triggers a live API call and gets cached as a write-through (verify via DB inspect after the call).
- Bulk reminder send (cron) doesn't hit the upstream API at all — confirm by API access log.

## Status

⬜ Investigation pending (2026-05-12). Gate decision after the five investigation questions above are answered.
