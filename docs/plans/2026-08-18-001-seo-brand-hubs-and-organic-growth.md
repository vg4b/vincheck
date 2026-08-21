# feat: brand hubs, server-side JSON-LD, defect content, and a data study

**Status:** S0a, S0b, S1, S2 and most of S5 shipped 2026-08-19/20. S3 and S4
outstanding. Verified on production; see "Shipped" below.

**Status (original):** proposed. Created 2026-08-18, out of the "má smysl kupovat backlinky?"
discussion. The short answer there was **no** — the Czech paid-article market sells
placements on sites with no audience, which Google devalues on its own schedule.
This plan is what to do with that budget and effort instead.

## Shipped

| Unit | State | Verified on production 2026-08-21 |
|---|---|---|
| S0a normalise model strings | done | 0 duplicate cohorts, 0 colliding slugs |
| S0b fold + floor 500 | done | 2 273 → 764 cohorts, 4 331 aliases 308-ing |
| S1 brand hubs | done | 43 hubs, all 200, unknown brand → 404 + noindex |
| S2 crawl-time JSON-LD | done | Dataset + BreadcrumbList in raw HTML, one node after hydration |
| S5 drill-down | mostly | motorisations on 269 model pages, hub leads with brands, nav link added |
| S3 defects on model pages | done | 763/764 cohorts; the aggregation added **8 minutes** to the rebuild (113 vs 105) |
| S4 odometer study | **dropped** 2026-08-21 at the owner's decision |
| S6 ranking pages | 4 of 5 live | theft ranking **withdrawn before shipping** — see below |

Rebuild takes **105 minutes** with the GROUPING SETS approach (132 before), and
every unit that adds a column costs one — batch schema changes before running it.

**Re-measure GSC in 4-8 weeks** against the baseline below. The 4 331 redirects
and the 1 509 removed urls need crawling before anything moves.

## Goal Capsule

**Intent.** Turn `/znacky` from a directory of 2 273 links into the site's
strongest content: a brand → model → motorisation tool people actually use.
Organic growth follows from that rather than the other way round — the index data
says Google is declining to crawl thin, near-identical pages, and the fix is
fewer pages that are each worth reading. Concretely: (a) clean the model data so
the numbers are credible, (b) complete the hub-and-spoke hierarchy the section was
designed for but never got, (c) open a new surface from the STK defect codes,
(d) make the structured data crawl-visible, and (e) earn editorial links with a
data study nobody else in CZ can compute.

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

