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

## Source — `download.dataovozidlech.cz`

Confirmed (2026-05-20) from the open-data portal:

- **Cadence:** monthly, **full snapshot** (not deltas). Published on the **12th of the following month**.
- **Format:** CSV, UTF-8, comma-separated. OFN data types (string / date / float / boolean).
- **License:** open data under § 106/1999 Sb. (svobodný přístup k informacím) — redistribution permitted.
- **Available range:** snapshots from **November 2025** onwards (older snapshots are in a different format and not published here). Past months are gzipped; the current month is uncompressed.
- **Cross-dataset join key:** **PČV** (jedinečný identifikátor vozidla). Replaces our earlier "everything keyed by VIN" assumption.

The bulk source is **not** one CSV — it's **seven companion datasets** (six ingested, one rejected), all joined by PČV. The live API exposes only dataset #1; the rest is data the API never returns. So this isn't just a cache, it's a **superset**.

## Available datasets & strategic priority

| # | Dataset (URL slug) | What's in it | Priority | Why |
|---|---|---|---|---|
| 1 | `vypisvozidel` — Vozidla, technické údaje | Per-vehicle technical specs (≈ live API). | **P0** | Speed + resilience for current lookups. |
| 2 | `technickeprohlidky` — Technické prohlídky | STK history per vehicle: pass-status (Stav A/B/C), station, validity windows. **No odometer column.** | **P0** | STK pass/fail history + station-shopping anomalies + count of past inspections. Not a Cebia replacement (no mileage in source), still a unique free signal. |
| 3 | `vlastnikprovozovatelvozidla` — Vlastník/provozovatel | Owner & operator intervals. Legal entities expose IČO + Název + Adresa; individuals are anonymised (only dates + flags). | **P0** | "5 majitelů za 8 let" + ex-fleet detection (IČO match). Used-car valuation signal. |
| 4 | `vozidlavyrazenazprovozu` — Vyřazená z provozu | Deregistration events (sold abroad / scrapped / totaled). | **P1** | Buyer-safety warning. Small volume, high signal. |
| 5 | `zpravyvyrobcezastupce` — Zprávy výrobce/zástupce | **Not recalls** (the original assumption was wrong): free-text clerk notes, truncated at 65 chars. | **✗ Rejected** | 1.1% coverage; 32% of rows carry clerk names (GDPR); only signal of value (VIN re-stamping) fires on 1 in 1,480 live vehicles. Assessed + dropped 2026-07-14. |
| 6 | `vozidladovoz` — Dovezená vozidla | Import country + date (`PČV, Stát, Datum dovozu`). | **P1 — ✅ ingested** | Imported = the CZ registry holds no foreign history, so the paid Cebia report is worth most there. Powers the "Dovezené vozidlo z {země}" badge + an import-targeted Cebia upsell. |
| 7 | `vozidladoplnkovevybaveni` — Doplňkové vybavení | Equipment + modifications per vehicle (`PČV, Typ, Od, Do`), 35 types. | **P1 — ✅ ingested** | Originally dismissed as a mere "accessory list" — wrong. It's the only source of **usage** signals: dual controls = ex-driving-school (21k), beacons = ex-emergency/utility (138k), LPG/CNG retrofit (315k). Powers the "Výbava a úpravy" section + red-flag badges. |

> **Note on date-mismatch heuristics:** the naive "imported = `datum_prvni_registrace_v_cr` > `datum_prvni_registrace`" trick was rejected — it fires on ~40% of the parc and is polluted by sentinel dates (`1900-01-01`, bulk `1981-xx`). The authoritative source is the `vozidladovoz` dataset above, which also gives the country of origin.

### The competitive wedge

The schema docs confirm `technickeprohlidky` **does not include odometer at inspection** — so the earlier "free 'stočený tachometr' detection" framing was wrong. What P0 *does* give us, beyond tech specs:

- **STK history per vehicle** — pass-status (Stav A/B/C) + station + validity windows. Anomaly signal ("3 different STK stations in 2 years" = inspector shopping; failed inspection followed by retest elsewhere).
- **Owner timeline** — count of distinct subjects + transition dates per PČV. Legal-entity ownership exposes IČO/Název/Adresa → ex-fleet / ex-rental detection.
- **Import / deregistration flags** (P1) — buyer-safety warnings.

That's a **vehicle-history-lite** — not a full Cebia replacement (mileage is the missing piece, and Cebia gets it from servis/STK private feeds we can't access), but it's a free, public-data-only signal layer **other VIN-lookup competitors don't surface**. It anchors the search-stay-bookmark conversion that feeds the reminder loop + insurance lead-gen.

