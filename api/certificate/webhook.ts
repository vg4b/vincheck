/**
 * POST /api/certificate/webhook — payment provider callback.
 *
 * Verifies the signature over the RAW request body (so body parsing is disabled),
 * flips the matching certificate to `issued`, and emails the buyer a download
 * link. Idempotent: replays of an already-issued certificate are a no-op.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import { ensureTables } from '../_db'
import { verifyAndParseWebhook } from '../_payments'
import { sendCertificateEmail } from '../_email'
import { getPublicBaseUrl } from '../_certificate'

// Signature is computed over the exact bytes received — never let Vercel parse it.
export const config = { api: { bodyParser: false } }

async function readRawBody(req: VercelRequest): Promise<Buffer> {
	const chunks: Buffer[] = []
	for await (const chunk of req) {
		chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
	}
	return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

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
