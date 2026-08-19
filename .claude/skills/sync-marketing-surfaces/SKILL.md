---
name: sync-marketing-surfaces
description: Audit whether a shipped feature is reflected on the public marketing and SEO pages. Use after shipping anything customer-visible, or when asked "is the landing page up to date".
---

# Sync marketing surfaces

Shipping a user-visible feature is not finished when the code works. The pages
that *sell* it are separate files that nothing forces you to touch, so they go
stale silently — the certificate carried STK defect codes for a day before the
landing page mentioned them, and nothing failed in between.

This skill is the audit. It is deliberately **not** a CI check: whether a feature
belongs on a given page is a judgement call, and a keyword assertion would either
pass on a stale page or fail on a deliberate omission. What is mechanical is
*asking the question about every surface*, which is what this does.

## The surfaces

Every customer-visible change should be checked against all of these. Most
changes touch two or three; the point is to decide, not to skip.

| Surface | File | Carries |
|---|---|---|
| Certificate landing page | `src/pages/CertificateLandingPage.tsx` | what the paid PDF contains, why buy, differentiators |
| Product comparison | `src/components/ProductComparison.tsx` | us vs. the partner check — bullets must stay truthful both ways |
| Vehicle detail page | `src/pages/VehicleDetailPage.tsx` | the free preview and the upsell |
| Homepage | `src/pages/HomePage.tsx` | headline claims, JSON-LD |
| Long-form SEO pages | `src/pages/KompletniHistorieVozuPage.tsx`, `PovinneRuceniPage.tsx`, `HavarijniPojisteniPage.tsx`, `UpozorneniNaTerminyPage.tsx` | topical content that should mention new capabilities |
| Brand/model stats | `src/pages/BrandModelStatsPage.tsx`, `ZnackyHubPage.tsx` | aggregate pages; new per-vehicle data often has an aggregate angle |
| Certificate PDF | `api/_certificatePdf.ts` | the delivered product itself |
| Structured data | JSON-LD blocks in the pages above | `Product`, `Dataset`, breadcrumbs |
| Sample certificate | `api/_certificate.ts` (`buildSampleSnapshot`) | the public sample must exercise the new field, or prospects see an outdated document |

## How to run the audit

1. **Name the change** in one sentence, as a buyer would hear it. If you cannot,
   it is probably not customer-visible and this skill does not apply.
2. **Read the surfaces above** — actually read them, do not grep for a keyword.
   A page can describe a capability without using your internal noun.
3. For each, decide: **already covered · should be added · deliberately not**.
   Write the "deliberately not" reasons down; they are the useful output.
4. **Check the claims still hold.** New capability sometimes falsifies old copy —
   a bullet saying "výsledky STK" understates a page that now lists the defects,
   and a comparison bullet may now be wrong about what the partner adds.
5. **Say what is conditional.** Anything that depends on data availability
   (mileage prediction, import detail, defects before 2009) must be described as
   conditional on the page, or it becomes a refund request.
6. **Update the sample snapshot** if the feature adds a field, so the public
   sample PDF shows it.

## Rules

- **Never claim a capability the data cannot support.** Check the actual code
  path or query before writing marketing copy about it. If a field is null for
  most vehicles, say when it appears.
- **Czech for user-facing strings, English for code comments** (repo rule).
- Landing-page changes are SEO surface: keep `<title>`, description and JSON-LD
  consistent with the new body copy.
- Verify by rendering, not by reading the diff — layout and overflow bugs in this
  repo have only ever been caught by looking at the page or the PDF.

## When to invoke

- Immediately after merging a customer-visible feature.
- As a Definition-of-Done item in `docs/plans/*` for any feature with a user
  surface.
- Periodically (quarterly is enough) as a drift check across all surfaces.
