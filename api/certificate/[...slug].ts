/**
 * Certificate endpoints, consolidated into one Serverless Function (the Hobby
 * plan caps a deployment at 12 functions). Routes by method + first path segment:
 *
 *   POST /api/certificate/create   → start a purchase (guest checkout)
 *   POST /api/certificate/webhook  → payment provider callback
 *   GET  /api/certificate/:code    → PDF (with ?token=) or public verify metadata
 *
 * Body parsing is disabled so the webhook can verify its signature over the raw
 * bytes; the `create` branch JSON-parses the raw body itself.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import { getUserFromToken } from '../_auth'
import { ensureTables } from '../_db'
import { sendCertificateEmail } from '../_email'
import { rateLimit } from '../_rateLimit'
import {
	createCheckout,
	PAYMENT_PROVIDER,
	verifyAndParseWebhook
} from '../_payments'
import { renderCertificatePdf } from '../_certificatePdf'
import {
	buildSampleSnapshot,
	generateCode,
	generateDownloadToken,
	getCertificatePriceCzk,
	getPublicBaseUrl,
	maskVin
} from '../_certificate'
import {
	isCacheConfigured,
	isCacheFresh,
	lookupVehicleFromCache,
	type VehicleCacheResult
} from '../_vehicleCache'

// Webhook signature is computed over the exact bytes received — never let Vercel
// parse the body. The `create` branch parses the raw body manually.
export const config = { api: { bodyParser: false } }

// Conservative — minimal valid email shape; real validation is the payment step.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const first = (v: string | string[] | undefined): string | undefined =>
	Array.isArray(v) ? v[0] : v

/**
 * The last path segment after /api/certificate/. Parsed from req.url rather than
 * the filesystem `slug` param: vercel.json's explicit `/api/(.*)` rewrite invokes
 * the function but doesn't populate the catch-all param, so req.query.slug is empty.
 */
function pathSegment(req: VercelRequest): string | undefined {
	const path = (req.url ?? '').split('?')[0]
	const m = path.match(/\/api\/certificate\/([^/]+)\/?$/)
	return m ? decodeURIComponent(m[1]) : undefined
}

async function readRawBody(req: VercelRequest): Promise<Buffer> {
	const chunks: Buffer[] = []
	for await (const chunk of req) {
		chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
	}
	return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const slug = pathSegment(req)

	if (req.method === 'POST' && slug === 'create') {
		return handleCreate(req, res)
	}
	if (req.method === 'POST' && slug === 'webhook') {
		return handleWebhook(req, res)
	}
	if (req.method === 'GET' && slug === 'sample') {
		return handleSample(req, res)
	}
	if (req.method === 'GET' && slug) {
		return handleFetch(req, res, slug)
	}
	return res.status(405).json({ error: 'Method not allowed' })
}

/** GET /api/certificate/sample — public watermarked example PDF (no DB, no token). */
async function handleSample(req: VercelRequest, res: VercelResponse) {
	if (!rateLimit(req, res, { limit: 30, windowMs: 60_000 })) {
		return
	}
	const pdf = await renderCertificatePdf(buildSampleSnapshot(), {
		code: 'UKÁZKA',
		issuedAt: new Date(),
		verifyUrl: `${getPublicBaseUrl()}/overit/UKAZKA`,
		watermark: 'UKÁZKA'
	})
	res.setHeader('Content-Type', 'application/pdf')
	res.setHeader('Content-Disposition', 'inline; filename="certifikat-ukazka.pdf"')
	// Static content — cache hard at the edge.
	res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400')
	return res.status(200).send(pdf)
}

/** POST /api/certificate/create — freeze registry data + open a checkout. */
async function handleCreate(req: VercelRequest, res: VercelResponse) {
	// Checkout creation hits the payment provider + the cache — modest per IP.
	if (!rateLimit(req, res, { limit: 10, windowMs: 60_000 })) {
		return
	}

	let body: { vin?: string; email?: string; termsAccepted?: boolean } = {}
	try {
		const raw = await readRawBody(req)
		body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
	} catch {
		return res.status(400).json({ error: 'Neplatný požadavek.' })
	}

	const cleanVin = String(body.vin ?? '')
		.replace(/[^a-zA-Z0-9]/g, '')
		.toUpperCase()
	const cleanEmail = String(body.email ?? '').trim()

	if (cleanVin.length !== 17) {
		return res.status(400).json({ error: 'Neplatný VIN.' })
	}
	if (!EMAIL_RE.test(cleanEmail)) {
		return res.status(400).json({ error: 'Neplatný e-mail.' })
	}
	// Consent to the terms + immediate-delivery withdrawal waiver is mandatory.
	if (body.termsAccepted !== true) {
		return res
			.status(400)
			.json({ error: 'Je nutné souhlasit s obchodními podmínkami.' })
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
			// Token in the redirect gives the buyer instant download once the webhook
			// marks the row issued; it is also delivered by email.
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
			registry_snapshot_date, provider, provider_ref, amount_czk, download_token,
			terms_accepted_at
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
			${downloadToken},
			now()
		);
	`

	return res.status(201).json({ code, checkoutUrl: checkout.url })
}

/** POST /api/certificate/webhook — mark paid + deliver. Idempotent. */
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
	let parsed: ReturnType<typeof verifyAndParseWebhook>
	try {
		const rawBody = await readRawBody(req)
		const signature = req.headers['x-signature'] as string | undefined
		parsed = verifyAndParseWebhook(rawBody, signature)
	} catch (error) {
		console.error('Webhook verification error:', error)
		return res.status(400).json({ error: 'Invalid webhook' })
	}

	// Unknown/unhandled event or bad signature — ack so the provider stops retrying.
	if (!parsed || !parsed.paid || !parsed.certificateCode) {
		return res.status(200).json({ received: true })
	}

	await ensureTables()

	// Match on the certificate code we set in metadata (round-trips reliably).
	// Only act on a still-pending row (idempotent on replays).
	const { rows } = await sql`
		UPDATE certificates
		SET status = 'issued', issued_at = now()
		WHERE code = ${parsed.certificateCode}
			AND status = 'pending'
		RETURNING code, vin, buyer_email, download_token;
	`

	if (rows.length === 0) {
		// Already issued (replay) or no match — nothing to do, but ack.
		return res.status(200).json({ received: true })
	}

	const cert = rows[0] as {
		code: string
		vin: string
		buyer_email: string
		download_token: string
	}

	const base = getPublicBaseUrl()
	try {
		await sendCertificateEmail({
			to: cert.buyer_email,
			code: cert.code,
			vin: cert.vin,
			downloadUrl: `${base}/api/certificate/${cert.code}?token=${cert.download_token}`,
			verifyUrl: `${base}/overit/${cert.code}`
		})
	} catch (error) {
		// The certificate is paid + issued; a failed email must not 500 the webhook
		// (that would trigger retries and risk double-processing). Log and move on —
		// the buyer can still reach it via the success redirect.
		console.error('Certificate email failed:', error)
	}

	return res.status(200).json({ received: true })
}

/** GET /api/certificate/:code — PDF (with ?token=) or public verify metadata. */
async function handleFetch(
	req: VercelRequest,
	res: VercelResponse,
	code: string
) {
	if (!rateLimit(req, res, { limit: 30, windowMs: 60_000 })) {
		return
	}
	const token = first(req.query.token)

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
