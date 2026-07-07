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
import { sendCertificateEmail, sendOperatorAlert } from '../_email'
import { logEvent, type EventType } from '../_metrics'
import { rateLimit } from '../_rateLimit'
import {
	createCheckout,
	PAYMENT_PROVIDER,
	verifyAndParseWebhook,
	webhookAckBody
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
	if (req.method === 'POST' && slug === 'track') {
		return handleTrack(req, res)
	}
	if (req.method === 'GET' && slug === 'sample') {
		return handleSample(req, res)
	}
	if (req.method === 'GET' && slug) {
		return handleFetch(req, res, slug)
	}
	return res.status(405).json({ error: 'Method not allowed' })
}

// Client funnel events the browser is allowed to record. Kept as a closed set so
// a public endpoint can't write arbitrary rows into `events`.
const CLIENT_EVENTS = new Set<EventType>([
	'comparison_view',
	'cert_cta_click',
	'checkout_modal_open',
	'partner_click'
])

/**
 * POST /api/certificate/track — best-effort client funnel beacon. Records an
 * allowlisted event (comparison impression, CTA click, modal open, partner click)
 * so we can see where buyers drop between viewing a vehicle and starting checkout.
 * Always 204s — tracking must never surface an error to the user.
 */
async function handleTrack(req: VercelRequest, res: VercelResponse) {
	// Generous — one beacon per user interaction, but bounded against abuse.
	if (!rateLimit(req, res, { limit: 60, windowMs: 60_000 })) {
		return
	}
	try {
		const raw = await readRawBody(req)
		const body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
		const event = String(body.event ?? '') as EventType
		if (CLIENT_EVENTS.has(event)) {
			// Only keep a couple of low-cardinality, non-PII fields.
			const props: Record<string, unknown> = {}
			if (typeof body.placement === 'string')
				props.placement = body.placement.slice(0, 40)
			if (typeof body.src === 'string') props.src = body.src.slice(0, 40)
			void logEvent(event, props)
		}
	} catch {
		// Malformed beacon — ignore.
	}
	return res.status(204).end()
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
			// marks the row issued; it is also delivered by email. The result screen
			// keys off `stav`: paid (default) polls for the PDF, `ceka` (pending) shows
			// a "not finished / we'll email you" screen but still polls in case a bank
			// transfer settles, and `zruseno` (cancelled) shows a retry screen.
			successUrl: `${base}/certifikat/${code}?token=${downloadToken}`,
			pendingUrl: `${base}/certifikat/${code}?token=${downloadToken}&stav=ceka&vin=${cleanVin}`,
			cancelUrl: `${base}/certifikat/${code}?stav=zruseno&vin=${cleanVin}`
		})
	} catch (error) {
		console.error('Checkout creation failed:', error)
		void logEvent('certificate_error', { stage: 'checkout', vin: maskVin(cleanVin) })
		// A failure here means the customer can't even start paying — if it's the
		// provider/config rather than a fluke, every order is broken, so alert.
		void sendOperatorAlert('Platbu nelze zahájit', [
			`Vytvoření platby u poskytovatele ${PAYMENT_PROVIDER} selhalo (zákazník nemohl zaplatit).`,
			`VIN: ${maskVin(cleanVin)}`,
			`Chyba: ${error instanceof Error ? error.message : String(error)}`
		])
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

	void logEvent('certificate_created', {
		code,
		vin: maskVin(cleanVin),
		amountCzk
	})

	return res.status(201).json({ code, checkoutUrl: checkout.url })
}

/** Provider-appropriate 2xx acknowledgement (Comgate wants `code=0&message=OK`). */
function ackWebhook(res: VercelResponse) {
	const { contentType, body } = webhookAckBody()
	res.setHeader('Content-Type', contentType)
	return res.status(200).send(body)
}

