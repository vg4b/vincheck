# feat: zveřejnit datový modul (eHub schválil) + import × STK obsah

**Status:** navrženo 2026-08-25. Odblokováno odpovědí eHubu.

## Co eHub schválil (Kristina Krátká, 2026-08-25)

Doslova, ať se z toho dá vycházet:

1. **Vlastní obsah** – omezení míří na *grafické materiály s logem inzerenta*,
   které si partner vytvoří sám. „Používání toho, co je k dispozici v administraci
   je v pohodě." **Náš web je takto v pořádku** – tedy včetně modulu na náhledové
   URL. → **F3 z předchozího plánu je odblokovaná, modul smí ven.**
2. **E-mailing** – schválení potřebuje jen mailing *čistě o nabídce ČSOB* na
   všechny uživatele (fakticky i graficky). Připomínky k vozu uživatele, k našim
   článkům nebo k souboru akcí více inzerentů schválení nepotřebují.
3. **Odkazy** – vše z administrace lze používat volně; **smíme si tvořit vlastní
   deeplinky** na jiné podstránky, než jsou v reklamních prvcích.

Bod 3 je navíc oproti očekávání: vlastní deeplinky rozšiřují, kam smíme vést
(např. přímo na konkrétní produkt kalkulačky), aniž bychom čekali na novou kreativu.

## Jednotky

### R1 – Sundat náhledovou bránu z /sjednat-pojisteni (rychlé)

Modul dnes běží jen za `?nahled=csob` a stránka je pod ním `noindex`. Schválení
tu podmínku ruší.

- odstranit `PREVIEW_FLAG`, `previewOn` a `noindex` větev
- modul se vykreslí, když jsou v URL `znacka` + `model` (což zůstává pravda pro
  odkaz z e-mailu/karty, jakmile se doplní – viz R3)
- **DoD:** `/sjednat-pojisteni?znacka=…&model=…` ukáže modul bez `nahled`, stránka
  je zase indexovatelná

### R2 – Umístit modul „pod výsledek lustrace vozidla" (hlavní plocha)

To je plocha, kterou jsem eHubu popsal, a kde má modul reálný smysl: detail vozu
po lustraci VIN. `VehicleDetailPage` má `brand` a `model` z
`resolveVehicleTitle(vehicleData)` (řádek 324) a prop `promoSection` na
`VehicleInfo`.

- vložit `<VehicleInsuranceModule>` pod výsledek lustrace, se slugy z R3
- **jen když je vůz M1** (osobní) – u nákladních/motorek modul nedává smysl a
  kohorta stejně nebude existovat, takže se sám nevykreslí, ale ať to nevoláme zbytečně
- **DoD:** ověřeno v prohlížeči na reálném VINu, že modul ukáže čísla toho modelu

### R3 – Opravit rozlišení slugu (jinak modul u většiny aut mlčí)

**Zádrhel, který R2 sabotuje potichu.** Registr má „OCTAVIA 1.9 TDI", ale kohorty
v `stats_model` jsou složené na „OCTAVIA". `getModelStatsBySlug` matchuje přesně
(`slugSql(model)=slug`), takže `octavia-1-9-tdi` **nenajde** kohortu `octavia`
a modul se u takového vozu nevykreslí vůbec (na 404 vrací `null` – bezpečné, ale
tiché). To by potkalo většinu reálných aut.

Stránka `/znacky/*` to řeší `resolveModelAlias` (tabulka `stats_model_alias` mapuje
retirované slugy). JSON endpoint `/api/stats?type=model` ale tenhle fallback nemá.

- do JSON model větve v `api/stats.ts` přidat: na čistý miss zkusit
  `resolveModelAlias(brand, model)` a při nálezu dotaz zopakovat se složeným slugem
- alternativa (horší): foldovat na frontendu – ale fold logika žije v SQL, duplikovat
  ji do JS je přesně ten druh divergence, co se rozejde
- **DoD:** `/api/stats?type=model&brand=skoda&model=octavia-1-9-tdi` vrátí kohortu
  `octavia`, ne 404

