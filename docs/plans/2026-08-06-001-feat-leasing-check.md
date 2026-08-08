# Plan — Leasing / financing check (paid certificate feature)

**Status:** IMPLEMENTED 2026-08-06. Kept as the record of how the IČO list was
derived and how to refresh it (appendix). Two deviations from the plan, both
found while verifying against real VINs:

1. `kinds` ships in the FREE teaser as well — without it the badge would label an
   ex-rental as "leasing", which is simply wrong.
2. A `rental` match counts only where the company was the **owner**. A live VIN
   surfaced a one-day 2002 *operator* row for an IČO that trades as a carsharing
   operator today, which would have badged the car "ex-půjčovna" for a business
   that didn't exist then. The certificate also carries a caveat that names are
   the IČO's current registered name.

**Date:** 2026-08-06.
**Working title (CZ):** *Leasing a financování* / badge *"Leasing v historii"*.

## Goal

Detect whether a **leasing / financing company** appears in the vehicle's owner
history (`vehicle_owners`) and turn that into a new **paid section of the
certificate** plus badges on the detail page.

Three genuinely different answers for the buyer:

| Case | Meaning for the buyer | Tone |
|---|---|---|
| **Financing company is the CURRENT owner** | The seller is (per the registry) only the *provozovatel* — the car is not theirs to hand over free and clear. Must be settled before money changes hands. | red — the single most expensive mistake this product can prevent |
| **Financing company only in the PAST** | Ex-leasing / ex-fleet car: financed or on an operating lease, typically higher yearly mileage but regular servicing. Ownership itself is clean. | neutral/info — history, not a defect |
| **No financing company found** | The registry records none. **Not** proof the car is unencumbered (an úvěr or a zástavní právo never appears here). | light — plus the honest pointer to a real lien check |

## Why this works on our data

Czech registry semantics make the signal reliable for **finanční/operativní
leasing**:

- On a finance/operating lease the leasing company is registered as **vlastník**
  and the user as **provozovatel** — exactly the two `vztah_k_vozidlu` values we
  already parse.
- `typ_subjektu='2'` (legal entity) rows expose a public **IČO**, and the IČO of
  a leasing company is stable and enumerable.
- `aktualni='True'` distinguishes the current holder from the historic ones.

### Measured on the live cache (2026-08-06, 90.7M owner rows)

| Metric | Value |
|---|---|
| Vehicle↔financier associations across the curated leasing list | **~2.78M** (upper bound — a vehicle financed twice is counted twice) |
| Currently owned by the **top 6** financiers alone | **~329k** vehicles (ŠkoFIN 116,695 · Moneta Auto 48,794 · ČSOB Leasing 45,657 · Arval 45,676 · UniCredit Leasing 40,788 · Ayvens 31,521) |
| Distinct vehicles ever touching ŠkoFIN alone | 758,178 |

So this is not a rare-edge-case feature — it is a top-3 prevalence signal,
comparable to the ~28% company-ownership figure already documented in
`docs/VEHICLE_HISTORY_PANEL.md`.

**Two shapes of financing show up in the data, and they need different copy:**

- **Finance lease / úvěr se zajištěním** — lessor is owner only. Moneta Auto:
  48,794 current owner rows vs **91** current operator rows.
- **Operating lease / fleet** — lessor is owner *and* operator. Arval: 45,676
  current owner vs 45,638 current operator; Ayvens 31,521 / 25,977.

**Known noise:** ~7–11% of the "currently owned by a financier" rows have a
`datum_od` before 2015 (ŠkoFIN: 12,926 of 116,695). Leases don't run 12 years —
these are stale registry records or long-term fleet. Reason enough to state the
registry fact and the action, never a legal conclusion.

### What this will NOT see (must be in the copy — see *Honesty*)

- **Úvěr / spotřebitelský úvěr** — the buyer is the owner from day one; the loan
  is invisible in the registry.
- **Zástavní právo** (Rejstřík zástav / Notářská komora) — a different register
  we do not hold.
- Financing by a company not on our list — mitigated by regenerating the list
  from the data (below), never eliminated.

## Detection design

### Runtime = curated IČO allowlist only

