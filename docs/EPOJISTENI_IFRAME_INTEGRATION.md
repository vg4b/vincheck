# Integrating the ePojištění (eSpolupráce) insurance-comparison iframe

How the vehicle-insurance comparator is embedded on VIN Info.cz, written so it
can be **replicated in another repo** with the same behaviour. Self-contained —
nothing here imports from this repo.

## What it is

An **iframe creative** served by the **eSpolupráce** affiliate network
(operated by **Elephant Orchestra, s.r.o.**, IČO 03272974) for the advertiser
**ePojištění.cz**. Tracking runs through HasOffers/go2cloud
(`espolupracecz.go2cloud.org`). One creative per insurance type.

## The iframe URL

```
https://espolupracecz.go2cloud.org/aff_c?offer_id=2&aff_id=<AFF_ID>&aff_sub=<PLACEMENT>&url_id=<URL_ID>&file_id=<FILE_ID>&use-style=<FORM_STYLE_URL>
```

| Param | Meaning | Value (VIN Info.cz) |
|---|---|---|
| `offer_id` | eSpolupráce offer | `2` |
| `aff_id` | **your** publisher/affiliate ID | `6692` |
| `aff_sub` | lead attribution — where the embed lives | e.g. `sjednat_page`, `nav`, `vehicle_info` |
| `url_id` | which entry form (per type) | POV `1401` · HAV `1856` |
| `file_id` | creative ID (reporting, per type) | POV `40146` · HAV `40694` |
| `use-style` | Formstyler CSS to brand the form | `https://cdn.eoit.cz/css/38be4807-5ee3-44b1-802b-543298d7a4c1` |

Per insurance type:

| Type (`kind`) | `url_id` | `file_id` | Creative size | iframe height to use |
|---|---|---|---|---|
| `povinne` (POV) | `1401` | `40146` | 1000×2100 | **2200 px** |
| `havarijni` (HAV) | `1856` | `40694` | 1000×2400 | **2500 px** |

### ⚠️ Two gotchas

1. **`use-style` must be appended as a RAW (un-encoded) URL** — exactly as the
   eSpolupráce portal generates the tracking link. If you URL-encode it, the form
   ignores it (`StyleUrl` won't populate). So build the rest with
   `URLSearchParams`, then concatenate `&use-style=<url>` manually.
2. **Do NOT load `iframeResizer.js`.** ePojištění offers it for auto-height, but
   its add-on keeps calling `setInterval` on the (now-removed) `#epIframe` after
   you navigate away → repeated "Script error". Use a **fixed height per type**
   (table above) + `scrolling="yes"` so the whole form is reachable on mobile.

### Where the IDs come from

`aff_id`, `url_id`, `file_id`, and the Formstyler `use-style` CSS all come from
the **tracking link you generate in the eSpolupráce portal**
(<https://affiliates.espoluprace.cz/>) for your account/campaign, and the
Formstyler (Rady a Návody → Formstyler). If the other repo uses the **same
eSpolupráce account**, reuse the values above; if it's a **different publisher**,
regenerate them — only `offer_id=2` and the host stay the same.

## React component (portable, copy-paste)

```tsx
import { useState } from 'react'

type InsuranceKind = 'povinne' | 'havarijni'

const AFF_BASE = 'https://espolupracecz.go2cloud.org/aff_c'
const OFFER_ID = '2'
const AFF_ID = '6692' // ← your eSpolupráce publisher ID
const URL_IDS: Record<InsuranceKind, string> = { povinne: '1401', havarijni: '1856' }
const FILE_IDS: Record<InsuranceKind, string> = { povinne: '40146', havarijni: '40694' }
const FORM_STYLE_URL = 'https://cdn.eoit.cz/css/38be4807-5ee3-44b1-802b-543298d7a4c1'
const HEIGHT: Record<InsuranceKind, number> = { povinne: 2200, havarijni: 2500 }

function getIframeUrl(kind: InsuranceKind, placement: string): string {
  const params = new URLSearchParams({
    offer_id: OFFER_ID,
    aff_id: AFF_ID,
    aff_sub: placement, // lead attribution (where the embed is)
    url_id: URL_IDS[kind],
    file_id: FILE_IDS[kind],
  })
  let url = `${AFF_BASE}?${params.toString()}`
  if (FORM_STYLE_URL) url += `&use-style=${FORM_STYLE_URL}` // RAW, not encoded
  return url
}

export function InsuranceComparator({ placement = 'sjednat_page' }: { placement?: string }) {
  const [kind, setKind] = useState<InsuranceKind>('povinne')
  return (
    <div>
      <div role="group" aria-label="Typ pojištění">
        <button type="button" aria-pressed={kind === 'povinne'} onClick={() => setKind('povinne')}>
          Povinné ručení
        </button>
        <button type="button" aria-pressed={kind === 'havarijni'} onClick={() => setKind('havarijni')}>
          Havarijní pojištění
        </button>
      </div>
      <iframe
        key={kind} // remount on type switch
        src={getIframeUrl(kind, placement)}
        title={kind === 'povinne' ? 'Srovnání povinného ručení' : 'Srovnání havarijního pojištění'}
        scrolling="yes"
        style={{ display: 'block', width: '100%', height: HEIGHT[kind], border: 0 }}
      />
    </div>
  )
}
```

Optional: read `?typ=havarijni` and `?src=<placement>` from the URL to preselect
the type and set `aff_sub` (that's how the cross-site entry points attribute leads).

## Plain HTML / vanilla JS (non-React repos)

```html
<iframe id="epIframe" title="Srovnání povinného ručení" scrolling="yes"
  style="display:block;width:100%;height:2200px;border:0"
  src="https://espolupracecz.go2cloud.org/aff_c?offer_id=2&aff_id=6692&aff_sub=PLACEMENT&url_id=1401&file_id=40146&use-style=https://cdn.eoit.cz/css/38be4807-5ee3-44b1-802b-543298d7a4c1"></iframe>
```

For havarijní swap `url_id=1856`, `file_id=40694`, height `2500px`. Replace
`PLACEMENT` with the source tag.

## Compliance — required before going live (don't skip)

The iframe is a **third-party embed that sets cookies**, so in the EEA it must be
**consent-gated** and **disclosed**:

1. **Gate it behind your CMP** — do not auto-load it before consent. Either
   click-to-load (placeholder + button) or, better, render only when the relevant
   consent purpose is granted (e.g. IAB TCF **Purpose 1 — "Store and/or access
   information on a device"** via `__tcfapi`), with a consent-change listener.
2. **CMP vendor** — add eSpolupráce/ePojištění as a **custom vendor** in your CMP
   (in Clickio: Vendors → Other → Add → Partner "New"; Name + Privacy URL; assign
   TCF Purpose 1) so consent is collected and disclosed.
3. **Privacy policy** — disclose **Elephant Orchestra, s.r.o.** (eSpolupráce
   affiliate network, IČO 03272974) as recipient + **ePojištění.cz** as partner,
   and note ePojištění.cz is a **separate controller** for data the user enters in
   the iframe. (Mirror the VIN Info.cz policy: Section "Affiliate sítě a
   partneři".)

## Campaign requirement

eSpolupráce requires the **list of compared insurers** to be shown on the site
(source: <https://www.epojisteni.cz/pojistovny>). VIN Info.cz lists: Allianz,
Inter Partner Assistance, Česká podnikatelská pojišťovna, ČSOB, Direct, ERV,
Generali Česká pojišťovna, Kooperativa, Maxima, MetLife, NN Životní pojišťovna,
Pillow, Slavia, Union, UNIQA, Pojišťovna VZP. Verify the current list before launch.
