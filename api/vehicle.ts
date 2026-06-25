/**
 * Vercel Serverless Function — available at /api/vehicle.
 *
 * Cache-first vehicle lookup:
 *   1. Try the registry cache (Scaleway Postgres) — sub-50ms, no upstream call.
 *   2. On miss / stale / cache-not-configured, fall back to the live API
 *      (api.dataovozidlech.cz). No write-through: the live API returns no PČV.
 *   3. If the live API fails but we have a (stale) cache row, serve it with
 *      `_stale: true` rather than erroring.
 *
 * Successful responses get edge-cache headers so repeat lookups for the same
 * VIN are served from Vercel's CDN — caps DB/upstream load and cost under bursts.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { logEvent } from './_metrics'
import { rateLimit } from './_rateLimit'
import {
	isCacheConfigured,
	isCacheFresh,
	lookupVehicleFromCache
} from './_vehicleCache'

const API_KEY = process.env.API_KEY
const API_BASE_URL = process.env.API_BASE_URL

const first = (value: string | string[] | undefined): string | undefined =>
	Array.isArray(value) ? value[0] : value

function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
	const origin = req.headers.origin
	const allowedOrigins = [
		'https://vininfo.cz',
		'https://www.vininfo.cz',
		'http://localhost:3000',
		'http://localhost:3001',
		'http://127.0.0.1:3000',
		'http://127.0.0.1:3001'
	]

	if (origin && allowedOrigins.includes(origin)) {
		res.setHeader('Access-Control-Allow-Origin', origin)
	} else if (!origin) {
		res.setHeader('Access-Control-Allow-Origin', '*')
	} else if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
		res.setHeader('Access-Control-Allow-Origin', origin)
	} else if (origin.includes('vininfo.cz')) {
		res.setHeader('Access-Control-Allow-Origin', origin)
	} else if (origin.endsWith('.vercel.app')) {
		res.setHeader('Access-Control-Allow-Origin', origin)
	} else {
		res.setHeader('Access-Control-Allow-Origin', 'https://vininfo.cz')
	}

	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
	res.setHeader('Access-Control-Allow-Credentials', 'true')
	res.setHeader('Access-Control-Max-Age', '86400')
}

// Registry data changes monthly; a day of CDN caching is safe and absorbs
// repeat lookups. Vary on Origin so per-origin CORS headers cache correctly.
function setEdgeCacheHeaders(res: VercelResponse) {
	res.setHeader(
		'Cache-Control',
		'public, s-maxage=86400, stale-while-revalidate=604800'
	)
	res.setHeader('Vary', 'Origin')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	setCorsHeaders(req, res)

	if (req.method === 'OPTIONS') {
		return res.status(200).end()
	}
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' })
	}
	if (!rateLimit(req, res, { limit: 60, windowMs: 60_000 })) {
		return
	}

	const vin = first(req.query.vin)
	const tp = first(req.query.tp)
	const orv = first(req.query.orv)

	if (!vin && !tp && !orv) {
		return res
			.status(400)
			.json({ error: 'Missing required parameter: vin, tp, or orv' })
	}

	// Identifier kind for monitoring — never the value itself.
	const lookupBy = vin ? 'vin' : tp ? 'tp' : 'orv'

	// 1. Cache first. A cache failure must never break the lookup — fall through.
	let cached: Awaited<ReturnType<typeof lookupVehicleFromCache>> = null
	if (isCacheConfigured()) {
		try {
			cached = await lookupVehicleFromCache({ vin, tp, orv })
		} catch (error) {
			console.error('Vehicle cache lookup failed:', error)
		}
		if (cached && isCacheFresh(cached.snapshot)) {
			setEdgeCacheHeaders(res)
			// Fire-and-forget — must not add latency to the hot lookup path.
			void logEvent('vin_lookup', { by: lookupBy, source: 'cache' })
			// History is additive — present only on a cache hit (the live-API
			// fallback below can't produce it). See docs/VEHICLE_HISTORY_PANEL.md.
			//
			// Mileage is a PAID feature: never put exact km in the public response
			// (the blur would be cosmetic). Send only a teaser — count, inspection
			// dates (already public via STK history) and the rollback flag. The full
			// figures live server-side and are frozen into the certificate snapshot
			// for the PDF.
			const { mileage, ...restHistory } = cached.history
			const publicHistory = {
				...restHistory,
				mileage: {
					count: mileage.readings.length,
					rollbackSuspected: mileage.rollbackSuspected,
					readingDates: mileage.readings.map((r) => r.date)
				}
			}
			return res
				.status(200)
				.json({ ...cached.response, History: publicHistory })
		}
	}

	// 2. Cache miss / stale / not configured → live API.
	try {
		if (!API_KEY) {
			console.error('API_KEY environment variable is not set')
			// A stale cache row beats a hard error if the upstream is unusable.
			if (cached) {
				return res.status(200).json({ ...cached.response, _stale: true })
			}
			return res.status(500).json({ error: 'Server configuration error' })
		}

		const baseUrl =
			API_BASE_URL ||
			'https://api.dataovozidlech.cz/api/vehicletechnicaldata/v2'
		let apiUrl = baseUrl
		if (vin) {
			apiUrl += `?vin=${encodeURIComponent(vin)}`
		} else if (tp) {
			apiUrl += `?tp=${encodeURIComponent(tp)}`
		} else if (orv) {
			apiUrl += `?orv=${encodeURIComponent(orv)}`
		}

		const response = await fetch(apiUrl, { headers: { api_key: API_KEY } })

		if (!response.ok) {
			const errorBody = await response.text()
			console.error(
				'External API error:',
				response.status,
				response.statusText,
				errorBody
			)
			// Upstream is up but unhappy — prefer stale cache over an error.
			if (cached) {
				return res.status(200).json({ ...cached.response, _stale: true })
			}
			return res
				.status(response.status)
				.json({ error: 'Chyba při načítání dat o vozidle' })
		}

		const data = await response.json()
		setEdgeCacheHeaders(res)
		void logEvent('vin_lookup', { by: lookupBy, source: 'live' })
		return res.status(200).json(data)
	} catch (error) {
		console.error('Proxy error:', error)
		// Network failure to the upstream — serve stale cache if we have it.
		if (cached) {
			return res.status(200).json({ ...cached.response, _stale: true })
		}
		return res.status(500).json({ error: 'Internal server error' })
	}
}
