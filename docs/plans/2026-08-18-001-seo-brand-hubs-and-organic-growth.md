# feat: brand hubs, server-side JSON-LD, defect content, and a data study

**Status:** proposed. Created 2026-08-18, out of the "má smysl kupovat backlinky?"
discussion. The short answer there was **no** — the Czech paid-article market sells
placements on sites with no audience, which Google devalues on its own schedule.
This plan is what to do with that budget and effort instead.

## Goal Capsule

**Intent.** Grow organic traffic by (a) completing the hub-and-spoke hierarchy the
`/znacky` section was designed for but never got, (b) making the structured data
crawl-visible, (c) opening a new keyword surface from the STK defect codes, and
(d) earning editorial links with a data study nobody else in CZ can compute.

**Definition of done.** 66 brand hubs live and indexed; JSON-LD present in the
crawl-time HTML; model pages carry a "nejčastější závady" section; one study page
published with a reproducible methodology.

**Explicitly not in scope.** Buying links or paid article placement. Indexing
individual VIN pages (rejected on privacy grounds in
`docs/plans/2026-07-15-001-aggregate-seo-pages.md`, still rejected).

## Context

`docs/plans/2026-07-15-001-aggregate-seo-pages.md` scoped a **hub-and-spoke** set:
"brand hubs, model pages, and shareable ranking lists". Model pages shipped;
**brand hubs never did**. The consequences are measurable today:

| Measured 2026-08-18 | Value |
|---|---|
| Model pages live in `znacky-sitemap.xml` | 2 274 |
| Distinct brands across them | 66 |
| Brand hub pages | **0** |
| `GET /znacky/skoda` | **200 with the homepage `<title>`** — soft 404 |
| `ld+json` occurrences in server HTML of a model page | **0** (client-only) |
| Internal links into a typical model page | **1** (from `/znacky`) |
| `vininfo.cz` → `www` | 308 ✅ (correct, no action) |

Two of these are worth spelling out because they are not what they look like:

- **`/znacky/:brand` is not a broken page, it is a missing route.** `vercel.json`
  rewrites only `/znacky/:brand/:model`; the brand-level URL falls through to the
  SPA catch-all and gets `build/index.html` verbatim — homepage title, homepage
  canonical, HTTP 200. `renderModelPage()` already handles *model* misses
  correctly (real 404 + `noindex`, and 200-but-indexable on a DB blip), so this is
  a gap in routing, not a regression in that logic.
- **The JSON-LD is not missing, it is late.** `BrandModelStatsPage.tsx:247` builds
  a correct `Dataset` node — inside `useEffect`. Google's second render wave picks
  it up eventually and unreliably. Everything *else* in that head
  (title/description/canonical/OG) is already injected server-side by
  `api/stats.ts:injectHead`; the JSON-LD is simply the one thing that was left
  behind on the client.

**Why this and not links.** These pages already rank on long-tail queries. The
constraint is that the section has no hierarchy: 2 274 pages hang off one hub with
a single inbound link each, and the highest-volume query in the whole section
("ojetá Škoda", "Škoda spolehlivost") has no page at all. Fixing the shape of the
site is cheaper and more durable than buying authority to push a broken shape.

## Product Contract

### Problem

The `/znacky` section captures model-level queries and nothing above them. Brand
queries — higher volume, same buying intent — hit either nothing or a soft 404.

### Primary actor

Someone researching a used car before buying: searches a brand, then a model, then
a specific concern ("nejčastější závady", "poruchovost", "nájezd").

### Behavior / requirements

- **R1.** `GET /znacky/:brand` returns a real page for each of the 66 published
  brands: aggregate stats + the brand's models, server-rendered head.
- **R2.** An unknown brand slug returns **404 + `noindex`**, mirroring
  `renderModelPage`. A DB failure returns **200 + indexable**, never `noindex`.
- **R3.** Brand hubs appear in `znacky-sitemap.xml`, ordered before model pages.
- **R4.** Links form a real hierarchy: `/znacky` → brand → model, and each model
  links back to its brand plus its sibling models.
