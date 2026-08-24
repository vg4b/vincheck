# feat: ČSOB jako jediný partner pro pojištění, s vlastní datovou kreativou

**Status:** F0, F1, F2 a F5 hotové 2026-08-24, necommitované. Zbývá F3
(odeslat k posouzení a po souhlasu uvolnit) a F4 (e-maily). Vytvořeno 2026-08-24. Vzniklo z rozhodnutí opustit CJ
(dormant fees, vysoký výplatní limit) a soustředit pojištění k jednomu
poskytovateli na eHubu, kde už běží Cebia.

**Hotovo předem:** ČSOB kupóny přesynchronizované 2026-08-24 (6 platných, 0
prošlých). Od dubna do srpna byly prošlé všechny, takže blok ČSOB byl na třech
stránkách neviditelný a jedinou viditelnou monetizací zůstal rozbitý iframe.

## Hotovo 2026-08-24

| jednotka | stav | ověřeno |
|---|---|---|
| F0 iframe pryč, copy přepsané | hotovo | 0 `<iframe>` v DOM i v bundlu, žádné pevné šířky |
| F1 produktová ID kreativ | hotovo | `getProductUrl()` pro 6 produktů |
| F2 modul za `?nahled=csob` | hotovo | bez parametru se nevykreslí, s ním `noindex, nofollow` |
| F5 mrtvý kód pryč | hotovo | `epojisteni` i `axaCestovniPojisteni` smazány |
| kupóny z API + hlídání kampaně | hotovo | CI job `sync-ehub-csob` |

**Audit marketingových ploch** (skill `sync-marketing-surfaces`, 2026-08-24):

| plocha | závěr |
|---|---|
| CertificateLandingPage, ProductComparison | **záměrně ne** – prodávají historii vozu, ne sjednání pojištění |
| VehicleDetailPage, UpozorneniNaTerminyPage | **už v pořádku** – zmínky se týkají typů připomínek, ne srovnávání nabídek |
| PovinneRuceniPage, HavarijniPojisteniPage | **upraveno** – „Porovnejte si nabídky" → „Sjednáte online" |
| ClientZonePage, HomePage | **upraveno** – „Porovnat pojištění" → „Sjednat pojištění" |
| BrandModelStatsPage, ZnackyHubPage | **záměrně ne zatím** – datový modul sem patří až v F3, po souhlasu |
| `_certificatePdf.ts` | **nedotčeno** – „Zaniklé pojištění" je historický příznak, ne nabídka |
| **Zásady ochrany osobních údajů** | **upraveno** – eSpolupráce/ePojištění byly uvedené jako příjemce dat a iframe jako mechanismus předání; nahrazeno eHUB/ČSOB, cookie 30–90 dní na 15 dní |
| Obchodní podmínky (`/podminky`) | **nedotčeno** – zmiňují jen obecné „partnerské nabídky", žádného partnera jménem |
| vzorový certifikát | **nedotčeno** – změna nepřidává žádné pole do PDF |
| CTA v `VehicleInfo`, `Navigation`, `Footer` | **už v pořádku** – všechny říkají „Sjednat pojištění" |

## Goal Capsule

**Záměr.** Nahradit iframe srovnávače ePojištění nabídkou ČSOB na všech
plochách, kde dnes pojištění nabízíme, a získat právo zobrazovat **vlastní
kreativu postavenou na našich datech o vozidle** místo generického banneru.

**Proč ČSOB.** Jeden partner pokrývá autopojištění, cestovní, majetek i
odpovědnost. Platí **obojí** – provizi z prodeje (u autopojištění 16 %, sazby po
produktech níže) a PPL 100 Kč za kontaktní formulář, tedy i lead, na kterém dnes
stojí ePojištění. Sedí na eHubu společně
s Cebií, takže jeden výplatní limit a žádné poplatky CJ. A jeho kupóny dávají
návštěvníkovi skutečnou slevu, ne jen nám provizi.

## Změřená fakta (eHub portál, 2026-08-24)

Kampaň **ČSOB Pojišťovna `174174d6`**, stav Schváleno.

| údaj | hodnota |
|---|---|
| Atribuční období (cookie) | **15 dnů** |
| Ø objednávka | 1 327,72 Kč |
| Schvalovací poměr | 93 % |
| Ø čas do konverze | 4 hodiny 23 minut |
| Max. schvalovací interval | 50 dnů |
| Doménový tracking | ano |
| Defaultní odkaz | `a_bid=f5e0f8fb` |