### R4 – E-maily: co teď smíme a co ne

Podle bodu 2 výše:

- **Připomínky zůstávají jak jsou** – vedou na náš web, bez tracking odkazu, bez
  jména pojišťovny. To je transakční zpráva k vozu uživatele, schválení nepotřebuje.
- **Tracking odkaz přímo do připomínky NEvkládat bez schválení.** Připomínka, jejíž
  promo blok je čistě pobídka k ČSOB, se blíží „mailingu čistě o nabídce ČSOB".
  Hranici nechci uhodnout – před vložením tracking odkazu do e-mailu si to nechat
  potvrdit zvlášť (Kristina to v odpovědi nechala otevřené právě pro tento případ).
- `vin` → značka/model v odkazu z připomínky je pořád nenapojený (viz předchozí
  plán). Napojit až s R3, aby odkaz z připomínky rovnou ukázal modul.

## Import × STK jako obsah (S-import)

Průzkum (`docs/research/2026-08-25-import-country-sources.md`) došel k tomu, že
cizí registr napojit nelze, ale **z vlastních dat plyne publikovatelný poznatek**:
dovezené z Německa padají na STK častěji než tuzemské u **všech 5 testovaných
modelů** (Golf +42 %, A4/Passat +20 %, Focus +18 %, Fabia +17 %).

**Musí do nočního přepočtu, ne ad-hoc.** Join registr × dovozy × prohlídky přes
celý park spadl na 25min timeout; přes 550k vozů to instance neutáhne za běhu.
`compute-stats.sql` ale registr i prohlídky **stejně skenuje** – přidat rozpad
podle původu (DE / jiný / bez záznamu) tam je skoro zadarmo.

Rozlišení je **DE vs. tuzemské (bez záznamu dovozu)**, ne dovoz obecně –
research měřil konkrétně Německo (2,69 % vs. 3,82 % u Golfu). Dovoz z jiných
zemí je proto v **žádném** z obou kbelíků; ty dva podíly nejsou rozklad celku.

