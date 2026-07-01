/**
 * Thin payment-provider abstraction for one-off certificate purchases.
 *
 * Two providers are implemented; pick via the PAYMENT_PROVIDER env var:
 *   - 'comgate'      — Comgate (Czech PSP). We (the OSVČ) are the seller; as a
 *                      neplátce we charge no VAT on CZ sales. Its fees are a
 *                      domestic supply, so they don't trigger "identifikovaná
 *                      osoba" (unlike a foreign MoR). Cheaper per 99 Kč sale.
 *   - 'lemonsqueezy' — Lemon Squeezy (Merchant of Record). Kept as a fallback:
 *                      LS is the legal seller and remits EU VAT for us, but its
 *                      fees are a foreign service. Left in place so we can switch
 *                      back by flipping PAYMENT_PROVIDER.
 *
 * Only this file knows about the providers. The rest of the app uses
 * `createCheckout` + `verifyAndParseWebhook`, which dispatch on PAYMENT_PROVIDER.
 * Implemented with plain fetch + crypto (no SDK).
 */
import crypto from 'crypto'

/** Active provider. Defaults to Comgate; set PAYMENT_PROVIDER=lemonsqueezy to use
 *  the MoR fallback. Stored on each certificate row for webhook attribution. */
export const PAYMENT_PROVIDER: 'comgate' | 'lemonsqueezy' =
	process.env.PAYMENT_PROVIDER === 'lemonsqueezy' ? 'lemonsqueezy' : 'comgate'

function env(name: string): string {
	const v = process.env[name]
	if (!v) throw new Error(`${name} is not set`)
	return v
}

/**
 * Live only on the real production deployment. Vercel sets NODE_ENV=production on
 * *preview* deploys too, so key off VERCEL_ENV when present (production | preview
 * | development) and fall back to NODE_ENV off-Vercel (local scripts, tests).
 */
function isLiveMode(): boolean {
	if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production'
	return process.env.NODE_ENV === 'production'
}

/** Timing-safe string compare (equal-length-guarded). */
function safeEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a)
	const bb = Buffer.from(b)
	return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}

export interface CheckoutParams {
	/** Display price in whole crowns. With Comgate this is the charged amount;
	 *  with Lemon Squeezy the real charge is the variant price (display-only). */
	amountCzk: number
	email: string
	/** Public certificate code — round-trips so the webhook can match our row. */
	certificateCode: string
	vin: string
	successUrl: string
	cancelUrl: string
	/** Where to send a payment that was initiated but not completed (Comgate
	 *  PENDING — e.g. the buyer clicked "back to shop", or a bank transfer is
	 *  still settling). Defaults to successUrl when omitted. */
	pendingUrl?: string
}

export interface CheckoutResult {
	/** Hosted payment page to redirect the buyer to. */
	url: string
	/** Provider reference (checkout/transaction id, if any) — stored as provider_ref. */
	ref: string | null
}

export interface WebhookResult {
	/** Provider reference to match against `provider_ref` (may be null). */
	ref: string | null
	/** The certificate code carried back by the provider — the primary match key. */
	certificateCode: string | null
	/** True once the payment is actually captured. */
	paid: boolean
}

// --- Public interface: dispatch on the active provider ---------------------

export async function createCheckout(
	params: CheckoutParams
): Promise<CheckoutResult> {
	return PAYMENT_PROVIDER === 'comgate'
		? comgateCreateCheckout(params)
		: lemonSqueezyCreateCheckout(params)
}

/**
 * Verify + parse a payment webhook. Returns null for unknown/unhandled events or
 * a failed verification — the caller treats null as "ignore, respond 2xx" so the
 * provider stops retrying. Async because Comgate re-queries the authoritative
 * status server-to-server.
 */
export async function verifyAndParseWebhook(
	rawBody: Buffer | string,
	signature: string | undefined
): Promise<WebhookResult | null> {
	return PAYMENT_PROVIDER === 'comgate'
		? comgateVerifyWebhook(rawBody)
		: lemonSqueezyVerifyWebhook(rawBody, signature)
}

// --- Comgate (Czech PSP, HTTP API v1.0, form-encoded) ----------------------
//
// Auth = merchant + secret in the body. The push notification carries our secret
// (so we can authenticate it) plus refId (= our certificate code) and status; we
// additionally re-query /status, which Comgate recommends as the source of truth.

const COMGATE_BASE = 'https://payments.comgate.cz/v1.0'

function comgateForm(params: Record<string, string>): string {
	return new URLSearchParams(params).toString()
}

