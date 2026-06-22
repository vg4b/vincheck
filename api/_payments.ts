/**
 * Thin payment-provider abstraction for one-off certificate purchases.
 *
 * Provider: Lemon Squeezy (Merchant of Record). As MoR, Lemon Squeezy is the
 * legal seller and collects + remits EU VAT for us, so we never file a VAT
 * return. Chosen because it is the only fast/self-serve MoR that bills in CZK
 * (Creem is USD/EUR only); Paddle also does CZK but is approval-gated. Only this
 * file knows about the provider — swapping it means reimplementing
 * `createCheckout` + `verifyAndParseWebhook` and nothing else.
 *
 * Implemented with plain fetch + crypto (no SDK). The charged amount lives on the
 * Lemon Squeezy variant (LEMONSQUEEZY_VARIANT_ID), so our CERTIFICATE_PRICE_CZK
 * is display-only and must match the variant price.
 */
import crypto from 'crypto'

/** Stored on each certificate row so we can attribute webhooks to a provider. */
export const PAYMENT_PROVIDER = 'lemonsqueezy'

const API_BASE = 'https://api.lemonsqueezy.com/v1'
// Lemon Squeezy speaks JSON:API — both headers are required.
const JSONAPI = 'application/vnd.api+json'

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

/**
 * Resolve a mode-specific Lemon Squeezy secret. The API key and webhook secret
 * differ between test and live mode (the store/variant ids don't). In non-live
 * mode (local, preview, tests) prefer the `_TEST` variant, falling back to the
 * base name; in live mode always use the base (live) name.
 */
function lsModeEnv(base: string): string {
	if (!isLiveMode()) {
		const test = process.env[`${base}_TEST`]
		if (test) return test
	}
	return env(base)
}

export interface CheckoutParams {
	/** Display price in whole crowns — informational; the real charge is the
	 *  Lemon Squeezy variant's configured price. Kept for the stored record. */
	amountCzk: number
	email: string
	/** Public certificate code — round-trips via checkout custom data. */
	certificateCode: string
	vin: string
	successUrl: string
	/** Unused by Lemon Squeezy — kept for interface stability. */
	cancelUrl: string
}

export interface CheckoutResult {
	/** Hosted payment page to redirect the buyer to. */
	url: string
	/** Provider reference (checkout id, if returned) — stored as provider_ref. */
	ref: string | null
}

export async function createCheckout(
	params: CheckoutParams
): Promise<CheckoutResult> {
	const body = {
		data: {
			type: 'checkouts',
			attributes: {
				checkout_data: {
					email: params.email,
					// Round-trips to the webhook (meta.custom_data) to match our row.
					custom: { certificate_code: params.certificateCode, vin: params.vin }
				},
				product_options: { redirect_url: params.successUrl }
			},
			relationships: {
				store: {
					data: { type: 'stores', id: env('LEMONSQUEEZY_STORE_ID') }
				},
				variant: {
					data: { type: 'variants', id: env('LEMONSQUEEZY_VARIANT_ID') }
				}
			}
		}
	}

	const res = await fetch(`${API_BASE}/checkouts`, {
		method: 'POST',
		headers: {
			Accept: JSONAPI,
			'Content-Type': JSONAPI,
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

export interface WebhookResult {
	/** Provider reference to match against `provider_ref` (may be null). */
	ref: string | null
	/** The certificate code carried in custom data — the primary match key. */
	certificateCode: string | null
	/** True once the payment is actually captured. */
	paid: boolean
}

/**
 * Verify the webhook signature and extract what the endpoint needs. Returns null
 * for unknown/unhandled events or a bad signature — the caller treats null as
 * "ignore, respond 200" so the provider stops retrying.
 *
 * Signature is HMAC-SHA256(secret, rawBody) compared in hex (X-Signature header),
 * so the webhook route disables body parsing and passes the exact bytes received.
 */
export function verifyAndParseWebhook(
	rawBody: Buffer | string,
	signature: string | undefined
): WebhookResult | null {
	const secret = lsModeEnv('LEMONSQUEEZY_WEBHOOK_SECRET')
	if (!signature) return null

	const expected = crypto
		.createHmac('sha256', secret)
		.update(rawBody)
		.digest('hex')

	const sigBuf = Buffer.from(signature)
	const expBuf = Buffer.from(expected)
	if (sigBuf.length !== expBuf.length) return null
	if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null

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

	// One-off product purchase → `order_created`.
	if (event.meta?.event_name !== 'order_created') {
		return null
	}
	const status = event.data?.attributes?.status
	return {
		ref: event.data?.id ?? null,
		certificateCode: event.meta?.custom_data?.certificate_code ?? null,
		// `order_created` only fires on a real order; status check is belt-and-braces.
		paid: status ? status === 'paid' : true
	}
}