**Out:** buying links; per-VIN indexing; a blog/CMS; a URL level per
motorisation (S5 explains why the data ships inside the model page instead); the outreach itself (S4 ships the page, sending
pitches is the owner's call and is not automated here).

### Success criteria

- **Zero colliding slugs** in `stats_model` — no cohort is unreachable.
- `/znacky` is reachable from the main navigation on every page.
- A model page shows its motorisations without a further navigation step.
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
- The U3 backfill from `docs/plans/2026-08-17-001-feat-stk-defect-codes-plan.md`
  completed 2026-08-19 (91 936 384 rows, 100 % coverage), so S3 is unblocked.

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

### S0a. Normalise model strings (found 2026-08-20)

*Depends on: nothing. Must run **before** the engine fold.*

**25 slugs collide, involving 53 cohorts — and one of each pair is unreachable.**
`getModelStatsBySlug` matches on the slug with `LIMIT 1` and no `ORDER BY`, so
when two cohorts slugify identically the database picks one arbitrarily and the
other's vehicles appear nowhere on the site.

| URL | cohorts sharing it |
|---|---|
| `hyundai/i-30` | `i 30` (85 063) **vs** `I 30` (4 531) |
| `peugeot/206` | `206` (35 298) **vs** `206+` (2 350) |
| `opel/astra` | `ASTRA` (10 200) **vs** `ASTRA+` (939) |
| `opel/astra-sports-tourer` | three cohorts, one URL |
| `peugeot/rifter` | `Rifter` (5 934) **vs** `RIFTER` (242) |
| `volkswagen/up` | `UP!` (4 207) **vs** `UP` (283) |
| `mercedes-benz/v-klasse` | `V-KLASSE` **vs** `V - KLASSE` |

The causes are letter case (`Rifter`/`RIFTER`), spacing (`V-KLASSE`/`V - KLASSE`)
and punctuation slugify discards (`206+`, `UP!`). None of them are different cars.

Hyundai i30 is the worst case and the one that makes the point about credibility:
`i 30`, `I 30`, `i30`, `I 30CW`, `i 30CW`, `i 30 N` — six cohorts, of which three
are the same string in different clothes.

**Fix: group by the slug, not by a normalised string.** The first attempt was a
normalisation function (upper-case, collapse whitespace, strip the punctuation
slugify drops). It cut collisions from 25 to 11 and then stalled on an endless
tail of separator and diacritic noise — `MX-5` vs `MX 5`, `DOBLÓ` vs `DOBLO`,
`TOWN & COUNTRY` vs `TOWN COUNTRY`, `TUCSON, IX35` vs `TUCSON,IX35` vs
`TUCSON IX35`. Chasing a rule per character is a losing game.

The clean formulation: **if two strings slugify identically they are the same
page, by definition of our URL space.** So group on
`slugify(fold_model(model))` and keep the highest-count raw spelling as the
display name. Collisions then cannot exist — not because a rule caught them, but
because the grouping key *is* the URL. 252 slugs absorb more than one source
cohort under this rule.

That also fixes the decimal-point trap the normalisation approach hit: a `norm()`
that strips `.` turns `1.9` into `1 9`, and the engine fold stops recognising it.
Grouping by slug needs no such surgery on the string.

Measured effect on Hyundai i30 — the case that prompted this:

| before | after |
|---|---|
| `i 30` (85 063), `I 30` (4 531), `i30` (790), `I 30CW` (2 953), `i 30CW` (2 809), `i 30 N` (118) | `i-30` (89 594), `i-30cw` (5 762), `i-30-n` (118) |

Six cohorts become three, and the three that remain are genuinely different cars:
hatchback, estate, and the N hot hatch.

**Separators fragment too, and slug grouping alone does not catch it.** Raised
by the owner 2026-08-20: the STK data is typed by people with no enum to pick
from, so the same car arrives spelled several ways. Where those spellings produce
*different* slugs, grouping by slug leaves them apart:

| URL | URL |
|---|---|
| `kia/cee-d` (33 997) | `kia/ceed` (22 407) |
| `hyundai/i-30` (89 594) | `hyundai/i30` (790) |
| `volvo/xc60` (19 475) | `volvo/xc-60` (243) |
| `mazda/mazda6` (1 134) | `mazda/mazda-6` (672) |

**Measured impact, and the two numbers answer different questions:**

- **3 models** would be hidden by a 500 floor when split but clear it when merged
  (2 072 vehicles). The owner's stated worry — a legitimate car disappearing — is
  real but small.
- **29 750 vehicles** sit on a *duplicate* page that should not exist at all,
  dominated by Kia Cee'd. That is the larger problem, and it is independent of the
  floor.

**Fix:** group on the slug with separators removed (`i-30` and `i30` both key on
`i30`), and keep the **highest-count member's slug as the canonical URL** so the
page with the history keeps its address; the others become aliases and 308 to it
through the mechanism S0b already builds.

**All 27 affected groups were reviewed by hand and none is a false merge** — every
one is the same car typed differently (`vel-satis`/`velsatis`, `m550d`/`m-550-d`,
`pathfinder-a-t`/`pathfinder-at`). The rule is "identical once separators are
removed", which is far stronger than "similar": it cannot merge an A4 with an A5.
The residual risk is a maker deliberately using a hyphen to distinguish two
models, which does not occur in this data — re-review the group list when the
registry snapshot changes materially.

**Verification:** zero duplicate `(brand_slug, model_slug)` pairs in
`stats_model` — structurally guaranteed, and asserted anyway. Plus: no group of
separator-variants left unmerged, asserted the same way.

### S0b. Fold engine variants, then raise the publish floor

*Depends on: nothing for the fold; the floor raise depends on S1.*

**The fold.** Strip engine, displacement, valve-count, power and drivetrain
tokens from the model string before grouping; keep body styles. Measured on the
live data 2026-08-19: **2 273 → 1 876 cohorts**, all 366 merges genuinely the
same car (`OCTAVIA 1.9 TDI` → `OCTAVIA`, `BERLINGO 1.6 HDI` → `BERLINGO`).

Body styles are deliberately **not** folded, on evidence: `A4 AVANT` holds 19 044
vehicles against `A4`'s 16 100, and `PASSAT VARIANT` 48 818. These are searched as
their own cars; merging them would destroy a cohort, not consolidate one. The same
care applies to BMW, where the trailing letter *is* the name — `320 D` and `320 I`
are different cars, so a lone `D`/`I` is dropped only when an engine token was
already stripped from the same string (`X5 3.0 D` → `X5`, but `320 D` survives).

**The floor.** Folding alone is a 16 % reduction, which does not solve crawl
rationing on its own. Raising `min_count` is the lever:

Re-measured 2026-08-20 with S0a's slug grouping applied first (`min_count` is
**100** today):

