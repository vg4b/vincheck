# Data o vozidlech – schéma vs. aplikace

Aplikace čte JSON z API `vehicletechnicaldata/v2` (proxy `/api/vehicle`). Na stránce s výpisem vozidla se klíče z odpovědi mapují na české popisky v [`src/utils/vehicleApi.ts`](../src/utils/vehicleApi.ts) (`fieldLabels` + fallback `formatFieldName`).

Úřad publikuje **schéma otevřených dat „výpis vozidel“** (CSV) zde:

<https://download.dataovozidlech.cz/schema/vypisvozidel>

## Důležité rozlišení

| Zdroj | Formát klíčů | Účel |
|--------|----------------|------|
| Schéma *vypisvozidel* | lidské názvy sloupců (`titles`), např. „Datum 1. registrace“ | CSV, dokumentace polí |
| API v aplikaci | programové klíče, např. `DatumPrvniRegistrace`, `TovarniZnacka` | JSON z `vehicletechnicaldata` |

Klíče v API **nejsou** stejné jako `name`/`titles` ze schématu – odpovídají ale **stejným údajům** z TP/evidence (viz sloupce D.1, E, P.1 at v `dc:description` u polí ve schématu).

## Pole v API, která ve *vypisvozidel* chybí

Následující údaje aplikace zobrazují, pokud je API vrátí, ale **není uvedené** v JSON schématu `vypisvozidel` (ta sada je zaměřená na homologační/technický výpis, ne na všechny provozní údaje):

- **`PravidelnaTechnickaProhlidkaDo`** – platnost STK / pravidelná technická prohlídka (často vyžadovaný uživateli údaj).
- **`PocetVlastniku`**, **`PocetProvozovatelu`** (pokud API vrací) – nejsou v přiloženém schématu výpisu vozidel.

To není chyba mapování: jde o **jiný / rozšířený** výstup API oproti jedné CSV sadě.

## Přehled hlavních shod klíč ↔ oficiální název (titles)

| Klíč v API (aplikace) | Odpovídající *titles* ve schématu vypisvozidel |
|------------------------|-----------------------------------------------|
| `DatumPrvniRegistrace` | Datum 1. registrace |
| `DatumPrvniRegistraceVCr` | Datum 1. registrace v ČR |
| `CisloTypovehoSchvaleni` | ZTP |
| `HomologaceEs` | ES/EU |
| `VozidloDruh` | Druh vozidla |
| `VozidloDruh2` | Druh vozidla 2. ř. |
| `Kategorie` | Kategorie vozidla |
| `TovarniZnacka` | Tovární značka |
| `Typ` | Typ |
| `Varianta` | Varianta |
| `Verze` | Verze |
| `VIN` | VIN |
| `ObchodniOznaceni` | Obchodní označení |
| `VozidloVyrobce` | Výrobce vozidla |
| `MotorVyrobce` | Výrobce motoru |
| `MotorTyp` | Typ motoru |
| `MotorMaxVykon` | Max. výkon [kW] / [min⁻¹] |
| `Palivo` | Palivo |
| `MotorZdvihObjem` | Zdvihový objem [cm³] |
| `VozidloElektricke` | Plně elektrické vozidlo |
| `VozidloHybridni` | Hybridní vozidlo |
| `EmiseEHKOSNEHSES` | Emisní limit [EHKOSN/EHSES] |
| `EmisniUroven` | Stupeň plnění emisní úrovně |
| `EmiseCO2` | CO2 město /mimo město/kombinované [g.km-1] |
| `SpotrebaMetodika` | Spotřeba předpis |
| `SpotrebaNa100Km` | Spotřeba město /mimo město/kombinovaná [l.100km⁻¹] |
| `VozidloKaroserieBarva` | Barva |
| `VozidloKaroserieMist` | Počet míst celkem / k sezení / k stání |
| `Rozmery` | Celková délka/šířka/výška [mm] |
| `RozmeryRozvor` | Rozvor [mm] |
| `Rozchod` | Rozchod [mm] |
| `HmotnostiProvozni` | Provozní hmotnost |
| `DalsiZaznamy` | Další záznamy |
| `CisloTp` | Číslo TP |
| `CisloOrv` | Číslo ORV |
| `RzDruh` | Druh RZ |
| `ZarazeniVozidla` | Zařazení vozidla |
| `StatusNazev` / `Status` | Status |
| `NapravyPocetDruh` | Počet náprav - z toho poháněných |
| `NapravyPneuRafky` | Kola a pneumatiky na nápravě - rozměry/montáž [N.1; N.2; N.3; N.4] |
| `NejvyssiRychlost` | Nejvyšší rychlost [km.h⁻¹] |
| `HlukJizda` | Za jízdy |
| `VozidloAutonomniStupen` | Stupeň autonomity vozidla |

Další pole ze schématu může API vracet pod dalšími PascalCase klíči – pokud v `fieldLabels` chybí, zobrazí se automaticky rozřezaný název z `formatFieldName`. Nové klíče lze doplnit podle reálné odpovědi API.

## Zobrazení v aplikaci

Detail v (`VehicleInfo`) rozděluje řádky tabulky do **sekcí** podle typu údaje (doklady, druh/homologace, motor, emise, karoserie, rozměry/hmotnosti, nápravy, hluk/rychlost, ostatní). Mapování klíč → sekce je v [`src/utils/vehicleFieldCategories.ts`](../src/utils/vehicleFieldCategories.ts); nová pole z API jdou do „Ostatní“, dokud je nepřiřadíte.

## Kontrola do budoucna

1. Stáhnout ukázkovou odpověď `GET .../vehicletechnicaldata/v2?vin=...`.
2. Porovnat klíče v `Data { ... }` s tabulkou výše a se schématem vypisvozidel.
3. Doplnit `fieldLabels` pro klíče, kde je výstup `formatFieldName` nepřesný.
4. Případně doplnit `getVehicleFieldCategory()` / množiny v `vehicleFieldCategories.ts`, aby nová pole spadla do správné sekce místo jen do „Ostatní“.
