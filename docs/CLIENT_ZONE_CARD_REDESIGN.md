# Plan — Client Zone Vehicle Card Redesign

## Context

The vehicle card on `/klientska-zona` (`src/pages/ClientZonePage.tsx`) currently dumps every piece of metadata into a stack of identical `<p class="mb-1 text-muted">` rows: brand, VIN, TP, ORV, STK date, then a column of plain `<a>` action links. The result is a wall of grey text where nothing is scannable — VIN looks the same weight as STK date, action links blend with metadata, and the only visual hierarchy is the `.plate-title` at the top.

This plan replaces that flat list with a hierarchy that matches how users actually scan a vehicle card: **what is it → when's the next deadline → what can I do with it**.

## Current state (excerpt from rendered card)

```html
<h3 class="plate-title"><span>Auto bílé</span></h3>
<p class="mb-1 text-muted">ŠKODA  / 5J</p>
<p class="mb-1 text-muted">VIN: TMBJN6NJ2GZ041911</p>
<p class="mb-1 text-muted">TP: UG681823</p>
<p class="mb-1 text-muted">ORV: UBA050252</p>
<p class="mb-1 text-muted">STK do: <span style="color: green;">21. 7. 2027</span></p>
<div class="mt-2">
  <a class="link-primary d-block">Info z registru vozidel →</a>
  <a class="link-primary d-block">Prověřit historii vozidla ➜</a>
  <a class="link-primary d-block">Sjednat pojištění →</a>
</div>
```

**Readability problems:**

1. **No hierarchy.** Brand/model deserves more weight than identification numbers. STK date deserves the most weight — it's the only actionable info.
2. **Identification numbers (VIN/TP/ORV) are wall-of-text.** Long alphanumeric strings benefit from monospaced/tabular-nums treatment and a label/value column layout.
3. **STK date uses raw `color: green`** (literal CSS color, not a token). Loses both consistency with the brand palette and the warning state when STK is near expiry.
4. **Three action links stack identically.** They have different roles: one is internal navigation (registry detail), one is an external paid affiliate (Cebia), one is a CTA (sjednat pojištění). They shouldn't look identical.
5. **Bootstrap `.text-muted`** instead of `--ink-500` token, so links and metadata don't visually align with the rest of the site's brand-aligned typography.

## Proposed redesign

### A. Vehicle identification block — definition-list layout

Replace the stack of `<p>` rows with a `<dl>` using the existing `.dl-grid` primitive from `index.css`. Two columns: left = small uppercase label, right = value. Numeric identifiers use `.num` (tabular-nums).

```jsx
<dl className="dl-grid mt-3 mb-3">
  {(vehicle.brand || vehicle.model) && (
    <>
      <dt>Značka / Model</dt>
      <dd>{`${vehicle.brand ?? ''} ${vehicle.model ?? ''}`.trim() || '—'}</dd>
    </>
  )}
  {vehicle.vin && (
    <>
      <dt>VIN</dt>
      <dd className="num">{vehicle.vin}</dd>
    </>
  )}
  {vehicle.tp && (
    <>
      <dt>Číslo TP</dt>
      <dd className="num">{vehicle.tp}</dd>
    </>
  )}
  {vehicle.orv && (
    <>
      <dt>Číslo ORV</dt>
      <dd className="num">{vehicle.orv}</dd>
    </>
  )}
</dl>
```

Drops every `text-muted` `<p>`. Uses the same definition-list primitive as `VehicleInfo.tsx` for cross-page visual consistency.

### B. STK date — pull out as a prominent stat

The STK date is the single most important piece of info on this card — it's the whole reason a user saves a vehicle. Promote it to its own row above the identification block, styled as a "stat".

```jsx
<div className="stk-stat" data-status={isExpiringSoon ? 'warn' : isExpired ? 'alert' : 'ok'}>
  <span className="stk-stat__label">STK do</span>
  <span className="stk-stat__value num">{techInspection}</span>
</div>
```

CSS in `index.css`:

```css
.stk-stat {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background-color: var(--brand-50);
  margin: var(--space-3) 0;
}
.stk-stat__label { font-size: 0.8125rem; color: var(--ink-500); text-transform: uppercase; letter-spacing: 0.05em; }
.stk-stat__value { font-size: 1.0625rem; font-weight: 700; color: var(--brand-700); }
.stk-stat[data-status="warn"] { background-color: var(--warn-50); }
.stk-stat[data-status="warn"] .stk-stat__value { color: var(--warn-700); }
.stk-stat[data-status="alert"] { background-color: var(--alert-50); }
.stk-stat[data-status="alert"] .stk-stat__value { color: var(--alert-700); }
```

Status logic — extend the existing `stkColor` calculation in `ClientZonePage.tsx`:

- expired → `alert`
- valid AND within 60 days → `warn`
- otherwise → `ok`

Replaces the inline `style={{ color: 'green' }}`. Status is now semantic (data-attribute) and themable.

### C. Action links — split into primary vs secondary

The three links have different roles. Treat them differently:

- **"Info z registru vozidel"** — primary internal navigation. Keep as a brand-coloured link with right-arrow icon (`<Icon name="chevron-right">`).
- **"Sjednat pojištění"** — secondary CTA. Same treatment as primary link.
- **"Prověřit historii vozidla"** — external affiliate link. Use `<Icon name="external-link">` to signal "leaves the site", de-emphasise visually (slightly muted, smaller font) so it doesn't compete with internal navigation. Disclose affiliate nature on hover via `title`.

```jsx
<ul className="vehicle-actions">
  {(vehicle.vin || vehicle.tp || vehicle.orv) && (
    <li>
      <Link to={...}>
        <Icon name="chevron-right" size={16} />
        Info z registru vozidel
      </Link>
    </li>
  )}
  <li>
    <Link to={`/sjednat-pojisteni?vin=${vehicle.vin}`}>
      <Icon name="chevron-right" size={16} />
      Sjednat pojištění
    </Link>
  </li>
  <li className="vehicle-actions__affiliate">
    <a href={cebiaUrl} target="_blank" rel="noopener noreferrer" title="Partnerský odkaz">
      <Icon name="external-link" size={14} />
      Prověřit historii vozidla
    </a>
  </li>
</ul>
```

CSS:

```css
.vehicle-actions { list-style: none; padding: 0; margin: var(--space-4) 0 0; display: flex; flex-direction: column; gap: var(--space-2); }
.vehicle-actions a { color: var(--brand-700); text-decoration: none; display: inline-flex; align-items: center; gap: var(--space-2); font-weight: 500; }
.vehicle-actions a:hover { color: var(--brand-600); text-decoration: underline; }
.vehicle-actions__affiliate a { color: var(--ink-500); font-size: 0.875rem; }
.vehicle-actions__affiliate a:hover { color: var(--ink-700); }
```

### D. Reminders section divider

After the action links, the `<div className="mt-3"><h4>Upozornění</h4>...</div>` section currently runs into the metadata above with no separator. Add a 1px `--ink-300` horizontal divider, then a proper `.heading-accent`-styled H4.

```jsx
<hr style={{ borderTop: '1px solid var(--ink-300)', margin: 'var(--space-5) 0 var(--space-4)' }} />
<h4 className="h6"><span className="heading-accent">Upozornění</span></h4>
```

Same treatment for "Stav tachometru" further down.

### E. "Přidat upozornění" form — improve label readability

Current form uses Bootstrap `<select>` and `<input>` with default styling. After Phase 1 brand work, these already pick up the new tokens via `--bs-border-color` etc., so visually OK. But the form labels (`<label className="form-label">`) are generic. Apply consistent label sizing matching `.dl-grid dt`:

```css
.card-body .form-label { font-size: 0.875rem; color: var(--ink-700); font-weight: 500; }
```

Minor touch, single CSS rule, no JSX change.

## Files to modify

| File | Change |
|---|---|
| `src/pages/ClientZonePage.tsx` | Replace `<p class="mb-1 text-muted">` stack with `<dl class="dl-grid">`. Add the STK stat row. Restructure action links into `<ul class="vehicle-actions">` with icons. Add HR + heading-accent dividers before sub-sections. |
| `src/index.css` | Add `.stk-stat`, `.vehicle-actions` CSS blocks (~30 lines). |

No new dependencies. No new components. All primitives (`.dl-grid`, `.num`, `.heading-accent`, `<Icon>`) already exist.

## Verification

1. `npm run build` — clean compile.
2. `vercel dev` and visit `/klientska-zona` (logged in, with at least one saved vehicle).
3. Check at 390px (mobile), 768px (tablet), 1280px (desktop):
   - Card no longer reads as a wall of grey text.
   - STK date is the visually heaviest element after the title.
   - VIN/TP/ORV align in a clean two-column grid, monospaced.
   - "Prověřit historii" sits visually separate (smaller, muted) from internal navigation links.
4. With a vehicle whose STK is within 60 days, confirm the stat row turns amber. With expired STK, red.
5. Lighthouse on the page — Accessibility should stay ≥ 95 (no regressions).

## Out of scope

- No data-model changes. Existing `ClientVehicle` type unchanged.
- No new pages, no new components.
- No changes to the reminder or odometer sub-sections beyond the divider/heading-accent touch.
- No changes to the "Upravit název / Odebrat" buttons (already moved to a separate row in this session's previous fix).

## Effort & risk

~1.5 hours including visual QA. Low risk — purely presentational, no logic changes.

## Status

✅ Shipped (2026-05-13).