| floor | pages | vehicle coverage |
|---|---|---|
| today, no S0a/S0b | 2 273 | 100 % |
| 100 (current floor) | 1 737 | 100 % |
| 250 | 1 069 | 98.3 % |
| **500** | **749** | **96.4 %** |
| 750 | 594 | 94.8 % |
| 1 000 | 509 | 93.6 % |
| 2 000 | 333 | 89.4 % |

**Proposed: 500.** A 67 % cut from today's 2 273 URLs for 3.6 % of vehicle
coverage. It is also defensible statistically — 500 cars carry roughly 2 500
inspections behind `stk_fail_pct`, and `median_km_by_age` has its own `n >= 20`
guard — so this is not trading honesty for tidiness.

Not 1 000: the extra 240 pages saved cost another 2.8 points of coverage, which
is more "model not found" for cars people actually own. The floor can be raised
later if crawling still stalls; it cannot easily be lowered once pages have been
dropped and redirected.

With S5 shipping a motorisation breakdown inside each page, a 500-car cohort is
no longer a thin page — it is one car with its variants laid out, which is the
depth the crawl data says is missing.

**Sequencing matters here.** `renderModelPage` returns a real 404 for an unknown
slug, so raising the floor before S1 exists would send ~1 000 URLs — including 22
currently indexed ones — to 404 with nowhere to go. Ship the fold first (nothing
is lost, every retired slug 308s to its base model), then S1, then raise the floor
with dropped models redirecting to their brand hub.

**Do the redirects in code, not in `vercel.json`.** The brand aliases are 14
static entries; 366 folded slugs plus ~1 000 floor-dropped ones is a different
scale. `api/stats.ts` already handles the miss case — on a 404, apply the same
fold to the requested slug and 308 to the target when one exists. That covers
future folds automatically and keeps the config readable.

**Junk cohorts.** Three published cohorts carry an engine spec where the model
name belongs (`OPEL / 1.0 12V`, `1.2 16V`, `1.3CDTI 16V` — ~1 000 vehicles). They
are excluded at the publish-floor step, not in `_base`: the cars are still Opels
and must keep counting toward brand aggregates, they just do not deserve a page.

**Deploy order is forced, not a preference.** Running the precompute before the
code ships turns 504 retired slugs into 404s, several of them indexed. Shipping
the code first is a no-op — the alias table does not exist yet, so the handler
degrades to its existing 404. So: code + migration 008, then the precompute.
The precompute itself has no downtime window: both `TRUNCATE`s sit inside the
single `BEGIN`/`COMMIT`, so readers see the old cohorts until the swap commits.

**Verification:** every retired slug resolves 200 after one hop; no fold merges
two cohorts whose base names differ; `A4 AVANT`, `PASSAT VARIANT`, `320 D` and
`320 I` all survive as distinct pages.

### S5. Make the stats a destination, not a directory (2026-08-20)

*Depends on: S0a, S0b, S1. This is the reason the rest is worth doing.*

