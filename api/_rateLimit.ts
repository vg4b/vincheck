import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Best-effort in-memory per-IP sliding-window rate limiter.
 *
 * NOTE: state lives per serverless instance, so it's NOT a distributed limiter
 * — a burst spread across many warm instances can exceed the nominal limit.
 * Combined with the endpoints' edge caching (repeat identical requests never
 * reach the function) it still blunts casual abuse and accidental loops. For
 * hard guarantees use Vercel Firewall (dashboard) or Upstash Ratelimit (Redis).
 */
type Timestamps = number[]
const buckets = new Map<string, Timestamps>()
let lastSweep = 0

function clientIp(req: VercelRequest): string {
	const xff = req.headers['x-forwarded-for']
	const raw = Array.isArray(xff) ? xff[0] : xff
	return raw?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
}

/**
 * Returns true if allowed. If the IP exceeded `limit` requests within
 * `windowMs`, sends 429 + Retry-After and returns false (caller should `return`).
 */
export function rateLimit(
	req: VercelRequest,
	res: VercelResponse,
	{ limit = 30, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): boolean {
	const now = Date.now()

	// Periodic sweep so the map can't grow unbounded across many IPs.
	if (now - lastSweep > windowMs) {
		for (const [ip, ts] of buckets) {
			const kept = ts.filter((t) => now - t < windowMs)
			if (kept.length) {
				buckets.set(ip, kept)
			} else {
				buckets.delete(ip)
			}
		}
		lastSweep = now
	}

	const ip = clientIp(req)
	const ts = (buckets.get(ip) ?? []).filter((t) => now - t < windowMs)

	if (ts.length >= limit) {
		const retryMs = windowMs - (now - ts[0])
		res.setHeader('Retry-After', Math.ceil(retryMs / 1000).toString())
		res
			.status(429)
			.json({ error: 'Příliš mnoho požadavků. Zkuste to prosím za chvíli.' })
		return false
	}

	ts.push(now)
	buckets.set(ip, ts)
	return true
}
