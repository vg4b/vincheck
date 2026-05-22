# Insurance lead-gen — implementation plan

**Status:** Phases 1–3 + 5 implemented (2026-05-19); Phase 4 = dashboard only.
**Email promo enabled**; eSpolupráce sign-off pending — see Compliance.
**Goal:** turn the insurance reminder moment into a measurable lead-gen revenue stream,
and fix the awkward `/sjednat-pojisteni` flow while doing it.

## Background

The real asset of VIN Info.cz is **Moje VINInfo**: logged-in users who have told us, per
vehicle, exactly when their `povinne_ruceni` and `havarijni_pojisteni` come due. The
reminder email arrives at the exact moment of need and is opened because it is genuinely
useful. That is the highest-intent surface we have — insurance is the flagship monetization.

### What is wrong today

The current flow (`src/pages/SjednatPojisteniPage.tsx`):

- **3-step wizard** (type → vehicle → summary) that ends by `window.open`-ing the CSOB
  kalkulačka in a new tab plus an upsell modal.
- **Step 2 collects VIN/SPZ that is never used.** `csob.getVehicleKalkulackaUrl(kind, data1)`
  takes only the insurance kind + a tracking string. The vehicle the user typed is discarded;
  the summary even says "Bez předvyplnění." Step 2 is pure friction.
- **Fragile popup handling** — new-tab open, then a modal, then popup-blocked fallbacks
  (retry / copy-link). A lot of code wrapping a single outbound link.
- **Promise/delivery mismatch** — the page copy says "Porovnejte nabídky" but sends the
  user to *one* insurer's calculator (CSOB only).
- The reminder email's `getPromoBlockHtml` funnels insurance reminders into
  `/sjednat-pojisteni?vin=…` — good intent timing wasted on a wizard that drops the VIN.

## Decisions taken

- **Partner: ePojištění** (comparison aggregator) is the primary insurance offer — real
  price comparison, recurring yearly per user. Partnership is **signed** (HasOffers /
  go2cloud, `aff_id=6692`).
- **Integration: embedded iframe.** ePojištění supplies iframe creatives, not a plain
  click-out link. The comparison happens **inline on our page** — no popup, no leaving the
  site, no popup-blocker dance.
- **`/sjednat-pojisteni`: single-screen page** — replaces the 3-step wizard; it becomes the
  one canonical host for the ePojištění iframe.
- **CSOB** stays as a *secondary* offer (eHub coupon strip on the havarijní page); it is no
  longer the primary insurance funnel.

## Partner reference — ePojištění

iframe `src` = `aff_c?offer_id=2&aff_id=6692` + `aff_sub` + `url_id` + `file_id`
(+ optional `use-style`). `url_id` selects the form; `file_id` is the creative ID for
reporting. Values are exactly those the eSpolupráce portal's tracking-link builder emits:

| Insurance kind | `url_id` | `file_id` |
|---|---|---|
| Povinné ručení (POV) | `1401` | `40146` |
| Havarijní pojištění (HAV) | `1856` | `40694` |

Full `src` example (POV, `vehicle_card`):
`…/aff_c?offer_id=2&aff_id=6692&aff_sub=vehicle_card&url_id=1401&file_id=40146&use-style=https://cdn.eoit.cz/css/<id>`

**Sub-id tracking:** `&aff_sub=<placement>` attributes each lead to the surface that drove
it (go2cloud surfaces `aff_sub` in reporting). Placement codes — see Phase 3.

**Iframe height:** fixed per kind (`IFRAME_HEIGHT`: POV 2200 px, HAV 2500 px) with
`scrolling="yes"`. ePojištění's `iframeResizer.js` is **not** loaded — its appended
scroll-sync addon runs a `setInterval` that keeps calling into a removed `#epIframe` after
SPA navigation, producing a recurring cross-origin "Script error."

### Formstyler — brand-matching the iframe form