The section is currently built as an index: a flat A-Z list of 2 273 links. The
owner's reading is that these numbers are the most interesting thing on the site
and should hold people there. That reframes the goal from "pages that rank" to
"a tool people use", and the two are not in tension — dwell time and depth are
exactly what "Discovered – currently not indexed" is asking for.

**Drill-down instead of a list.** Brand → model → motorisation, each step
narrowing the set:

1. `/znacky` — brands, with counts. Not 2 273 links.
2. `/znacky/:brand` — that brand's models (S1).
3. `/znacky/:brand/:model` — the model page, **with a motorisation breakdown on
   it**.

**Motorisations are a section, not a URL level.** This is the one place the
owner's sketch and the index data pull apart, and the resolution favours both:
2 180 of our URLs are already discovered-and-not-crawled, so a third URL level
would add thousands more of exactly what Google is declining. Rendering the
motorisations *within* the model page gives the same drill-down experience,
keeps the data the fold would otherwise discard, makes the page substantially
richer, and adds no URLs. A buyer comparing "Octavia 1.9 TDI" against "Octavia
2.0 TDI" wants them side by side anyway, not on two pages.

This means **S0b must keep the per-variant data, not discard it**: the fold
decides what gets a URL, not what gets computed. Add a `motorisations JSONB`
column to `stats_model` holding each source variant with its count, fuel, and
median mileage.

**Main-navigation link.** `/znacky` is absent from the main nav (verified
2026-08-20: the nav carries `/firma`, `/povinne-ruceni`, `/overeny-vypis-vozidla`
and six others, not this). That is a site-wide internal link to the section
Google is under-crawling — the cheapest item in this entire plan and one of the
better-targeted ones.

**Layout is already fine.** Both `ZnackyHubPage` and `BrandModelStatsPage`
already render `Navigation` and `Footer`, so the pages are not visually detached
from the site. What was missing is the entry point, not the chrome.

**Keep the flat list.** Move it to its own route (`/znacky/vse`) or below the
fold on the hub. It stays useful for crawlers and for people who know exactly
what they want; it just stops being the primary interface.

### S1. Brand hub pages `/znacky/:brand` — BUILT 2026-08-20

Implemented as specified, with two notes worth carrying forward.

**Brand rows come from the same scan as model rows,** via `GROUPING SETS` on
every aggregation block rather than a second pass. A second pass would re-run the
joins over `vehicle_inspections` (83 M) and `vehicle_inspection_odometer`
(91.9 M), roughly doubling a 2h12m job. Brand rows are the ones with
`model IS NULL`; each assemble filters accordingly.

**`scripts/test-compute-stats.sh` exists because of a near miss.** The script
`TRUNCATE`s `stats_model`, and it was pointed at production as a "quick test"
with a brand filter on 2026-08-20 — had it committed, it would have published one
brand and deleted 763. Only the single-transaction design saved it. The harness
builds a local fixture from the real migrations and exercises every rule in
seconds: spelling merges, separator merges, engine folds, the body styles and
BMW letters that must *not* merge, junk-cohort exclusion, aliases, motorisations,
and that a brand total exceeds the sum of its published models.



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

*Depends on: U3 backfill — **complete since 2026-08-19**, so this is unblocked.*

**Cost measured 2026-08-19, and it is the real constraint here.** Aggregating the
defect codes for a single cohort (ŠKODA OCTAVIA, 932 116 VINs — the largest one)
against an indexed VIN table took **3 min 20 s**. The result is exactly the
content this unit is for:

| code | occurrences | |
|---|---|---|
| 6.2.1.1.1 | 960 440 | povrchová koroze karosérie |
| 5.3.3.2.1 | 550 271 | nápravy, kola a pneumatiky |
| 6.1.1.3.1 | 503 814 | povrchová koroze rámu |
| 1.1.14.1.1 | 386 682 | zkorodovaný brzdový kotouč |