- ✅ migrace `013_stk_by_origin.sql`: `stk_fail_pct_de`, `stk_inspections_de`,
  `stk_fail_pct_domestic`, `stk_inspections_domestic` na `stats_model` (aditivní,
  bezpečná před přepočtem – sloupce jsou NULL, čtenáři NULL berou jako „nemám dost")
- ✅ `compute-stats.sql`: dva `LEFT JOIN` na `vehicle_imports` v bloku `_stk`
  (`DISTINCT pcv`, a `stat='Německo'`), `FILTER` rozdělen podle původu; 4 sloupce
  doplněny do `INSERT` do `stats_model` (brand hub beze změny)
- ✅ modelová stránka (`BrandModelStatsPage`): věta pod „Poruchovost při STK"
  („Dovezené z Německa propadají na STK o X % častěji"), práh 500 prohlídek na
  každý kbelík, směr se řídí daty (ne natvrdo „častěji")
- ✅ ověřeno na fixture (`test-compute-stats.sh`, migrace 013 přidána): DE 50 % vs.
  tuzemské 0 % dle návrhu, denominátory DE+dom < celku (slovenský dovoz mimo oba)
- ⚠️ **zbývá:** ověřit napříč modely **uvnitř nočního přepočtu** na prod datech
  (Golf byl vzorek; potvrzeno na 5 modelech +17–42 %, doměřit zbytek dotazem)
- **DoD:** rozpad je v `stats_model` na prod, na modelové stránce, a přepočet se
  nezpomalil o víc než pár minut (přidány všechny 4 sloupce jedním během)

## Pořadí

R3 je nutná podmínka R2 (jinak R2 nefunguje). R1 je nezávislá a rychlá.
S-import je samostatný a čeká na okno přepočtu (dnešní kupóny + tahle změna by
měly jet jedním během).

## Definition of Done

- [x] R1: náhledová brána pryč (`PREVIEW_FLAG`, `previewOn`, noindex větev
      odstraněny; modul se řídí jen `znacka`+`model`), stránka indexovatelná
- [x] R3: JSON model endpoint foldne retirovaný slug – doplněn `resolveModelAlias`
      fallback i do JSON větve `api/stats.ts` (dřív byl jen v HTML/SEO větvi, což R2
      potichu sabotovalo). Alias data v produkci existují (HTML větev už 308uje
      `octavia-1-9-tdi`→`octavia`); JSON fold se projeví po nasazení.
- [x] R2 (kód): `<VehicleInsuranceModule>` na `VehicleDetailPage`, jen M1
      (`Kategorie` prefix), slugy přes nový `src/utils/slug.ts`. **Umístěn POD
      technické údaje (varianta B)**, ne do `promoSection` – certifikát (živý,
      `ProductComparison` 99 Kč) vlastní horní plochu, modul je až v patičce jako
      kontext, ne konkurenční CTA v konverzním bodě (otevírá ČSOB v novém tabu, tak
      neodvádí kupce z certifikátu). **Ověření na reálném VINu čeká na nasazení**
      (JSON fold z R3 musí být na prod).
- [~] R4: **vin→značka/model napojeno** (2026-09-03) – připomínkové e-maily i karty
      vozidel v klientské zóně teď vedou na `/sjednat-pojisteni?znacka=…&model=…`,
      takže se modul rozsvítí. E-mail nejmenuje pojišťovnu, jen odkazuje na naši
      stránku – to eHub potvrdil, že souhlas nepotřebuje (připomínka k vozu, ne
      mailing o nabídce ČSOB; viz `docs/emails/2026-08-24-*`, bod 2). **Zbývá jen**
      tracking odkaz VLOŽENÝ přímo do e-mailu – ten čeká na zvláštní potvrzení eHubu.
- [x] S-import: **HOTOVO a živé na produkci** (2026-09-03). Migrace 013 + cílený
      backfill (UPDATE, ne TRUNCATE → neblokuje `/znacky`), větev `feat/stk-by-origin`
      mergnuta na main. Klíčové zádrhely cestou: (1) `stat` je plný název země
      „Spolková republika Německo", ne „Německo"; (2) split dává smysl jen ve
      věkovém pásmu **~10–16 let** – přes celý park se efekt smázne/obrátí (Passat).
      Ověřeno na prod: 5 research modelů reprodukuje (+17–46 %). Dlaždice je
      směrově-poctivá, zúžená na „U vozů 10–16 let…". Runbook má incident log:
      `docs/runbooks/2026-09-02-stk-by-origin-scaleway.md`. Další mining: plán
      `docs/plans/2026-09-02-002-mine-existing-import-stk-data.md`
- [x] R1/R2/R3: **releasnuto na main** (rollout modulu, nezávislý na S-importu)
- [x] `sync-marketing-surfaces` proběhl. Závěr: **žádná plocha nevyžaduje změnu.**
      Modul žije na dvou zákaznických plochách, které ho už nesou (`VehicleDetailPage`
      po lustraci, `/sjednat-pojisteni` s vozem v URL). Záměrně jinde ne:
      - insurance SEO (`PovinneRuceniPage`, `HavarijniPojisteniPage`) linkují na
        `/sjednat-pojisteni` bez `znacka`+`model` → modul se nemá o jaký vůz opřít;
        jsou to tematické stránky, ne detail konkrétního vozu
      - homepage / hub / stats stránky: modul je per-vozidlo affiliate CTA, na
        obsahovou/SEO plochu nepatří (`BrandModelStatsPage` už STK/krádeže ukazuje
        jako fakta, ne jako pobídku)
      - certifikát (landing / PDF / `ProductComparison` / sample): netýká se –
        modul je affiliate pojištění, ne placený certifikát; žádné tvrzení o
        certifikátu nefalšuje. Modul je M1-only a sám se skryje bez kohorty
        (žádné přeslibování)
- [x] ověřeno na produkci: R1/R2/R3 modul + S-import dlaždice živé a ověřené
      v prohlížeči/API (build + typecheck + fixture + prod smoke test OK)