### One-off filtered exports (`/vydej`)

The portal also offers an email-delivered filtered export (region, brand, year ranges, …). **Not part of the recurring ingest** — useful only for prototyping a UI on a small targeted slice ("50k Octavias to mock up a brand page") without ingesting the full monthly snapshot. Park it.

## Per-dataset schemas

Confirmed against `dataovozidlech.cz/info/<slug>` documentation pages + sample CSVs. Header rows match column names verbatim, with a UTF-8 BOM byte order mark on every file (ingest must strip).

### `vypisvozidel` — Vozidla, technické údaje (~90 columns)

Foundation table. Hot columns surfaced as generated columns; the long tail goes to `data JSONB`.

| Column | Type | Notes |
|---|---|---|
| `PČV` | int | cross-dataset join key — `BIGINT PRIMARY KEY` |
| `VIN` | string | nullable; indexed |
| `Číslo TP`, `Číslo ORV` | string | indexed (lookup keys today) |
| `Status` | string (povinná) | e.g. `PROVOZOVANÉ`, `ZÁNIK` |
| `Datum 1. registrace`, `… v ČR` | date | first-registration dates |
| `Tovární značka`, `Typ`, `Obchodní označení` | string | brand / type / model |
| `Druh vozidla`, `Kategorie vozidla` | string | OSOBNÍ AUTOMOBIL, M1, … |
| `Palivo`, `Zdvihový objem [cm³]`, `Max. výkon` | string/float | engine |
| `Plně elektrické vozidlo`, `Hybridní vozidlo` | boolean | |
| `Stupeň plnění emisní úrovně` | string | EURO 5/6/… |
| `Rok výroby` | int | |
| `Barva`, `Provozní hmotnost`, `Specifické CO2` | mixed | |

All other ~70 columns flow into `data JSONB`; promote to generated columns ad-hoc when a UI/query needs them.

### `technickeprohlidky` — STK history (9 cols)

Many rows per PČV (one per inspection).

| Column | Type | Notes |
|---|---|---|
| `PČV` | int (povinná) | join key |
| `Typ` | string | e.g. `P - Pravidelná`, `E - Evidenční` |
| `Stav` | string | docs: `A`/`B`/`C`/`Neuvedeno`; sample also has `Nezjištěno` |
| `Kód STK` | int | station code |
| `Název STK` | string | station address |
| `Platnost od`, `Platnost do` | date | validity window |
| `Číslo protokolu` | string | nullable |
| `Aktuální` | boolean (povinná) | latest inspection of this type for the vehicle |

**No mileage / odometer column.**

### `vlastnikprovozovatelvozidla` — Owner & operator (9 cols)

Many rows per PČV (intervals).

| Column | Type | Notes |
|---|---|---|
| `PČV` | int (povinná) | join key |
| `Typ subjektu` | int (povinná) | 1 = individual (ROB), 2 = legal entity (ROS), 3 = unidentified |
| `Vztah k vozidlu` | int (povinná) | 1 = owner, 2 = operator; historical: 3 = co-owner, 4 = acquirer |
| `Aktuální` | boolean (povinná) | currently-on-vehicle flag |
| `IČO`, `Název`, `Adresa` | string | **legal entities only** — null for individuals |
| `Datum od`, `Datum do` | date | interval |

Owner count = distinct non-overlapping `(Vztah k vozidlu = 1)` intervals per PČV.

### `vozidlavyrazenazprovozu` — Deregistration (P1, 6 cols)

| Column | Type | Notes |
|---|---|---|
| `PČV` | int (povinná) | join key |
| `Datum od`, `Datum do` | date | deregistration interval |
| `Důvod` | string | reason text |
| `RM kód`, `RM Název` | int / string | registry office |

### `vozidladovoz` — Imports (✅ ingested → `vehicle_imports`, 3 cols)

`PČV` (int), `Stát` (string, povinná — full Czech country name, e.g. `Spolková
republika Německo`), `Datum dovozu` (date, often empty). Header confirmed against
the live file (`RSV_vozidla_dovoz_YYYYMMDD.csv`, UTF-8 BOM). Many vehicles have a
row; non-empty = imported. Column order in `vehicle_imports` matches the header so
`COPY` needs no column list.

### `zpravyvyrobcezastupce` — Manufacturer notices (✗ rejected, 2 cols)

`PČV` (int), `Krátký text` (string) — e.g. `ALTERNATIVNÍ PNEU`.

