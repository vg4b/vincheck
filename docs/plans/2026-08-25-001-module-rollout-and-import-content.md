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

- migrace: `stk_fail_pct_imported`, `stk_fail_pct_domestic` (+ počty) na `stats_model`
- v `compute-stats.sql` doplnit `LEFT JOIN vehicle_imports` do bloku, který už
  počítá `_stk`, a rozdělit `FILTER` podle původu
- na modelové stránce ukázat jako větu/dlaždici („dovezené kusy … o X % častěji")
- ⚠️ ověřit napříč modely **uvnitř přepočtu**; Golf byl první vzorek; ověřeno na 5 modelech (+17–42 %). Potvrdit i u zbytku uvnitř přepočtu
- **DoD:** rozpad je v `stats_model`, na modelové stránce, a přepočet se
  nezpomalil o víc než pár minut (každý sloupec stojí jeden běh – batchovat)

## Pořadí

R3 je nutná podmínka R2 (jinak R2 nefunguje). R1 je nezávislá a rychlá.
S-import je samostatný a čeká na okno přepočtu (dnešní kupóny + tahle změna by
měly jet jedním během).

## Definition of Done

- [ ] R1: náhledová brána pryč, stránka indexovatelná
- [ ] R3: JSON model endpoint foldne retirovaný slug (nutné před R2)
- [ ] R2: modul pod lustrací vozu, ověřeno na reálném VINu
- [ ] R4: připomínky beze změny; tracking odkaz do e-mailu jen po zvláštním potvrzení
- [ ] S-import: rozpad v nočním přepočtu, ověřený napříč modely, na modelové stránce
- [ ] `sync-marketing-surfaces` proběhl (modul je nová zákaznická plocha)
- [ ] ověřeno na produkci, ne jen lokálně