`api/_vehicleCache.ts` already **drops `nazev` from every owner row on purpose**
(GDPR — an OSVČ's `nazev` is a personal name) and exposes only the IČO. That rule
stays. The new feature therefore:

- matches the timeline's **IČO** against a curated allowlist, and
- renders **our own canonical name** from that allowlist (a legal entity we
  vetted), never the registry's `nazev` string.

No raw `nazev` ever leaves the server — the feature adds zero new PII surface.

Name-pattern matching (`%leas%`, `%financ%`, …) is used **offline to build and
refresh the list**, never at request time. An allowlist also means dealers,
importers and autobazars are excluded *by construction*: a new car first
registered to Porsche Inter Auto or a trade-in sitting at AURES never matches, so
we can never mislabel it "financed". (See appendix A4 for the traps.)

### Classification kinds

| kind | Meaning | Badge tone |
|---|---|---|
| `leasing` | Finance lease / financing house (ŠkoFIN, ČSOB Leasing, UniCredit Leasing, Moneta, ESSOX…) | red if current, info if past |
| `fleet` | Operating lease / fleet management (Ayvens, Arval, Business Lease, Drivalia…) | info — ex-firemní vůz |
| `rental` | Rent-a-car / carsharing (Hertz, Avis, CAR4WAY…) | warn even when past — real wear |

### Derived shape

Added to `VehicleHistory` in `src/types/index.ts` + `api/_vehicleCache.ts` as an
**optional** key (`financing?:`) with an `EMPTY_FINANCING` fallback — exactly like
`equipment`, so certificate snapshots frozen before this ships still render.

```ts
financing: {
  /** Any leasing/fleet/rental subject in the owner history. */
  hasHistory: boolean
  /** A leasing/fleet subject is the CURRENT owner or co-owner. */
  active: boolean
  records: Array<{
    ico: string
    /** Canonical name from OUR allowlist — never the registry's `nazev`. */
    name: string
    kind: 'leasing' | 'fleet' | 'rental'
    relation: OwnerRelation
    from: string | null
    to: string | null
    current: boolean
  }>
}
```

Derivation is pure and needs **no new query** — it maps over the `timeline` array
already built in `lookupVehicleFromCache`. Zero added latency on the hot path.

```ts
// api/_vehicleCache.ts, right after `timeline` is built
const financing = buildFinancing(timeline)   // api/_financingCompanies.ts
```

`active` = `current === true && kind !== 'rental' && relation ∈ {owner, co-owner}`
— a current *operator* that happens to be a leasing company is not an ownership
blocker, and a rental company's current ownership means "still in the fleet", a
different statement.

## Free vs paid split

The precedent is mileage (`api/vehicle.ts`): the **alarming boolean is free**, the
**exact figures are paid**. Copy that.

**Decided (owner, 2026-08-06): this split.**

- **Free (public `/api/vehicle` response):** `hasHistory`, `active`, and a count.
  Rendered as a badge + one-line teaser with the unlock CTA.
- **Paid (certificate snapshot + PDF):** `records[]` — *which* company, *which*
  period, owner vs operator, the kind (leasing / fleet / rental), the verdict
  paragraph and the buyer checklist.

Rationale, stated plainly: the IČOs themselves are **already public on the free
page** (the timeline links each one to `/firma/:ico`), so pretending to hide the
yes/no would be a paywall a curious user walks around in 30 seconds — and hiding
an *active-financing* warning from a buyer is user-hostile. What we sell is the
identification, the interpretation, and the PDF they can put in front of a seller.

*(Rejected alternative: strip `financing` from the public response entirely and
show only a locked "Leasing a financování 🔒" row. Higher perceived exclusivity,
weaker hook, and the data stays inferable from the public timeline anyway.)*

## Surfaces

### 1. Detail page — `VehicleHistoryPanel.tsx` (free)

Inside the existing *Historie z registru* card, above the owner timeline:

- `active` → red alert, same weight as the rollback alert:
  > **Vozidlo je podle registru ve vlastnictví leasingové/finanční společnosti.**
  > Prodávající je veden pouze jako provozovatel. Před koupí si vyžádejte
  > potvrzení o doplacení a převodu vlastnictví. Konkrétní společnost a období
  > najdete v certifikátu.
- `hasHistory && !active` → info line + badge:
  > **V historii vozidla je leasingová/finanční společnost.** Vozidlo bylo
  > pravděpodobně financováno nebo šlo o firemní vůz.

Badges (Bootstrap pills, matching `buildFlags`):

| Badge | Class | Fires when |
|---|---|---|
| `Aktivní leasing / financování` | `text-bg-danger` | `active` |
| `Leasing v historii` | `text-bg-warning` | `hasHistory && !active`, kind `leasing` |
| `Ex-firemní / operativní leasing` | `text-bg-light border` | kind `fleet` |
| `Ex-vozidlo z půjčovny` | `text-bg-warning` | kind `rental` |

`rental` sits with the equipment-derived *usage notes* in tone: it is history, not
a defect — but it is the kind of history a buyer overpays for without knowing.

### 2. Certificate PDF — `api/_certificatePdf.ts` (paid)

- **Glance chip** next to the existing status/owners/STK/tacho chips:
  `Aktivní leasing` (warn) / `Leasing v historii` (neutral) / `Bez záznamu
  leasingu` (good).
- **New section `Leasing a financování`** directly after *Majitelé a
  provozovatelé* (it is an ownership statement) — `secTitle('Leasing a
  financování', 'fin-t')`, then per record a `tlRow`-style line:
  `1. 3. 2019 – 28. 2. 2023 · ŠkoFIN s.r.o. (IČO 45805369) · vlastník · leasing`,
  with the IČO linked via the existing `registryUrl(ico)`.
- **Verdict block** — one of the three cases above, in full sentences.
- **Checklist** when `active`, the concrete thing the buyer pays us for:
  vyžádat vyčíslení zůstatku od leasingové společnosti; převod až po doplacení;
  neplatit zálohu prodávajícímu; ověřit, u koho je velký technický průkaz.
- **Always** the honesty footnote, including in the *no record* case.

### 3. `ProductComparison.tsx`

The two cards currently collide: the affiliate card claims **"Zástavy a leasing"**
as Cebia's differentiator, and we are about to sell a leasing check. Fix by
splitting the claim along what each source can actually prove — *who owned it*
(registry, ours) vs *is there a lien on it right now* (rejstřík zástav, theirs).

**Our card** — insert after "Vlastníci a provozovatelé":

```
Leasing a financování v historii vlastníků
```

Static, not conditional on the VIN (unlike the mileage bullets): the certificate
answers the question in all three cases, including "no record", and a bullet that
appears only for financed cars would leak the paid answer into the card.

**Affiliate card** — one word changes:

| | Before | After |
|---|---|---|
| bullet 2 | `Zástavy a leasing` | `Zástavy a právní vady (rejstřík zástav)` |

This *strengthens* the affiliate bullet — a lien register check is a real,
distinct product we genuinely cannot do — while removing the head-on overlap.
The card's closing line ("…prověřit nehody, zástavy a původ ze zahraničí") already
matches this framing and needs no change.

The same pairing goes anywhere else the two products are contrasted, so that our
claim is always *"leasing v historii vlastníků"* and never bare *"leasing"*.

### 4. Landing page `CertificateLandingPage.tsx`

One bullet in the contents list, same wording as the comparison card.

## Honesty / legal (non-negotiable copy rules)

Same discipline as the equipment section ("chybějící položka neznamená, že ji
vozidlo nemá"):

- **Never** print *"vozidlo není zatíženo"*, *"bez leasingu"*, *"právně čisté"*.
  Only: *"Registr silničních vozidel neeviduje mezi vlastníky leasingovou ani
  finanční společnost z našeho seznamu. Úvěr ani zástavní právo se v registru
  neprojeví — ty ověřte v Rejstříku zástav."*
- **Never** turn an `active` record into a legal conclusion about debt or lien.
  State the registry fact ("vlastníkem je podle registru X"), then what to do.
  ~7–11% of these rows are stale (see prevalence above) — the copy must survive
  being wrong about the loan while still being right about the registry.
- The list is ours and finite → say *"podle našeho seznamu leasingových a
  finančních společností"* in the methodology footnote.

## Files touched

| File | Change |
|---|---|
| `api/_financingCompanies.ts` | **new** — `FINANCING_COMPANIES: Record<ico, {name, kind}>` + `buildFinancing(timeline)` |
| `api/_vehicleCache.ts` | call `buildFinancing`, add `financing` to `VehicleHistory` |
| `src/types/index.ts` | `financing?:` on `VehicleHistory` (optional, snapshot back-compat) |
| `api/vehicle.ts` | public teaser (strip `records` if the harder paywall is chosen) |
| `api/_certificatePdf.ts` | glance chip + `Leasing a financování` section + verdict + checklist |
| `src/components/VehicleHistoryPanel.tsx` | badges + alert + teaser CTA |
| `src/components/ProductComparison.tsx` | feature bullet + reworded affiliate bullet |
| `src/pages/CertificateLandingPage.tsx` | contents bullet |
| `docs/VEHICLE_HISTORY_PANEL.md`, `docs/CERTIFICATE.md` | document the derivation + copy rules |

No migration, no new table, no new query — the allowlist is a TS constant and the
derivation is pure. Vercel function count unchanged (we are at the 12 cap).

## Maintaining the IČO list

The list drifts (renames and mergers: ALD/LeasePlan → Ayvens, sAutoleasing →
Leasing ČS, Leasys/FCA → Drivalia). Refresh it from the cache itself — **one
regex, one pass**; the 24-`ILIKE` variant kept losing the connection:

```sql
SELECT ico, nazev, count(*) AS rows
FROM vehicle_owners
WHERE typ_subjektu = '2' AND ico IS NOT NULL
  AND nazev ~* '(leas|financ|credit|kredit|rent|půjčov|pujcov|sharing|fleet|mobilit)'
GROUP BY ico, nazev
HAVING count(*) >= 300
ORDER BY 3 DESC;
```

Runs ~5 min on the Scaleway cache. **Append `&keepalives=1&keepalives_idle=15`
to the connection URL** — without it the connection dies silently mid-scan and
psql hangs forever (this bit twice while building the list).

Add a line to the monthly cache-refresh checklist (`refresh-vehicle-cache` skill /
`docs/VEHICLE_DATA_CACHE.md`): re-run, diff against `api/_financingCompanies.ts`,
add newcomers. **Keep retired IČOs forever** — historic ownership rows still
reference them (many of the entries below are `v likvidaci` and still matter).

## Verification

1. `pnpm exec tsc --noEmit` + `pnpm exec biome check --write`.
2. Pick real VINs from the cache for each case (a `pcv` with a current leasing
   IČO, one with a past one, one with none) and render via
   `scripts/render-vin-cert.ts`; check section, chip and verdict.
3. Free page for the same VINs (`?cert=preview`): badge + alert + CTA, and
   confirm the public `/api/vehicle` payload carries no `records` if the harder
   paywall is chosen.
4. Re-download a certificate issued **before** this ships — must still render
   (the `EMPTY_FINANCING` fallback).

## Decisions (owner, 2026-08-06)

1. **Paywall depth** — ✅ free yes/no + active warning, paid detail.
2. **Scope in v1** — ✅ all three kinds, `leasing` + `fleet` + `rental`. The
   rental list is settled (appendix A3): SIXT and Europcar do not exist as CZ
   registrants, Hertz does, and the tail below ~150 vehicles is deliberately not
   pursued. Copy states coverage is partial.
3. **`ProductComparison` wording** — ✅ see the before/after in *Surfaces § 3*.
4. **Price** — no change (99 Kč). This deepens the existing product rather than
   becoming an upsell of its own.

---

# Appendix — IČO list

> **Audited 2026-08-07.** The name sweep below cannot see a provider whose name
> carries no keyword — `Birne by Direct s.r.o.` (car subscription, 1 627 vehicles)
> was missed entirely. A second, **structural** sweep now complements it: group by
> IČO with `count(*) FILTER (WHERE vztah_k_vozidlu=…)` and look for companies that
> currently hold many vehicles as owner and/or operator. Candidates are confirmed
> against the business register (ARES NACE **77110** / 64910), never from the name
> or the numbers alone. Both queries live in the `refresh-vehicle-cache` skill and
> run with the monthly ingest. Three entries added since the initial list:
> `14404630` Birne by Direct, `25231022` JPPE, `25522248` IPB Invest.
>
> **77110 is a filter, not a verdict:** 19 of 342 provider-like candidates carried
> it, and all but two were dealerships (courtesy cars), a builder or a window
> maker. Adding those would have been exactly the false positive the allowlist
> exists to prevent.

Derived from the live Scaleway cache on 2026-08-06 (`vehicle_owners`, 90.7M rows,
snapshot as configured in `cache_meta`). `rows` = owner/operator records, a proxy
for fleet size. Names are exactly as the registry carries them, so they can be
used verbatim as the canonical display name.

## A1 — `leasing` (finance lease / auto credit)

| IČO | Name | rows |
|---|---|---|
| 45805369 | ŠkoFIN s.r.o. | 1,028,839 |
| 63998980 | ČSOB Leasing, a.s. | 326,371 |
| 15886492 | UniCredit Leasing CZ, a.s. | 274,654 |
| 60112743 | MONETA Auto, s.r.o. | 237,241 |
| 27089444 | Leasing České spořitelny, a.s. | 165,251 |
| 26764652 | ESSOX s.r.o. | 127,775 |
| 63997240 | Mercedes-Benz Financial Services Česká republika s.r.o. | 120,313 |
| 60751606 | MONETA Leasing, s.r.o. | 93,425 |
| 25139886 | Credium, a.s., v likvidaci | 84,002 |
| 65413261 | Toyota Financial Services Czech s.r.o. | 75,728 |
| 25103768 | CASPER Consumer Finance a.s. | 67,449 |
| 25722328 | RCI Financial Services, s.r.o. | 66,203 |
| 61467863 | Raiffeisen - Leasing, s.r.o. | 64,115 |
| 25615564 | FCE Credit, s.r.o., v likvidaci | 55,462 |
| 26978636 | Home Credit a.s. | 49,321 |
| 61061344 | SG Equipment Finance Czech Republic s.r.o. | 43,204 |
| 25205552 | UNILEASING a.s. | 36,149 |
| 62912691 | SPEED LEASE a.s. | 30,825 |
| 26737442 | PSA FINANCE ČESKÁ REPUBLIKA, s.r.o. | 28,255 |
| 6208991 | SAFE Lease s.r.o. | 22,722 |
| 63999579 | DINESIA a.s., v likvidaci | 22,192 |
| 25657496 | TRATON Financial Services Czech Republic s.r.o. | 21,757 |
| 16325460 | Erste Leasing, a.s. | 18,078 |
| 48909238 | D.S. Leasing, a.s. | 16,928 |
| 27179907 | COFIDIS a.s. | 15,344 |
| 27116867 | VFS Financial Services Czech Republic s.r.o. | 15,122 |
| 25634208 | GMAC, s.r.o., v likvidaci | 14,508 |
| 47285214 | Autoleasing Litoměřice spol. s r.o. | 13,986 |
| 27091325 | Oberbank Leasing spol. s r.o. | 11,123 |
| 65006658 | IMPULS-Leasing-AUSTRIA s.r.o. | 11,012 |
| 60851252 | AGRO LEASING J.Hradec s.r.o. | 10,757 |
| 2315980 | PACCAR Financial CZ s.r.o. | 9,859 |
| 8112312 | BMW Financial Services Czech Republic s.r.o. | 9,540 |
| 49241150 | GE Money Multiservis, s.r.o. v likvidaci | 22,400 |
| 25723758 | Deutsche Leasing ČR, spol. s r.o. | 8,047 |
| 27677150 | Leasekredit, a.s. | 7,023 |
| 61057738 | VLTAVÍN leas, a.s. | 6,642 |
| 44468105 | Východočeská leasingová, spol. s r.o. | 6,213 |
| 26424207 | Santander Consumer Leasing s.r.o. | 6,105 |
| 61250015 | ŠkoLEASE s.r.o. | 5,636 |
| 28123778 | CZECH LEASE s.r.o. | 5,541 |
| 27423425 | CZECH FINANCE, a.s. | 5,466 |
| 60196971 | Servis Leasing a.s. | 5,458 |
| 25682971 | FC Leasing, k.s. | 5,019 |
| 25131991 | MB Leasing a.s. v likvidaci | 4,257 |
| 25159909 | ESSOX LEASING a.s. | 4,234 |
| 25138936 | Caterpillar Financial Services ČR, s.r.o. | 4,158 |
| 44964927 | J-T Leasing, s.r.o. | 3,276 |
| 7033893 | Pro LeaseKredit, s.r.o. | 3,273 |
| 25379658 | RT TORAX Leasing, s.r.o. | 2,709 |
| 26425556 | BAWAG Leasing & Fleet s.r.o. | 2,666 |
| 28345401 | CAR LEASING s.r.o. | 2,555 |
| 49240111 | Invest car leasing a.s. v likvidaci | 2,516 |
| 27184366 | Car Trade Finance s.r.o. | 2,487 |
| 14501210 | Oberbank Bohemia Leasing s.r.o. | 2,469 |
| 25644688 | NOVA-AUTO Leasing, a.s. | 2,414 |
| 24687332 | NOVA leasing, a.s. "v likvidaci" | 2,267 |
| 5929504 | LeaseMobile s.r.o. | 2,104 |
| 26231158 | FlexiLease, s.r.o. | 1,947 |
| 25191241 | NL-Leasing s.r.o. | 1,615 |
| 3621952 | Focus Lease a.s. | 1,612 |
| 9184716 | elva lease s.r.o. | 1,603 |
| 27949745 | AutoFinance Consumer s.r.o. | 1,534 |
| 2225191 | Ecoflex Leasing s.r.o. v likvidaci | 1,515 |
| 24820938 | Evropská leasingová s.r.o. | 1,422 |
| 25440004 | LEASETREND s.r.o. | 1,256 |
| 25411781 | FEDERAL CARS LEASING s.r.o. | 1,185 |
| 47115432 | SOGELEASE ČR, a.s. | 1,176 |
| 25073117 | CitiLeasing, s.r.o. v likvidaci | 1,106 |
| 60192372 | IPB Leasing, a.s. | 1,087 |
| 25117629 | ING Lease (C.R.), s.r.o. | 1,080 |
| 27719197 | ADIV Lease s.r.o. | 1,060 |
| 3600238 | EUROPEAN LEASE a.s. | 984 |
| 62029100 | Global Lease, s.r.o. | 954 |
| 41324536 | TLC - leasing s.r.o. | 898 |
| 24219380 | ONB LEASING s.r.o. | 866 |
| 10669914 | IN LEASE s.r.o. | 864 |
| 49815806 | MB Leasing ,s.r.o. | 864 |
| 27375307 | CSI Leasing Services, s.r.o. | 859 |
| 2085593 | ERSTE FLEET s.r.o. | 806 |
| 63995859 | ALIMEX LEASING,s.r.o. v likvidaci | 790 |
| 8280355 | 1CAR lease, s.r.o. | 782 |
| 29060494 | TOP LEASE CZ s.r.o. | 774 |
| 49241061 | RELEAS a.s. | 724 |
| 1731041 | LeaseRent s.r.o. | 706 |
| 869767 | AL-LEAS, spol. s r.o., v likvidaci | 633 |
| 49712152 | DLB LEASING ,s.r.o. v likvidaci | 592 |
| 62908308 | RSJ Leas Praha, spol. s r.o. | 575 |
| 25330098 | Q-LEASING, s.r.o. | 565 |
| 45315515 | InterLeasing a.s. v likvidaci | 557 |
| 45794766 | A.K.Leasing, spol. s r.o. | 543 |
| 62362887 | TROPPAU INVEST LEASING, spol. s r. o. | 523 |
| 65006402 | DELTA leasing Co., a.s. v likvidaci | 517 |
| 43004334 | GRAUMANN Vario leasing, s.r.o. | 510 |
| 27516580 | LEASECAR CZECH s.r.o. | 464 |
| 24159972 | TIR CENTRUM financial services s.r.o. | 462 |
| 62417541 | Český Leasing, spol. s r.o. | 454 |
| 418153 | TECHNOLOGY leasing, a.s. v likvidaci | 443 |
| 15061175 | IB-LEAS, akciová společnost, Hradec Králové | 442 |
| 48537411 | Lomax leasing s.r.o. | 425 |
| 48535206 | STAMAR LEASING s.r.o. | 417 |
| 28518314 | STARLEASING s.r.o. | 412 |
| 40524396 | HLS M.A.R.K. Leasing, spol. s r.o. | 410 |
| 16367791 | DAPOT - leas, spol. s r. o. | 408 |
| 18238530 | UNILEASING spol. s r.o. | 401 |
| 29250609 | Lease & Go s.r.o. | 374 |
| 46963910 | HANÁ Leasing, a.s. v likvidaci | 358 |
| 25303538 | AUSTROFIN Leasing spol. s r.o. "v likvidaci" | 319 |
| 42193575 | B + B, Leasing company, spol. s r.o. | 308 |
| 46356371 | SID leasing,a.s. | 307 |

## A2 — `fleet` (operating lease / fleet management)

| IČO | Name | rows |
|---|---|---|
| 63671069 | Drivalia Lease Czech Republic s.r.o. | 276,304 |
| 61063916 | Ayvens s.r.o. *(ex ALD Automotive / LeasePlan)* | 232,649 |
| 26726998 | ARVAL CZ s.r.o. | 225,728 |
| 25071025 | BUSINESS LEASE  s.r.o. | 84,336 |
| 62582836 | UniCredit Fleet Management, s.r.o. | 45,459 |
| 7567707 | EF Mobility s.r.o. | 17,437 |
| 3558461 | EURO FLEET SERVIS s.r.o. | 6,690 |
| 49240641 | ŠkoFIN Fleet Services a.s. | 5,753 |
| 25322508 | HAVEX Mobility s.r.o. | 5,548 |
| 28198921 | AUTOBOND MOBILITY s.r.o. | 3,464 |
| 8928088 | MHC Mobility, odštěpný závod | 2,876 |
| 24753068 | FORTIS FLEET s.r.o. | 2,507 |
| 8805555 | Mobility Fleet Solutions, s.r.o. | 1,850 |
| 5502713 | QAPITO Mobility s.r.o. | 1,332 |
| 7584466 | D - Mobility Czech Republic s.r.o. | 1,425 |
| 4141628 | Carprolease s.r.o. | 950 |
| 3647307 | Fleetia Czech s.r.o. | 940 |
| 26190851 | CAR FLEET SERVICES s.r.o. | 751 |
| 6382282 | Fleet One s.r.o. | 478 |
| 9137394 | OverLine Fleet s.r.o. | 383 |
| 19487363 | MA Mobility a.s. | 386 |

## A3 — `rental` / carsharing

Brand sweep run 2026-08-06 (regex over `sixt|europcar|hertz|enterprise|alamo|
thrifty|dollar rent|budget rent|autopůjč|půjčovn|car ?sharing|hoppygo|anytime|
uniqway|citymove|greengo|rent[- ]a[- ]car|driveto`, `HAVING count(*) >= 10`).

| IČO | Name | rows |
|---|---|---|
| 25131401 | CAR4WAY a.s. | 35,855 |
| 45770603 | Avis Autovermietung GmbH - organizační složka | 12,630 |
| 27963829 | TOP RENT CAR s.r.o. | 5,389 |
| 29255210 | SCAN RENT s.r.o. | 4,536 |
| 27232352 | JÍŠA rent - car s.r.o. | 4,324 |
| 3416313 | Rent@less s.r.o. | 3,703 |
| 25005901 | AUTORENT s.r.o. | 2,863 |
| 407615 | Hertz Autopůjčovna s.r.o. | 2,418 |
| 10953302 | AUTO KP PLUS RENT s.r.o. | 2,282 |
| 4242998 | Bizz Car Rental s.r.o. | 2,090 |
| 3572871 | DH Rentcar s.r.o. | 2,036 |
| 24160504 | GS RENTAL CAR s.r.o. | 1,829 |
| 27500853 | Rentstyl, s.r.o. | 1,749 |
| 24153711 | European Car Rent Praha s.r.o. v likvidaci | 1,661 |
| 2772833 | Vans Renting s.r.o. | 1,614 |
| 2860945 | GENERAL LEASE & RENTAL s.r.o. | 1,574 |
| 5146411 | Green Motion Rent CZ, s.r.o. | 1,559 |
| 6658881 | FEMAT Rent s.r.o. | 1,472 |
| 26497255 | ECORENTAL SOLUTIONS, a.s. | 1,439 |
| 27975860 | Europa Rent a Car s.r.o. | 1,402 |
| 4316886 | H-rent s.r.o. | 1,351 |
| 48534684 | A-RENT CAR,spol. s r.o. | 1,286 |
| 4838483 | RentLess CZ s.r.o. | 1,200 |
| 26451379 | ZemanCar, rent a car s.r.o. | 1,181 |
| 5953677 | RENTCAR Bohemia s.r.o. | 1,162 |
| 60722436 | SPEED RENT, s.r.o. | 1,069 |
| 17146127 | IGORentcar s.r.o. | 1,067 |
| 29147743 | FHRent Car s.r.o. | 1,022 |
| 4530951 | Pegas Rental Services s.r.o. | 1,014 |
| 563463 | UNION RENT A CAR,spol. s r.o. v likvidaci | 951 |
| 563510 | Czech Auto Rent, spol. s r.o. | 938 |
| 4543297 | SKODRA RENT & TRADE s.r.o. | 932 |
| 24144967 | RENT plus s.r.o. | 806 |
| 24728233 | Interlease & Rent s.r.o. v likvidaci | 799 |
| 28613015 | MFC Rent, s.r.o. | 789 |
| 26808251 | GRENT - Žváček s.r.o. | 780 |
| 29365392 | TATRA LEASE & RENT s.r.o. v likvidaci | 708 |
| 6097405 | MB-Rent-PT s.r.o. | 688 |
| 19916370 | VGR Rent s.r.o. | 654 |
| 26696266 | ASTON RENT s.r.o. | 617 |
| 3689557 | Charterline Fuhrpark rent a car s.r.o. | 560 |
| 27622436 | Blue Rent, a.s. | 465 |
| 2531968 | Půjčovna MARENT s. r. o. | 438 |
| 29161568 | invelt - rent s.r.o. | 430 |
| 27190161 | VIVA Rent s.r.o. | 421 |
| 7049455 | re.volt carsharing s.r.o. | 416 |
| 3655661 | CarTec Rent s.r.o. | 398 |
| 24837598 | TOP RENT CZ s.r.o. | 385 |
| 17238145 | VIARENT Česká republika s.r.o. | 381 |
| 8035954 | LG rent s.r.o. | 381 |
| 7973004 | PANDA AUTORENT s.r.o. | 352 |
| 48536920 | MINODA-PŮJČOVNA s.r.o. | 339 |
| 3394531 | TEDESCO RENT CAR s.r.o. | 337 |
| 3631443 | V-Rentcar s.r.o. | 302 |

### Additional entries found by the brand sweep

| IČO | Name | rows | vehicles |
|---|---|---|---|
| 27367169 | 1 1 Nejlepší autopůjčka s.r.o. v likvidaci | 719 | 464 |
| 25277324 | AUTOPŮJČOVNA OLFIN a.s. | 292 | 198 |
| 7672802 | GreenGo Car Czech s.r.o. *(carsharing)* | 260 | 230 |
| 25110799 | CZECH RENT A CAR s.r.o. | 235 | 225 |
| 3362906 | Půjčovna dodávek RENT s.r.o. | 228 | 111 |
| 24255505 | Autopůjčovna dodávek s.r.o. | 220 | 96 |
| 24838951 | EUROPŮJČOVNA s.r.o. | 205 | 96 |
| 3038866 | autopůjčovna-cb s.r.o. | 185 | 93 |
| 63075067 | Dvořák, rent a car, s.r.o. | 161 | 130 |
| 4936949 | Půjčovna karavanů s.r.o. *(motorhomes)* | 149 | 75 |
| 18629148 | Rentex Autopůjčovna s.r.o. | 137 | 137 |
| 47681217 | CONTACT - Rent-a-car, spol. s r. o. | 132 | 96 |
| 554421 | HERTZ spol. s r.o. v likvidaci | 57 | 44 |
| 15270041 | NOSTA-HERTZ spol. s r.o. | 109 | 62 |
| 7867778 | Hertz Rent CZ s.r.o. | 22 | 11 |
| 5185157 | Prague Car Sharing s.r.o. | 91 | 77 |

### Answered: SIXT and Europcar

**Neither exists as a vehicle-registering legal entity in the CZ registry.** The
sweep matched `sixt` and `europcar` down to 10 records and returned only
unrelated hits — `SIXT Umformtechnik s.r.o.` (metal forming), `SIXTOL`,
`FARMA-SIXTA`, and a dozen private individuals named *Sixta*; for Europcar,
only `Europa Rent a Car s.r.o.` (a different company) and `EUROPŮJČOVNA s.r.o.`.
Both brands run in Czechia through franchise operators that register vehicles
under their own, unrelated names — so there is **nothing to add**, and no
follow-up scan will change that. Hertz is the exception among the internationals:
it registers directly (four entities, above).

### What the sweep says about scoping `rental`

The rental market in the registry is a **long tail of tiny operators** — past
roughly the top 40, entries drop to 20–80 vehicles each (`Autopůjčovna VV Tábor`,
`P.L. Autopůjčovna`, …), and hundreds of them exist. Chasing that tail means
permanent maintenance for near-zero coverage.

**Recommended cutoff: ≥ ~150 vehicles**, which is everything listed above. That
captures the operators a used-car buyer could plausibly meet — CAR4WAY (21,863
vehicles), Avis (8,154), Hertz (2,051) — and stops. Coverage is deliberately
partial, which is why the `rental` copy must be phrased as *"vozidlo bylo
evidováno u autopůjčovny"* and never as *"nebylo z půjčovny"*.

A behavioural detector (a company owning many vehicles for short, non-overlapping
spells) would find the tail without a name list. Worth revisiting if `rental`
turns out to convert; not worth it for v1.

### Excluded — matched the pattern, are not rentals

`Driveto s.r.o.` (online used-car marketplace), `Stella Car s.r.o.`, and the
`*_ CAR` name collisions (`BOHEMIA CAR`, `GOJVA CAR`, `CALIBRA CAR`); every
`Půjčovna …` that rents something other than vehicles — nářadí, lešení, lodí,
stavebních strojů, **motodlah** (medical splints); and the `enterprise`
collisions (`Aricoma Enterprise Applications`, `MING ENTERPRISES`, `SEA
Enterprises`, `Axel Foley Enterprise`).

## A4 — Explicitly **NOT** financing (do not add)

Traps found while curating. Every one of these would produce a wrong, visible
"vozidlo bylo financováno" claim:

- **Autobazary / dealer groups** — AURES Holdings (1759299, AAA Auto/Mototechna,
  484k vehicles), AAA AUTO (26699648), AutoESA (25627538), AUTO JAROV, Louda
  Auto, Auto Palace, Emil Frey ČR, IMPORTO Drive. A trade-in parked at a dealer
  is not a lease.
- **Importers / factory** — Škoda Auto (177041), Porsche Inter Auto CZ, Porsche
  ČR, Mercedes-Benz ČR, BMW Vertriebs, Hyundai Motor Czech, Renault ČR. New cars
  are routinely first registered here.
- **`CARent, a.s.` (63485885)** — reads like a rental, is a Brno dealership.
  The single clearest argument for a curated list over a name regex.
- **Banks** — MONETA Money Bank (25672720), Komerční banka (45317054), Česká
  spořitelna, UniCredit Bank (64948242). Almost certainly their own company
  fleets; their *leasing* subsidiaries are already in A1.
- **Name collisions** — MARENT DEMOLICE (26390931), RAMIRENT (scaffolding),
  STROJRENT, Ministerstvo financí ("financ"), Easy Estate Finance (real estate),
  Provident Financial (unsecured cash loans, own fleet).
- **Machinery / trailer rental** — Trailer & Truck rental, Truck to Rent,
  HeavyRent Logistics. Relevant only if the `rental` kind is extended to trucks.

## A6 — Test VINs (verified 2026-08-06 against the live cache)

Every row was run through the real `lookupVehicleFromCache()` + `buildFinancing()`
and shows the actual output, not an expectation.

### Positive — badge / alert / PDF section

| VIN | Vehicle | Result |
|---|---|---|
| `TMBJB9NSXP8052762` | Škoda Kodiaq | **active** · ŠkoFIN 2023 → dosud · red alert + checklist |
| `VF1VY0K0NUC340814` | Renault Koleos | **active** · MONETA Auto 2025 → dosud |
| `VF1B4010506373727` | Renault 5 | **active** · UniCredit Leasing since 1992 — the *stale-record* case |
| `W0L0SDL6884006265` | Opel Corsa | **active** · GMAC **v likvidaci** — dissolved financier still current owner |
| `TMBGE61ZXB2143125` | Škoda Octavia | **active fleet** · ARVAL 2011 → dosud |
| `WV1ZZZ2KZ8X038187` | VW Caddy (N1) | **active fleet** · Ayvens 2007 → dosud |
| `KMHBT51HP5U342877` | Hyundai Getz | past leasing · ČSOB 2005–2008 |
| `TMBGE61ZXB2144405` | Škoda Octavia | past, **2 kinds** · Credium → BUSINESS LEASE (merged spells) |
| `KNEDC241236154582` | Kia | past, **financed twice** · CASPER → ESSOX |
| `WF0LXXGBFLYT27688` | Ford Transit (N1) | past, **financed twice** · ŠkoFIN → ČSOB |
| `TMBJP6NJ2KZ030684` | Škoda Fabia | **two ŠkoFIN spells with a gap** — must stay 2 records, not merge |
| `TMBAJ7NEXJ0124597` | Škoda Octavia | **fleet then active leasing** · ARVAL past + ŠkoFIN current |
| `TMBJR7NPXM7036509` | Škoda Superb | **rental + leasing** · CAR4WAY 2020–2024 then ŠkoFIN |
| `TMB10M00LH3408264` | Škoda 105 | rental, current owner — see *known limitation* below |
| `WF0FXXGBBFNT09806` | Ford Sierra | past rental · Hertz 1995 |
| `VF1BZ1U0646120611` | Renault Mégane | past rental · Avis 2012 |
| `YV2J4CKC03B325019` | Volvo FM9 (N3) | truck financing · TRATON |
| `XLRTE47MS0E896897` | DAF XF105 (N3) | truck financing · PACCAR |
| `VF634FPA000000954` | Renault Kerax (N3G) | truck financing · VFS Volvo |
| `TK923525862PP7222` | Paragan trailer (O2) | past leasing on a **trailer** · ČSOB |

### Negative — must show NOTHING

| VIN | Why it's a trap | Result |
|---|---|---|
| `TMBNY46Y243902401` | CAR4WAY as **operator only** | no record ✓ |
| `TMBJB16Y423470972` | CAR4WAY as **operator only** | no record ✓ |
| `TMBDM21Z6B2141614` | AURES (AAA Auto / Mototechna) owned it | no record ✓ |
| `U6YJE55258L024183` | AURES owned it | no record ✓ |
| `WF0JXXGAJJAA52841` | **CARent, a.s.** — dealer whose name reads as a rental | no record ✓ |
| `TMBMD25J895037638` | Porsche Inter Auto — importer first registration | no record ✓ |
| `TMBADA300L0112729` | private owners only (also `ZÁNIK` + rollback) | no record ✓ |
| `SMTTE5855R8323943` | private owners only | no record ✓ |

### Mixed — proves the allowlist discriminates

| VIN | Result |
|---|---|
| `TMBNY46Y454291931` | CARent (dealer) owned it → **not** flagged; only ŠkoFIN 2006–2009 appears |
| `TMBJX41U468834257` | Škoda Auto (factory) owned it → **not** flagged; only MONETA Auto appears |

### Renamed IČO — SOLVED 2026-08-08 with `since`

`TMB10M00LH3408264` is a **Škoda 105** whose current owner is IČO 25131401,
which trades as CAR4WAY today. The record is literally true (that IČO owns the
car), but the 1999 start date predates the carsharing business, so "ex-vozidlo
z půjčovny" overstated it.

Fixed by adding an optional `since` to a company entry: the date the IČO started
doing *this* business, taken from the ARES VR name history
(`ekonomicke-subjekty-vr`, `obchodniJmeno` with `datumZapisu`/`datumVymazu`).
Ownership that **started** before it is skipped — a car bought by AUTOSALON LOUDA
in 1999 did not become a carsharing car when the same IČO renamed on 2013-10-03.
Undated ownership is skipped too, erring toward making no claim.

**25 of 205 entries carry a `since`; the rule drops ~4.0% of their owner records
(5,930 of 148,002).** Crucially it is set ONLY for a change of *business* — a
rename inside the same trade (OB Leasing → ČSOB Leasing, ALD Automotive → Ayvens,
s Autoleasing → Leasing ČS, Scania Finance → TRATON) gets none, or genuine old
records would be lost. The public list shows the date in a "Záznamy sledujeme od"
column so the exclusion is visible rather than silent.

Verified: `TMB10M00LH3408264` and `TMB10M00LH3478841` now return no record at
all, while `TMBJR7NPXM7036509` keeps its genuine 2020–2024 CAR4WAY spell.

Still open at a much smaller scale: an ownership spell that *straddles* the
rename is attributed to the earlier business (skipped). Conservative on purpose.

## A5 — Ready-to-paste skeleton

```ts
// api/_financingCompanies.ts
export type FinancingKind = 'leasing' | 'fleet' | 'rental'

/**
 * Curated IČO → financing company. Runtime matching is BY IČO ONLY: the registry's
 * `nazev` is never read (GDPR — an OSVČ name is personal data), and an allowlist
 * means dealers/importers can never be mislabelled as financing. Regenerate with
 * the query in docs/plans/2026-08-06-001-feat-leasing-check.md. Never delete an
 * entry — historic owner rows still point at dissolved companies.
 */
export const FINANCING_COMPANIES: Record<string, { name: string; kind: FinancingKind }> = {
  '45805369': { name: 'ŠkoFIN s.r.o.', kind: 'leasing' },
  '63998980': { name: 'ČSOB Leasing, a.s.', kind: 'leasing' },
  // … A1 / A2 / A3 above
}
```
