/**
 * POST /api/certificate/create — start a certificate purchase (guest checkout).
 *
 * Freezes the current registry data into a `pending` row, then creates a hosted
 * checkout session. The webhook (api/certificate/webhook.ts) flips the row to
 * `issued` on payment. No PDF is generated here.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import { ensureTables } from '../_db'
import { getUserFromToken } from '../_auth'
import { rateLimit } from '../_rateLimit'
import {
	isCacheConfigured,
	isCacheFresh,
	lookupVehicleFromCache
} from '../_vehicleCache'
import { createCheckout, PAYMENT_PROVIDER } from '../_payments'
import {
	generateCode,
	generateDownloadToken,
	getCertificatePriceCzk,
	getPublicBaseUrl
} from '../_certificate'

// Conservative — minimal valid email shape; real validation is the payment step.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' })
	}
	// Checkout creation hits Stripe + the cache — keep it modest per IP.
	if (!rateLimit(req, res, { limit: 10, windowMs: 60_000 })) {
		return
	}

	const { vin, email } = (req.body ?? {}) as { vin?: string; email?: string }
	const cleanVin = String(vin ?? '')
		.replace(/[^a-zA-Z0-9]/g, '')
		.toUpperCase()
	const cleanEmail = String(email ?? '').trim()

	if (cleanVin.length !== 17) {
		return res.status(400).json({ error: 'Neplatný VIN.' })
	}
	if (!EMAIL_RE.test(cleanEmail)) {
		return res.status(400).json({ error: 'Neplatný e-mail.' })
	}
	if (!isCacheConfigured()) {
		return res
			.status(503)
			.json({ error: 'Služba je dočasně nedostupná. Zkuste to prosím později.' })
	}

	// Freeze the registry data now so the certificate is immutable. Only sell when
	// the cache has a fresh hit — never issue a certificate from stale/absent data.
	const cached = await lookupVehicleFromCache({ vin: cleanVin })
	if (!cached || !isCacheFresh(cached.snapshot)) {
		return res.status(404).json({
			error:
				'Pro tento VIN nemáme aktuální data z registru. Certifikát nelze vystavit.'
		})
	}

	await ensureTables()

	const code = generateCode()
	const downloadToken = generateDownloadToken()
	const amountCzk = getCertificatePriceCzk()
	const userId = getUserFromToken(req) // optional — links the cert if logged in

	const base = getPublicBaseUrl()
	let checkout: { url: string; ref: string | null }
	try {
		checkout = await createCheckout({
			amountCzk,
			email: cleanEmail,
			certificateCode: code,
			vin: cleanVin,
			// Token in the redirect gives the buyer instant download once the
			// webhook marks the row issued; it is also delivered by email.
			successUrl: `${base}/certifikat/${code}?token=${downloadToken}`,
			cancelUrl: `${base}/vin/${cleanVin}`
		})
	} catch (error) {
		console.error('Checkout creation failed:', error)
		return res
			.status(502)
			.json({ error: 'Platbu se nepodařilo zahájit. Zkuste to prosím znovu.' })
	}

	await sql`
		INSERT INTO certificates (
			code, vin, buyer_email, user_id, status, snapshot,
			registry_snapshot_date, provider, provider_ref, amount_czk, download_token
		) VALUES (
			${code},
			${cleanVin},
			${cleanEmail},
			${userId},
			'pending',
			${JSON.stringify(cached)}::jsonb,
			${cached.snapshot},
			${PAYMENT_PROVIDER},
			${checkout.ref},
			${amountCzk},
			${downloadToken}
		);
	`

	return res.status(201).json({ code, checkoutUrl: checkout.url })
}
