/**
 * Certificate feature flag.
 *
 * The paid certificate product is built but not launched publicly yet. We ship it
 * to production hidden so we can test the live payment flow (real Lemon Squeezy
 * live keys + production webhook) without exposing it to regular visitors.
 *
 * Visibility resolves in this order:
 *   1. Build-time: REACT_APP_CERTIFICATE_ENABLED === 'true' → on for everyone.
 *   2. Manual override for in-prod testing: append ?cert=preview to any URL to
 *      switch it on for this browser (persisted), ?cert=off to switch it back.
 *   3. Otherwise off.
 *
 * This only gates the promotional/entry points (nav link, product cards, landing
 * page). The post-purchase pages (/certifikat/:code, /overit/:code) and the API
 * stay always-on so issued certificates remain downloadable and verifiable.
 */
const OVERRIDE_KEY = 'vininfo_cert_preview'

export function isCertificateEnabled(): boolean {
	if (process.env.REACT_APP_CERTIFICATE_ENABLED === 'true') {
		return true
	}
	if (typeof window === 'undefined') {
		return false
	}
	try {
		const override = new URLSearchParams(window.location.search).get('cert')
		if (override === 'preview') {
			window.localStorage.setItem(OVERRIDE_KEY, '1')
		} else if (override === 'off') {
			window.localStorage.removeItem(OVERRIDE_KEY)
		}
		return window.localStorage.getItem(OVERRIDE_KEY) === '1'
	} catch {
		return false
	}
}