**Do not ingest.** Despite the name these are not recalls: 269k rows / 217.8k
distinct PČV (**1.1% coverage**), free text **truncated at 65 chars**, and
**85,162 rows (32%) embed the clerk's name** (`Zprávu zapsal: …`) — a GDPR
hazard. The one signal worth anything is VIN re-stamping (`Ražba VIN`, `obnova
VIN`), which resolves to just **7,320 vehicles still in operation — 1 in 1,480**.
Full analysis + the decision to drop it:
`docs/plans/2026-07-14-001-feat-equipment-and-manufacturer-messages.md`.

### `vozidladoplnkovevybaveni` — Equipment (✅ ingested → `vehicle_equipment`, 4 cols)

`PČV` (int), `Typ` (string), `Od`/`Do` (date). 345 MB, 12.48M rows, 8.5M distinct
PČV (1–8 rows per vehicle), 35 distinct types. **CRLF line endings** — Postgres
`COPY` strips the `\r` correctly (verified), but any awk/cut preprocessing must
`tr -d '\r'` first or the `Do` column parses as `\r` instead of empty. Several
type names carry double spaces (`MAJÁK  ORANŽOVÝ`, `ZVEDACÍ  ČELO`), so matching
normalises whitespace.

`ABS` / `AIRBAG` / `ASR` rows (4.41M, 35% of the file) are loaded but **never
displayed**: `vehicle_registry` already has them as dedicated columns in a better
form (`abs`/`asr` are explicit `True`/`False`, `airbag` is a count). A missing row
here means "no record", not "no ABS". Classification lives in
`api/_vehicleEquipment.ts`.

## Proposed architecture

### 1. Tables — one per dataset, all joined by PČV

P0 ingest creates **three tables**; full column lists come from the CSV samples (see investigation status):

- `vehicle_registry` (from `vypisvozidel`) — one row per vehicle, technical data. Replaces the live API for the hot path.
- `vehicle_inspections` (from `technickeprohlidky`) — one row per STK event, many per `pcv`. Primary signal: mileage at each inspection.
- `vehicle_owners` (from `vlastnikprovozovatelvozidla`) — one row per ownership/operator interval, many per `pcv`. Primary signal: owner count + transition dates.

Since extended: `vehicle_deregistration` (from `vozidlavyrazenazprovozu`) and
`vehicle_imports` (from `vozidladovoz`) — both many-per-`pcv`, joined the same way.
`vehicle_imports (pcv, stat, datum_dovozu)` drives the import badge + import-targeted
Cebia upsell.

All three carry `pcv TEXT NOT NULL`, `source_snapshot DATE NOT NULL`, `imported_at TIMESTAMPTZ DEFAULT now()`, plus dataset-specific columns. Sketch for the foundation table:

```sql
CREATE TABLE vehicle_registry (
  pcv             BIGINT PRIMARY KEY,      -- jedinečný identifikátor vozidla (cross-dataset join key); `int` in source CSV, BIGINT for headroom
  vin             TEXT,                    -- 17 chars; not unique in some edge cases, indexed below
  cislo_tp        TEXT,
  cislo_orv       TEXT,
  data            JSONB NOT NULL,          -- full record as key/value
  source_snapshot DATE NOT NULL,
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- hot-path generated columns
  tovarni_znacka  TEXT GENERATED ALWAYS AS (data->>'TovarniZnacka') STORED,
  typ             TEXT GENERATED ALWAYS AS (data->>'Typ') STORED,
  datum_prvni_registrace DATE GENERATED ALWAYS AS ((data->>'DatumPrvniRegistrace')::DATE) STORED,
  stk_do          DATE GENERATED ALWAYS AS ((data->>'PravidelnaTechnickaProhlidkaDo')::DATE) STORED
);

CREATE INDEX vehicle_registry_vin_idx ON vehicle_registry(vin) WHERE vin IS NOT NULL;
CREATE INDEX vehicle_registry_cislo_tp_idx ON vehicle_registry(cislo_tp) WHERE cislo_tp IS NOT NULL;
CREATE INDEX vehicle_registry_cislo_orv_idx ON vehicle_registry(cislo_orv) WHERE cislo_orv IS NOT NULL;
CREATE INDEX vehicle_registry_stk_do_idx ON vehicle_registry(stk_do) WHERE stk_do IS NOT NULL;
CREATE INDEX vehicle_registry_brand_idx ON vehicle_registry(tovarni_znacka);
```

`vehicle_inspections` and `vehicle_owners` are append-many: composite indexes on `(pcv, datum)` for chronological per-vehicle queries.

