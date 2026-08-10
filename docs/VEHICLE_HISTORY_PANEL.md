# Spec — Vehicle history-lite panel (Play 1)

## Goal

Surface, on every cached VIN/TP/ORV lookup, a **trust/risk panel** built from the
companion tables (`vehicle_owners`, `vehicle_inspections`, `vehicle_deregistration`)
plus `vehicle_registry.status`. These are signals competitors who only proxy the
live `api.dataovozidlech.cz` endpoint **cannot show** — it returns one vehicle's
technical specs and nothing about owners, STK history, or deregistration.

It's a free, public-data "history-lite" — **not** a Cebia/odometer replacement
(the source has no mileage). It raises trust on the core lookup → registration →
the reminder/insurance funnel.

### Signal prevalence (measured 2026-05-22, sampled full snapshot)

| Signal | Prevalence | Source |
|---|---|---|
| Company / ex-fleet ownership | ~28% of ownership records | `vehicle_owners.typ_subjektu='2'` |
| STK defects/unfit (B/C) | ~5.4% of inspections | `vehicle_inspections.stav` |
| Recorded stolen | 19,025 vehicles | `vehicle_deregistration.duvod='Odcizeno'` |
| Exported | ~7% | `vehicle_registry.status='VÝVOZ'` |
| Deregistered (ZÁNIK) | ~34% | `vehicle_registry.status` |

## Data sources & derivations

Keyed by `pcv` (indexed). All TEXT in the cache.

### Owners — `vehicle_owners`
Columns: `typ_subjektu` (1 person / 2 legal entity / 3 unidentified), `vztah_k_vozidlu`
(1 owner / 2 operator / 3 co-owner / 4 acquirer), `aktualni` ('True'/'False'),
`ico`, `nazev`, `adresa`, `datum_od`, `datum_do`.

- **owners** = count where `vztah_k_vozidlu IN ('1','3','4')` (matches existing `PocetVlastniku`)
- **operators** = count where `vztah_k_vozidlu='2'`
- **companies** = distinct `nazev` where `typ_subjektu='2'`
- **everCompanyOwned** = any `typ_subjektu='2'`
- **currentlyCompany** = any `typ_subjektu='2' AND aktualni='True'`
- **companyOwners[]** = legal-entity rows (`ico`, `nazev`, `from`, `to`, `current`, `relation`),
  newest first, capped at 10. Ex-fleet/ex-leasing detail. **Individuals stay anonymised** —
  never expose person-level rows (GDPR; the source already nulls them).

### Inspections — `vehicle_inspections`
Columns: `typ` (`P…` regular / `E…` evidence), `stav` (`A` pass / `B` defects /
`C` unfit / `Neuvedeno` / `Nezjištěno`), `kod_stk`, `nazev_stk`, `platnost_od`,
`platnost_do`, `aktualni`.

- **total**, **failed** (`stav IN ('B','C')`), **distinctStations** (`count(distinct kod_stk)`)
- **latest** = newest by `platnost_od` → `{ result, platnostDo, nazevStk }`
- **history[]** = last 8 by `platnost_od` desc → `{ date, result, nazevStk, typ }`
- `result` maps `stav`: A→`pass`, B→`defects`, C→`unfit`, else→`unknown`

### Flags — `vehicle_deregistration` + `vehicle_registry.status`
- **stolen** = any dereg `duvod='Odcizeno'`
- **insuranceLapsed** = any dereg `duvod='Zánik pojištění'`
- **exported** = `status='VÝVOZ'`
- **deregistered** = `status IN ('ZÁNIK','VYŘAZENO Z PROVOZU')` or any dereg row
- **statusLabel** = `status` (already mapped to `StatusNazev`)
- **deregistrations[]** = `{ from, to, reason }`, newest first

### Usage / účel vozidla — `vehicle_registry.ucel_vozidla` (added 2026-08-08)

The registry's own statement of what the vehicle is used for. It was always in
the payload, but rendered as one more row in the technical table at the same
weight as the wheelbase — so nobody saw it. Measured on the 2026-07 snapshot:

| Value | Vehicles |
|---|---|
| Běžný provoz | 10,172,944 |
| *(blank)* | 9,083,064 |
| **Taxi** | **16,573** |
| **Vozidlo s předností práva v jízdě** | **12,959** |
| Provozování silniční dopravy pro cizí potřeby | 2,973 |
| **Půjčovna** | **2,599** |
| Vozidlo určené k provozování veřejné linkové dopravy | 45 |

- `usage.kind` is set only for the notable values (`taxi`, `emergency`,
  `rental`, `haulage`, `publicTransport`); ordinary operation and blanks leave it
  null so nothing is rendered. Matching is on a distinctive substring, since the
  values are long and the registry has reworded them before.
- `usage.label` keeps the registry's own wording so the certificate can quote it
  verbatim ("Účel vozidla: Taxi") rather than paraphrase.
