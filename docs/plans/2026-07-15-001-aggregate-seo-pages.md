# Plan: aggregate brand/model SEO pages ("statistický" content)

**Status:** proposed. Created 2026-07-15, out of the "only 5 pages indexed in GSC"
discussion. This is the *safe* alternative to indexing individual VIN pages —
which was rejected (privacy/GDPR, thin-content risk, no SSR); see the reasoning
in that conversation, summarised under "Why not VIN pages" below.

## The idea

Turn the cache into programmatic-SEO content: a hub-and-spoke set of pages built
from **aggregate** statistics over the 19.3M-vehicle registry — brand hubs, model
pages, and shareable ranking lists ("modely s nejvyšší poruchovostí STK",
"nejčastěji registrované vozy", "vozy nejčastěji na LPG"). Aggregates only, never
individual vehicles, so there is **no privacy surface at all** — and the data is a
genuine moat: nobody else can write "průměrný nájezd Octavie ve 12 letech je X km"
and mean it, because we have the odometer + equipment data we just wired up.

This is a 6–12 month content play, not an overnight ranking fix. The 5-indexed-
pages problem is domain-authority/age, not URL count; these pages move the needle
because they're **unique, rich, and genuinely useful** — the opposite of thin VIN
pages.

## Two hard constraints learned while scoping (2026-07-15)

1. **Aggregations CANNOT run at request time.** A plain `GROUP BY tovarni_znacka`
   over `PROVOZOVANÉ` rows times out at 120s; an STK-failure join
   (`vehicle_registry` × `vehicle_inspections`, 83M rows) times out even scoped to
   a single model. Every metric on these pages must be **precomputed** into small
   summary tables by a batch job. Request-time reads are then trivial indexed
   lookups.

2. **The app is a CRA SPA with no SSR** (`react-scripts` 5.0.1, no prerender).
   Client-rendered pages whose content arrives via a later `fetch` are poison for
   this use case — Google renders JS slowly and unreliably at scale, which is one
   reason VIN pages were a non-starter. **These pages must ship their content in
   the initial HTML.** See "Rendering" for the two viable ways to do that on CRA.

## Data quality notes (measured)

- **Brand grouping** (`tovarni_znacka`) is clean and indexed: ŠKODA, VOLKSWAGEN,
  FORD, RENAULT, PEUGEOT, HYUNDAI, MERCEDES-BENZ, BMW, TOYOTA, OPEL … But the
  "brand" column also contains trailer makers (AGADOS) and mopeds (JAWA, SIMSON),
  so pages must be scoped by `druh_vozidla`/`kategorie_vozidla` (M1 passenger cars
  first) rather than blindly by brand.
- **Model grouping** (`obchodni_oznaceni`) is reasonably clean but needs light
  normalisation: `FABIA` vs `FABIA COMBI`, `100`/`105`/`120` legacy models,
  junk/placeholder values. A curated brand→model normalisation map for the top
  ~15 brands covers the vast majority of passenger cars; the long tail can be left
  unpublished.