**Why JSONB for the bulk data:** when the registry adds a new field, no migration. Generated columns expose hot-query fields for fast indexed lookups.

**Sizing — measured.** `scripts/local-vehicle-cache/setup.sh` with `SAMPLE_LINES=100000` (2026-05-21) loaded 100k rows of each CSV into a local Postgres 16 instance, with the schema in `scripts/local-vehicle-cache/schema.sql` (all-TEXT columns except `pcv BIGINT`) and the indexes in `indexes.sql`. Per-table footprint × full-snapshot row count gives:

| Table | Sample (100k rows) | Full rows | Extrapolated full size |
|---|---:|---:|---:|
| `vehicle_registry` (99 TEXT cols + `pcv BIGINT`) | 69 MB | 19.18M | **~13 GB** |
| `vehicle_inspections` | 18 MB | 82.5M | **~15 GB** |
| `vehicle_owners` | 12 MB | 91.0M | **~11 GB** |
| `vehicle_deregistration` | 10 MB | 1.9M | ~0.2 GB |
| **P0 + P1 total** | | | **≈ 40 GB** |

Earlier ~100–120 GB projections assumed a JSONB-blob schema; **native TEXT columns are ~3× more compact** than that. With type promotion (DATE / BOOLEAN / SMALLINT for the fields where it applies) we'd save another 10–20 %, but that optimisation isn't needed at this size.

**Hosting cost at the measured ~40 GB:**

| Provider | Monthly | Type |
|---|---:|---|
| **Scaleway** (DB-DEV-S €11.4 + 60 GB × €0.0993) | **~€12–18** | ✅ chosen — Managed, EU-native (GDPR), **flat pricing** (no per-CU-hour) |
| **Supabase Pro** ($25 + $0.125/GB over 8 GB) | ~$29 | Managed (AWS eu-central-1 / Frankfurt available) |
| **OVHcloud Managed Postgres** | ~€20–35 | Managed, EU-native (GDPR) |
| **Neon Scale** | ~$30 | Managed (EU regions), but **per-CU-hour compute** — load-coupled bill |
| **Hetzner CX31 self-host** | €14 | Self-managed VPS — **Hetzner has no managed-PG product**, you run Postgres yourself |
| Vercel Postgres (marked-up Neon) | ~$50 | Managed |

Recommended topology (decided 2026-05-22): **registry cache on Scaleway Managed PostgreSQL (EU/GDPR, flat pricing); keep users/reminders on the existing Neon-via-Vercel app DB.** The two DBs never need to JOIN — lookups fan out application-side, same as today's live-API call. Scaleway was chosen over Neon because its pricing is flat (fixed node + €0.0993/GB storage) rather than per-CU-hour — a traffic spike or attack can't inflate the bill.

**Scaleway sizing — split the two workloads via hourly billing.** Serving (indexed single-row lookups) and the monthly ingest (COPY 190M rows + rebuild indexes) have very different RAM needs:

- **Serving:** `DB-DEV-S` (2 vCPU / 2 GB, ≈ €11.4/mo) is comfortable — a lookup touches a handful of index + heap pages; the hot btree levels stay cached even though the DB ≫ RAM. Edge-cache (`s-maxage`) absorbs repeat hits.
- **Ingest:** on 2 GB the index rebuilds fall back to external (on-disk) merge sort with little parallelism on 2 vCPU → ~2–3 h. Works, but slow.
- **Best-value pattern:** keep `DB-DEV-S` for serving, and **temporarily scale the node up for the monthly ingest** (e.g. `DB-GP-XS`, 16 GB, €0.19/h) so the rebuild finishes in ~30–45 min, then scale back down. Scaleway vertical scaling needs no rebuild and bills hourly, so the burst costs **~€0.30–0.50/month**. Net ≈ **€12/mo** with fast ingest. Alternative: run `DB-DEV-M` (4 GB, ≈ €28/mo) permanently for simplicity.
- Storage: **60 GB Block Storage, 5K IOPS** (~40 GB data + headroom for index-build temp sort, WAL, growth; expandable online). Standalone node (cache is regenerable from the CSV — no need to pay 2× for HA). Encryption at rest **on** (owner table holds personal-ish data; can't be enabled later without downtime). Snapshots **manual** (the monthly CSV is the real backup).

Levers if size drifts up (not urgent now):

- **Slim the registry** — promote only ~15–20 hot columns; drop the long tail. Marginal at this size.
- **Periodic prune** — for vehicles with `Status = ZÁNIK` or deregistered >2 years, drop their history rows from `vehicle_inspections` / `vehicle_owners`.

**Ingest throughput:** Python CSV scan over the 16.9 GB main file ran at ~0.12 GB/s (parser-bound). Postgres `COPY` on local SSD hits ~1 GB/s on this hardware → initial bootstrap of all four P0+P1 files ≈ 30–60 min; monthly refresh in the same window.

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
  // 1. Try cache first — composes registry row + derived fields from
  //    vehicle_inspections / vehicle_owners / vehicle_deregistration
  const cached = await fetchFromCache(vin, tp, orv)
  if (cached && !isStale(cached)) return cached

  // 2. Cache miss or stale → fall back to live API.
  //    No write-through: the live API doesn't return PČV, and minting a
  //    synthetic key would collide with the next monthly ingest. The vehicle
  //    will appear in the cache after the next snapshot ingest naturally.
  try {
    return await fetchFromLiveAPI(vin, tp, orv)
  } catch (err) {
    // 3. Live API failed but we have stale cache → return stale with warning flag
    if (cached) return { ...cached, _stale: true, _source: 'cache_fallback' }
    throw err
  }
}
```

The `_source` field lets the frontend show "data from last sync (2026-05-10)" when serving stale.

The derived fields the live API returns but `vehicle_registry` doesn't:

| API field | Derived from |
|---|---|
| `PravidelnaTechnickaProhlidkaDo` | latest `vehicle_inspections.Platnost do` where `Typ='P - Pravidelná' AND Aktuální=true` |
| `EvidencniProhlidkaDne` | latest `vehicle_inspections.Platnost do` where `Typ='E - Evidenční' AND Aktuální=true` |
| `PocetVlastniku` | `COUNT(*)` over `vehicle_owners WHERE Vztah k vozidlu IN (1, 3, 4)` |
| `PocetProvozovatelu` | `COUNT(*)` over `vehicle_owners WHERE Vztah k vozidlu = 2` |
| `StatusNazev` | `vehicle_registry.status` (just a display alias) |

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

- Create the three P0 tables (`vehicle_registry`, `vehicle_inspections`, `vehicle_owners`).
- Build ingest script. Bootstrap with one full snapshot per P0 dataset.
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

## Files — Phase 1 (built 2026-05-22)

| File | Status | Purpose |
|---|---|---|
| `scripts/migrations/001_vehicle_cache.sql` | ✅ done | 6 tables (CSV-column-aligned, all TEXT except `pcv BIGINT`) + `cache_meta`. Tables: `vehicle_registry`, `vehicle_inspections`, `vehicle_owners`, `vehicle_deregistration`, `vehicle_imports`, `vehicle_equipment`. |
| `scripts/migrations/002_vehicle_cache_indexes.sql` | ✅ done | Indexes (idempotent); dropped/rebuilt around bulk load. Includes `vehicle_imports_pcv_idx`, `vehicle_equipment_pcv_idx`. |
| `scripts/migrations/005_vehicle_equipment.sql` | ✅ done | `vehicle_equipment` + its index + a role-guarded `GRANT`. Additive: applying it cannot affect the live lookup path. |
| `scripts/migrations/003_readonly_user.sql` | ✅ done | Creates the read-only `vincheck_api` role + table SELECT grants. `ALTER DEFAULT PRIVILEGES` auto-grants SELECT on tables the admin creates later (e.g. `vehicle_imports`), so a new table is readable without re-running 003. Its `GRANT CONNECT` / `GRANT USAGE` are **no-ops on Scaleway** (admin owns neither the DB nor `public`) — grant DB access via `scw rdb privilege set … permission=readonly` (see Runbook). |
| `scripts/ingest-vehicle-cache.sh` | ✅ done | Bash + psql `\copy` ingest. Host-agnostic (libpq env / `DATABASE_URL`), optional `DOWNLOAD=1`, `SAMPLE_LINES` for dev, and `ONLY=<dataset key>` to load a single table without touching the others or rebuilding their indexes (used to bootstrap `vehicle_imports`). Replaces the planned `.ts` script (Vercel can't run a 40 GB ingest; bash+psql is the right ops tool). |
| `api/_vehicleCache.ts` | ✅ done | `pg`-pool lookup. Maps registry columns → live-API PascalCase keys, composes derived fields (incl. `history.imports`), reads snapshot from `cache_meta`. The imports query tolerates a not-yet-migrated table (42P01) / missing grant (42501) so it's safe to deploy before the table exists. |
| `api/vehicle.ts` | ✅ done | Was `vehicle.js`. Cache-first → live-API fallback → stale-serve on upstream failure. Adds edge-cache headers. |
| `scripts/local-vehicle-cache/` | ✅ done | Local measurement harness (used for the sizing numbers). |
| `scripts/test-cache-lookup.ts` | ✅ done | Local smoke test: connects as `vincheck_api` over SSL, runs `lookupVehicleFromCache`, prints the mapped `{ Status, Data }`. Run before deploy and after each ingest. |
| `package.json` | ✅ done | Added `pg` + `@types/pg`. |
| `.github/workflows/ingest-vehicles.yml` | ⬜ optional | Monthly cron — not built yet. |

Note: the original sketch (JSONB blob, generated columns, write-through, `src/utils/vehicleApi.ts` wrapping) was **superseded** — the schema is all-TEXT (more compact; see *Sizing*), there's no write-through (live API returns no PČV), and the cache-first logic lives in `api/vehicle.ts`, not the frontend util.

## Pre-implementation investigation — status

Answered (open-data portal + schema docs + 2000-line samples on 2026-05-21):

- ✅ Download URLs, format, cadence, license, snapshot history.
- ✅ Cross-dataset join key: **PČV** (`int`).
- ✅ Schemas of all 7 datasets — see *Per-dataset schemas* above.
- ✅ `technickeprohlidky` does **not** include odometer/mileage. Re-scoped the wedge.
- ✅ `vlastnikprovozovatelvozidla` exposes ownership intervals with `Aktuální` flag — owner count derivable; legal entities expose IČO/Název/Adresa, individuals are anonymised.

Resolved against the **2026-05-02 full snapshot** (in `~/Desktop/datova kostka/`, 30 GB across 4 CSVs):

- ✅ **PČV uniqueness** in `vypis_vozidel`: 19,180,246 rows = 19,180,246 distinct PČV — zero duplicates. Safe as `PRIMARY KEY`.
- ✅ **PČV value range:** `1 … 19,492,653` — fits `INT` comfortably; `BIGINT` is defensible head-room (cheap on Postgres).
- ✅ **VIN coverage in `vypis_vozidel`:** 99.5% (19.08M of 19.18M). The missing 0.5% are pre-VIN-era vehicles — confirms VIN cannot be PK.
- ✅ **Real row counts** and storage projections — see *Sizing* table in the schema section.

Remaining: **none** — all gating questions resolved.

### Bridge to the live API — resolved (2026-05-21)

Tested with `WVWZZZ1KZDP015799` against both sources:

- CSV row carries **`PČV = 12365572`**.
- Live API returns **96 fields, none of them an internal ID**. Only the VIN string is shared.
- Field values match exactly across both sources for that vehicle.
- The live API exposes ~5 fields the snapshot lacks — `PravidelnaTechnickaProhlidkaDo`, `EvidencniProhlidkaDne`, `PocetVlastniku`, `PocetProvozovatelu`, `StatusNazev` — but every one of them is **derivable from our companion datasets** (`vehicle_inspections`, `vehicle_owners`), not a raw API-only field.

**Consequences:**

1. **PČV is internal-only.** All external lookups remain by VIN / Číslo TP / Číslo ORV.
2. **No write-through on cache miss.** The original plan in §3 below said *"on miss, fetch live and write back into cache."* We can't — the live API gives us no PČV, and a synthetic key would collide with the next ingest. Drop write-through; serve the live response straight through on miss, let the monthly snapshot pick the vehicle up naturally.
3. **Read-side composition required.** A cache read must return the registry row **plus** a composed view (latest STK due date, owner count, deregistration flag) joined from `vehicle_inspections` / `vehicle_owners` / `vehicle_deregistration`. Otherwise the page UI loses fields the live API currently provides.

### Sample findings (2026-05-21, first 2000 lines)

- **UTF-8 BOM** on every file — strip in the ingest reader.
- **Column-name unicode** — headers contain `⁻¹`, `³`, `–`, etc. Keep as-is in JSONB keys, normalise to ASCII slugs for generated columns.
- `technickeprohlidky.Stav` has the value **`Nezjištěno`** in samples (docs only mention `A`/`B`/`C`/`Neuvedeno`). Map it as a fifth permitted value.
- `vlastnikprovozovatelvozidla` rows for individuals (Typ subjektu = 1) have null `IČO`/`Název`/`Adresa` — confirmed anonymisation; we only get dates + flags.
- Sample row in `vypisvozidel` showed `1985-04-30` first registrations — full historical range, not just modern vehicles. Indexing on `datum_prvni_registrace` must handle the 1900s–today span.
- **VIN length wildly inconsistent.** Pre-VIN-era vehicles carry short legacy IDs (e.g. `3106260`, `J3549360`) in the `VIN` column alongside modern 17-char VINs (e.g. `TMB12MOOLJ3659963`). The lookup code (`api/vehicle.js`) must accept arbitrary length — don't enforce `length=17`.
- **Quoted commas** are real (e.g. `"PRŮMYSLOVÁ 381, 53301, PARDUBICE"` in `Název STK`). Use a proper CSV parser at ingest, not naive `split(',')`.
- **Ingest throughput**: Python CSV scan over 16.9 GB file ran at ~0.12 GB/s; Postgres `COPY` on local SSD reaches ~1 GB/s — bootstrap budget ≈ 30–60 min, monthly refresh same.

Samples in repo: `sample-vozidla.csv`, `sample-prohlidky.csv`, `sample-vlastnici.csv` (top 2000 lines each).

## Verification

Once Phase 1 is deployed against the real Scaleway instance:

- `GET /api/vehicle?vin=<known-vin>` p50 latency drops from ~500ms to <100ms (Vercel Analytics).
- A miss falls through to the live API and still returns the correct shape (no write-through — the vehicle appears in cache after the next monthly ingest).
- Blocking egress to `api.dataovozidlech.cz` while a stale cache row exists returns that row with `_stale: true` (degraded mode, no hard error).
- Repeat lookups for the same VIN are served from Vercel's CDN (edge-cache headers) without touching the DB — confirm via response `age`/`x-vercel-cache` headers.

## Runbook — deploy & monthly refresh

All connection strings are placeholders — **never commit real credentials**:

- `<ADMIN_URL>` — admin string, e.g. `postgres://vincheck_admin:<pw>@<host>:<port>/rdb?sslmode=require` (read+write; used for ingest and grants).
- `<API_URL>` — read-only string with the `vincheck_api` user (used by the app; goes in `.env` / Vercel as `VEHICLE_CACHE_DATABASE_URL`).