/** POST /api/certificate/webhook — mark paid + deliver. Idempotent. */
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
	let parsed: Awaited<ReturnType<typeof verifyAndParseWebhook>>
	try {
		const rawBody = await readRawBody(req)
		const signature = req.headers['x-signature'] as string | undefined
		parsed = await verifyAndParseWebhook(rawBody, signature)
	} catch (error) {
		console.error('Webhook verification error:', error)
		return res.status(400).json({ error: 'Invalid webhook' })
	}

	// Bad signature / unhandled event, or not a completed payment — ack so the
	// provider stops retrying.
	if (!parsed?.paid) {
		return ackWebhook(res)
	}

	// Paid, but no VIN/certificate context — someone bought via the public Lemon
	// Squeezy checkout directly, bypassing our flow, so there's nothing to issue.
	// Never keep the money silently: alert for a manual refund.
	if (!parsed.certificateCode) {
		await logEvent('certificate_error', {
			stage: 'webhook_no_code',
			ref: parsed.ref
		})
		await sendOperatorAlert('Platba bez VIN (přímý checkout)', [
			'Přišla platba bez kontextu certifikátu — zřejmě přímé otevření platební brány.',
			`Provider ref: ${parsed.ref ?? '?'}`,
			'Certifikát nelze vystavit. Vyřešte ručně: vraťte platbu, nebo si od zákazníka vyžádejte VIN.'
		])
		return ackWebhook(res)
	}

	await ensureTables()

	// Match on the certificate code we set in metadata (round-trips reliably).
	// Only act on a still-pending row (idempotent on replays).
	const { rows } = await sql`
		UPDATE certificates
		SET status = 'issued', issued_at = now()
		WHERE code = ${parsed.certificateCode}
			AND status = 'pending'
		RETURNING code, vin, buyer_email, download_token, amount_czk;
	`

	if (rows.length === 0) {
		// No pending row flipped. Either a harmless replay of an already-issued cert,
		// or a paid event whose code we don't recognise at all — the latter means a
		// customer paid but has nothing to deliver, which is a real delivery failure.
		const { rows: existing } = await sql`
			SELECT 1 FROM certificates WHERE code = ${parsed.certificateCode} LIMIT 1;
		`
		if (existing.length === 0) {
			await logEvent('certificate_error', {
				stage: 'webhook_unknown_code',
				code: parsed.certificateCode
			})
			await sendOperatorAlert('Platba bez certifikátu', [
				'Platební brána potvrdila platbu, ale neznáme odpovídající certifikát.',
				`Kód: ${parsed.certificateCode}`,
				`Provider ref: ${parsed.ref ?? '?'}`,
				'Zákazník zaplatil, ale certifikát nelze doručit — zkontrolujte ručně.'
			])
		}
		return ackWebhook(res)
	}

	const cert = rows[0] as {
		code: string
		vin: string
		buyer_email: string
		download_token: string
		amount_czk: number | null
	}

	// Durable record of the sale (no operator email — the payment provider
	// notifies of sales; operator alerts are reserved for delivery failures).
	await logEvent('certificate_issued', {
		code: cert.code,
		vin: maskVin(cert.vin),
		amountCzk: cert.amount_czk
	})

	const base = getPublicBaseUrl()
	let emailDelivered = false
	try {
		emailDelivered = await sendCertificateEmail({
			to: cert.buyer_email,
			code: cert.code,
			vin: cert.vin,
			downloadUrl: `${base}/api/certificate/${cert.code}?token=${cert.download_token}`,
			verifyUrl: `${base}/overit/${cert.code}`,
			amountCzk: cert.amount_czk ?? getCertificatePriceCzk(),
			paidAt: new Date()
		})
	} catch (error) {
		// The certificate is paid + issued; a failed email must not 500 the webhook
		// (that would trigger retries and risk double-processing). Log and alert —
		// the buyer paid but didn't receive their certificate.
		console.error('Certificate email failed:', error)
	}

	// Paid + issued but the delivery email didn't go out → notify the operator so
	// they can resend manually. This is the core "ordered but not delivered" case.
	if (!emailDelivered) {
		await logEvent('certificate_error', {
			stage: 'delivery_email',
			code: cert.code
		})
		await sendOperatorAlert('Certifikát nedoručen', [
			'Certifikát byl zaplacen a vystaven, ale doručovací e-mail se nepodařilo odeslat.',
			`Kód: ${cert.code}`,
			`E-mail kupujícího: ${cert.buyer_email}`,
			`Stažení: ${base}/api/certificate/${cert.code}?token=${cert.download_token}`
		])
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
		// A token means a PDF request for a cert that isn't issued → real 404.
		// Without a token this is the public/polling metadata endpoint: "not issued
		// yet" is a normal state (the success page polls a pending cert), so answer
		// 200 {valid:false} instead of 404 to avoid noisy console errors while polling.
		return token
			? res.status(404).json({ error: 'Certifikát nenalezen.' })
			: res.status(200).json({ valid: false })
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
