# Plan: RSV equipment + manufacturer-messages datasets

Two currently-unused RSV open-data files, analysed 2026-07-14 against the
`20260701` snapshot. They join on `PČV`, the key the cache already uses
everywhere, so both plug into the existing `vehicle_imports` pattern: an
optional enrichment table, loaded by `scripts/ingest-vehicle-cache.sh`, read
with a fault-tolerant query in `api/_vehicleCache.ts`.

They are **not** equally valuable and ship as **two independent phases**.
Phase A is a clear win. Phase B carries a privacy hazard and needs a product
decision before any of it becomes visible.

Portal slugs verified live (HTTP 200):
`vypiszregistru/vozidladoplnkovevybaveni`, `vypiszregistru/zpravyvyrobcezastupce`.

---

## Source analysis (measured, not assumed)

### `RSV_vozidla_doplnkove_vybaveni_*.csv` — equipment

| | |
|---|---|
| Size / rows | 345 MB, 12,482,474 rows |
| Distinct PČV | 8,505,548 (~44% of the 19.3M rows in `vehicle_registry`) |
| Columns | `PČV, Typ, Od, Do` |
| `Od` (fitted) set | 3,994,112 rows — but only **34.8% of *displayable* rows** (i.e. excluding the hidden ABS/AIRBAG/ASR); **65.2% carry no date at all** |
| `Do` (removed) set | 30,084 rows — kept and marked, NOT dropped (see below) |
| Distinct types | 35 |
| Line endings | **CRLF** — `Do` parses as `\r`, not empty, if not stripped |

Rows per vehicle are mostly 1–3 (max seen: 8), so a per-vehicle fetch is cheap.

**Type distribution** (full list, 12.48M rows):

```
5221452 TAŽNÉ ZAŘÍZENÍ      103164 MAJÁK  ORANŽOVÝ      5186 PLACHTA
3292859 ABS                  79280 ASR                  5152 OTVIRACÍ STŘECHA
1675879 KATALYZÁTOR          76749 OMEZ. RYCHLOSTI      5018 NAVIJÁK
1039901 AIRBAG               41451 TOČNICE              2461 DALŠÍ SVĚTLA
 315001 POHON PLYNEM         36996 NESTANDARD. PNEU     2438 MAJÁK  ČERVENÝ
 238544 KLIMATIZACE          32093 MAJÁK  MODRÝ         2276 ZDRAVOTNÍ ÚPRAVA
 214994 ZÁVĚS                30599 NEZÁVISLÉ TOPENÍ     2020 SNĚHOVÝ PLUH
                             21458 DVOJÍ OVLÁDÁNÍ       1779 PLYNOVÉ TOPENÍ
                             12228 INVALIDNÍ ÚPRAVA     1196 NAKLADAČ
                              7978 HYDRAULICKÁ RUKA      604 MĚŘÍCÍ APARATURA
                              6925 ZVEDACÍ  ČELO         357 RADLICE
                              5365 BOČNÍ  VOZÍK          325 NAKLÁDACÍ PÁS
                                                         321 ČERPADLO
                                                         226 ZAVAZADL. SKŘÍŇ
                                                         135 ZVÝŠENÁ BOČNICE
                                                          64 PŘÍDAVNÝ FINIŠER
```

Note the double spaces in `MAJÁK  ORANŽOVÝ`, `ZVEDACÍ  ČELO`, `BOČNÍ  VOZÍK` —
normalise whitespace when matching.

**ABS / AIRBAG / ASR (4.41M rows, 35% of the file) are redundant and must be
dropped at display time.** `vehicle_registry` already stores them as dedicated
columns in a *better* form: `abs`/`asr` are explicit `True`/`False`, `airbag` is
an actual count (`4`, `1/6`). This file only has presence rows, so a missing row
means "no record", not "no ABS". Keep them in the table (cheap, and truncate +
reload is simpler than filtering during COPY) but never render them.

### `RSV_zpravy_vyrobce_zastupce_*.csv` — manufacturer/representative messages

| | |
|---|---|
| Size / rows | 12 MB, 269,135 rows |
| Distinct PČV | 217,833 — **~1.1% of the registry** |
| Columns | `PČV, Krátký text` |
| Text length | **capped at 65 chars** — arrives truncated mid-word |
| Rows naming a clerk | **85,162 (32%)** |

The text is unstructured and fragmentary: `JAWA`, `Pneu`, `Motor`, `HP-0266`,
`"Alternativní použití pneumatik o rozměru: ,8,0JX1"`.

**Privacy hazard:** 85,162 rows embed the name of the official who typed them —
`Zprávu zapsal: Vaňková Věra,Typ vozu: Škoda Garde`. Rendering the raw text on a
public page or in a sold PDF would republish named civil servants' personal data,
walking straight back into the problem `feat/cert-tech-data-and-owner-privacy`
just solved for owner names. **The raw text must never reach the client.**