### One-time: read-only user

```bash
# 1. Role + table SELECT grants (run as admin). CONNECT/USAGE GRANTs warn
#    "no privileges were granted" on Scaleway — expected, see 003 header.
psql '<ADMIN_URL>' -f scripts/migrations/003_readonly_user.sql

# 2. Set its password (interactive; never echoed or stored in history).
psql '<ADMIN_URL>'        # then at the prompt:  \password vincheck_api
#    Generate a URL-safe one (hex avoids URL-encoding pain): openssl rand -hex 24

# 3. Grant DB-level read access via Scaleway's control plane (the SQL GRANT
#    CONNECT in step 1 is a no-op — admin doesn't own the database).
scw rdb privilege set region=nl-ams instance-id=<uuid> \
  database-name=rdb user-name=vincheck_api permission=readonly
#    (or Console -> instance -> Users -> Update permissions -> rdb: Read)

# 4. Verify least privilege: SELECT works, writes are refused.
psql '<API_URL>' -c "SELECT count(*) FROM vehicle_registry;" \
  -c "INSERT INTO cache_meta(dataset,source_snapshot,imported_at,row_count) VALUES('_t',now(),now(),0);"
#    Expect a count, then: ERROR: permission denied for table cache_meta
```

Network ACL: the instance is open to `0.0.0.0/0` so Vercel's dynamic egress IPs can reach it — encryption + credentials are the only gate (acceptable for v1; the data is public open-data, the owner table aside).

