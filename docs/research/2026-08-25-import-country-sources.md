# Dovozové země a dostupnost jejich registrů

**Zadání (2026-08-25):** žebříček zemí, odkud se nejčastěji dováží, a průzkum,
zda by jejich zdroje šlo napojit — pilotně jedna země, s hypotézou, že Německo
bude přístupné podobně jako Česko.

## 1. Žebříček dovozových zemí

Zdroj: `vehicle_imports` (3 418 809 vozidel se záznamem dovozu). Podíly jsou
stabilní napříč obdobími, nejde o historický zůstatek — proto uvádím i okno od
2021 a od 2024.

| země | podíl celkem | podíl od 2021 | podíl od 2024 |
|---|---|---|---|
| **Německo** | **62,2 %** | **63,4 %** | **63,0 %** |
| Rakousko | 7,0 % | 7,0 % | 6,5 % |
| Itálie | 9,5 % | 5,5 % | 5,1 % |
| Belgie | 3,0 % | 3,1 % | 3,3 % |
| Francie | 4,0 % | 3,0 % | 2,9 % |
| Nizozemsko | 2,6 % | 2,8 % | 3,1 % |
| Polsko | 1,9 % | 2,9 % | 2,3 % |
| Slovensko | 1,9 % | 2,7 % | 3,2 % |

Německo dominuje tak, že pilotní země je fakticky předurčená: jeden zdroj z
Německa pokryje víc dovezených vozů než všechny ostatní země dohromady.

## 2. Dostupnost registrů

Hypotéza „Německo jako Česko" bohužel **neplatí**. Klíčové rozlišení: my u
dovezeného vozu známe jen **VIN**. Zdroj je použitelný jen tehdy, když jde
hromadně (ne po jednom s CAPTCHA) dotázat **podle VIN** a nevrací osobní údaje.

| země | co existuje | dotaz podle VIN? | hromadně / API? | verdikt |
|---|---|---|---|---|
| **Německo** | ZFZR (KBA) uzavřený jen pro úřady; Open Data jen **agregované statistiky**, žádné jednotlivé vozy | ne | ne | **nelze** |
| Rakousko | jen `Finanzsperrauskunft` (zástavy), ne historie | omezeně | ne | nelze |
| Itálie | PRA je právně veřejný rejstřík | ano | jen placený dotaz/kus, **s osobními údaji majitele vč. adresy** | nelze (GDPR + neškáluje) |
| **Nizozemsko** | RDW Open Data, CC-0, denně, vč. APK historie — **technicky nejlepší** | **NE** | ano | **nelze** — dataset je klíčovaný SPZ a **VIN záměrně neobsahuje** (proti podvodům); most VIN→kenteken neexistuje |
| Polsko | CEPiK: (a) Open Data API `api.cepik.gov.pl`, (b) „Historia Pojazdu" web | (a) NE — anonymizované, bez VIN; (b) ano, ale web s CAPTCHA + nutná i SPZ a datum 1. registrace | jen (a), ta ale VIN nemá | nelze |
| Belgie | Car-Pass (nájezdy, povinný při prodeji) | přes web ano | ne, jen po jednom | nelze automatizovat |

**Vzorec je konzistentní:** země s otevřenými daty (NL, PL) z nich VIN *záměrně*
vynechávají kvůli ochraně před zneužitím; země dotazovatelné podle VIN (IT PRA,
CZ, PL Historia Pojazdu) jsou jednotlivé webové dotazy s osobními údaji nebo
CAPTCHA, ne hromadný zdroj. To je i důvod, proč Cebia a carVertical data
**nakupují od komerčních partnerů** (autobazary, servisy) místo z registrů —
veřejná hromadná cesta po VIN v EU prakticky neexistuje.

Právní pozadí: [EuGH C-319/22] rozhodl, že VIN *samo o sobě* není osobní údaj,
ale stává se jím u toho, kdo umí dohledat majitele-fyzickou osobu. Registry to
řeší tak, že VIN v otevřených datech buď není, nebo je za placeným dotazem.

## 3. Co z toho plyne — a co máme rovnou k dispozici

Napojení cizího registru pro pilot **nedoporučuji**: pro nejsilnější zemi
(Německo) neexistuje a u zbytku žebříčku buď taky ne, nebo jen jako placený
dotaz po jednom s osobními údaji. To je jiná liga než české otevřené ISTP/registr.

Realistické cesty ke stejnému cíli („co ten vůz dělal v zahraničí"):

1. **Komerční data feed** (cesta Cebie/carVertical) — koupit historii nájezdů
   nebo záznamy od agregátora. Placené, ale je to jediná hromadná cesta po VIN.
2. **Vytěžit, co už máme.** `vehicle_imports` + `datum_dovozu` + naše STK data
   umožňují říct o dovezených vozech to, co žádný jednotlivý registr neřekne:

### Předběžný nález (VW Golf 2010–2016, ověřeno na produkční DB)

| původ | vozidel | neúspěšnost STK |
|---|---|---|
| dovoz z Německa | 25 267 | **3,82 %** |
| bez záznamu dovozu | 23 783 | **2,69 %** |
| dovoz odjinud | 5 731 | 3,82 % |

Dovezený Golf padá na STK **o ~42 % častěji** než tuzemský. To je publikovatelný
poznatek z dat, která už držíme, bez jakéhokoli cizího zdroje — a je to přesně
ten typ obsahu, co posiluje `/znacky` a zároveň dává smysl vedle prodeje prověrky.

**Pozor:** číslo je z jednoho modelu a join přes tři velké tabulky trvá na
současné instanci ~4–9 minut (agregace přes celý park narazila na timeout). Než
z toho udělat feature, ověřit napříč modely v rámci nočního přepočtu, ne za běhu.

## Zdroje

- KBA ZFZR (uzavřený): kba.de/…/ZFZR/Auskunft
- KBA Open Data (jen statistiky): kba.de/…/OpenData
- RDW Open Data (SPZ, bez VIN): opendata.rdw.nl
- ACI PRA (IT, placené, osobní údaje): aci.it/servizi/la-visura-pra
- CEPiK API (PL, bez VIN): api.cepik.gov.pl ; historiapojazdu.gov.pl
- EuGH C-319/22 (FIN jako osobní údaj): legal.pwc.de/…/eugh-zur-fin
- Cebia — odkud čerpá data (potvrzuje komerční nákup): cebia.cz/novinky/proverovani
