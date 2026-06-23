# Monitoring

Lightweight, zero-cost monitoring of the core flows. Two sinks, both best-effort
(they never break the request they observe), implemented in `api/_metrics.ts`:

1. **Structured Vercel logs** — every event prints one JSON line
   (`{"evt":"...","ts":"..."}`), searchable in the Vercel dashboard. This is the
   only place high-frequency `vin_lookup` volume is fully captured (those run on
   the edge-cache-miss path and are logged fire-and-forget).
2. **`events` table (Vercel Postgres)** — durable history that outlives Vercel's
   short Hobby-plan log retention. Created lazily on first event.

## Event types

| `type`                | Emitted from                         | Notable props |
|-----------------------|--------------------------------------|---------------|
| `vin_lookup`          | `api/vehicle.ts`                     | `by` (vin/tp/orv), `source` (cache/live) |
| `client_op`           | `api/client/*`                       | `endpoint`, `method`, `userId` |
| `certificate_created` | `api/certificate` (create)           | `code`, `vin` (masked), `amountCzk` |
| `certificate_issued`  | `api/certificate` (webhook, paid)    | `code`, `vin` (masked), `amountCzk` |
| `certificate_error`   | `api/certificate` (checkout failure) | `stage`, `vin` (masked) |

VINs are always masked in stored props. No personal data is logged (client ops
store only the user id).

## Alerts

Operator emails (`sendOperatorAlert`, `api/_email.ts`) are sent **only on
delivery failures** — not on sales (Lemon Squeezy already notifies of those).
Set `OPERATOR_EMAIL` to enable; unset = silently skipped. Triggers:

- **Checkout can't be created** — the customer couldn't even start paying
  (provider/config issue → likely affects every order).
- **Paid but unknown certificate** — a paid webhook references a code we don't
  have; the customer paid with nothing to deliver.
- **Paid + issued but the delivery email failed** — the core "ordered but not
  delivered" case; the alert includes the tokenised download link for a manual
  resend.

The `certificate_issued` event is still recorded in the `events` table for
revenue/abandonment queries; it just doesn't email.

## Querying

```sql
-- Last 24h, grouped by type
SELECT type, count(*)
FROM events
WHERE created_at > now() - interval '24 hours'
GROUP BY type ORDER BY count DESC;

-- Daily VIN lookups, last 14 days
SELECT date_trunc('day', created_at) AS day, count(*)
FROM events
WHERE type = 'vin_lookup' AND created_at > now() - interval '14 days'
GROUP BY day ORDER BY day;

-- Certificates sold + revenue, last 30 days
SELECT count(*) AS sold,
       coalesce(sum((props->>'amountCzk')::int), 0) AS revenue_czk
FROM events
WHERE type = 'certificate_issued' AND created_at > now() - interval '30 days';

-- Client-zone usage by endpoint
SELECT props->>'endpoint' AS endpoint, props->>'method' AS method, count(*)
FROM events
WHERE type = 'client_op' AND created_at > now() - interval '7 days'
GROUP BY endpoint, method ORDER BY count DESC;
```

## Notes / future

- No in-app metrics endpoint: the project is at the Vercel Hobby 12-function cap.
  To add `/api/metrics`, free a slot first (e.g. fold `api/fleet.ts` into
  `api/vehicle.ts`).
- `certificate_created` minus `certificate_issued` over a window approximates the
  checkout abandonment rate.