- **Free**, like the equipment signals — it is a hook for the certificate, not a
  paid figure. Badge on the detail page, glance chip + identity row in the PDF.
- **CURRENT state, not history.** A taxi deregistered before sale reverts to
  "Běžný provoz" and becomes invisible to us, so copy says what the registry
  records now ("Registr: TAXI") and never "bylo taxi".
- Complements, does not duplicate: `Půjčovna` here is an independent second
  source for rental use that does not depend on the IČO allowlist, and
  `Vozidlo s předností práva` corroborates the blue-beacon equipment flag.

### Financing — derived from the owner timeline (added 2026-08-06)

No new query: `buildFinancing()` in `api/_financingCompanies.ts` matches the
timeline's **IČO** against a curated allowlist of ~200 leasing, fleet and rental
companies (see `docs/plans/2026-08-06-001-feat-leasing-check.md` for how the list
was derived and how to refresh it).

- **hasHistory** = any match. **active** = a `leasing`/`fleet` match that is the
  CURRENT owner — the case that blocks a sale (the seller is only the
  provozovatel).
- **records[]** = `{ ico, name, kind, relation, from, to, current }`, oldest
  first. Operating leases carry the lessor twice (owner + operator, same period);
  those collapse to one record, keeping the owner row.
- **The list is public**, at `/leasingove-spolecnosti`
  (`src/pages/FinancingCompaniesPage.tsx`), and the certificate links to it — the
  check has to be auditable, not a black box. That is why the data lives in
  `src/data/financingCompanies.ts` and `api/_financingCompanies.ts` imports it:
  one source for the page and the matching, so they cannot drift.
- **Matching is by IČO only.** The displayed `name` comes from OUR list, never
  from `vehicle_owners.nazev` — which stays dropped for GDPR. An allowlist also
  makes it structurally impossible to mislabel a dealer or importer as financing.
- A `rental` match counts only where the company was the **owner**: rental fleets
  are owned, and an IČO trading as a carsharing operator today may have been an
  unrelated business decades ago.
- **PAID.** `api/vehicle.ts` sends only the teaser — `hasHistory`, `active`,
  `count`, `kinds`. The `records` (which company, when, what relation) are
  certificate-only. `kinds` ships free so a badge can't mislabel an ex-rental as
  "leasing".
- **Copy rule:** state the registry fact and the action, never a legal conclusion.
  An úvěr never appears here, a zástavní právo lives in another register, and
  ~7–11% of "currently financed" rows are stale. Never print "vozidlo není
  zatíženo".

### Equipment — `vehicle_equipment` (added 2026-07-14)
Classified in `api/_vehicleEquipment.ts` (`buildEquipment`), rendered as the
"Výbava a úpravy" section on the web and in the PDF.
- **items[]** = `{ type, label, from, to, removed, flag }`. Still-fitted flagged
  items first, then removed flagged items, then the rest (A–Z within each group).
  Duplicate types are deduped, preferring the row that is still fitted.
- **Removed equipment is KEPT, not dropped**, and the usage flag still fires.
  A blue beacon fitted 2003 and removed 2022 still means ~19 years in emergency
  service; dual controls pulled out before the sale still mean an ex-autoškola
  car. Stripping the hardware doesn't strip the wear — and doing it right before
  selling is exactly the case a buyer needs to see. Removed items render as
  `6. 2. 2003 – 25. 1. 2022 · odstraněno`.
- **flags** = usage signals that nothing else in the registry reveals:
  `drivingSchool` (DVOJÍ OVLÁDÁNÍ — an ex-autoškola car), `emergency` (blue/red
  beacon), `utility` (orange beacon), `gasPowered` (LPG/CNG), `towing`,
  `heavyDuty`, `adapted`. `drivingSchool` + `emergency` also surface as badges
  alongside the stolen/exported flags.
- **ABS / AIRBAG / ASR are never displayed** — the registry columns already carry
  them, better (explicit `True`/`False`; airbag as a count).
- `equipment` is **optional**: certificate snapshots frozen before this shipped
  have no such key, so readers fall back to `EMPTY_EQUIPMENT`.

> **Honesty:** the registry's equipment record can be incomplete, so a missing
> item is NOT evidence the vehicle lacks it. Copy says *"Registr eviduje pouze
> vybrané prvky výbavy — seznam nemusí být úplný."* — never *"vozidlo nemá…"*.

## Response shape

`history` is **additive and present only on a cache hit** — it does not touch the
live-API-mirroring `Data` envelope, so a live-API fallback simply omits it (panel
hidden). `api/vehicle.ts` returns it as a top-level `History` key:

```jsonc
{
  "Status": 1,
  "Data": { /* unchanged live-API-shaped fields */ },
  "History": {
    "owners":     { "total": 5, "operators": 5, "companies": 1,
                    "everCompanyOwned": true, "currentlyCompany": false,
                    "companyOwners": [ { "ico": "…", "nazev": "…", "from": "2014-03-01",
                                         "to": "2018-06-30", "current": false,
                                         "relation": "owner" } ] },
    "inspections":{ "total": 9, "failed": 1, "distinctStations": 2,
                    "latest": { "result": "pass", "platnostDo": "2026-06-03", "nazevStk": "…" },
                    "history": [ { "date": "2024-05-30", "result": "pass",
                                   "nazevStk": "…", "typ": "P - Pravidelná" } ] },
    "flags":      { "stolen": false, "exported": false, "deregistered": false,
                    "insuranceLapsed": false, "statusLabel": "PROVOZOVANÉ" },
    "deregistrations": [],
    "snapshot": "2026-05-02"
  }
}
```

## Backend — `api/_vehicleCache.ts`

- Extend `VehicleCacheResult` with `history: VehicleHistory`.
- In `lookupVehicleFromCache`, add to the existing `Promise.all`:
  owners-aggregate, company-owners list, inspections-aggregate, inspections-recent,
  deregistration rows. All `WHERE pcv = $1` (indexed). ~6 parallel queries on a hit;
  still well under the edge-cache TTL and the live-API latency it replaces.
- `api/vehicle.ts`: on a fresh cache hit return `{ ...cached.response, History: cached.history }`.
  (Stale/fallback path is unchanged and carries no `History`.)

## Frontend

`fetchVehicleInfo` currently returns `VehicleDataArray` and `transformApiResponse`
**drops everything outside `Data`**, so `History` would be lost. Minimal contract change:

- `fetchVehicleInfo` → returns `{ fields: VehicleDataArray; history: VehicleHistory | null }`
  (reads `responseData.History` before flattening). Type `VehicleHistory` added to `src/types`.
- Callers (3): `HomePage`, `VehicleDetailPage` destructure `{ fields, history }` and pass
  `history` to `<VehicleInfo>`; `ClientZonePage` (validation-only) takes `fields` and ignores history.
- `<VehicleInfo>` gains an optional `history` prop and renders a new
  `VehicleHistoryPanel` above the detailed field table.

### UI — `VehicleHistoryPanel`
- **Red-flag badges** first (only when true): 🔴 Odcizeno, Vyvezeno, Vyřazeno/Zánik,
  Zaniklé pojištění. Most severe = red; status = neutral.
- **Majitelé**: "N majitelů / M provozovatelů"; if `everCompanyOwned` → "ex-firemní/flotila"
  chip + the company name(s)/IČO from `companyOwners`.
- **Historie STK**: pass/defects/unfit timeline (last 8) with colour per `result`;
  `failed > 0` and the station count surfaced as a note ("kontrolováno na N stanicích" —
  neutral; a windowed "fail → different station soon after" shopping signal is Phase 2).
- Czech UI strings; English code/comments. Empty/absent `history` → panel not rendered.

## Constraints
- **No odometer** — frame as "veřejný registr", not mileage-fraud detection.
- **Individuals anonymised** — only legal-entity owners get name/IČO; never render person rows.
- **Single snapshot** — no change-detection ("new owner since…") until the monthly cron
  retains ≥2 snapshots (Phase 3).
- Stolen/export/dereg flags can lag the real event — always show with the registry date,
  worded "evidováno v registru".

## Extension — company-owner timeline + lookup by IČO

- **Timeline:** the panel renders `owners.companyOwners` (legal entities only —
  private owners are excluded server-side) as a dated from–to list, owner vs
  operator distinguished; each company name links to its fleet page.
- **Lookup by IČO** (`/api/fleet?ico=…` → `/firma/:ico` page): reverse lookup of
  vehicles registered to a legal entity. Cache-only (the live API has no
  reverse-by-IČO). Backed by `vehicle_owners_ico_idx` (in `002` + the ingest
  drop/rebuild cycle). **The index is required** — without it the query
  seq-scans 91M rows and the connection times out (confirmed). Build it once on
  the live DB as admin:

  ```
  psql '<ADMIN_URL>' -c "CREATE INDEX IF NOT EXISTS vehicle_owners_ico_idx ON vehicle_owners (ico) WHERE ico IS NOT NULL;"
  ```

  Big fleets reach 100k–800k vehicles (ŠkoFIN ≈ 775k), so the endpoint returns a
  bounded **sample of 60** + a **count capped at 1000** (`countCapped` → "1000+");
  no exact totals or full enumeration for giant fleets.

Follow-ups: per-IP rate limiting on `/api/fleet`; OSVČ (sole traders) are legal
entities with a public IČO but their name is personal — decide whether to surface
them like companies; true pagination/sorting (v1 returns an unordered sample).

## Status
🚧 Built on `feat/vehicle-history-panel` (history panel + company-owner timeline +
IČO lookup), **held from deploy**. tsc/biome/build clean; history composition
validated against real data. The IČO endpoint is pending the live index build
(above) before it can be exercised. Email/SEO plays (2, 3) are separate.