The ePojištění iframe form can be restyled to the VIN Info.cz brand via eSpolupráce's
**Formstyler**. It produces a CSS link that the form loads via the `use-style` custom
variable — already wired in code (`EPOJISTENI_FORM_STYLE_URL` in `affiliateCampaigns.ts`;
empty string = ePojištění's default style).

**Steps (in the eSpolupráce portal):**

1. Log in → menu **Rady a Návody → Formstyler**.
2. **Vytvořit nový styl** — opens the editor with a live preview.
3. Set **Název stylu** (e.g. `VIN Info.cz`) and each color per the table below.
   **Velikost**: start at `L`; check the preview and bump up/down if the form overflows.
4. **Uložit**.
5. **Výpis všech stylů** → copy the generated CSS link (`cdn.eoit.cz/css/…`).
6. Hand the link over → it goes into `EPOJISTENI_FORM_STYLE_URL`; `getIframeUrl` then
   appends `&use-style=<link>` to both iframes. The link is appended **raw / un-encoded**
   — exactly as the portal's tracking-link builder emits it; a URL-encoded value does not
   reach the form's `StyleUrl` field.

**Color mapping** — Formstyler field → brand token (values from `docs/DESIGN.md`). These are
the fields the current editor actually shows; the 2021 PDF guide is outdated.

| Formstyler field | Brand token | Hex |
|---|---|---|
| Velikost | — | `L` (then verify in preview) |
| Pozadí formuláře | `--surface` | `#ffffff` |
| Pozadí inputů | `--surface` | `#ffffff` |
| Pozadí souhrnu | `--brand-50` | `#eaf4eb` |
| Navigační prvky | `--brand-600` | `#2f7a3e` |
| Barva tlačítka | `--brand-600` | `#2f7a3e` |
| Barva textu tlačítka | white | `#ffffff` |
| Hover barva tlačítka | `--brand-700` | `#22612f` |
| Text | `--ink-700` | `#334155` |
| Barva nadpisů | `--ink-900` | `#0f172a` |
| Barva ohraničení | `--ink-300` | `#cbd5e1` |
| Barva placeholderu | `--ink-500` | `#64748b` |

## Compliance — eSpolupráce / ePojištění campaign terms

Hard requirements from the campaign page; violations risk commission loss or blocking.

- **Partner-insurer list must be on the site.** "Je nutné mít na webových stránkách
  umístěný seznam pojišťoven." Implemented: `epojisteni.partnerInsurers` (16 insurers,
  source `epojisteni.cz/pojistovny`) renders at the bottom of `/sjednat-pojisteni`.
- **Email as a traffic channel needs sign-off.** The campaign lists mailing as
  allowed-but-pre-approved; unapproved commercial email risks **10 000 Kč per violation**.
  Our reminder emails are transactional (opted-in), use our own wording, and link to our
  own `/sjednat-pojisteni` page — but they carry `aff_sub=email_reminder`, so the traffic
  is self-reported to eSpolupráce. **Status:** the `email_reminder` promo block is
  **enabled** in `getPromoBlockHtml`. Before the next reminder cron batch, the clarification
  email to `podpora.espoluprace@srovnejto.cz` must go out (transactional reminder emails
  linking to our own comparison page — confirm acceptable). If eSpolupráce objects, set
  the `povinne_ruceni` / `havarijni_pojisteni` branch back to `return ''`.
- **No keyword bidding** on ePojištění brand terms (SEM) — not codebase-relevant.
- On-site web placements need no pre-approval; the embedded iframe is ePojištění's own
  creative. Social / incentive traffic is not allowed.

**Payouts (reference):** povinné ručení lead 100 Kč CPA · havarijní closed contract
650 Kč · cestovní 15 % CPS. Conversion measurement is server postback with Transaction ID
on ePojištění's side — nothing to implement.

---

## Phase 1 — Insurance offer config

A single config block so every surface builds the iframe the same way and a future partner
swap is one change.

**`src/config/affiliateCampaigns.ts`** — add an insurance section:

