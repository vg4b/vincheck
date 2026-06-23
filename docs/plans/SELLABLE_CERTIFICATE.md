# Plan: Our own sellable vehicle-history certificate

Status: **largely implemented** on `feat/sellable-certificate` (behind a feature
flag, pre-launch). Key deltas from the original plan below:
- **Price:** 99 Kč (not 149 Kč).
- **Payments:** **Lemon Squeezy** (Merchant of Record — handles EU VAT), not
  Stripe. No Czech-native MoR exists and Stripe leaves us as VAT payer; Lemon
  Squeezy was the only fast, self-serve, zero-monthly MoR that bills in CZK.
- **Endpoints:** the three certificate routes are consolidated into one catch-all
  (`api/certificate/[...slug].ts`) to stay under the Vercel Hobby 12-function cap.
- **PDF:** `@react-pdf/renderer` with embedded DejaVu Sans (Czech diacritics) and
  a logo; all fields rendered inline with the web labels.
- **Feature flag:** hidden by default (`REACT_APP_CERTIFICATE_ENABLED` /
  `?cert=preview` override) so the live flow can be tested in production first.
- **Terms + consent:** terms section added; checkout requires an immediate-
  delivery consent (withdrawal-right waiver, §1837 OZ), recorded server-side
  (`certificates.terms_accepted_at`).
- **Monitoring:** delivery-failure operator alerts + an `events` log (see
  `docs/MONITORING.md`).

See `docs/CERTIFICATE.md` for the as-built feature documentation.

---

## Context

The redesigned detail page (owner timeline + `VehicleHistoryPanel` +
`VehicleInfo`) now answers everything the public RSV registry holds — owners,
STK, imports, deregistrations, status flags — so visitors get enough value for
free and the Cebia affiliate click-through dropped.

Instead of hiding value, we monetise the asset we already own: the clean,
authoritative presentation of official Czech registry data. We sell a branded,
verifiable PDF certificate that a seller can hand a buyer as credible proof of a
car's registry history.

**Positioning (decided): complementary, not a Cebia replacement.** We still don't
have mileage / accident / lien data. The certificate covers the official registry
facts cheaply and instantly; the affiliate stays as the upsell for the data we
lack. Two revenue streams. (Note: the odometer plan changes this — once official
mileage history lands, the certificate will include it.)

**Decisions locked with the user:**
- Complementary to the affiliate (keep the upsell).
- Guest checkout — pay with just an email, no account required (account optional).
- Deliverable = verifiable PDF + public verify page with QR code.
- Payments must be zero monthly fee + zero onboarding (instant self-serve).
- No VAT hassle → Merchant of Record (→ Lemon Squeezy).

## Architecture overview

Reuse the existing stack: Vercel serverless `api/`, Vercel Postgres, JWT auth,
Resend email, Scaleway registry cache. New: one DB table, a payments abstraction,
a PDF builder, the consolidated endpoint, the pages, and the CTAs.

### Flow (guest checkout)

1. Detail page CTA → modal asks for email + terms consent.
2. `POST /api/certificate/create {vin, email, termsAccepted}`:
   - Freeze registry data via the cache and insert a `certificates` row
     `status='pending'` with a public `code` (`VI-XXXX-XXXX`).
   - Create a Lemon Squeezy checkout; return its URL.
3. User pays on the hosted MoR page.
4. `POST /api/certificate/webhook` (signature verified):
   - Mark row `issued`, email the certificate with a tokenised download link.
5. Success redirect → `/certifikat/:code` (download + verify link).
6. Public `/overit/:code` confirms authenticity (QR on the PDF points here).

PDFs are generated on-demand from the frozen snapshot (deterministic, immutable
across monthly registry refreshes).

## Implementation steps (as built)

1. **Data model** — `certificates` table in `api/_db.ts` (+ `terms_accepted_at`).
2. **Payment abstraction** — `api/_payments.ts` (Lemon Squeezy; test/live keyed
   off `VERCEL_ENV`; mode-aware variant id + secrets).
3. **PDF builder** — `api/_certificatePdf.ts` (embedded fonts, logo, all sections
   inline with the web labels; watermark support for the public sample).
4. **Endpoint** — `api/certificate/[...slug].ts` (create / webhook / sample /
   fetch), body parsing disabled for webhook signature verification.
5. **Email** — `sendCertificateEmail` in `api/_email.ts`.
6. **Frontend** — `ProductComparison`, `CertificateCheckoutModal`,
   `CertificateLandingPage` (`/overeny-vypis-vozidla`), `CertificatePage`
   (`/certifikat/:code`), `VerifyCertificatePage` (`/overit/:code`), nav link,
   all gated by `src/config/featureFlags.ts`.
7. **Legal/compliance** — terms section + immediate-delivery consent; "not an
   official document" disclaimer; VIN masked on the public verify page.
8. **Config** — `LEMONSQUEEZY_*`, `CERTIFICATE_PRICE_CZK`, `PUBLIC_BASE_URL`,
   `REACT_APP_CERTIFICATE_ENABLED`, `OPERATOR_EMAIL`.

## Verification

- Live test in production behind the flag (`?cert=preview`): real checkout →
  webhook flips `pending → issued` → email + `/overit/:code` shows authentic.
- PDF renders with embedded font/logo on Vercel (`includeFiles` bundling).
- Webhook idempotent on replays; signature verified over raw bytes.

## Out of scope (v1)

- Subscriptions / bulk dealer plans (later: IČO fleet certificates).
- Multi-currency / non-CZ buyers.
- Account-gated certificate library (guest flow first; client-zone tab later).