**Provize po produktech** (z API, portál ukazuje jen souhrn „16–65 %"):

| produkt | sazba |
|---|---|
| **Autopojištění (povinné i havarijní)** | **16 %** |
| Cestovní pojištění | 20 % |
| Pojištění internetových rizik | 16 % |
| Občanská odpovědnost, profesní | 16 % |
| Rento (úrazové pojištění řidiče) | 16 % |
| Pojištění Náš domov (stavby, domácnost) | 46 % |
| Lead – životní pojištění | 40 % |
| Životní pojištění | 65 % |
| **PPL kontaktní formulář** | **100 Kč** |

⚠️ **Naše vertikála je na spodní hranici.** Souhrn „16–65 %" svádí k tomu číst
autopojištění optimisticky, ale je to právě těch 16 %. Při Ø objednávce 1 328 Kč
vychází prodej autopojištění na zhruba **210 Kč**, tedy asi dva leady. Nejvyšší
sazby nesou životní pojištění a Náš domov, což není náš obor. To nemění závěr
(ČSOB platí i lead, takže dnešní model zůstává zachovaný), ale ruší představu,
že provize z autopojištění bude výrazně lepší než dosavadních 100 Kč za lead.

Dodatečná podmínka inzerenta: *„V případě, že se v konverzní cestě zákazníka
nachází internetové bankovnictví ČSOB nebo app ČSOB SMART, může dojít
k zamítnutí provize."*

## Pravidlo, které určuje celý postup

V záložce Omezení propagace je mezi zakázanými položkami uvedena **„Tvorba
vlastního obsahu a použití loga inzerenta"**. Detail toho omezení ale zní:

> Pokud partneři tvoří vlastní obsah pro propagaci inzerenta, mohou tento obsah
> publikovat pouze s předchozím souhlasem inzerenta nebo sítě.

Není to tedy zákaz, ale **podmínka předchozího souhlasu**. Vlastní kreativa je
možná, jen se nesmí publikovat dřív, než ji někdo schválí. Totéž platí pro
e-maily:

> Partneři nesmí rozeslat emailing bez předchozího souhlasu inzerenta nebo sítě,
> pokud se nejedná o pravidelný emailing s obecnou nabídkou 3 a více inzerentů
> či značek najednou, s jehož zasíláním uživatelé vyjádřili souhlas.

Naše připomínka STK nese jednoho inzerenta, takže do výjimky nespadá.

Ostatní zákazy: plugin v prohlížeči, PPC na klíčová slova včetně brandu (`csob`,
`csobpoj`, `csob pojistovna`, `csob group`, `csob.cz`, `csbopoj.cz`), klamavá
reklama, překlepové domény, přímé přesměrování domény. Porušení znamená zamítnutí
dotčených provizí a může vést k ukončení spolupráce.

**Plán je proto rozdělený na to, co smíme hned, a co až po schválení.**

## Jednotky

### F0 – Odstranit iframe ePojištění (bez schválení)

Architektura je příznivá: **`SjednatPojisteniPage.tsx` je jediný soubor, který
sahá na `epojisteni`.** Všech deset vstupních bodů (navigace, patička,
`VehicleInfo`, klientská zóna, obě produktové stránky, připomínkový e-mail)
odkazuje na `/sjednat-pojisteni?typ=…&src=…` a zůstane beze změny.

Iframe se nedá opravit: creativa je navržená na 1000 px a vkládá se s pevnou
výškou 2200 px (HAV 2500). Naše CSS končí na hranici cizí domény.

#### Jak bude stránka vypadat

Mění se účel stránky. Dosud říkala „vyplň tady formulář a porovnej nabídky".
Nově říká „tohle potřebuješ vědět, sjednání je u ČSOB na dvě minuty".

**1. Přepínač typu zůstává** (povinné / havarijní / cestovní). Řídí obsah
i cílový odkaz, a je na něj navázaných deset vstupních bodů přes `?typ=`.

**2. Hlavní blok: jedna nabídka, ne mřížka.**

    Povinné ručení
    Sjednáte online, bez telefonátů. Budete potřebovat SPZ nebo VIN
    a datum narození; vyřízení trvá pár minut.

    [ Sleva 20 % při online sjednání, platí do 31. 8. ]   ← jen když kupón běží

    [ Spočítat povinné ručení ]  → eHub kreativa edd3eab1

Kupón se bere z `csob.getValidCoupons()` a párování na produkt jde přes
`validTo`/label. Když pro daný typ žádný neběží, blok se prostě nezobrazí.

**3. Kontext vozidla, když přijde `?vin=`.** Z připomínkového e-mailu a z karty
vozu chodí VIN. Tady bude bydlet datová kreativa z F3. Do schválení jen název
vozu a CTA, po schválení celý modul se statistikami.

**4. „Co získáte" přepsat.** Dnes prodává srovnání, které tam nebude.

**5. Zbylé kupóny jako pruh dole.** Návštěvník přišel kvůli autu, ale může ho
zaujmout cestovní nebo majetek. Stránka tak vydělává i mimo svůj typ, a cestovní
pojištění navíc platí 20 % oproti 16 % u auta.

**6. Smazat seznam `partnerInsurers`** – byl podmínkou kampaně eSpolupráce
a odchází s ní.

#### Copy, které musí pryč

Stránka dnes v úvodu slibuje: *„Vyberte typ pojištění a porovnejte si nabídky
pojišťoven přímo zde online a zdarma."* Po přechodu na jednu pojišťovnu není co
porovnávat. Ponechat tu větu by nebyla jen nepřesnost, ale tvrzení o službě,
kterou neposkytujeme, což spadá pod **klamavou reklamu** – a ta je zakázaná
absolutně, bez možnosti schválení.

Totéž platí pro *„za jedny z nejlepších cen na trhu"* v `promoBlock()`
připomínkových e-mailů (viz F4). **Obě formulace přepsat současně s F0**, ne
později.

Zůstat naopak může *„bez telefonátů"* a *„online během pár minut"* – to jsou
tvrzení o způsobu sjednání, ne o cenách, a jsou pravdivá.

- **DoD:** na stránce není žádný `<iframe>`; při 375 px nevzniká vodorovný
  scroll; nikde na webu ani v e-mailech nezůstalo slovo o srovnávání nabídek
  ani o nejlepších cenách

### F1 – Oficiální odkazy ČSOB (bez schválení)

eHub nabízí hotové kreativy typu **Odkaz**, které míří rovnou do kalkulačky
(`kalkulacka.csobpoj.cz`). Použití oficiální kreativy žádné schválení nevyžaduje.

| produkt | ID kreativy |
|---|---|
| povinné ručení | `edd3eab1` |
| havarijní pojištění | `f2cbd4a7` |
| pojištění vozidla komplet | `31ad0287` |
| cestovní pojištění | `ce3024c2` |
| pojištění odpovědnosti | `9892e41f` |
| pojištění majetku | `a6886874` |
| defaultní odkaz | `f5e0f8fb` |

Dnešní kód používá pro všechno jediné `f5e0f8fb` s přepsaným `desturl`, takže
**všechny kliky se v eHubu reportují pod jednou kreativou**. Přechod na
produktová ID dá členění zdarma.

- Doplnit `csobLinks` do `affiliateCampaigns.ts`
- `data1` použít pro atribuci umístění (helper to už umí)
- **DoD:** každý produkt vede přes vlastní ID a v eHub statistikách se liší

### F2 – Postavit modul za URL parametrem (bez schválení)

Modul se **smí postavit hned**. Pravidlo mluví o *publikování* vlastního obsahu,
ne o jeho vytvoření. Postavíme ho tedy celý, ale zpřístupníme jen za parametrem
v adrese, například `?nahled=csob`.

Podmínky, aby to nebylo publikování:

- bez parametru se modul nevykreslí vůbec, nejen skryje CSS
- nevede na něj žádný odkaz z webu ani ze sitemapy
- náhledová adresa dostane `noindex` (stránka už umí `setRobots`)

Tím se pořadí obrací k lepšímu: správkyně kampaně posuzuje **živou věc**, ne můj
popis v próze, a my mezitím nestojíme.

- **DoD:** bez parametru se v DOM nevyskytuje nic z modulu; s parametrem je
  stránka `noindex`; modul není v sitemapě

### F3 – Poslat k posouzení a po souhlasu uvolnit

Koncept e-mailu je v `docs/emails/2026-08-24-csob-schvaleni-kreativy.txt`,
adresát **Kristina Krátká, Affiliate Manager, `kratka@ehub.cz`**. Před odesláním
doplnit náhledovou URL z F2.

Ptá se na dvě věci: posouzení modulu a potvrzení, že produktové odkazy do
kalkulačky smíme používat volně. **Otázka na e-mailing v něm záměrně není** –
patří k F4 a přidáním by se zdržela odpověď na to, co blokuje web.

Po souhlasu odstranit podmínku parametru a nasadit na plochy: po lustraci VIN,
karta vozu v klientské zóně, obě produktové stránky. Na `/znacky/*` maximálně
jedna decentní karta dole, ty stránky nesou `Dataset` JSON-LD a právě si
vydobyly indexaci.

Pravidla zabudovaná do návrhu modulu:

- **Logo ČSOB pouze z oficiální kreativy**, nikdy překreslené
- **Žádné vymyšlené ceny.** „Od 1 990 Kč" je tvrzení o cizím produktu a zároveň
  nejjistější cesta ke klamavé reklamě
- **Napsat i to, co se nehodí** („u osmnáctiletého vozu havarijko obvykle nedává
  smysl"). Právě tahle věta dělá zbytek důvěryhodným
- **Jedna nabídka, ne mřížka log** – mřížka je srovnávač, tedy to, od čeho jdeme pryč

### F4 – E-maily (samostatné kolo schvalování)

Připomínky jsou samostatná plocha a je potřeba je řešit zvlášť, protože se na ně
snadno zapomene. Vše je v `api/_reminderEmail.ts`, funkce `promoBlock()`:

| typ připomínky | kam dnes vede | co to je |
|---|---|---|
| `povinne_ruceni` | `${baseUrl}/sjednat-pojisteni?vin=…` | **náš web** |
| `havarijni_pojisteni` | `${baseUrl}/sjednat-pojisteni?vin=…` | **náš web** |
| `stk` | `ehub.cz/…&a_bid=67e04d9d` | affiliate **Cebia** |

Z toho plynou dvě věci, které nesmíme uhodnout.

**1) Přenáší se pravidlo o emailingu přes vlastní stránku?**
E-mail sám žádný tracking odkaz ČSOB nenese, takže doslovně o emailing inzerenta
nejde. Jenže po F0/F1 povede na stránku, která ČSOB propaguje, a inzerent to může
číst jako propagaci vyvolanou e-mailem. **Tuhle otázku položit v samostatném e-mailu**, až bude vyřízené F3;
ne si na ni odpovědět sám. Do doby odpovědi nechat odkaz na vlastní doménu tak,
jak je.

**2) Text e-mailu obsahuje cenové tvrzení.**
Dnes zní: *„Sjednejte si pojištění online během pár minut – bez telefonátů a za
jedny z nejlepších cen na trhu."* U srovnávače to dávalo smysl. Jakmile stránka
nabídne jedinou pojišťovnu, stává se z toho **nedoložitelné tvrzení o cenách
ČSOB**. To spadá pod „klamavou reklamu", a ta je zakázaná **absolutně, bez možnosti
schválení**. Formulaci je nutné přepsat společně s F0, ne až u F4.

