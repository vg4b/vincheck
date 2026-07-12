---
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: manual
---

# Improve Technical-Data Display (schema-driven) — Plan

## Goal Capsule

- **Objective:** Make the technical-data fields readable on both the web detail page and the paid certificate PDF by parsing each field into its real sub-parts, dropping empty/placeholder parts, keeping meaningful zeros, and (optionally) labelling parts — instead of dumping the raw registry string.
- **Authority:** Owner (vaclav.gabriel). Touches the shared registry-field rendering used by the web (`src/utils`) and the cert (`api/`).
- **Open blockers:** None. Two product decisions (rendering style, zero-policy ownership) are captured under "Decisions".

## Context

The registry ("Vozidla - technické údaje") exposes many **composite** fields whose value packs several sub-values with a separator hierarchy:

- `|` separates **groups** (e.g. axles / wheels),
- `/` separates **parts within a group** (e.g. přípustná / povolená, or celkem / k sezení / k stání),
- values are frequently **partially empty** (a trailing `/`, an all-empty axle `/ `), and sometimes carry a `0` that may or may not be meaningful.

Today neither surface understands this structure. Both keep a `key → Czech label` map plus a `formatValue` that only splits on `|`, joins, and drops **fully-empty** strings:

- `api/_vehicleFieldLabels.ts` — PDF: `split('|').map(trim).filter(Boolean).join(', ')`
- `src/utils/vehicleApi.ts` — web: `formatValue` / `formatValueHtml` (splits `|` → `<br>`)
- `src/utils/vehicleFieldCategories.ts` — web category grouping (mirrors the api-side categories)

Because `filter(Boolean)` only removes `""`, a punctuation-only part like `"/ "` survives. Real observed output (`WVWZZZ1KZDP015799`, cert VI-TEST-5799):

| Field | Raw registry value | Schema structure | Current output |
|---|---|---|---|
| Hmotnosti přípustné/povolené na nápravu | `960/ 960\|880/ 880\|/ \|/ \|` | per-axle `přípustná/povolená`, `\|` between axles | `960/ 960, 880/ 880, /, /` |
| Počet míst | `5 / 5 / ` | celkem / k sezení / k stání | `5 / 5 /` |
| Emisní limit [EHKOSN/EHSES] | ` / 566/2011F` | EHK-OSN / ES-EU | `/ 566/2011F` |
| Spotřeba při rychlosti | `0 / ` | 2 consumption forms | `0 /` |

**We do not use the official schema.** The dataset docs (`dataovozidlech.cz` — *Vozidla – technické údaje*, *Technické prohlídky*, *Vyřazená z provozu*, *Dovezená vozidla*, *Vlastník a provozovatel*) give, per field: the Czech name, the type (`string/int/float/boolean/date`), and — in the description — the composite structure and separators (e.g. *"N – ... na 1. nápravu / ... na 1. nápravu | ... na 2. nápravu / ..."*). That is enough to parse and render deterministically.

## Product Contract

### Problem
Composite technical fields render as raw registry strings with dangling separators and empty groups (`5 / 5 /`, `960/ 960, /, /`). It looks broken and is hard to read, on both the free page and — worse — the **paid** certificate.

### Primary actor
Consumer viewing a vehicle's technical data (free detail page and paid certificate). Same actor for both surfaces.

### Behavior / requirements
- **Parse composite fields by their real separator hierarchy** (`|` groups, `/` parts) using per-field metadata (see "Schema sourcing" below).
- **Positional integrity is non-negotiable — never re-index sub-parts.** Each position has a fixed meaning; dropping a middle part must never shift later parts into its slot.
  - Example — `a/b/c/d = 12/9/0/22`: the result must remain `a=12, b=9, c=0-or-—, d=22`. Collapsing to `12/9/22` (which would read as `c=22`) is a **bug**.
  - Consequence: an empty/placeholder **middle** part is either **kept as `0`/`—`** (unlabelled inline) or **dropped with its label retained on the survivors** (labelled). Only **trailing** empties may be trimmed in unlabelled inline mode.