### Bootstrap / monthly refresh: full ingest

```bash
# Optional but recommended: scale the node up for the run (faster index rebuild),
# then scale back down afterwards — Scaleway vertical scaling bills hourly.
#   Console -> instance -> scale to DB-GP-XS  (≈ €0.19/h)

DATABASE_URL='<ADMIN_URL>' \
  CSV_DIR="$HOME/Desktop/datova kostka" \
  bash scripts/ingest-vehicle-cache.sh
#   DOWNLOAD=1   fetch fresh CSVs from the open-data portal first (monthly refresh)
#   The full run drops indexes -> COPY -> rebuilds them; ~30-60 min + CSV upload.

# Dev/sample variant (skips the drop/rebuild path, keeps indexes):
DATABASE_URL='<ADMIN_URL>' SAMPLE_LINES=100000 bash scripts/ingest-vehicle-cache.sh
```

#### One-time: bootstrap a single dataset (e.g. `vehicle_imports`)

`ONLY=<key>` loads just one table without touching the big tables or rebuilding
their indexes — no node scale-up needed. The startup migration creates the table
+ its index; `ALTER DEFAULT PRIVILEGES` (from `003`) makes it readable by
`vincheck_api` automatically.

```bash
DATABASE_URL='<ADMIN_URL>' CSV_DIR="$HOME/Desktop/datova kostka" \
  DOWNLOAD=1 ONLY=vozidla_dovoz bash scripts/ingest-vehicle-cache.sh
```