- `InsuranceKind = 'povinne' | 'havarijni'` (ePojištění supplies exactly these two creatives;
  the old "oboje" option goes away — a povinné-ručení comparison upsells havarijní anyway).
- `InsurancePlacement` — string-union of placement codes (Phase 3 table).
- `epojisteni` partner object: `displayName`, `partnersUrl`, `partnerInsurers`,
  `resizerScriptUrl`, and `EPOJISTENI_URL_IDS` (`{ povinne: '1401', havarijni: '1856' }`).
- `epojisteni.getIframeUrl(kind, placement)` → assembles the go2cloud URL with
  `aff_sub=<placement>` + `url_id`. **The one function the page calls.**

No `api/` mirror is needed: with the iframe model the email never builds an affiliate URL
(email clients block iframes). Emails just link to `/sjednat-pojisteni` with query params;
the page builds the iframe. This is simpler than the click-out model would have been.

## Phase 2 — Single-screen `/sjednat-pojisteni` with embedded iframe

Rewrite `SjednatPojisteniPage.tsx` as one screen. **Delete:** `STEPS`, `step` state,
`showKalkulackaModal`, `kalkulackaPopupBlocked`, `openKalkulackaInNewTab`, the modal JSX,
the body-overflow and Escape `useEffect`s, `REMINDER_MODAL_COLUMNS` / `ReminderModalLine`
(or demote to the static block below).

New layout:

- **Insurance type toggle** — Povinné ručení / Havarijní pojištění (`btn-check` pattern).
  Default povinné. Pre-selected from `?typ=` (`povinne` | `havarijni`).
- **Embedded iframe** — `<iframe id="epIframe" src={epojisteni.getIframeUrl(typ, placement)}>`.
  Switching the toggle swaps the `src` between the two `url_id`s. `placement` derived from
  `?src=` (defaults to `sjednat_page`). `title` set for a11y.
- **No CTA button, no popup** — the comparison form *is* the page content.
- Keep the **"Co získáte"** benefits panel as supporting copy.
- Below the iframe, a **static** "Nechte se upozornit na termíny" block (the content the old
  modal showed) — page content that never hijacks anything.
- The old `?vin=` / `?spz=` params are dropped (the iframe collects vehicle data itself).

**iframe height** — fixed per kind (`IFRAME_HEIGHT`: POV 2200 px, HAV 2500 px) with
`scrolling="yes"` so the form stays fully reachable on any width. ePojištění's
`iframeResizer.js` is deliberately not used — its `setInterval` scroll-sync addon throws
a recurring "Script error." after SPA navigation.

**CSP** — checked: no Content-Security-Policy is set (`vercel.json`, `index.html`), so the
iframe is not blocked. If a CSP is ever added later, `espolupracecz.go2cloud.org` (and the
domain the creative redirects to) must go in `frame-src`.

## Phase 3 — Wire the high-intent surfaces

Every surface points at `/sjednat-pojisteni`; each carries a distinct `?src=` placement so
the resulting lead is attributable.

| Placement (`aff_sub`) | Surface | Link |
|---|---|---|
| `email_reminder` | povinné/havarijní reminder email | `/sjednat-pojisteni?typ=<kind>&src=email_reminder` |
| `vehicle_card` | vehicle card — generic action link | `/sjednat-pojisteni?typ=povinne&src=vehicle_card` |
| `vehicle_card_due` | vehicle card — contextual deadline CTA (Phase 5) | `/sjednat-pojisteni?typ=<kind>&src=vehicle_card_due` |
| `client_zone_benefits` | Moje VINInfo „Výhody" tab | `/sjednat-pojisteni?typ=povinne&src=client_zone_benefits` |
| `sjednat_page` | direct nav to the page | (default) |
| `povinne_page` | `/povinne-ruceni` CTAs | `/sjednat-pojisteni?typ=povinne&src=povinne_page` |
| `havarijni_page` | `/havarijni-pojisteni` CTAs | `/sjednat-pojisteni?typ=havarijni&src=havarijni_page` |
| `vehicle_info` | public VIN lookup result | `/sjednat-pojisteni?typ=povinne&src=vehicle_info` |
| `footer` / `nav` | global navigation | `/sjednat-pojisteni?src=footer` / `?src=nav` |