⚠️ Do e-mailu **nevkládat eHub tracking odkaz ČSOB** před schválením. Pozor na
záměnu: `api/_reminderEmail.ts:11` už jeden eHub odkaz nese, ale je to Cebia
(`67e04d9d`) pod jinou kampaní a jinými pravidly.

### F5 – Odstranit CJ

`axaCestovniPojisteni` je **mrtvý kód** – je definovaný a exportovaný
v `allCampaigns`, ale nikde se nerenderuje. To zároveň vysvětluje nulové kliky
na CJ: odkaz se na web nikdy nedostal. Smazat.

## Rizika

**Cookie 15 dní** je krátká. Ø čas do konverze 4 h 23 min napovídá, že většina
lidí rozhoduje ve stejné session, ale kdo si pojištění rozmýšlí týdny, se
neatribuuje.

**Zamítnutí u klientů ČSOB.** Konverze přes internetové bankovnictví ČSOB nebo
app ČSOB SMART se nemusí proplatit.

**Jeden partner = jediný bod selhání.** Pokud ČSOB kampaň pozastaví, nezbude nic.
Seznam pojišťoven u ePojištění byl ošklivý, ale široký. Beru to jako tvoje
rozhodnutí, jen ať je vyslovené: doporučuju nechat `csobCoupons` a strukturu
konfigurace natolik obecnou, aby šel druhý partner doplnit bez přepisování stránek.

