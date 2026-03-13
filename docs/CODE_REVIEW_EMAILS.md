# Code Review: Email Flow (Reminder + Marketing)

## Scope
Verify that recent changes (getBaseUrl → _utils, VERCEL_PROJECT_PRODUCTION_URL, affiliate promo blocks, vehicleVin) do not break email delivery.

---

## ✅ Verified

### 1. Reminder email flow
- **Cron** (`api/cron/send-reminders.ts`): Passes `vehicleVin: reminder.vehicle_vin` ✅
- **Client** (`api/client/reminders.ts`): Fetches `vin` from vehicles, passes `vehicleVin: vehicle?.vin ?? null` ✅
- **Schema**: `vehicles.vin` exists in `_db.ts` ✅
- **Params**: `SendReminderEmailParams` includes `vehicleVin`, passed to `generateReminderEmailHtml` ✅

### 2. getBaseUrl() consolidation
- Centralized in `api/_utils.ts`, used by `_reminderEmail`, `send-marketing`, `preview-reminder-email` ✅
- Fallback chain: `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` → `localhost` ✅

### 3. Unsubscribe URLs
- Reminder: `${getBaseUrl()}/api/email/unsubscribe?token=...` ✅
- Marketing: same pattern ✅
- Unsubscribe handler does not use getBaseUrl (renders HTML only) ✅

### 4. Affiliate promo blocks (conditional)
- `povinne_ruceni`, `havarijni_pojisteni` → sjednat-pojisteni link (with VIN when available) ✅
- `stk` + hasVin → Cebia affiliate URL ✅
- `servis`, `prezuti_pneu`, `dalnicni_znamka`, `jine` → klientska-zona?tab=benefits ✅

### 5. Other email flows (unchanged)
- `sendVerificationEmail` in `_email.ts` – no getBaseUrl, no changes ✅
- `sendEmail` core – unchanged ✅

---

## ⚠️ Prerequisites

### Vercel: Automatically expose System Environment Variables
`VERCEL_PROJECT_PRODUCTION_URL` is a [Vercel system variable](https://vercel.com/docs/environment-variables/system-environment-variables#vercel_project_production_url). It must be enabled:

**Project → Settings → Environment Variables → ☑ Automatically expose System Environment Variables**

If disabled, `getBaseUrl()` falls back to `VERCEL_URL` (deployment URL, e.g. `vincheck-xxx.vercel.app`), which caused the original bug (links in emails pointed to preview URLs instead of production).

---

## ⚠️ Minor observations

### 1. Hardcoded URL in reminder footer (line 112)
```html
<a href="https://vininfo.cz" ...>VIN Info.cz</a>
```
Static branding link. Could use `baseUrl` for consistency, but low impact.

### 2. XSS in user-provided fields
`note` (and theoretically `vehicleName` from DB) is interpolated into HTML without escaping. If `note` contains `<script>`, it could execute. Consider escaping HTML entities for user inputs. Reminder `type` comes from a controlled enum.

### 3. VIN validation
`hasVin = vin && vin.length === 17` – correct for VIN. SPZ (5–8 chars) would not qualify for Cebia/insurance prefill; that's intentional (sjednat-pojisteni expects VIN or SPZ, Cebia expects VIN).

---

## Testing checklist

- [ ] **Preview**: `GET /api/dev/preview-reminder-email?type=povinne_ruceni&vin=WF0FXXWPCFHD05923` returns HTML with correct links
- [ ] **Cron**: Run send-reminders cron, confirm emails are sent and links use production URL
- [ ] **Client**: Create reminder with email_enabled, confirm immediate email with correct baseUrl
- [ ] **Unsubscribe**: Click unsubscribe in reminder email, confirm it works
- [ ] **Marketing**: Send test marketing email, confirm unsubscribe URL works
