---
name: verify
description: Build and drive this app to observe a change at its real surface (web UI, /api JSON, certificate PDF). Use when verifying a diff rather than running tests.
---

# Verifying vincheck changes at the surface

Three surfaces, one handle. `vercel dev` serves **both** the CRA app and the
`/api` functions on a single port — this is the only way to exercise the real
serverless code path locally (the browser always calls relative `/api/...`).

```bash
vercel dev --listen 3011          # any free port; 3000 is often the user's own
until curl -s -o /dev/null -m 2 "http://localhost:3011/api/vehicle?vin=<VIN>"; do sleep 5; done
```

First boot compiles the CRA bundle (~1–2 min). `.env` supplies
`VEHICLE_CACHE_DATABASE_URL` (read-only Scaleway cache) and the payment keys.

## Surfaces

| Change reaches | Drive it with |
|---|---|
| Detail page, panels, badges | `http://localhost:PORT/vin/<VIN>` in a browser |
| Free-vs-paid gating | same URL **with and without** `?cert=preview` — that query param is the certificate feature flag (`src/config/featureFlags.ts`) |
| Public JSON | `curl "http://localhost:PORT/api/vehicle?vin=<VIN>"` — check what is *withheld*, not just what is present |
| Certificate PDF | `curl -o out.pdf "http://localhost:PORT/api/certificate/sample"` — the real function, no purchase needed |
| Static pages | plain URL; everything not matching `/api/` etc. rewrites to `index.html` (see `vercel.json`) |

`scripts/render-vin-cert.ts <VIN> out.pdf` renders a certificate for any real
VIN straight from the cache. Handy for iterating on layout, but it is a script,
not the surface — confirm through `/api/certificate/sample` before calling a PDF
change verified.

## Reading a PDF as evidence

```bash
pdftotext -layout out.pdf - | sed -n '/Section title/,/Next section/p'   # copy + column alignment
pdfinfo out.pdf | grep Pages                                             # page-count regressions
pdftoppm -png -r 110 -f 3 -l 3 out.pdf page                              # render a page to look at it
```

Watch stderr from the render: `Node of type VIEW can't wrap between pages and
it's bigger than available page height` means a `wrap: false` block overflowed
and rows are printing on top of each other.

## Gotchas

- **Long psql queries die silently.** Append
  `&keepalives=1&keepalives_idle=15` to `VEHICLE_CACHE_DATABASE_URL` or a
  multi-minute scan drops its connection and psql hangs forever.
- **`biome check --write` on a directory reformats ~27 untouched files.** Always
  pass explicit file paths.
- **ARES lookups**: use `curl`, not Python `urllib` — the local TLS chain has an
  intercepting root that urllib rejects (`CERTIFICATE_VERIFY_FAILED`).
- Kill the server when done: `pkill -f "vercel dev"`.

## Test VINs

`docs/plans/2026-08-06-001-feat-leasing-check.md` appendix A6 lists ~30 verified
VINs covering financing/fleet/rental/none, trucks, trailers and the negative
cases (dealers, importers). Use those instead of hunting for fresh ones.
