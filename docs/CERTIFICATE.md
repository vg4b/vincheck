# Spec — Sellable vehicle-history certificate

## Goal

Sell VIN Info's own **verifiable PDF certificate** ("Certifikát historie
vozidla") built from the same public RSV data the detail page shows for free.
Positioning: the registry is the authoritative *source*, but raw registry data is
barely readable — our value is the clear, analysed report. So customer-facing copy
calls the *source data* "z registru ČR" but never calls our *product* "oficiální"
(avoids implying state affiliation). Motivation: the detail-page redesign answered
enough for free that the Cebia affiliate click-through dropped, so we monetise the
asset we already own.

**Complementary to Cebia, not a replacement.** We have no mileage / accident /
lien data, so the detail page keeps the Cebia upsell as the secondary CTA for
exactly that gap. Two revenue streams.

## Decisions

- **Guest checkout** — pay with just an email, no account. `user_id` is linked
  only if the buyer happens to be logged in (`getUserFromToken`).
- **Deliverable** — a branded PDF + a public verify page (`/overit/:code`) with a
  QR code on the PDF pointing to it.
- **Payments** — Lemon Squeezy (Merchant of Record), behind the swappable
  `api/_payments.ts` interface. As MoR, Lemon Squeezy is the legal seller and
  collects + remits EU VAT for us, so we never file a VAT return. Chosen because
  it is the only fast/self-serve MoR that bills in **CZK** (Creem is USD/EUR only;
  Paddle does CZK but is approval-gated). No Czech-native MoR exists. Fee ~5% +
  $0.50, zero monthly/setup. The charged amount lives on the Lemon Squeezy variant
  (`LEMONSQUEEZY_VARIANT_ID`), so our `CERTIFICATE_PRICE_CZK` is display-only and
  must match it. Variant priced tax-inclusive so buyers see "99 Kč incl. DPH".
- **Immutability** — the registry data is frozen into `certificates.snapshot` at
  purchase; the PDF is regenerated on demand from it, so it never drifts after the
  monthly cache refresh.

## Flow

1. Detail page CTA → `CertificateCheckoutModal` collects an email.
2. `POST /api/certificate/create {vin, email}` — looks up + freezes the registry
   data (only sells on a fresh cache hit), inserts a `pending` row, creates a
   Lemon Squeezy checkout (`POST /v1/checkouts`, JSON:API, with our
   `certificate_code` in `checkout_data.custom`), returns `data.attributes.url`.
   Frontend redirects there.
3. Buyer pays on Lemon Squeezy's hosted page.
4. `POST /api/certificate/webhook` — verifies the `X-Signature` HMAC-SHA256 over
   the **raw** body, matches the row by `meta.custom_data.certificate_code` on the
   `order_created` event, flips it to `issued`, emails a tokenised download link.
   Idempotent (only acts on a `pending` row); a failed email never 500s (avoids
   retry/double-issue).
5. Success redirect → `/certifikat/:code?token=…` polls until issued, then offers
   the PDF download.
6. `GET /api/certificate/:code` — with a valid `?token=` streams the PDF; without
   one returns public verify metadata (masked VIN + dates) for `/overit/:code`.

## Data model

`certificates` table, added to `ensureTables()` in `api/_db.ts` (same Vercel
Postgres as users/vehicles — NOT the Scaleway cache, so no `scripts/migrations`
file). Columns: `code` (public verify code), `vin`, `buyer_email`, `user_id?`,
`status` (pending|issued|failed), `snapshot` (frozen `VehicleCacheResult`),
`registry_snapshot_date`, `provider`, `provider_ref`, `amount_czk`,
`download_token`, `created_at`, `issued_at`.

## Files

- `api/_payments.ts` — Lemon Squeezy-backed `createCheckout` +
  `verifyAndParseWebhook` (plain fetch + crypto, no SDK).
- `api/_certificatePdf.ts` — `renderCertificatePdf` via `@react-pdf/renderer`
  (dynamic-imported; ESM-only) + `qrcode`. Renders from the frozen snapshot.
- `api/_certificate.ts` — code/token generation, price + base-URL config, VIN mask.
- `api/certificate/{create,webhook,[code]}.ts` — endpoints.
- `api/_email.ts` — `sendCertificateEmail` (links the download; no attachment).
- `src/components/CertificateCheckoutModal.tsx`, `src/pages/CertificatePage.tsx`,
  `src/pages/VerifyCertificatePage.tsx`, two-tier CTA in `VehicleInfo.tsx`, routes
  in `App.tsx`.

## Config

See `.env.example`: `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`,
`LEMONSQUEEZY_VARIANT_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `CERTIFICATE_PRICE_CZK`
(default 99, must match the Lemon Squeezy variant price + the constant in
`VehicleInfo.tsx`), `PUBLIC_BASE_URL`. Deps: `@react-pdf/renderer`, `qrcode`.
A test-mode API key keeps the whole flow in test mode (no separate base URL).

## Legal / compliance

- **Not an official document.** Never describe our product as "oficiální" /
  "úřední výpis" (would imply state affiliation); "oficiální" may only describe
  the *source registry data*. Product is "Certifikát historie vozidla". The PDF
  footer + verify page state the data is public RSV open data, accurate to the
  stated snapshot, not an úřední dokument, and excludes mileage/accidents/liens.
- **VAT** — Lemon Squeezy is the Merchant of Record: it is the legal seller and
  collects + remits EU VAT, so we never file a VAT return. Price is configured
  tax-inclusive on the variant. No EET (abolished in CZ).
- **GDPR** — individuals in the timeline are already anonymised upstream
  (ico/nazev null); only company owners are named. The public verify page masks
  the VIN and never exposes the snapshot or buyer info.

## Verification

1. Lemon Squeezy test mode (test-mode API key) with a test store/variant; create
   a webhook (event `order_created`) pointing at the deployed
   `/api/certificate/webhook` (or tunnel for local). Click the CTA, complete a
   test payment, confirm the row flips `pending → issued`.
2. Open `/api/certificate/<code>?token=<token>` — PDF matches the on-site
   `VehicleInfo` for that VIN; QR scans to `/overit/<code>`.
3. `/overit/<code>` shows authentic + masked VIN; a bogus code shows not-found.
4. Replay the webhook — no double-issue / double-email.
5. After a cache refresh, re-download an old certificate — still the frozen data.

## Out of scope (v1)

- Dealer/bulk (IČO fleet) certificates, multi-currency, account-gated certificate
  library (the "Moje certifikáty" client-zone tab comes once the core sells).