That number does **not** multiply by 2 274. The precompute makes one pass grouped
by `(brand, model)`, the same shape `_odo` already uses for median mileage, so the
whole set is one scan rather than 2 274 of them. But the full-pass cost was not
measured — doing so means running the heaviest query in the system against the
shared node, which belongs off-peak and not during a working day. **Measure it
before committing to a monthly cadence**, and be ready to fall back to a separate
quarterly job if it does not fit alongside the existing blocks.

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

### S6. Ranking pages — the listicles this plan dropped

*Depends on: S0a/S0b (done). Independent of everything else.*

**This was scoped and then lost.** `docs/plans/2026-07-15-001-aggregate-seo-pages.md`
listed "shareable ranking lists" in its first paragraph and named the routes at
its line 161: `/statistiky/nejporuchovejsi-vozy`, `/nejcastejsi-vozy`,
`/vozy-na-lpg`. Writing the 2026-08-18 plan I carried over the hubs, the model
pages and the study, and silently left the rankings behind. Raised by the owner
2026-08-21.

They belong here for the same reason the hubs do: a ranking page is one URL that
earns links and links *out* to dozens of model pages, which is exactly the
internal-linking shape the crawl data says is missing.

**Data confirmed available 2026-08-21:**

| Page | Source | Status |
|---|---|---|
| Nejporuchovější / nejspolehlivější vozy | `stats_model.stk_fail_pct` | already computed — the page is `ORDER BY` |
| Nejčastěji stáčené vozy | odometer readings (S4's rule) | needs S4's detection first |
| Nejčastěji kradené vozy | `vehicle_deregistration.duvod = 'Odcizeno'` | 19 355 records, joins to brand/model, returns in seconds |
| Vozy na LPG/CNG | `stats_model.pct_lpg` | already computed |
| Nejrozšířenější vozy | `stats_model.vehicle_count` | already computed |

**Rates, not counts — this is the whole design.** A raw theft ranking reads
ŠKODA 6 162, VOLKSWAGEN 1 070, FORD 920, which is not a list of stolen cars but a
list of *common* cars. Every ranking here must divide by the registered
population and carry a minimum-denominator floor, or the page says nothing and
invites a correction. The same trap applies to defects and to rollbacks.

**One route, not one function per page** (the 12-function cap): `/statistiky/:slug`
rewritten to `api/stats.ts` with a `type=ranking` discriminator, exactly as the
brand hubs work.

**Ranking snapshots go in a table.** The 2026-07-15 plan already proposed
`stats_meta` for this. Computing a ranking at request time means scanning the
registry, which is the constraint that plan established in the first place.

**KTD7 applies to theft as it does to rollbacks:** publish rates and the method,
never a claim about a named model being "the thieves' favourite". A ranking is a
description of data, not an accusation.

### S7. Theft ranking, done properly — scoped 2026-08-21

Replaces the withdrawn version. Feasibility measured rather than assumed.

**The numerator works.** Theft records carry dates (`datum_od`, 1993→2026) and
run ~1 400 a year, so a five-year window (2021-2025) holds ~6 745 thefts. With
the cohort fold applied:

| minimum thefts | models qualifying |
|---|---|
| 10 | 104 |
| **20** | **43** |
| 30 | 24 |
| 50 | 12 |

A floor of 20-30 leaves a publishable list. This is the numerator guard the
first attempt lacked, where the top entries rested on two events.

**The denominator is the work.** "Fleet at risk during the window" =
vehicles registered before the window ended and not already deregistered when it
began — computable, and it must be built outside the `PROVOZOVANÉ` filter, which
is what broke v1. Measured: **12.9 M vehicles, 3m20s** as a single count.

**But grouped by model it times out at 7 minutes.** The naive form uses a
correlated `LATERAL` against `vehicle_deregistration` for each of 19.3 M registry
rows. The fix is the pattern this script already uses for `_owners` and `_imp`:
pre-aggregate the deregistration dates into an indexed temp table, then
`LEFT JOIN`. Tractable, but it is optimisation work, not a copy-paste.

**Effort: roughly half a day hands-on, plus one unattended rebuild.**

| | |
|---|---|
| SQL block (numerator, denominator, floor) incl. the optimisation above | 1.5-2 h |
| Migration 011 — the existing `stolen_per_1000` has the wrong semantics and should be replaced, not reused | 15 min |
| Fixture test, specifically that a *deregistered* stolen car is counted | 30 min |
| Ranking definition and honest page copy | 20 min |
| Verify and deploy | 30 min |
| Rebuild | ~2 h unattended |

**Risks worth naming before starting.** A car deregistered mid-window is counted
as fully at risk, which slightly understates rates — a simplification to state on
the page rather than model away. And KTD7 still governs the copy: publish the
rate and the method, never a claim that a named model is a thieves' favourite.

### Withdrawn: the theft ranking (v1)

Built, computed, and pulled before it went live (2026-08-21). Recorded because
the failure is not obvious from the query, which looks correct.

`_base` is restricted to `status = 'PROVOZOVANÉ'`. A stolen car gets
deregistered, so **17 924 of the 19 355 'Odcizeno' rows sit on VYŘAZENO Z PROVOZU
vehicles** and the join saw 845 of them — 4.4 %. The column was measuring "stolen
and still on the road", which is closer to a recovery rate than a theft rate.

Two further problems even with the full numerator:

- The rate divides all-time thefts by *today's* registered population: two
  different periods over two different populations.
- The top rates were built on 2 to 4 events. `AUDI TT — 0.90 per 1 000` rests on
  two thefts. That is noise with a decimal point, and a minimum numerator is as
  necessary as the minimum denominator already in place.

A sound version needs thefts and registrations from the same window, computed
outside the `PROVOZOVANÉ` filter, with a numerator floor. The columns and the
precompute block stay (they cost 8 minutes and no correctness); only the public
page is withheld. **A wrong ranking is worse than no ranking** — this one would
have named specific models as theft magnets on evidence that does not support it.

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

### GSC baseline, captured 2026-08-19 (29-day window)

**Index coverage is the whole story.**

| Index status | Pages |
|---|---|
| Indexed | **58** |
| **Discovered – currently not indexed** | **2 180** |
| Duplicate without user-selected canonical | 16 |
| Excluded by noindex | 2 |
| Redirect page | 2 |

**2 180 URLs have been discovered and never crawled** — "Naposledy procházeno:
Není k dispozici" on every one. Google read them from the sitemap, assessed the
domain, and declined to spend the budget. That list includes pages with real
demand: `/znacky/audi/a4`, `/audi/a6`, `/audi/q7`, `/alfa-romeo/giulietta`, and
the top-level `/upozorneni-na-terminy`.

The 58 that *are* indexed are effectively a random early sample — `kia/clarus`,
`daewoo/leganza`, `citroen/zx` — not the valuable ones.

**The queries confirm it.** Every query in the 29-day window is either brand
navigation (`vin info` 35 clicks, `vininfo` 17) or generic free-VIN intent
(`kontrola vin zdarma`, `vin kód zdarma`). **Not one model query.** The `/znacky`
section is not ranking badly for "škoda octavia" — it is not in the race at all.

The two smaller buckets are already handled and will self-heal: the `noindex` and
`redirect` entries are the login page and the apex, both correct, and
`/znacky/vw/tiguan` and `/znacky/mercedes-amg/…` were crawled on 21-22 July,
*before* the brand-alias 308s landed. Both now redirect correctly (re-verified
2026-08-19).

**This changes the diagnosis.** Cannibalisation is real but small — 16 pages.
The dominant problem is that a low-authority domain published 2 273 URLs of
near-identical shape, and Google is rationing. Adding pages does not fix that;
**making the set smaller and each page more distinct does.** Every unit in this
plan should be judged by whether it raises value-per-URL:

- **S0 (consolidate thin variants)** removes ~1 400 near-duplicate URLs. Directly
  targets the ration.
- **S1 (brand hubs)** adds 66 URLs but gives the survivors a real internal link
  hierarchy — the standard remedy for "Discovered – not indexed".
- **S3 (defects)** makes each surviving page carry content no template can
  generate. Also directly on target.
- **S2 (JSON-LD)** does not move this needle. It is still worth an hour, but it
  is no longer the recommended first step.

### Supporting measurements

| | |
|---|---|
| `www.vininfo.cz/` (homepage) | 612 clicks · 15 549 impressions |
| `vininfo.cz/` (apex, historical) | 265 clicks · 4 197 impressions |
| **All `/znacky/*` pages combined** | **1 click · ~77 impressions across 43 URLs** |
| `/overeny-vypis-vozidla` | 0 clicks · 22 impressions |
| Model pages published | 2 273 |

The apex figures need no action: `vininfo.cz` → `www` is a 308 that preserves the
path, and the pages self-canonicalise to `www` (re-verified 2026-08-19). That
traffic is Google catching up, not a live split.

**The section is not under-ranked, it is under-crawled and diluted.** 2 273 pages
returned 77 impressions between them, and the ones that surfaced are variants
nobody types: `citroen/c8-2-0hdi-16v`, `bmw/730-d`, `chevrolet/captiva-2-2`. Two
measurements explain it:

- **68 % of the pages (1 548 / 2 272) are engine or trim variants**, not model
  names, and **1 497 base+variant pairs** are both published — `/skoda/octavia`
  competes with `/skoda/octavia-1-9-tdi`, `/octavia-rs`, `/octavia-combi`,
  `/octavia-kombi`, `/octavia-slx-tdi` and more.
- **63 % of cohorts (1 422 / 2 273) hold fewer than 500 vehicles.** OCTAVIA itself
  has 698 195; OCTAVIA KOMBI has 187. They are listed in the same flat sitemap
  with no `<priority>`, so a crawler cannot tell them apart.

The 2026-07-15 plan chose to keep model strings "intentionally granular". That
choice is now measurably the bottleneck: it spends a small crawl budget on pages
that cannot rank, and splits the signal of the ones that could.

**This reorders the plan.** S1's brand hubs are still right — they are what gives
the good pages internal links — but consolidating or de-indexing the thin variants
is cheaper and should come first, because otherwise the hubs link to 2 273 pages
of which two thirds should not exist. See "Open Questions" for what is still
unknown.

**Re-measure after each unit ships.** Without this table, the effect of any of it
is unattributable and the "don't buy links" argument stays unfalsifiable.

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
| S3's precompute does not fit the monthly run | Full-pass cost unmeasured; one cohort took 3m20s. Measure off-peak before wiring it into the monthly job; fall back to a separate quarterly job |

## Sequencing

```
S2 (JSON-LD)      ──┐
S1 (brand hubs)   ──┼── all four are now unblocked (U3 completed 2026-08-19)
S4 (study)        ──┤
S3 (defect content) ─┘  heaviest precompute; measure the full pass off-peak
```

Recommended order, revised after the 2026-08-19 baseline:
**S0a → S0b-fold → S1 → S5 → S0b-floor → S3 → S2 → S6 → S4**.

S6 sits before S4 because two of its five pages need no new data at all.

S0a leads because the fold inherits its noise otherwise. S5 lands after
the hubs because the drill-down needs them to exist, and before the floor
raise because a richer page changes which cohorts are worth keeping.

The original order led with S2 because it was small. The index data says the
binding constraint is crawl rationing across 2 273 near-identical URLs, so the
work that shrinks and enriches that set comes first. S2 keeps its place as an
hour of cleanup, just not at the front.

## Open Questions

- **Which index status do the 58 sampled URLs represent?** GSC's drilldown was
  read without its category label, so "58 URLs" could mean 58 indexed, or 58
  crawled-but-not-indexed. The two imply different fixes: the first is a crawl
  budget problem, the second a quality/thin-content one. Needed before S0 is
  scoped.
- **What do people actually search?** The Queries tab would confirm the reading
  above — that demand is on "škoda octavia", not "octavia 1.9 tdi". The page-level
  data strongly implies it but does not prove it.
- **S0 (new): consolidate or de-index thin model pages.** Fold variants into their
  base model, or keep the pages and `noindex` those under a vehicle-count floor?
  Folding is better for users and signal; noindex is reversible and far cheaper.
  Either way the brand-alias precedent applies: retired slugs need 308s in
  `vercel.json`, exactly as the brand folds already do.
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
