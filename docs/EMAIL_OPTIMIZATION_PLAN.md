# Email Optimization Plan

Staged plan for evolving VIN Info.cz transactional emails (verification + reminders).
Ordered by **deliverability/UX impact × inverse risk**. Phase 1 (color swap to match the
new brand palette) is already shipped — see commit history on `api/_email.ts` and
`api/_reminderEmail.ts`.

**Guiding constraints:**

- Active user base exists. **Never break rendering for current recipients.**
- Every change must be reversible with a single `git revert`.
- Validate every step locally (`npm run preview:emails`) plus at least one round of
  send-to-self across Gmail + Outlook + iCloud before merging.
- Resend is the sending provider. Templates are inline-styled HTML strings in
  `api/_email.ts` and `api/_reminderEmail.ts`.

---

## Phase 2A — High value, low risk (do next, in this order)

### 1. Drop "noreply" from the sender address

**What:** Change `from: 'VINInfo <noreply@mail.vininfo.cz>'` in `api/_email.ts:35`.

**Why:** [Resend's deliverability guidance](https://resend.com/docs/dashboard/emails/deliverability-insights#don%E2%80%99t-use-%E2%80%9Cno-reply%E2%80%9D) explicitly says no-reply addresses **decrease trust** and signal one-way communication. Some inbox providers use **engagement signals (replies, forwards) to decide filter placement** — a sender that explicitly rejects replies looks like a bulk-mail bot. Real Czech users can also reply with questions; today they silently disappear.

**Implementation (shipped):**

- `from` is `'VIN Info.cz <vininfo@mail.vininfo.cz>'`.
- `reply_to` is `'vininfo@fixweb.cz'` — the existing monitored inbox shown
  in the site footer. Replies arrive somewhere a human reads them today.
- MX inbound for `mail.vininfo.cz` is already configured
  (`inbound-smtp.eu-west-1.amazonaws.com`) as a prerequisite for a future
  webhook-based reply handler. Resend inbound forwarding requires a webhook
  ([docs](https://resend.com/docs/dashboard/receiving/forward-emails)), not
  a codeless DNS-only flow — see item 2A.5 below.

**Risk:** Low. Both addresses are under your DNS. `reply_to` is a standard header — Resend supports it natively.

**Verify:** Reply to a test email from your own account, confirm it lands in the chosen inbox.

**Effort:** ~10 min including inbox verification.

**Rollback:** Single `git revert`.

---

### 2. List-Unsubscribe header (RFC 8058)

**What:** Add `List-Unsubscribe` and `List-Unsubscribe-Post` headers to the Resend payload for the reminder email.

**Why:** Gmail and Apple Mail show a **native "Unsubscribe" button next to the sender name** when the header is present. Gmail's Feb 2024 bulk-sender policy requires this for senders sending >5k/day; smaller senders get **better inbox placement** when included. Currently the unsubscribe link exists only in the body.

**Implementation:**

- `api/_email.ts` `sendEmail()` accepts an optional `headers` param.
- The reminder send (`api/_reminderEmail.ts`) passes:
  ```
  'List-Unsubscribe': `<${unsubscribeUrl}>`
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
  ```
- The existing unsubscribe URL + token are reused; no new endpoints needed.

**Risk:** Low — pure additive header. Worst case: ignored.

**Verify:** Open a delivered email in Gmail web → confirm "Unsubscribe" appears next to the sender. Check "Show original" → headers contain `List-Unsubscribe`.

**Effort:** ~15 min.

**Rollback:** Single `git revert`.

---

### 3. Preheader text

**What:** Add an invisible preview-line `<span>` as the first child of `<body>` in both templates.

**Why:** Inboxes (Gmail, Apple Mail, Outlook mobile) show a **preview line next to the subject**. Today they fall back to whatever the first body text is — for the reminder email, "Blíží se termín: …". A controlled preheader like _"Vaše STK pro Škoda Octavia končí 15. 6. 2026"_ gives the user actionable context before they click.

**Implementation:**

```html
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f5f5f5;opacity:0;">
  ${preheaderText}
</div>
```

Place immediately after `<body>`. Drive content per template:

- Verification: `"Váš ověřovací kód: ${code}"` (or generic if you'd rather not put the code in the preview line — discuss).
- Reminder: `"${reminderTypeLabel} pro ${vehicleName} – ${dueDate}"`.

**Risk:** Very low — hidden span, falls back gracefully if a client strips it.

**Verify:** Send to Gmail, check the inbox listing column.

**Effort:** ~20 min including testing the multi-property hidden-text pattern needed for Outlook (`display:none` alone isn't enough — needs the full property stack).

**Rollback:** Single `git revert`.

---

### 4. Plain-text fallback

**What:** Resend's `/emails` API accepts a `text` field alongside `html`. Provide a stripped plain-text version of each email.

**Why:** **Improves deliverability scores** at every major provider — pure-HTML emails are a small but real spam signal. Also serves accessibility tools and the rare client that prefers text.

**Implementation:**

- Either hand-write a plain-text version per template (only two templates — manageable), or add a tiny `htmlToText(html)` utility. Hand-written is clearer and avoids a new dep.
- Pass both `html` and `text` to `sendEmail`.

**Risk:** Low — additive. Clients render HTML by default (~99% of recipients); the rare text-only client falls back to the text part.

**Verify:** In Gmail "Show original" → confirm `multipart/alternative` containing both parts.

**Effort:** ~30 min.

**Rollback:** Single `git revert`.

---

### 5. Inbound reply webhook (deferred from Phase 2A)

**What:** Handle Resend's `email.received` webhook to forward replies to
`vininfo@mail.vininfo.cz` somewhere a human reads them — either an upstream
inbox (Gmail) or stored rows in the existing Postgres database.

**Why deferred:** Per Resend's [forwarding docs](https://resend.com/docs/dashboard/receiving/forward-emails),
inbound forwarding requires custom code — no codeless "forward to Gmail" toggle.
The MX record is already in place (prerequisite), but until the webhook ships,
replies to `vininfo@mail.vininfo.cz` would sit invisibly in Resend storage.
Phase 2A.1 therefore points `reply_to` at the existing monitored `vininfo@fixweb.cz`
inbox instead.

**Implementation outline (when you're ready):**

- New file `api/email/inbound.ts`. Endpoint that:
  - Verifies the Resend webhook signature using the secret from `RESEND_WEBHOOK_SECRET` env.
  - On `email.received` event, calls `resend.emails.receiving.forward(emailId, '<personal-inbox>', 'vininfo@mail.vininfo.cz')`.
  - Returns 200. Idempotent — replays of the same event ID are a no-op.
- Register the webhook URL in Resend dashboard.
- Once verified working, switch `EMAIL_REPLY_TO` from `vininfo@fixweb.cz`
  back to `vininfo@mail.vininfo.cz` so brand-aligned reply address is restored.

**Risk:** Medium — webhook code with signature verification, idempotency,
and a quiet failure mode (if it 500s, replies silently pile up). Plan and
test before flipping the reply-to constant.

**Effort:** ~1–2 hours implementation + thorough testing.

---

## Phase 2B — Medium risk, do after 2A bakes for a week

### 5. Hosted PNG logo at top

**What:** Replace the plain `<h1>VIN Info.cz</h1>` header text with an `<img>` pointing to a PNG version of the license-plate brand mark, hosted at an absolute URL on `vininfo.cz` (e.g., `https://vininfo.cz/logo-email.png`).

**Why:** Brings the new visual identity into the email. **PNG, not SVG** — Outlook desktop renders SVG broken. Use a 2× retina image (e.g., 320×120) for crisp display on high-DPI screens.

**Implementation:**

- Generate a PNG export of the license-plate logo at 320×120 and 640×240 (retina).
- Host as a static asset (`public/logo-email.png` etc., served from Vercel).
- `<img src="..." alt="VIN Info.cz" width="160" height="60">` — always include `alt` so the design degrades to text when images are blocked.
- Keep the existing colored header bar as a background for the logo.

**Risk:** Low-medium. Image-blocking clients show alt text only — the surrounding design must still read clearly without the image. Hosting URL must stay stable across deploys (don't change to a hashed filename).

**Verify:** Litmus or send-to-self matrix across Gmail / Outlook desktop / iCloud / Apple Mail mobile.

**Effort:** ~30 min including generating PNG assets and visual QA.

**Rollback:** Single `git revert`.

---

### 6. Table-based layout migration

**What:** Wrap email body in `<table role="presentation">` constructs instead of nested `<div>`s.

**Why:** Outlook desktop uses Word's HTML renderer, which handles tables reliably but mangles divs (eats padding, ignores some background colors, breaks rounded corners). Today's emails work but are one Outlook update away from a layout regression. Tables are the industry-standard insurance.

**Risk:** Medium — every template must be eyeballed in Outlook desktop before deploy. This is the highest-risk item in the plan; do not ship without thorough cross-client testing.

**Verify:** Litmus full-client check (their 7-day free trial covers this single migration).

**Effort:** ~2 hours per template, plus testing.

**Rollback:** Single `git revert`, but **plan for a full re-test cycle on revert too** — a layout regression in either direction needs validation.

---

## Phase 2C — Polish, optional

### 7. Dark mode support

**What:** Add `@media (prefers-color-scheme: dark)` rules + Outlook-specific `[data-ogsc]` selectors so dark-mode clients invert the surface tokens.

**Why:** Apple Mail and Outlook mobile honor this. Outlook desktop ignores it (acceptable — falls back to light). Pure polish.

**Risk:** Low — additive. Broken contrast is the only downside; tune carefully.

**Effort:** ~1 hour.

---

### 8. Tighter mobile breakpoint

**What:** Add `@media (max-width: 480px)` with tighter padding and slightly larger font sizes.

**Why:** Improves phone readability. Gmail and Apple Mail respect `@media`; Outlook desktop strips it (falls back to desktop layout — acceptable).

**Risk:** Low.

**Effort:** ~30 min.

---

### 9. ⛔ Don't do — Migrate to `react-email`

Resend's official React-based templating framework. Beautiful DX, but adds a build step and requires a full refactor of both templates. **Not worth it for two templates.** Revisit only if you grow to >5 templates or hire a frontend dev who specifically wants to work in JSX for emails.

---

## Cross-cutting deliverability checks (independent of the above)

1. **Verify SPF, DKIM, DMARC alignment** for `mail.vininfo.cz`. Resend's dashboard shows status — confirm all three are green. If DMARC is `p=none`, consider moving to `p=quarantine` after 30 days of clean DMARC reports.
2. **Enroll in [Google Postmaster Tools](https://postmaster.google.com)** for `mail.vininfo.cz`. One-time setup, gives ongoing visibility into your spam rate, IP reputation, and authentication status at Gmail (the largest receiver).
3. **Keep subject lines stable.** Sudden subject-line changes in a short window can trigger reclassification. Evolve them one at a time, never in bursts.

---

## Recommended sequence and timing

| Week | Phase | Risk | Reversibility |
|---|---|---|---|
| Now | Phase 2A items 1–4 (ship together or separately) | Low | `git revert` per item |
| +1 week | Phase 2B item 5 (PNG logo) | Low-med | `git revert` |
| +2 weeks | Phase 2B item 6 (table layout) — only if you have appetite for thorough testing | Med | `git revert` + full re-test |
| Later / never | Phase 2C (dark mode, tighter mobile) | Low | Optional polish |

**Validation between every step:**

1. `npm run preview:emails` — render all variants locally.
2. Open `tmp/index.html`, click through every variant.
3. Chrome DevTools device mode for mobile width.
4. Send to your Gmail + a free Outlook.com account + a free iCloud account. ≤ 30 min total.
5. For Phase 2B item 6, run a Litmus free trial — covers Outlook desktop and the long-tail clients you can't test by hand.

---

## Status

| Item | Status |
|---|---|
| Phase 1 — palette swap | ✅ Shipped |
| Phase 2A.1 — drop noreply, add reply_to | ✅ Shipped (2026-05-12) |
| Phase 2A.2 — List-Unsubscribe header | ✅ Shipped (2026-05-12) |
| Phase 2A.3 — preheader text | ✅ Shipped (2026-05-12) |
| Phase 2A.4 — plain-text fallback | ✅ Shipped (2026-05-12) |
| Phase 2A.5 — inbound reply webhook | ⬜ Deferred (MX in place, code pending) |
| Phase 2B.5 — hosted PNG logo | ⬜ Next |
| Phase 2B.6 — table-based layout | ⬜ |
| Phase 2C.7 — dark mode | ⬜ |
| Phase 2C.8 — tighter mobile breakpoint | ⬜ |
| Cross-cutting: Postmaster Tools enrollment | ⬜ |
| Cross-cutting: DMARC tightening | ⬜ |