- **Never drop a real value.** Cleaning removes only *empty* (punctuation-only, per `isBlank`) or *placeholder-zero* parts — and only where doing so can't change the meaning of another part (per positional integrity).
- **Keep meaningful zeros; treat placeholder zeros as empty — per field, positionally.** `0` for a count (místa k stání, poháněné nápravy) is real; `0` for a dimension/weight/emission/consumption field usually means "not recorded". A placeholder `0` in a **middle** slot is still shown as `0` (or `—`) to preserve position; only a **trailing** placeholder `0` may be trimmed. Driven by a curated `zeroMeansEmpty` flag, seeded from the schema type + a data sample.
- **A field that becomes entirely empty after cleaning is hidden** (consistent with today's `isBlank` behaviour — e.g. `Spotřeba při rychlosti 0 /` → both parts empty → field drops out). A field that is only *partially* empty is **kept**, positionally.
- **Garbage tolerance.** The registry holds records back to the 1990s; some values are malformed or don't match the documented shape. The renderer must **fall back to the raw (whole) value** for any field whose part count / shape doesn't match its metadata — never silently mangle it.
- **Optional labelling of sub-parts** (rendering-style decision below), e.g. `1. náprava 960/960 kg · 2. náprava 880/880 kg`, `celkem 5 · k sezení 5`, `ES/EU: 566/2011F`. Labelling is what makes middle-part dropping *safe*.
- **Both surfaces stay identical.** The improvement lands on the web table and the certificate the same way.

### Scope boundaries
- **In:** technical-data composite fields (the ~10 genuinely composite ones). Formatting/parsing only — no change to which fields are collected or to the data pipeline.
- **Out (for now):** re-labelling non-composite fields, changing categories/grouping, translating registry code values (e.g. fuel codes) — separate concerns.
- **Not touched:** the odometer/STK/owner data, payments, the snapshot pipeline.

### Success criteria
- The four example fields above render clean (no dangling `/`, no empty axles) on both surfaces.
- **Positional integrity holds:** an `a/b/c/d` fixture with an empty/zero in the first, middle, and last slot never re-indexes the survivors (unit-tested).
- No field that carries a **meaningful** `0` loses it (verified against a data sample).
- Malformed / legacy values fall back to the raw string rather than being mangled.
- No regression: scalar fields render exactly as before; fully-empty composite fields stay hidden.

## Design sketch (for planning, not final)

### 0. Schema sourcing — what the official docs can and can't give us
The datasets at `download.dataovozidlech.cz` provide two things at different levels of usefulness:
- **Machine-readable:** the CSV header (field names, order) and the docs table (name, type `string/int/float/boolean/date`, required). The `refresh-vehicle-cache` ingest already pulls these datasets, so this is available cheaply.
- **Prose only:** the **composite structure** — how many sub-parts a value has, what each means, and the `|`/`/` separator hierarchy — lives in the free-text *Popis* column (e.g. *"N – ... na 1. nápravu / ... na 1. nápravu | ... na 2. nápravu / ..."*). This is **not** machine-parseable into rules.

**Therefore:**
- The **composite parsing metadata (sub-labels, separators, units, `zeroMeansEmpty`) is hand-curated** from the documented descriptions — ~10 fields, one-time.
- Optionally, **ingest the schema table to auto-generate the label + type + order map** and add a **drift test** that fails when the registry adds/renames/retypes a field (so our hand-curated metadata is flagged as stale). This is a hardening step, not required for the display fix.

We do **not** plan to ingest the full schema as a live dependency of rendering; rendering uses the curated metadata, with the schema as the *authoring reference* (and optional drift guard).

### 1. Field-metadata table (single source of truth)
One plain-data module describing composite fields:

```ts
{
  key: 'HmotnostiPripPovN',
  kind: 'grouped',          // 'scalar' | 'split' | 'grouped'
  groupSep: '|', partSep: '/',
  groupLabel: (i) => `${i + 1}. náprava`,
  partLabels: ['přípustná', 'povolená'],
  unit: 'kg',
  zeroMeansEmpty: true,
}
```

Candidate composite fields (from the schema): `VozidloKaroserieMist` (počet míst), `Rozmery` (d/š/v), `Rozchod` (per-axle), `HmotnostiPripPov*` (přípustná/povolená pairs), `HmotnostiPripPovN` (per-axle pairs), `NapravyPneuRafky` (per-wheel pneu/kola), `HlukStojiciOtacky` (hluk/otáčky), `SpotrebaNa100Km` (město/mimo/kombi), `SpotrebaPriRychlosti`, `EmiseEHKOSNEHSES` (EHK-OSN/ES-EU), `EmiseCO2` (město/mimo/kombi), `NapravyPocetDruh`.

### 2. Structured renderer
`raw → split(groupSep) → split(partSep) → trim → drop isBlank parts → apply zeroMeansEmpty → format (unit, labels)`. Returns either a cleaned inline string or a list of labelled parts, per the chosen style. Falls back to today's behaviour for any field without metadata.

### 3. Zero/empty policy (positional)
Per-field `zeroMeansEmpty`, seeded by:
- **Keep 0:** counts — místa (k stání), poháněné nápravy.
- **0 = empty:** dimensions, weights, emissions, consumption.
- Confirm the list against a cache sample (which fields actually carry non-zero-but-meaningful zeros).

Applied **positionally**: a placeholder `0`/empty is trimmed only when it's **trailing** (or when the render is labelled so survivors keep their meaning). A **middle** placeholder is shown as `0`/`—` to hold the slot. The parser therefore works on `(index, value)` pairs, never a compacted list.

### 4. Shared across surfaces
Field metadata is currently duplicated between `api/` and `src/` (separate builds). Add **one metadata module** consumed by both the PDF builder and the web table, or a generated JSON, so the two never drift.

## Phasing

1. **Quick win (no schema):** apply per-part `isBlank` inside both `formatValue`s. Immediately removes dangling `/` and empty axles. Low risk.
2. **Metadata table:** encode the ~10 composite fields from the schema.
3. **Structured renderer + zero policy:** wire into PDF (`_vehicleFieldLabels` / `_certificatePdf`) and web (`vehicleApi` / the technical table).
4. **Audit:** sample the cache to confirm the `zeroMeansEmpty` list and catch any field whose real separators differ from the schema.

## Decisions (resolved 2026-07-10)

1. **Rendering style → Labelled parts (Variant 2).** Each sub-part gets its label + unit (`1. náprava 960/960 kg`, `celkem 5 · k sezení 5`, `ES/EU 566/2011F`). This is also what makes middle-slot dropping positionally safe.
2. **Zero policy → curated list, owner reviews.** See "Zero-policy list (for review)" below; implementation waits on sign-off of that list.
3. **Surfaces → both web + PDF**, from one shared metadata source of truth.

## Zero-policy list (for review)

Per-field rule for a `0` sub-part: **keep** (real value) vs **empty** (placeholder → trimmed positionally). Middle placeholder-zeros are still shown as `0`/`—` to hold the slot; only trailing ones are dropped.

**Keep `0` — it's a real value**
- `VozidloKaroserieMist` — počet míst *k sezení / k stání* (0 standing places is normal).
- `NapravyPocetDruh` — počet náprav / poháněných.

**`0` = empty (not recorded)**
- Weights: `HmotnostiPripPov`, `HmotnostiPripPovN`, `HmotnostiPripPovBrzdenePV`, `HmotnostiPripPovNebrzdenePV`, `HmotnostiPripPovJS`, `HmotnostiProvozni`, `HmotnostiProvozniDo`, `HmotnostiZatizeniSZ`.
- Dimensions: `Rozmery` (d/š/v), `Rozchod`, `RozmeryRozvor`, `RozmeryLoznaDelka`, `RozmeryLoznaSirka`, `DelkaDo`, `VyskaDo`.
- Fuel economy: `SpotrebaNa100Km`, `SpotrebaPriRychlosti`.
- Noise/speed: `HlukStojiciOtacky` (dB and otáčky), `HlukJizda`, `NejvyssiRychlost`.

**Conditional — needs the electric/hybrid flag ⚠ (explicit review)**
- `EmiseCO2` (g/km): `0` is **real** for a BEV, a placeholder for a combustion car with missing data → keep `0` when `VozidloElektricke = ANO`, else treat `0` as empty.
- `MotorZdvihObjem` (cm³): `0` is **real** for a BEV (no displacement) → same conditional as CO₂.
- `EmiseKSA` (kouřivost/opacity): `0` may be a genuine reading or "not recorded" — **lean keep** (don't hide a real measurement); flag for your call.
- `SpotrebaEl` (Wh/km) / `DojezdZR` (km): the real fields for EVs; `0` = not recorded → empty.

**Resolved 2026-07-10:** conditional trio approved as proposed — electric-flag conditional for CO₂ + displacement, "lean keep" for KSA.

## Sharing / build constraint (confirmed)

Standard CRA (react-scripts 5, not ejected): `ModuleScopePlugin` blocks `src/` from importing outside `src/`, and `api/` (Node16) vs `src/` (bundler) differ. The repo already handles this by **mirroring** (`api/_vehicleFieldLabels.ts` ⇄ `src/utils/vehicleFieldCategories.ts`). So the composite-field **metadata + parser is mirrored** in `api/_vehicleFieldFormat.ts` and `src/utils/vehicleFieldFormat.ts` (pure logic, sync comment). The parser returns structured labelled segments; each surface renders them into its own markup (react-pdf `Text` vs HTML spans).

## Risks / notes

- **Positional shift (highest severity):** dropping a middle sub-part and re-indexing the rest silently changes data (`12/9/0/22` → `12/9/22` reads as `c=22`). Mitigated by the positional-integrity rule: middle empties are kept (`0`/`—`) or only dropped under a label; only trailing empties are trimmed. A unit test with `a/b/c/d` fixtures (empty first / middle / last) guards this.
- **Over-hiding a real value / a meaningful zero:** second-highest risk. Mitigated by the per-field `zeroMeansEmpty` list (seeded from schema type + a cache sample), never a global "hide 0" rule, and by the positional rule that keeps middle zeros.
- **Garbage / legacy shapes:** 1990s-era records and malformed values won't always match the documented part count. The renderer must detect shape mismatch and fall back to the raw whole value rather than mangle it. The audit phase (4) samples the cache to find these.
- **Separator drift:** the schema documents separators in prose, but real values occasionally deviate (extra spaces, `,` vs `/`, `|` vs `/`). Same fallback-to-raw guard applies.
- **Two builds:** api/ (CommonJS) and src/ (CRA) can't trivially share TS modules; may need a generated JSON or parallel tables kept in sync by a test.