If the read-only user can't see the new table (no `ALTER DEFAULT PRIVILEGES`
in your setup), grant it explicitly as admin:

```bash
psql '<ADMIN_URL>' -c "GRANT SELECT ON vehicle_imports TO vincheck_api;"
```

After this the monthly full `DOWNLOAD=1` run keeps `vehicle_imports` current
automatically (it's one of the five datasets).

### Local smoke test (before deploy, after each ingest)

```bash
# .env must hold VEHICLE_CACHE_DATABASE_URL=<API_URL> (read-only user).
npx tsx scripts/test-cache-lookup.ts             # auto-discovers a HIT + probes the canonical VIN
npx tsx scripts/test-cache-lookup.ts <VIN>       # a specific VIN
```

### Deploy

1. Set `VEHICLE_CACHE_DATABASE_URL=<API_URL>` in Vercel (Production [+ Preview]).
2. Deploy. The endpoint gates on `isCacheConfigured()` — if the var is unset it behaves exactly as before (live API only), so deploy is safe even before data loads.

### Verify (production)

```bash
curl -s 'https://<host>/api/vehicle?vin=WVWZZZ1KZDP015799' | jq '.Status, (.Data | length)'
#   Re-request and check x-vercel-cache / age headers for edge caching.
```

## Status

🟢 **Phase 1 built + validated end-to-end against Scaleway (sample); pending full ingest + deploy.** Schema + ingest + lookup + cache-first endpoint implemented; the lookup reproduces the live-API `{ Status, Data }` shape (86 fields + derived) reading from Scaleway as the read-only user. `tsc` + Biome clean.

Done:

1. ✅ **Provisioned** — Scaleway DB-DEV-S, nl-ams, PG-17, encryption on; network ACL `0.0.0.0/0`.
2. ✅ **Read-only user** — `vincheck_api` created; table SELECT granted via `003`; CONNECT granted via Scaleway `permission=readonly` (SQL `GRANT CONNECT` is a no-op on managed PG). Least-privilege verified.
3. ✅ **Local smoke test** — `scripts/test-cache-lookup.ts` connects over SSL and returns the mapped envelope. Caught + fixed a real connection bug: newer `pg-connection-string` maps `sslmode=require` → `verify-full`, which overrode `rejectUnauthorized:false` and rejected Scaleway's self-signed cert. `api/_vehicleCache.ts` now strips `sslmode` from the URL and drives SSL via the `ssl` option.

Remaining before it's live:

1. ⬜ **Full ingest** — replace the 100k sample with the full snapshot (see Runbook).
2. ⬜ **Vercel env** — set `VEHICLE_CACHE_DATABASE_URL` to the `vincheck_api` string.
3. ⬜ **Deploy.**
4. ⬜ **Confirm** the verification checks on `WVWZZZ1KZDP015799` (PČV 12365572) — should be a cache HIT after the full ingest.

Follow-ups (not blocking): per-IP rate limiting on `/api/vehicle`; harden cache SSL to verify Scaleway's CA (currently `rejectUnauthorized: false`); monthly ingest cron (`.github/workflows/ingest-vehicles.yml`).

### Update (2026-06-10) — imports dataset (`vehicle_imports`)

Added the `vozidladovoz` dataset end-to-end: migration table + index, an `ONLY=`
single-dataset ingest path, `history.imports` in `_vehicleCache.ts`, an import
badge in the history panel, and an **import-targeted Cebia upsell** (distinct
tracking source `vehicle_info_import`) — imported cars are exactly where the CZ
registry is blind and the paid foreign-history report adds most value. `tsc` +
Biome clean.

Deploy-order safe: the imports query tolerates `42P01`/`42501`, so the code can
ship before the table exists. To activate (data not yet in Scaleway):

1. ⬜ Bootstrap the table: `DOWNLOAD=1 ONLY=vozidla_dovoz` ingest (see Runbook).
2. ⬜ Deploy.
3. ⬜ Smoke-test a known imported VIN → expect the "Dovezené vozidlo z {země}" badge.