async function comgatePost(
	path: string,
	params: Record<string, string>
): Promise<URLSearchParams> {
	const res = await fetch(`${COMGATE_BASE}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: comgateForm(params)
	})
	const text = await res.text()
	if (!res.ok) {
		throw new Error(`Comgate ${path} HTTP ${res.status}: ${text}`)
	}
	return new URLSearchParams(text)
}

async function comgateCreateCheckout(
	params: CheckoutParams
): Promise<CheckoutResult> {
	const out = await comgatePost('/create', {
		merchant: env('COMGATE_MERCHANT'),
		secret: env('COMGATE_SECRET'),
		price: String(Math.round(params.amountCzk * 100)), // haléře
		curr: 'CZK',
		label: 'Certifikát historie vozidla',
		refId: params.certificateCode,
		email: params.email,
		method: 'ALL',
		prepareOnly: 'true',
		lang: 'cs',
		country: 'CZ',
		url_paid: params.successUrl,
		url_cancelled: params.cancelUrl,
		url_pending: params.pendingUrl ?? params.successUrl,
		// Notification URL is set in the Comgate portal (e-shop connection); it must
		// point at /api/certificate/webhook.
		...(isLiveMode() ? {} : { test: 'true' })
	})

	if (out.get('code') !== '0') {
		throw new Error(`Comgate create failed: ${out.toString()}`)
	}
	const url = out.get('redirect')
	if (!url) {
		throw new Error('Comgate did not return a redirect URL')
	}
	return { url, ref: out.get('transId') }
}

/** Confirm a transaction is actually PAID via the authoritative status method. */
async function comgateConfirmPaid(transId: string): Promise<boolean> {
	const out = await comgatePost('/status', {
		merchant: env('COMGATE_MERCHANT'),
		secret: env('COMGATE_SECRET'),
		transId
	})
	return out.get('code') === '0' && out.get('status') === 'PAID'
}

async function comgateVerifyWebhook(
	rawBody: Buffer | string
): Promise<WebhookResult | null> {
	const body = new URLSearchParams(
		typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
	)
	const transId = body.get('transId')
	if (!transId) {
		return null
	}
	// Authenticity: the notification echoes our secret. Verify before trusting it.
	const notifSecret = body.get('secret')
	if (!notifSecret || !safeEqual(notifSecret, env('COMGATE_SECRET'))) {
		return null
	}
	// Source of truth: re-query the status server-to-server (Comgate's advice).
	const paid = await comgateConfirmPaid(transId)
	return { ref: transId, certificateCode: body.get('refId'), paid }
}

/** Body Comgate expects in the 2xx notification acknowledgement. */
export function webhookAckBody(): { contentType: string; body: string } {
	return PAYMENT_PROVIDER === 'comgate'
		? { contentType: 'text/plain', body: 'code=0&message=OK' }
		: { contentType: 'application/json', body: JSON.stringify({ received: true }) }
}

// --- Lemon Squeezy (Merchant of Record, JSON:API) — kept as a fallback ------
//
// The charged amount lives on the LS variant (LEMONSQUEEZY_VARIANT_ID), so
// CERTIFICATE_PRICE_CZK is display-only and must match the variant price. API
// key / webhook secret / variant id differ by test vs live mode (store id shared).

const LS_API_BASE = 'https://api.lemonsqueezy.com/v1'
const LS_JSONAPI = 'application/vnd.api+json'

/** Resolve a mode-specific Lemon Squeezy value (prefers *_TEST off production). */
function lsModeEnv(base: string): string {
	if (!isLiveMode()) {
		const test = process.env[`${base}_TEST`]
		if (test) return test
	}
	return env(base)
}

async function lemonSqueezyCreateCheckout(
	params: CheckoutParams
): Promise<CheckoutResult> {
	const body = {
		data: {
			type: 'checkouts',
			attributes: {
				checkout_data: {
					email: params.email,
					billing_address: { country: 'CZ' },
					custom: { certificate_code: params.certificateCode, vin: params.vin }
				},
				product_options: { redirect_url: params.successUrl }
			},
			relationships: {
				store: { data: { type: 'stores', id: env('LEMONSQUEEZY_STORE_ID') } },
				variant: {
					data: { type: 'variants', id: lsModeEnv('LEMONSQUEEZY_VARIANT_ID') }
				}
			}
		}
	}

	const res = await fetch(`${LS_API_BASE}/checkouts`, {
		method: 'POST',
		headers: {
			Accept: LS_JSONAPI,
			'Content-Type': LS_JSONAPI,
			Authorization: `Bearer ${lsModeEnv('LEMONSQUEEZY_API_KEY')}`
		},
		body: JSON.stringify(body)
	})

	if (!res.ok) {
		const text = await res.text().catch(() => '')
		throw new Error(`Lemon Squeezy checkout failed: ${res.status} ${text}`)
	}

	const json = (await res.json()) as {
		data?: { id?: string; attributes?: { url?: string } }
	}
	const url = json.data?.attributes?.url
	if (!url) {
		throw new Error('Lemon Squeezy did not return a checkout url')
	}
	return { url, ref: json.data?.id ?? null }
}

/**
 * Verify the LS webhook signature (HMAC-SHA256(secret, rawBody) hex, X-Signature
 * header) and extract what the endpoint needs. The route disables body parsing
 * and passes the exact bytes so the HMAC matches.
 */
function lemonSqueezyVerifyWebhook(
	rawBody: Buffer | string,
	signature: string | undefined
): WebhookResult | null {
	const secret = lsModeEnv('LEMONSQUEEZY_WEBHOOK_SECRET')
	if (!signature) return null

	const expected = crypto
		.createHmac('sha256', secret)
		.update(rawBody)
		.digest('hex')
	if (!safeEqual(signature, expected)) return null

	let event: {
		meta?: { event_name?: string; custom_data?: { certificate_code?: string } }
		data?: { id?: string; attributes?: { status?: string } }
	}
	try {
		event = JSON.parse(
			typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
		)
	} catch {
		return null
	}

	if (event.meta?.event_name !== 'order_created') {
		return null
	}
	const status = event.data?.attributes?.status
	return {
		ref: event.data?.id ?? null,
		certificateCode: event.meta?.custom_data?.certificate_code ?? null,
		paid: status ? status === 'paid' : true
	}
}
