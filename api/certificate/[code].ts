/**
 * GET /api/certificate/:code
 *   - with a valid `?token=` → streams the certificate PDF (regenerated on demand
 *     from the frozen snapshot).
 *   - without a token → returns public verification metadata (masked VIN, dates,
 *     summary) for the /overit page. Never exposes the snapshot or buyer PII.
 *
 * Only `issued` certificates are served — a pending/unpaid row 404s.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import { ensureTables } from '../_db'
import { rateLimit } from '../_rateLimit'
import { renderCertificatePdf } from '../_certificatePdf'
import { getPublicBaseUrl, maskVin } from '../_certificate'
import type { VehicleCacheResult } from '../_vehicleCache'

const first = (v: string | string[] | undefined): string | undefined =>
	Array.isArray(v) ? v[0] : v

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' })
	}
	if (!rateLimit(req, res, { limit: 30, windowMs: 60_000 })) {
		return
	}

	const code = first(req.query.code)
	const token = first(req.query.token)
	if (!code) {
		return res.status(400).json({ error: 'Chybí kód certifikátu.' })
	}

	await ensureTables()

	const { rows } = await sql`
		SELECT code, vin, status, snapshot, registry_snapshot_date,
			download_token, issued_at
		FROM certificates
		WHERE code = ${code}
		LIMIT 1;
	`
	const cert = rows[0] as
		| {
				code: string
				vin: string
				status: string
				snapshot: VehicleCacheResult
				registry_snapshot_date: string | null
				download_token: string
				issued_at: string | null
		  }
		| undefined

	if (!cert || cert.status !== 'issued') {
		return res.status(404).json({ valid: false, error: 'Certifikát nenalezen.' })
	}

	// No token → public verification view only.
	if (!token) {
		return res.status(200).json({
			valid: true,
			code: cert.code,
			vinMasked: maskVin(cert.vin),
			issuedAt: cert.issued_at,
			registrySnapshotDate: cert.registry_snapshot_date
		})
	}

	// Token present → must match to release the PDF.
	if (token !== cert.download_token) {
		return res.status(403).json({ error: 'Neplatný přístupový token.' })
	}

	const pdf = await renderCertificatePdf(cert.snapshot, {
		code: cert.code,
		issuedAt: cert.issued_at ? new Date(cert.issued_at) : new Date(),
		verifyUrl: `${getPublicBaseUrl()}/overit/${cert.code}`
	})

	res.setHeader('Content-Type', 'application/pdf')
	res.setHeader(
		'Content-Disposition',
		`inline; filename="certifikat-${cert.code}.pdf"`
	)
	res.setHeader('Cache-Control', 'private, max-age=300')
	return res.status(200).send(pdf)
}
