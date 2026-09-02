# feat: vytěžit data, co už máme (research 3)2) — další publikovatelné poznatky

**Status:** návrh 2026-09-02. Navazuje na
`docs/research/2026-08-25-import-country-sources.md`, bod 3)2 („Vytěžit, co už
máme"). První realizace tohoto bodu — **STK podle původu (DE × tuzemské)** — se
právě nasazuje (viz `2026-08-25-001` + runbook `2026-09-02-stk-by-origin-scaleway.md`).
Tenhle plán hledá **další** poznatky ze stejného principu.

## Princip (co dělá mining levným a bezpečným)

1. **Jen z dat, která `compute-stats.sql` už skenuje.** Noční přepočet už čte
   registr, dovozy, prohlídky, tachometr, majitele, výbavu. Přidat agregaci do
   existujícího bloku stojí zlomek — samostatný ad-hoc join přes 550k+ vozů
   spadne na timeout (to je právě důvod, proč to musí do přepočtu).
2. **Žádný cizí zdroj.** Research uzavřel, že cizí registr napojit nelze. Tohle
   je čistě naše data.
3. **Publikovatelné na `/znacky`** jako věta/dlaždice na modelové stránce —
   posiluje SEO plochu a dává smysl vedle prodeje prověrky.
4. **Poctivost:** každý poznatek s prahem vzorku (jako STK split), NULL = „nemám
   dost", směr se řídí daty. [[certificate-real-value]] — nepřeslibovat.

## Kandidáti (skóre: hodnota / cena v přepočtu / riziko)

| # | Poznatek | Zdroj (už skenováno?) | Hodnota | Cena | Riziko |
|---|---|---|---|---|---|
| A | **Stáří vozu při dovozu do ČR** — `datum_prvni_registrace_v_cr` − `datum_prvni_registrace` u dovezených | registr (`_base`) ✅ | vysoká — **vysvětluje** STK gap („dovezené přijely o X let starší") | ~0 (oba sloupce v `_base`) | nízké |
| B | **Medián nájezdu: dovezené × tuzemské** | odometer (`_odo`) ✅ + imports | vysoká — druhá půlka vysvětlení STK gapu | nízká (join imports jako u `_stk`) | nízké |
| C | **STK neúspěšnost podle stáří vozu** (křivka spolehlivosti) | prohlídky + rok reg. (`_stk`, `_base`) ✅ | vysoká — obecná, silná, nezávislá na dovozu | nízká | střední (víc kbelíků → víc NULL prahů) |
| D | **Rozpad dovozových zemí** (top 2–3 země na model) | imports (`_imp`) ✅ | střední — mimo DE jsou podíly na model tenké | nízká | střední (malé vzorky) |
| E | **Podíl podle účelu** (`ucel_vozidla`: taxi/půjčovna) na model | registr ✅ | nízká–střední | ~0 | nízké (ale řídké) |
| F | **Recency dovozu** — podíl dovezených za posl. 3 roky | imports + `datum_dovozu` ✅ | nízká | ~0 | nízké |

## Doporučení

**Bundle „proč dovezené padají víc" (A + B).** Ty dva poznatky přímo **vysvětlují**
STK split, který právě nasazujeme, a používají jen data, co už skenujeme. Vytváří
to na modelové stránce ucelený příběh:

> „Dovezené z Německa přijely do ČR v průměru **o X let starší** a najezdily
> **o Y km víc** — proto na STK padají o Z % častěji než tuzemské."

**Silný samostatný:** **C (STK podle stáří)** — obecná křivka spolehlivosti pro
každý model, nezávislá na dovozu; dobrý druhý krok.

**Odložit:** D/E/F — buď tenké vzorky na model (D), nebo nízká hodnota (E/F).

## Návrh implementace (bundle A+B)

- migrace: `avg_import_age_years` (medián/průměr stáří vozu při 1. reg. v ČR u
  dovezených), `median_km_de` + `median_km_domestic` na `stats_model`
- `compute-stats.sql`:
  - A: v `_base` už jsou obě data — spočítat rozdíl let jen pro řádky, které
    mají `datum_prvni_registrace_v_cr > datum_prvni_registrace` (= reálný dovoz),
    agregovat medián na model
  - B: rozšířit `_odo` blok o `LEFT JOIN` na DE/domestic (přesně jako `_stk` teď),
    medián `odometer_km` per kbelík
- `BrandModelStatsPage`: věta pod „Poruchovost při STK", propojená s DE split
  (ukázat jen když oba mají práh)
- **datum parsing pozor:** `datum_prvni_registrace*` jsou `TEXT` — ověřit formát
  a parsovat robustně (v `_base` už se `reg_year` derivuje, navázat na to)

## Rozsah přes noc (bezpečnostní hranice)

- **Kód + fixture test dnes v noci: OK** (na větvi, bez dopadu na prod).
- **Produkční přepočet + publikace nového obsahu na `/znacky`: až po revizi.**
  Nový veřejný obsah (nová věta na modelových stránkách) by měl dostat lidské oči
  na čísla dřív, než jde ven — a další ~1h přepočet nemá smysl stohovat na noc bez
  dozoru. STK split (bod A předchozího plánu) je jiná věc: ten byl schválený a
  ověřený, tak jede. Tenhle bundle: implementovat a fixture-otestovat, publikaci
  nechat na ráno.
- **Bundlovat:** až se to bude publikovat, přidat A+B (+ případně C) **jedním**
  přepočtem, ne třemi.

## Definition of Done

- [ ] migrace + `compute-stats.sql` bloky pro A+B, aditivní/NULL-safe
- [ ] fixture (`test-compute-stats.sh`) rozšířen o dovozní data se stářím při
      dovozu + reálný řetězec `Spolková republika Německo` (pozor: lokál × prod
      locale a plný název země — viz co nás kouslo u STK splitu)
- [ ] dlaždice na modelové stránce, práh vzorku, NULL-safe
- [ ] **rozsáhlý regresní test po každé části** (build + typecheck + fixture +
      `/api/stats` + vizuál na reálném VINu)
- [ ] produkční přepočet + publikace: **až po revizi uživatelem**