- **A min-count threshold is mandatory** — both for statistical honesty (a "failure
  rate" over 12 cars is noise) and as a k-anonymity guard. Only publish a model
  page when it has **≥ N vehicles** (propose N = 100; tune after seeing the
  distribution). Everything below threshold is omitted, not shown thin.
- **Model names collide across generations** (found while building the precompute,
  2026-07-15). `obchodni_oznaceni='OCTAVIA'` lumps the 1960s vintage Škoda Octavia
  with the modern one (1996+), producing a nonsensical "average age 45 years" and
  poisoning median-km-by-age with incomparable eras. Fixed with a **rolling age
  window** (`max_age_years`, default 30) on the base cohort — which also focuses
  pages on the commercially relevant used cars (nobody searches used-buying intent
  for a 1965 Octavia at scale). Modern generations still blend on one page, which
  is fine: buyers search "Škoda Octavia", and median-km is keyed by *age* not
  calendar year, so a 5-year-old car of any generation stays comparable.

## Metrics we can compute (all from the existing cache)

Per brand+model (and per model-year cohort where useful):

| Metric | Source | Notes |
|---|---|---|
| Registrations, total + by year | `vehicle_registry` | headline volume |
| Average / distribution of age | `datum_prvni_registrace` | |
| Fuel-type split | `palivo` | petrol/diesel/LPG/EV/hybrid |
| **Avg / median mileage at age X** | `vehicle_inspection_odometer` | the unique one — nobody else has this |
| **STK failure rate** | `vehicle_inspections` (stav B/C, excl. kod_stk 9999) | "poruchovost" — highly shareable |
| Average number of owners | `vehicle_owners` | |
| % imported | `vehicle_imports` | |
| % on LPG/CNG, % with tow bar, % ex-fleet/ex-emergency | `vehicle_equipment` | **just shipped** — reuse `_vehicleEquipment` classification |
| Colour distribution | `barva` | light, fun content |

Ranking/listicle pages are just `ORDER BY` over the summary table (min-count
applied): most-registered, highest STK-failure, most-often-LPG, oldest-still-
running, most-owners-on-average, etc. These are the link-bait / PR pages.

## Architecture

### 1. Precompute job → summary tables

A batch script (TS, run **on/near the DB host**, not from a laptop over the
network — that's why the ad-hoc queries timed out) that does single-pass
aggregations and writes small tables, e.g.:

```sql
CREATE TABLE stats_model (
  brand              TEXT,
  model              TEXT,          -- normalised
  vehicle_count      INT,
  first_year         INT,
  last_year          INT,
  avg_age_years      NUMERIC,
  fuel_split         JSONB,         -- {"Nafta": 0.62, "Benzín": 0.31, ...}
  avg_owners         NUMERIC,
  pct_imported       NUMERIC,
  pct_lpg            NUMERIC,
  pct_towbar         NUMERIC,
  stk_fail_pct       NUMERIC,
  median_km_by_age   JSONB,         -- {"5": 78000, "10": 142000, ...}
  color_split        JSONB,
  computed_at        TIMESTAMPTZ,
  PRIMARY KEY (brand, model)
);
CREATE TABLE stats_meta (metric TEXT PRIMARY KEY, ...);  -- ranking snapshots
```

Runs **monthly, right after the registry ingest** (data only changes then), so
staleness is bounded and the cost is paid once. Reuse the ingest script's
connection/keepalive conventions. Apply the same min-count filter at write time so
nothing below threshold ever lands in the table.

### 2. Rendering — the crux (CRA has no SSR)

Content must be in the initial HTML. Two viable paths on the current stack:

> **Function-budget constraint (2026-07-15):** the Vercel Hobby plan caps a
> deployment at **12 Serverless Functions** and we were **at 12**. Prerequisite
> shipped: the four `api/client/*` handlers were consolidated into one
> `api/client/[...slug].ts` catch-all (→ 9 functions). The SEO renderer must
> likewise be **ONE** catch-all function (`api/stats/[...slug].ts`) serving every
> stats route — brand hub, model pages, ranking lists — not one per page type.
> That lands the deployment at 10/12.

- **Option A — On-demand SSR via a Vercel function (recommended, CHOSEN).** One
  serverless function (like the existing `api/` handlers) that, for
  `/znacky/:brand/:model` and the other stats routes, reads the summary table and
  returns a fully-rendered HTML page (`ReactDOMServer.renderToString` of a shared
  component), with `Cache-Control: s-maxage=86400, stale-while-revalidate`. A
  Vercel rewrite maps
  the stats routes to it. Pros: no build-time data dependency, always fresh after
  a recompute, content in initial HTML. Cons: a second rendering path to maintain
  alongside the SPA. This is the best fit — it gives real SSR for *just* these
  routes without migrating the whole app off CRA.

- **Option B — Build-time static generation.** A node build step reads the summary
  tables and writes static `.html` per page into `build/` (render-to-string +
  hydrate). Pros: plain static files, fastest possible serve, no runtime DB. Cons:
  the build now depends on DB access and the page set; regenerating after a monthly
  recompute means a rebuild/redeploy.

Recommend **A** — it decouples content refresh from deploys and matches the
existing serverless pattern. Reassess if the page count grows into the thousands
(then B's static files scale better).

Either way the client SPA keeps a matching React route so in-app navigation still
works and the SSR/static HTML hydrates.

### 3. Page set + URLs

- `/znacky` — index of all brands (hub).
- `/znacky/skoda` — brand hub: model list + brand-level aggregates.
- `/znacky/skoda/octavia` — the money page: all metrics above, prose + a couple of
  charts, internal links to sibling models and to the lookup CTA.
- `/statistiky/nejporuchovejsi-vozy`, `/statistiky/nejcastejsi-vozy`,
  `/statistiky/vozy-na-lpg`, … — ranking listicles.
- Czech slugs, consistent with existing routes. Diacritics-folded, hyphenated.

### 4. SEO wiring

- **These pages GO in `sitemap.xml`** (unlike VIN pages) — generated from the
  published summary rows, with real `lastmod` = `computed_at`. This is exactly the
  rich, unique content the sitemap is for.
- Per-page `<title>`/meta description/canonical/OG in the SSR output.
- **JSON-LD**: `Dataset`/`FAQPage`/`ItemList` structured data where it fits.
- Hub-and-spoke internal linking: homepage → `/znacky` → brand → model, plus
  model↔model cross-links and ranking-page → model links.
- Respect the www canonical rule from the global CLAUDE.md — all these URLs use the
  canonical host, and the SSR output's canonical/OG/JSON-LD must name it.
- Every stats page ends in a CTA into the actual VIN lookup — the content earns the
  visit, the CTA converts it.

## Phasing

1. **Precompute + one page type, behind the scenes.** Build the summary table +
   the model-page SSR for the **top ~15 brands' passenger models** only (the clean,
   high-volume core). Ship 100–300 genuinely rich pages, not thousands of thin
   ones. Measure indexation over 4–8 weeks.
2. **Ranking/listicle pages** once model pages exist (they're just views over the
   same table). These are the shareable/backlink-earning pages.
3. **Brand hubs + `/znacky` index**, internal-linking pass, JSON-LD.
4. Expand model coverage down the long tail only if phase 1 indexes well.

## Verification

- Precompute job: spot-check computed stats against a hand SQL query for 2–3
  models; assert min-count filter drops sub-threshold rows; confirm runtime is
  acceptable when run on/near the DB host (the ad-hoc versions timed out from a
  laptop — prove the batch job doesn't).
- Rendering: `curl` a stats URL and confirm the **stats are in the raw HTML**
  (`view-source`, not post-JS) — this is the whole point; if they're not, Google
  won't index them well.
- Privacy audit: grep a sample of rendered pages for any VIN, owner name, IČO, or
  address — must be **zero**. Only aggregates ship.
- Lighthouse/SEO basics: title, meta, canonical (correct host), mobile, no CLS.

## Privacy / legal posture

Categorically different from VIN pages: **no individual vehicle, owner, or VIN ever
appears.** Everything is an aggregate over ≥ N vehicles. There is no personal data
to process, so the GDPR/ÚOOÚ exposure that killed VIN indexing does not apply. The
dataovozidlech open-data licence covers derived statistics comfortably. Still worth
a one-line legal confirmation that publishing aggregate statistics is in scope, but
this is a formality next to the VIN-page question.

## Why not VIN pages (recap, so this isn't re-litigated)

Rejected 2026-07-15: (1) the proposed "exclude vehicles with IČO" privacy filter is
inverted — IČO = company = public; excluding them leaves only privately-owned cars;
(2) no SSR, so VIN pages wouldn't index well anyway; (3) millions of thin near-
duplicate pages invite Google thin-content/doorway suppression that can hurt the
whole domain; (4) proactively broadcasting every vehicle's history via sitemap is a
materially more aggressive GDPR posture than on-demand lookup and needs legal sign-
off. Aggregate pages sidestep all four.

## Not doing

- Individual VIN pages in the sitemap (see above).
- Live request-time aggregation (times out; precompute instead).
- Auto-generated pages below the min-count threshold (thin content).
- Publishing model-year cohorts so small they'd approach re-identification.