1. **Reminder email** — `api/_reminderEmail.ts`, `getPromoBlockHtml`. For `povinne_ruceni`
   and `havarijni_pojisteni` the promo block links to
   `/sjednat-pojisteni?typ=<kind>&src=email_reminder` (kind from `reminderTypeRaw`) — one
   tasteful, benefit-framed message. Enabled; gated by the eSpolupráce sign-off in
   Compliance.
2. **Vehicle card** — `ClientZonePage.tsx` (two card layouts). The "Sjednat pojištění" links
   point at `/sjednat-pojisteni?typ=povinne&src=vehicle_card`; the now-pointless `?vin=` is
   dropped. Modest action link, not over-commercialized.
3. **Client-zone „Výhody" tab** — `ClientZonePage.tsx` „Pojištění vozidla" card repointed to
   `/sjednat-pojisteni?typ=povinne&src=client_zone_benefits`.
4. **`PovinneRuceniPage.tsx` / `HavarijniPojisteniPage.tsx`** — both CTAs on each page now
   link to `/sjednat-pojisteni?typ=<kind>&src=<kind>_page`. The CSOB eHub coupon strip stays
   as a clearly-secondary offer. The CSOB kalkulačka helper (`csob.getVehicleKalkulackaUrl`,
   `vehicleKalkulackaTagline`, the `CsobVehicleKalkulackaKind` type) is now unused and
   removed from `affiliateCampaigns.ts`.
5. **`VehicleInfo.tsx`**, **`Footer.tsx`**, **`Navigation.tsx`** — repointed to the new page
   with the appropriate `?typ=` / `?src=`.

## Phase 4 — Measurement

Conversions are attributed in the **ePojištění / go2cloud dashboard** by `aff_sub`
placement. No internal tracking endpoint needed for v1 — the network reports clicks → leads
→ conversions per sub-id. Revisit only if their reporting proves too coarse.

## Phase 5 — contextual card CTA  *(implemented)*

The intent-timing payoff. In `ClientZonePage.tsx`, `getUpcomingInsuranceDeadline()` scans
each vehicle's reminders for the nearest **non-done** `povinne_ruceni` / `havarijni_pojisteni`
due within 60 days (`INSURANCE_DEADLINE_WINDOW_DAYS`). When one exists, the vehicle card
renders an `InsuranceDeadlineCallout` — "&lt;typ&gt; končí za X dní. Porovnejte si nabídky a
ušetřete." + a "Porovnat nabídky" button — and the generic "Sjednat pojištění" action link
is hidden (one offer per card, not two). The CTA carries the matching `typ` and placement
`vehicle_card_due`, so its conversion rate is measured separately from the generic
`vehicle_card` link.

## Risks

- **Over-commercialization.** Reminders are trusted because they are useful. One tasteful,
  benefit-framed offer per reminder — never more.
- **iframe height / mobile.** Fixed `IFRAME_HEIGHT` per kind + `scrolling="yes"`. On very
  tall (mobile) renders the iframe gets an internal scrollbar — acceptable; revisit with a
  self-managed `postMessage` height listener only if it becomes a real complaint.
- **Creative / `url_id` changes.** `url_id`s (1401 / 1856) are ePojištění's; if they rotate
  the form, re-copy from "Získat kód". Kept in one config constant — a one-line fix.

## Suggested commits

1. `feat(affiliate): ePojištění insurance offer config + iframe URL builder`
2. `refactor(sjednat-pojisteni): single-screen page with embedded ePojištění iframe`
3. `feat(email): point insurance reminders at the comparison page`
4. `feat(client-zone): repoint vehicle-card insurance CTA with placement tracking`
5. `refactor(havarijni-pojisteni): repoint CTAs to the comparison page`
6. `feat(client-zone): contextual insurance CTA on vehicle cards with a near deadline`