**The one thing worth extracting:** 10,154 distinct vehicles carry a message
about VIN re-stamping / restoration / identity verification — `Ražba VIN`,
`Souhlas s obnovou VIN`, `Obnova VIN náhradní technologií`, `Oprava chybně
vyraženého VIN`, `Vyrezlé VIN`, `ZTOTOŽNĚNÍ` (2,177). The VIN plate on that car
was re-stamped. Usually innocent (corrosion), but it is exactly the circumstance
a buyer of a *VIN check* needs flagged, and it is the highest-value single signal
in either file.

### Honesty constraint (applies to both)

We cannot verify that the registry's record is complete or current for a given
vehicle. **Absence of a row is not evidence of absence.** All copy must say
"registr eviduje…" ("the registry records…"), never "vozidlo nemá…" ("the vehicle
does not have…"). This mirrors the wording discipline already used for the
odometer prediction (a range, never a point claim).

---

## Phase A — `vehicle_equipment` (ship first, standalone)

### A1. Schema

New `scripts/migrations/005_vehicle_equipment.sql` (idempotent, `CREATE TABLE IF
NOT EXISTS` — 001 uses `DROP … CASCADE`, but a migration applied to a live DB
must not drop):

```sql
CREATE TABLE IF NOT EXISTS vehicle_equipment (
  pcv   BIGINT,
  typ   TEXT,
  od    TEXT,
  do_   TEXT   -- `do` is a reserved word; CSV column order is PČV,Typ,Od,Do
);
CREATE INDEX IF NOT EXISTS vehicle_equipment_pcv_idx ON vehicle_equipment (pcv);
```

Mirror the table into `scripts/local-vehicle-cache/schema.sql` (the local dev
mirror) and add the index to `scripts/migrations/002_vehicle_cache_indexes.sql`.

`ALTER DEFAULT PRIVILEGES` in `003_readonly_user.sql` already grants `SELECT` on
future admin-created tables, so `vincheck_api` should pick this up automatically
— but **verify** on Scaleway rather than assume, and re-run the `GRANT SELECT ON
ALL TABLES` line if not.

### A2. Ingest

`scripts/ingest-vehicle-cache.sh`:

- Add to `DATASETS`:
  `"vozidla_doplnkove_vybaveni|vozidladoplnkovevybaveni|RSV_vozidla_doplnkove_vybaveni_*.csv|vehicle_equipment"`
- Add `DROP INDEX IF EXISTS vehicle_equipment_pcv_idx;` to the bulk-load drop list.
- Apply `005_…sql` alongside 001/002 in the "ensure schema" step.

Everything else (TRUNCATE → COPY → `cache_meta` → index rebuild → ANALYZE) is
generic and needs no change. 12.5M rows is small next to the 90.7M odometer rows
already on Scaleway; expect the load to be a minor addition to total runtime.

Update `.claude/skills/refresh-vehicle-cache/SKILL.md` (dataset list + timings)
and `docs/VEHICLE_DATA_CACHE.md`.

### A3. API — `api/_vehicleCache.ts`

Add a query to the existing `Promise.all`, copying the `vehicle_imports`
fault-tolerance verbatim (tolerate `42P01` undefined_table and `42501`
permission_denied → degrade to empty, so this deploys safely *before* the table
exists):

```ts
p.query(
  `SELECT typ, od, do_ FROM vehicle_equipment WHERE pcv = $1 ORDER BY typ`,
  [pcv]
).catch(/* 42P01 / 42501 → { rows: [] } */)
```

Extend the `VehicleHistory` type with an `equipment` section. The classification
lives in TypeScript (not SQL) so it is unit-testable:

```ts
equipment: {
  /** Buyer-relevant equipment the registry records, redundant types removed. */
  items: Array<{ type: string; label: string; from: string | null }>
  /** Usage signals worth surfacing prominently. */
  flags: {
    drivingSchool: boolean   // DVOJÍ OVLÁDÁNÍ
    emergency: boolean       // MAJÁK MODRÝ / ČERVENÝ
    utility: boolean         // MAJÁK ORANŽOVÝ
    gasPowered: boolean      // POHON PLYNEM (LPG/CNG retrofit)
    towing: boolean          // TAŽNÉ ZAŘÍZENÍ / ZÁVĚS / TOČNICE
    heavyDuty: boolean       // HYDRAULICKÁ RUKA, SNĚHOVÝ PLUH, RADLICE, NAKLADAČ, …
    adapted: boolean         // INVALIDNÍ / ZDRAVOTNÍ ÚPRAVA
  }
}
```

A `EQUIPMENT_TYPES` map (normalise whitespace + case on the key) provides the
Czech display label and the flag bucket; `ABS`/`AIRBAG`/`ASR` map to `null` and
are filtered out. Unknown types pass through with their raw name as the label,
so a new registry type degrades gracefully instead of vanishing.

### A4. UI

- **`src/components/VehicleHistoryPanel.tsx`** — a "Výbava a úpravy" section
  following the existing `imports` / `deregistrations` block pattern; render only
  when `items.length > 0`. Surface the red-flag items (driving school, emergency,
  LPG) with the same visual weight the panel already gives `rollbackSuspected`.
- **`api/_certificatePdf.ts`** — the same section in the sold PDF.
- Copy in Czech, comments in English. Wording per the honesty constraint above.

### A5. Verification

- `pnpm exec tsc --noEmit`, `pnpm exec biome check --write`.
- Load the CSV into a local Postgres with `SAMPLE_LINES` and assert the CRLF `Do`
  column parses as NULL/empty, not `\r`.
- Exercise end-to-end against the reference test VINs (see the reference-test-VINs
  memory — cars/bus/truck/moto/motorhome), which should between them hit tow bar,
  LPG and heavy-duty types. Confirm ABS/AIRBAG/ASR never render.
- Confirm a VIN with **no** equipment rows renders the panel unchanged (no empty
  section, no crash).

### Design decision: removed equipment is history, not noise (2026-07-14)

The first cut dropped rows with a `Do` date on the reasoning that the equipment is
"no longer on the vehicle". **That was backwards**, and a real vehicle caught it:
PČV 1039592 (Land Rover Discovery, VIN SALLTGMP43A800513) has `MAJÁK MODRÝ` fitted
2003-02-06 and removed **2022-01-25** — dropping it would have shown *no* IZS
signal for a car that spent 19 years in emergency service. Same for the
ex-autoškola bikes whose dual controls were removed (PČV 1011108, 1041584).

Pulling the beacon or the dual controls out is exactly what you do *before selling
the car*. Stripping the hardware doesn't strip the wear, so removal now **marks**
the item (`removed` + `to`) and **still raises the usage flag**. Removed items
render as `6. 2. 2003 – 25. 1. 2022 · odstraněno`.

### Why it's worth it

It gives the certificate a real "Výbava a úpravy" section, and — more valuable —
a red-flag detector for **ex-driving-school** (21,458 vehicles: brutal clutch and
gearbox wear) and **ex-emergency/utility** vehicles (137,695), plus **LPG/CNG
retrofits** (315,001: affects value, insurance and STK obligations). None of those
claims are supported by any data we currently hold.

---

## Phase B — manufacturer messages: DROPPED (decided 2026-07-14)

**Verdict: not building it.** The measured hit rate kills it.

Of the 10,446 vehicles carrying a VIN re-stamping / identity record, only **7,320
are still in operation** (the rest: 1,279 ZÁNIK, 1,093 exported, 754
deregistered). Against 10,836,747 vehicles with status `PROVOZOVANÉ`, that is
**1 in 1,480 — 0.07% of lookups**. At any realistic certificate volume the flag
fires once or twice a year.

The data itself is clean (all 10,446 PČVs resolve to registry rows with VINs) —
there simply isn't enough of it to pay for its costs:

- **Truncated evidence.** 65-char cap means the classifier reads fragments; false
  negatives are guaranteed and the miss rate is unmeasurable.
- **GDPR exposure.** 32% of rows carry clerk names, so ingesting raw text needs a
  staging-table dance purely to avoid persisting personal data.
- **Hedged to uselessness.** A re-stamped VIN is usually just corrosion, so the
  copy must hedge to "ask the seller" — and needs legal review to avoid a
  defamation risk in the accusatory direction.
- **Superseded.** The second-best signal in the file was `PŘESTAVBA` (conversion),
  but Phase A already delivers that information far better: LPG/CNG appears as
  `POHON PLYNEM` on **315,001** vehicles versus a few thousand fragmentary notes.
- The remaining 98.9% of the file is junk (`Pneu`, `Motor`, `JAWA`, tyre sizes).

**If it is ever revived**, the only sane shape is a ~10k-row flag table (PČV +
boolean, raw text never stored), which sidesteps GDPR entirely and is nearly free
to build. The real cost then is the copy/legal review, not the engineering. The
question to answer first is a product one — *do we want to make a claim about VIN
re-stamping at all?* — and the honest answer is that its value would be mostly
marketing differentiation ("kontrolujeme i záznamy o ražbě VIN"), not per-lookup
utility. Park until Phase A is earning.

---

## Sequencing

Only **Phase A** ships, on `feat/vehicle-equipment`: ingest → API → panel → PDF →
verify. Phase B is dropped (see above).

Phase A is additive: `vehicle_equipment` is an optional enrichment, its query
degrades to empty on a missing table or grant, and it does not touch the core
lookup path.