- **R5.** `Dataset` + `BreadcrumbList` JSON-LD is present in the **crawl-time**
  HTML of brand and model pages. The client must not duplicate it.
- **R6.** Model pages show the most frequent STK defects for the cohort, with the
  inspection count behind the number.
- **R7.** One study page, aggregate-only, with the methodology stated on the page.

### Scope boundaries

**In:** `api/stats.ts`, `api/_statsData.ts`, `scripts/compute-stats.sql`, a new
`stats_brand` table, `vercel.json` routing, two React pages, the sitemap.

**Out:** buying links; per-VIN indexing; a blog/CMS; redesign of the model page
beyond the new defect section; the outreach itself (S4 ships the page, sending
pitches is the owner's call and is not automated here).

### Success criteria

- 66 brand hubs return 200 with a brand-specific `<title>` and self-canonical.
- `curl` of a model page shows `ld+json` in the raw HTML; the DOM after hydration
  contains exactly **one** such script.
- GSC: brand-hub impressions non-zero within 8 weeks of indexing.
- No page regresses: model-page titles/descriptions byte-identical to today apart
  from the deliberate defect addition.

### Assumptions

- Vercel Hobby's **12-function cap** still binds (memory + `api/stats.ts:5`), so
  every new route is a `type` discriminator on the existing `api/stats.ts`, never
  a new function file.
- `min_count = 100` remains the publish floor.
- S3 assumes the U3 backfill from
  `docs/plans/2026-08-17-001-feat-stk-defect-codes-plan.md` has completed.

## Key Technical Decisions

### KTD1 — Precompute `stats_brand`, do not aggregate `stats_model` at read time

Tempting, since 2 274 rows is nothing to scan. Rejected because **two of the
metrics do not aggregate**: `median_km_by_age` is a median (a median of medians is
not a median), and `stk_fail_pct` would need weighting by `stk_inspections` to
avoid a 120-car model counting as much as a 700 000-car one. Both are correct only
if recomputed from `_base`, which is exactly what `compute-stats.sql` already has
in scope. New table `stats_brand`, same shape, same run.

### KTD2 — Brand stats cover the full brand cohort, not the sum of its models

A brand's `vehicle_count` is computed over every M1 vehicle of that brand in
`_base`, including models below `min_count`. So the hub number is **larger** than
the sum of the models listed on it. That is the honest number, and the k-anonymity
floor is trivially satisfied at brand level. Mitigation is wording, not maths: the
model list is labelled "nejčastější modely", never "všechny modely".

### KTD3 — Reuse `api/stats.ts` with `type=brand`

Forced by the function cap (KTD1 assumption). Consistent with how `index`,
`sitemap`, `page` and `model` already share the handler.

### KTD4 — SSR emits the JSON-LD; the client adopts it instead of appending

If SSR injects a `<script type="application/ld+json">` and
`BrandModelStatsPage.tsx` keeps calling `createElement` + `appendChild`, every
hydrated page ends up with **two** Dataset nodes. The client already does the
adopt-or-create dance for `canonical` and `robots`; the JSON-LD moves to the same
pattern, keyed on the existing `data-stats-ld="true"` marker.

### KTD5 — Escape `<` as `\u003c` inside the JSON-LD

A `</script>` sequence anywhere in the serialised JSON terminates the script
element early and injects the remainder as markup. Brand and model names are
DB-sourced free text, so this is reachable, not theoretical. `htmlEscape()` is
**wrong** here — it would corrupt the JSON. Serialise, then replace `<` with
`\u003c`.

### KTD6 — Top defects are precomputed into `stats_model`, never joined at request time

The 2026-07-15 plan established that a registry × inspections join times out at
120 s even scoped to one model. After U3 the defect side is a 138.8 M-element
array column, which is worse. `top_defects JSONB` on `stats_model`, filled by the
monthly precompute; the page does an indexed single-row read as it does now.

### KTD7 — The study reports patterns, not accusations

Odometer rollback is fraud, and naming models invites a defamation problem. The
study publishes **aggregate percentages with the detection rule stated on the
page**, a conservative threshold, and the word "nesrovnalost" rather than
"podvod". No VIN, no seller, no dealer is ever named.

## Implementation Units

### S1. Brand hub pages `/znacky/:brand`

*Depends on: nothing. Biggest single win.*

1. **Migration `008_stats_brand.sql`** — additive, mirrors 006:
   `brand TEXT PRIMARY KEY`, `vehicle_count`, `model_count`, `first_year`,
   `last_year`, `avg_age_years`, `fuel_split`, `avg_owners`, `pct_imported`,
   `pct_lpg`, `pct_towbar`, `stk_fail_pct`, `stk_inspections`,
   `median_km_by_age`, `color_split`, `computed_at`. Same role-guarded
   `GRANT SELECT ... TO vincheck_api` block.
2. **`scripts/compute-stats.sql`** — add a `GROUP BY brand` pass over the same
   `_base` temp table, with the same `min_count` floor. Reuses the existing
   brand-alias fold, so hub slugs match the model slugs and the `vercel.json`
   308s already in place.
3. **`api/_statsData.ts`** — `getBrandStatsBySlug()`, `getModelsForBrand()`,
   `getAllPublishedBrands()`. Same `42P01`/`42501` tolerance as the existing three.
4. **`api/stats.ts`** — `type=brand` (HTML, mirroring `renderModelPage` including
   its three-way status logic) and `type=brandjson` for the client fetch.
5. **`vercel.json`** — add `/znacky/:brand` → `/api/stats?type=brand&brand=:brand`
   **after** the `:brand/:model` rewrite. Verify `/znacky` itself still resolves to
   the SPA hub and is not swallowed.
6. **`src/pages/BrandStatsPage.tsx`** + route in `App.tsx`.
7. **Sitemap** — brands after the hub, before models.

**Title/description shape** (mirrors the model-page convention exactly):
`Škoda: statistiky, spolehlivost a nájezd 58 modelů | VIN Info.cz`

### S2. JSON-LD in the crawl-time HTML

*Depends on: nothing. Smallest unit — ship it first as a warm-up.*

1. `HeadOpts.jsonLd?: object[]` in `api/stats.ts`; `injectHead` serialises with
   the KTD5 escape and emits `data-stats-ld="true"`.
2. Build `Dataset` (identical fields to `BrandModelStatsPage.tsx:250`) plus a
   `BreadcrumbList`: Značky → Brand → Model.
3. `BrandModelStatsPage.tsx` — adopt the existing element rather than append
   (KTD4). The cleanup path must not remove a node it did not create.
4. Same for `BrandStatsPage.tsx` from S1.

### S3. "Nejčastější závady" on model pages

*Depends on: **U3 backfill complete**. Blocked until then.*

1. `009_stats_top_defects.sql` — `ALTER TABLE stats_model ADD COLUMN
   top_defects JSONB`, nullable, no default. Degrades to "neuvedeno" while NULL.
2. `compute-stats.sql` — unnest `zavady_kody` for the cohort's inspections, count
   by code, keep the top 8 with `{code, count, share}`. Resolve the human text at
   **read** time via the vendored `api/_defectCatalog.json` (KTD2 of the defect
   plan: store codes, resolve on read — same rule applies here).
3. Model page section + an added clause in the SSR description.

**Why this is the biggest keyword unlock:** "nejčastější závady Octavia 3" and its
siblings are currently served by discussion forums with anecdotes. This answers
them from 138.8 M real inspection defects. It multiplies the *depth* of 2 274
existing pages rather than adding thin new ones.

### S4. Data study: odometer inconsistencies

*Depends on: **nothing** — needs only the odometer readings already ingested, not
the defect backfill. Can run in parallel with S1.*

1. `scripts/study-odometer-rollback.sql` — per vehicle, order ISTP readings by
   date; flag a pair where a later reading is lower than an earlier one by more
   than a tolerance (absorbs unit and typo noise). Aggregate to brand/model and
   import status. **Conservative threshold, stated on the page.**
2. A static study page under `/studie/:slug`, server-rendered head, in the
   sitemap.
3. Aggregate-only, methodology on the page, per KTD7.

The engineering ends there. Pitching it to the auto desks at Seznam Zprávy, iDNES,
Garáž, Hybrid.cz and Autobible is a manual step and deliberately not automated —
but it is the step that actually produces the links, so the page is not "done"
until someone sends those mails.

## Verification Contract

| # | Check | Expected |
|---|---|---|
| V1 | `curl -sI /znacky/skoda` | `200`, brand-specific `<title>` |
| V2 | `curl -sI /znacky/neexistujici-znacka` | `404` + `noindex` |
| V3 | Brand handler with the DB unreachable | `200`, `index, follow`, `no-store` |
| V4 | `curl -s /znacky/skoda/octavia \| grep -c ld+json` | `≥ 1` |
| V5 | Hydrated DOM, `[data-stats-ld]` count | exactly `1` |
| V6 | JSON-LD with a `<` forced into a brand name | renders `\u003c`, script intact |
| V7 | `znacky-sitemap.xml` loc count | `1 + 66 + 2274` |
| V8 | Every brand slug in the sitemap | resolves `200`, no redirect hop |
| V9 | Model-page title/description | byte-identical to pre-change baseline |
| V10 | Rich Results Test on a brand + a model URL | Dataset + BreadcrumbList valid |
| V11 | `pnpm build`, both typechecks, Biome on touched files | clean |

**Baseline first.** Capture GSC impressions/clicks for `/znacky/*` **before** S1
deploys. Without it, S1's effect is unattributable and the whole "don't buy links"
argument stays unfalsifiable.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| `/znacky/:brand` rewrite swallows `/znacky` | V7/V8 plus an explicit test of the bare hub URL; order rewrites specific-first |
| Function cap: a new file breaks the deploy | No new function files — `type` discriminator only (KTD3) |
| Doubled JSON-LD after hydration | KTD4 adopt-not-append; V5 asserts exactly one |
| `</script>` breakout from DB free text | KTD5; V6 asserts it |
| Brand count ≠ sum of model counts looks like a bug | KTD2; wording is "nejčastější modely" |
| Defect precompute too heavy for the monthly run | KTD6 precompute; measure on one brand before the full pass |
| Study reads as an accusation against a model | KTD7: aggregates, conservative threshold, published methodology |
| S3 slips if U3 slips | S1/S2/S4 are all independent of U3 — sequence them first |

## Sequencing

```
S2 (JSON-LD)      ──┐
S1 (brand hubs)   ──┼── independent of the defect backfill, start now
S4 (study)        ──┘
S3 (defect content) ── blocked on U3 backfill
```

Recommended order: **baseline GSC → S2 → S1 → S4 → S3**. S2 first because it is
an hour of work and validates the `injectHead` changes that S1 then builds on.

## Open Questions

- How many of the 2 274 model pages are actually indexed? If coverage is poor, the
  bottleneck is crawl budget/authority and S1's internal linking matters even more
  than assumed — but the fix order does not change.
- Tolerance for the rollback rule in S4: needs a distribution check on real
  reading pairs before a number is picked.

## Sources

- `docs/plans/2026-07-15-001-aggregate-seo-pages.md` — hub-and-spoke design, the
  precompute constraint, why VIN pages were rejected
- `docs/plans/2026-08-17-001-feat-stk-defect-codes-plan.md` — U3 backfill, the
  store-codes-resolve-on-read rule
- `api/stats.ts`, `api/_statsData.ts`, `scripts/compute-stats.sql`,
  `scripts/migrations/006_stats_tables.sql`, `vercel.json`
- Live measurements taken 2026-08-18 (table under "Context")
