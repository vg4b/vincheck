# Per-reminder-type default email-send dates

## Context

Today every reminder email defaults to **`due_date − 1 day`**, set both in the Add Reminder
form (`getDefaultEmailSendDate` in `ClientZonePage.tsx`) and in the backend POST fallback
(`api/client/reminders.ts`). That is wrong for several reminder types — e.g. **povinné
ručení** must be cancelled ~6 weeks before the prolongation date, and an **STK** slot
typically needs to be booked weeks ahead. A 1-day-before email arrives too late to act.

Goal: assign sensible defaults per `ReminderType`, **visibly display the default** in the
Add Reminder form (so users understand what's about to be saved), keep custom dates
working, and leave **existing reminders untouched** (no migration, no backfill — explicit
`email_send_at` values stay as they are).

## Defaults

| Type (`ReminderType`) | Czech label | Days before due | UI phrasing |
|---|---|---:|---|
| `stk` | Termín STK | **14** | "2 týdny před termínem" |
| `povinne_ruceni` | Povinné ručení | **56** | "8 týdnů před termínem" *(cancellation deadline is 6 weeks before prolongation — 2-week buffer)* |
| `havarijni_pojisteni` | Havarijní pojištění | **56** | "8 týdnů před termínem" *(same rationale as povinné)* |
| `servis` | Servisní prohlídka | **14** | "2 týdny před termínem" |
| `prezuti_pneu` | Přezutí pneu | **14** | "2 týdny před termínem" |
| `dalnicni_znamka` | Dálniční známka | **7** | "1 týden před termínem" |
| `jine` | Jiné | **1** | "1 den před termínem" *(preserves current behaviour as universal fallback)* |

## Architecture

A 7-entry `Record<ReminderType, number>` lives in **both** `src/` and `api/` (the
`api/tsconfig.json` `include` is scoped to `api/**`, so it cannot import from `src/`).
This is the same mirror pattern already used for `getCebiaAffiliateUrl` in
`api/_reminderEmail.ts`. Cross-reference comments in both files; values listed in the same
order to make drift obvious in review.

## Files to modify

### 1. `src/pages/ClientZonePage.tsx`

- **Add (near `reminderTypeLabels` ~L42):**

  ```ts
  // KEEP IN SYNC with api/client/reminders.ts (reminderTypeEmailLeadDays).
  const reminderTypeEmailLeadDays: Record<ReminderType, number> = {
    stk: 14, povinne_ruceni: 56, havarijni_pojisteni: 56,
    servis: 14, prezuti_pneu: 14, dalnicni_znamka: 7, jine: 1
  }

  const reminderTypeEmailLeadLabel: Record<ReminderType, string> = {
    stk: '2 týdny před termínem',
    povinne_ruceni: '8 týdnů před termínem',
    havarijni_pojisteni: '8 týdnů před termínem',
    servis: '2 týdny před termínem',
    prezuti_pneu: '2 týdny před termínem',
    dalnicni_znamka: '1 týden před termínem',
    jine: '1 den před termínem'
  }
  ```

- **Replace `getDefaultEmailSendDate`** — promote to module scope, take `type`, anchor the
  date in local time to avoid the existing UTC-rounding bug (see Risks):

  ```ts
  function getDefaultEmailSendDate(
    dueDateStr: string,
    type: ReminderType
  ): string {
    if (!dueDateStr) return ''
    const date = new Date(`${dueDateStr}T00:00:00`) // local midnight
    date.setDate(date.getDate() - reminderTypeEmailLeadDays[type])
    return date.toISOString().split('T')[0]
  }
  ```

- **Update `ReminderForm.handleSubmit`:** pass `type` to the call.

- **Update the form JSX hint:** replace the static "jinak 1 den před termínem" hint with
  a type-driven block:

  ```tsx
  {!useCustomEmailDate && (
    <div className='form-text mb-2'>
      Email se odešle <strong>{reminderTypeEmailLeadLabel[type]}</strong>
      {dueDate && (<> — {formatDate(getDefaultEmailSendDate(dueDate, type))}</>)}.
    </div>
  )}
  ```

  Re-render is automatic on `type` state change; nothing else needs `useEffect`.

### 2. `api/client/reminders.ts`

- **Add (near `reminderTypes` Set):**

  ```ts
  // KEEP IN SYNC with src/pages/ClientZonePage.tsx (reminderTypeEmailLeadDays).
  const reminderTypeEmailLeadDays: Record<string, number> = {
    stk: 14, povinne_ruceni: 56, havarijni_pojisteni: 56,
    servis: 14, prezuti_pneu: 14, dalnicni_znamka: 7, jine: 1
  }
  ```

- **Replace the POST fallback:**

  ```ts
  if (!emailSendAtValue && emailEnabledValue) {
    const leadDays = reminderTypeEmailLeadDays[type] ?? 1
    const due = new Date(`${dueDate}T00:00:00`)
    due.setDate(due.getDate() - leadDays)
    emailSendAtValue = due.toISOString().split('T')[0]
  }
  ```

  `?? 1` is defence-in-depth; `type` is already validated against `reminderTypes` upstream.

### 3. Nothing else changes

- `src/types/index.ts` — types unchanged.
- `api/_db.ts` — no schema change; `email_send_at` column has no DB default.
- `api/cron/send-reminders.ts` — reads `email_send_at` only.
- `src/utils/clientZoneApi.ts` — payload shape unchanged.
- **PATCH** branch — explicit `emailSendAt` is honored as-is, so existing rows are
  untouched on edit.
- **Reminder-list display** — the vehicle-card list stays compact; the alerts tab already
  shows `email_send_at` per row, so the value remains reachable. The new in-form display
  addresses the actual discoverability gap.

## Reused existing utilities

- `formatDate` in `src/utils/...` — already imported in `ClientZonePage.tsx`; used to
  render the computed default date in the hint.
- `reminderTypes` validation `Set` in `api/client/reminders.ts` — keeps the backend guard
  tight; no new validation needed.
- Mirror-pattern precedent: `getCebiaAffiliateUrl` in `api/_reminderEmail.ts`.

## Verification

```
npx biome check --write src/pages/ClientZonePage.tsx api/client/reminders.ts
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p api/tsconfig.json
```

Manual smoke test (`npm start`):

1. Moje VINInfo → vehicle card → expand *Upozornění* → Add Reminder form.
2. Type = *Termín STK*, due date 90 days out → hint reads
   *"Email se odešle **6 týdnů před termínem** — &lt;date 42 days before&gt;."*
3. Switch type to *Dálniční známka* → hint flips to *"1 týden před termínem — …"*.
4. Switch to *Jiné* → *"1 den před termínem"* (current behaviour preserved).
5. Save; open *Moje upozornění* tab — `email_send_at` matches the displayed default.
6. Edit an old reminder via the UI (toggle email switch); confirm its `email_send_at`
   is **not** recomputed.
7. POST `/api/client/reminders` with `type=stk`, no `emailSendAt` → row gets
   `due_date − 42 days`.
8. DST sanity: due `2026-04-01` (just after CET→CEST), `stk` → expected
   `email_send_at = 2026-02-18`.

## Risks / edge cases

- **Timezone bug** (pre-existing, latent). `new Date('YYYY-MM-DD')` parses as **UTC**
  midnight; `setDate` mutates locally and `toISOString().split('T')[0]` returns the UTC
  day → off-by-one in CET. The fix above (`${dueDate}T00:00:00` for local-midnight
  anchoring) is bundled into this change because the default value becomes user-visible.
- **`useCustomEmailDate` interaction.** Value is computed at submit time, not stored —
  toggling type while the checkbox is **off** updates the submitted value; toggling it
  **on** preserves the user's custom date across type changes. Both correct.
- **Short windows.** Picking a due date sooner than `leadDays` puts the default in the
  past; the cron sends immediately on create (existing behaviour). The new visible hint
  makes this predictable instead of surprising.
- **FE/BE map drift.** Mitigated by the cross-reference comment and identical key order;
  a future `scripts/check-reminder-defaults.ts` could diff them — out of scope.

## Out of scope

- DB migration / backfill.
- Per-row send-date display on the vehicle-card list.
- A shared package for the maps.
- Email-side (reminder email template) — content unchanged.
