/**
 * Best-effort client funnel beacon. Fires an allowlisted event to
 * `POST /api/certificate/track` (a sub-route of the certificate function, so it
 * costs no extra Vercel function). Uses `sendBeacon` where available so the event
 * survives a navigation (e.g. clicking an outbound partner link), falling back to
 * a keepalive fetch. Never throws — tracking must not affect the UI.
 */
export type ClientEvent =
	| 'comparison_view'
	| 'cert_cta_click'
	| 'checkout_modal_open'
	| 'partner_click'

const TRACK_URL = '/api/certificate/track'

export function trackEvent(
	event: ClientEvent,
	props: Record<string, string> = {}
): void {
	try {
		const body = JSON.stringify({ event, ...props })
		if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
			navigator.sendBeacon(
				TRACK_URL,
				new Blob([body], { type: 'application/json' })
			)
			return
		}
		void fetch(TRACK_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
			keepalive: true
		})
	} catch {
		// Beacon is best-effort; swallow everything.
	}
}
