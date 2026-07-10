---
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# Consumer Odometer Prediction - Plan

## Goal Capsule

- **Objective:** Monetize the odometer intelligence by adding an "expected mileage now" prediction to the consumer flow — a blurred teaser on the free lookup that drives certificate purchases, and a revealed range + honest verdict inside the paid certificate.
- **Product authority:** Owner (vaclav.gabriel). Certificate is the existing paid product (99 Kč, Comgate); this extends it.
- **Open blockers:** None to start. Confidence thresholds and a couple of placement questions are tuning decisions for planning, not blockers.

## Context

This brainstorm opened as "a paid B2B API for businesses (register data + odometer readings + odometer prediction)" and converged on a different bet. The register/inspection data is **open data** (data.gov.cz / ISTP), so it is not a moat; no business buyer has surfaced (supply-driven idea); and a B2B API carries heavy cost (auth, billing, SLAs, sales, support, data-licensing diligence) while competing with Cebia, the current affiliate partner. The odometer intelligence monetizes better through a channel already owned and already selling: the consumer certificate + free lookup.

The prediction itself is mostly already computed — `api/_vehicleCache.ts` derives `latestKm`, `rollbackSuspected`, and `avgKmPerYear` from the ~90M-row `vehicle_inspection_odometer` dataset. What is net-new is projecting that forward and presenting it responsibly.

## Product Contract

### Problem
A used-car buyer looking at an ad ("120 000 km") can't easily tell if the stated mileage is believable. The certificate today shows verified *history* + a *rollback* flag, but never an **expected-current-mileage** figure the buyer can weigh against the ad — the exact anxiety someone pays to resolve.

### Primary actor
Consumer used-car buyer checking a specific vehicle before purchase (same actor as the existing certificate). Not a business/API consumer.

### Behavior / requirements
- **Prediction ("expected mileage now"):** project the latest verified reading forward by the vehicle's historical km/yr pace (`avgKmPerYear`). Presented as a **range with its basis** (e.g. "~130–150k, based on ~18k km/yr over 2019–2023"), never a single point claim.
- **Two surfaces, existing teaser→unlock mechanism:**
  - *Free lookup:* a **blurred/partial** expected-mileage line alongside the existing blurred history + rollback flag → an additional hook to buy the certificate.
  - *Paid certificate:* the **revealed** range plus the verdict.
- **Optional compare field:** the buyer may enter the ad's **claimed km** to get a direct verdict — "claimed 120k vs expected ~140k, ~20k under the trend — worth asking the seller." The passive expected range shows even without any input.
- **Conservative, honest verdict:**
  - Surface a verdict **only when** there are enough readings **and** the gap is large.
  - Language is soft — "worth asking about," **never** a hard fraud claim like "rolled back."
  - **Suppress / soft-handle on low confidence:** too few readings, rollback already suspected (trend unreliable), or the last verified reading is stale.

### Scope boundaries

**Deferred for later (not this product):**
- **B2B paid API** (register data + odometer + prediction sold to businesses). Revisit trigger: a real business asks unprompted (inbound demand signal) — not "we still have the data."
- Bulk data-access / raw feed API.

**Outside this product's identity:**
- Any presentation that reads as an authoritative mileage or a definitive fraud accusation. The certificate's value is *verified* data; a shaky extrapolation dressed as certainty erodes that and creates false-accusation risk. The prediction is always an estimate, clearly framed.

### Success criteria
- More free lookups convert to certificate purchases (prediction teaser as a purchase driver).
- Higher perceived certificate value (prediction + verdict), supporting price / reducing refund doubt.
- **Zero erosion of the "verified" trust** — no false "suspicious" flags on honest sellers; the conservative framing holds.

### Assumptions
- The linear `avgKmPerYear` projection is imprecise (cars don't drive uniformly); conservative, range-based framing is a hard requirement, not a preference.
- The teaser→paid-unlock mechanism already used for the blurred mileage history is the right home for the prediction (extend, don't rebuild).
- Data-licensing note (verify before B2B, not blocking for consumer use): the underlying open data permits the current consumer presentation.

### Open questions (for planning)
- Exact confidence thresholds: minimum readings, minimum gap (absolute km and/or %), maximum staleness of the last reading before the prediction is suppressed.
- Does the optional compare field appear on the **free lookup** too, or only inside the paid certificate?
- Behavior when rollback is **already** suspected: suppress the prediction, or show it with an explicit caveat that the trend is unreliable?
- How the range width is derived (fixed ± %, or from the variance/spacing of readings).
