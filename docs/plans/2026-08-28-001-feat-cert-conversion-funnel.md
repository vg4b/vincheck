# feat: zvýšit konverzi certifikátu (funnel na /vin výsledku)

**Status:** 2026-08-28 — **dodán JEN F4 (admin/metrics panel).** F1/F2/F3 byly
navrženy špatně, postaveny a revertovány; F5 neřešeno. A/B (F3) odstraněno i
z admin panelu (zatím neděláme). Viz „Selhání" níže.

## ⚠️ Selhání této iterace (2026-08-28) — poctivý záznam

Uživatel to trefně shrnul: „totální trash" a „dnes ti to nejde". Sled chyb,
společná příčina = **navrhoval jsem, aniž jsem ověřil realitu produktu**:

1. **Fabrikované teasery (F2).** Tři „zamčené value" panely tvrdily, co produkt
   nemá: zahraniční historie (máme **jen CZ registr**), STK závady jako placené
   (jsou **zdarma** na detailu), „ověření zástavního práva" (jen **mapujeme IČO
   na seznam leasingovek**, žádná právní kontrola). Navíc 3–4 tlačítka na tutéž
   akci. → smazáno, `VehicleInfo.tsx` vrácen.
2. **„Posílit rollback."** Rollback je u vozů minimum → nízké pokrytí, malý dopad.
3. **„Posílit očekávaný nájezd."** Predikci **už zobrazujeme** (blurred hero
   v mileage panelu) — navrhoval jsem existující věc.
4. **„Ukázat rozsah zdarma."** Blbost — je to **predikce**, přesné číslo neznáme;
   rozsah **je** ten placený obsah na certifikátu. Nelze „odhalit zdarma".

**Poučení (do budoucna):** Před jakýmkoli návrhem na hodnotu/konverzi:
(a) přečíst, co panel/cert **dnes reálně zobrazuje** (`VehicleHistoryPanel.tsx`,
`api/_certificatePdf.ts`), (b) ověřit, co je **zdarma vs. zamčené**, (c) projet
`sync-marketing-surfaces`. Certifikát **nemá skrytá data k odemčení** nad rámec
oficiálního nájezdu z STK — ten už je surfovaný. Konverze proto **není problém
chybějící hodnoty**; reálné páky jsou spodek trychtýře (Comgate ~15 % opouští
bránu, karty „pending") a kvalita traffiku — ne obsah stránky. Viz paměť
`certificate-real-value`.

## Proč

Za 24 h ~122 lookupů, ale prodeje jsou vzácné. Trychtýř (celkem od 24. 6. 2026):

| Krok | Počet | Konverze z předchozího |
|---|---|---|
| `vin_lookup` | 2 300 | – |
| `comparison_view` (nabídka zobrazena) | 399 | 17 % |
| `cert_cta_click` | 36 | 9 % |
| `checkout_modal_open` | 34 | 94 % |
| `certificate_created` (redirect na Comgate) | 33 | 97 % |
| `certificate_issued` (zaplaceno) | 25 | 76 % |

Reálné prodeje (filtr `testMode=false`): **17 / 1 683 Kč**.

**Diagnóza:**
- Spodek trychtýře je zdravý: kdo klikne CTA, v ~69 % zaplatí. Cena (99 Kč) ani
  checkout nejsou brzda.
- Únik je nahoře/uprostřed: nabídku vidí jen ~20 % lookupů (zčásti feature flag /
  postupný rollout), a kdo ji vidí, málokdy klikne (9 %).
- **Zamčené panely s konkrétními daty konvertují nejlíp:** `cert_cta_click` podle
  placementu = `mileage_panel` **21** > `comparison` 10 > `hero` 5. → replikovat.
- **Comgate:** `certificate_created`→`issued` = ~15 % opustí bránu (potvrzená
  hypotéza „user si to na Comgate rozmyslí"). Menší únik než vršek.

**Zamítnuté páky:** paywall na free lookup (utne vršek trychtýře + SEO); plošná
sleva (spodek už konvertuje za 99 Kč – cena není brzda).

## Jednotky

### ~~F1 / F2 / F3~~ — zamítnuto, viz „Selhání" výše

F1 (viditelnost) stálo na měřicím artefaktu (server `vin_lookup` vs. browser
`comparison_view`, viz níže), F2 (value teasery) fabrikovalo data, F3 (A/B)
nemá co testovat, dokud není poctivá hypotéza. Neimplementováno / revertováno.

### F4 – Admin metrics panel ✅ DODÁNO

- `GET /api/admin/metrics` — auth `Authorization: Bearer <METRICS_SECRET>`
  (dedikovaný klíč, oddělený od cron/marketing secretu). Vrací funnel + 30denní
  konverze mezi kroky, denní lookupy/prodeje, reálné prodeje/tržbu (filtr
  `testMode`), CTA dle `placement`. **Bez A/B** (zatím neděláme).
- `src/pages/AdminMetricsPage.tsx` (`/admin/metrics`) — prompt na klíč (jen
  sessionStorage + Bearer header, nikdy v URL), noindex.
- Přidán jako soubor `api/admin/metrics.ts` → **11/12** Vercel funkcí.
- **DoD:** čísla sedí s přímým SQL (ověřeno: 17 reálných prodejů / 1 683 Kč),
  endpoint je za auth (401/200).

### F5 – Comgate abandon (budoucí, neřešeno)

- Dotáhnout platby kartou („pending scheme approval").
- Před redirectem ukázat cenu + „co se stane".

## Definition of Done (co reálně platí pro F4)

- `tsc --noEmit` + `biome check` čisté.
- Admin panel porovnán s přímým SQL.
- `METRICS_SECRET` nastaven ve Vercel env (uživatel, 2026-08-28).