**Změna modelu.** Lead se platí za odeslaný formulář, provize až za smlouvu.
PPL 100 Kč za kontaktní formulář to tlumí, protože ČSOB platí i lead.

## Definition of Done

- [x] `/sjednat-pojisteni` bez iframu (0 v DOM i v bundlu), bez pevných šířek
- [x] každý ČSOB odkaz přes vlastní produktové ID kreativy
- [x] text připomínkových e-mailů zbavený cenového tvrzení, spolu s F0
- [ ] otázka na přenos pravidla o e-mailingu položena a zodpovězena (po F3)
- [x] kupóny přesynchronizované a neprázdné (2026-08-24, ověřeno voláním `getValidCoupons()`)
- [x] kupóny se generují z eHub API a hlídá je CI job `sync-ehub-coupons`
- [ ] `EHUB_PARTNER_ID` a `EHUB_API_KEY` doplněné do GitHub secrets
- [x] `axaCestovniPojisteni` i `epojisteni` smazány
- [x] eSpolupráce/ePojištění odstraněny ze **zásad ochrany osobních údajů**
      (jediná právní plocha, kde byly jmenovány); v obchodních podmínkách nebyly
- [x] modul za parametrem je pro veřejnost neviditelný a noindex
- [ ] souhlas získán **dřív**, než se modul uvolní všem
- [x] proběhl skill `sync-marketing-surfaces` (viz tabulka výše)
- [ ] ověřeno na produkci, ne jen lokálně
