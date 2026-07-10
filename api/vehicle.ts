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
import { sql } from '@vercel/postgres'
import crypto from 'crypto'
import { ensureTables } from './_db'
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

// 7-char base58 token (URL-friendly, unambiguous — no 0/O/I/l). Short because the
// shared data is public anyway; the rare collision is retried against the PK.
const SHARE_ALPHABET =
	'123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function shortToken(): string {
	let s = ''
	for (let i = 0; i < 7; i++) {
		s += SHARE_ALPHABET[crypto.randomInt(SHARE_ALPHABET.length)]
	}
	return s
}

// Column is from a fixed set (never user input) so switching keeps sql tagged.
function existingShare(col: 'vin' | 'tp' | 'orv', val: string) {
	if (col === 'vin')
		return sql`SELECT token FROM vehicle_shares WHERE vin = ${val} LIMIT 1;`
	if (col === 'tp')
		return sql`SELECT token FROM vehicle_shares WHERE tp = ${val} LIMIT 1;`
	return sql`SELECT token FROM vehicle_shares WHERE orv = ${val} LIMIT 1;`
}
function insertShare(col: 'vin' | 'tp' | 'orv', val: string, token: string) {
	if (col === 'vin')
		return sql`INSERT INTO vehicle_shares (token, vin) VALUES (${token}, ${val});`
	if (col === 'tp')
		return sql`INSERT INTO vehicle_shares (token, tp) VALUES (${token}, ${val});`
	return sql`INSERT INTO vehicle_shares (token, orv) VALUES (${token}, ${val});`
}

/** One permanent token per identifier: reuse if present, else insert, retrying
 *  on the rare token-PK collision or a concurrent create. */
async function createOrGetShare(
	col: 'vin' | 'tp' | 'orv',
	val: string
): Promise<string> {
	const found = await existingShare(col, val)
	if (found.rows[0]) return found.rows[0].token as string
	for (let i = 0; i < 6; i++) {
		const token = shortToken()
		try {
			await insertShare(col, val, token)
			return token
		} catch (error) {
			if ((error as { code?: string })?.code === '23505') {
				const again = await existingShare(col, val)
				if (again.rows[0]) return again.rows[0].token as string
				continue // token collision → try a new token
			}
			throw error
		}
	}
	throw new Error('could not allocate share token')
}

async function handleCreateShare(req: VercelRequest, res: VercelResponse) {
	const body = (req.body ?? {}) as { vin?: unknown; tp?: unknown; orv?: unknown }
	const vin =
		typeof body.vin === 'string'
			? body.vin.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
			: ''
	const tp = typeof body.tp === 'string' ? body.tp.trim() : ''
	const orv = typeof body.orv === 'string' ? body.orv.trim() : ''
	// Only accept a plausibly-shaped identifier to bound abuse of a public write.
	const id: { col: 'vin' | 'tp' | 'orv'; val: string } | null =
		vin.length === 17
			? { col: 'vin', val: vin }
			: tp.length >= 6 && tp.length <= 10
				? { col: 'tp', val: tp }
				: orv.length >= 5 && orv.length <= 9
					? { col: 'orv', val: orv }
					: null
	if (!id) {
		return res.status(400).json({ error: 'Neplatný identifikátor vozidla.' })
	}
	// The bar creates a share on every detail view, so keep the hot path cheap:
	// skip ensureTables() and only run it (once) if the table isn't there yet.
	try {
		const token = await createOrGetShare(id.col, id.val)
		return res.status(200).json({ shareToken: token })
	} catch (error) {
		if ((error as { code?: string })?.code === '42P01') {
			try {
				await ensureTables()
				const token = await createOrGetShare(id.col, id.val)
				return res.status(200).json({ shareToken: token })
			} catch (retryError) {
				console.error('Share creation failed after migrate:', retryError)
				return res.status(500).json({ error: 'Server error' })
			}
		}
		console.error('Share creation failed:', error)
		return res.status(500).json({ error: 'Server error' })
	}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	setCorsHeaders(req, res)

	if (req.method === 'OPTIONS') {
		return res.status(200).end()
	}
	if (req.method !== 'GET' && req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' })
	}
	if (!rateLimit(req, res, { limit: 60, windowMs: 60_000 })) {
		return
	}

	// POST → create (or return the existing) permanent public share link for a
	// vehicle identifier. One token per VIN/TP/ORV; the data itself is public.
	if (req.method === 'POST') {
		return handleCreateShare(req, res)
	}

	let vin = first(req.query.vin)
	let tp = first(req.query.tp)
	let orv = first(req.query.orv)

	// Public vehicle-share link: resolve the token to the vehicle's identifiers,
	// then fall through to the normal cache lookup. Only the public registry
	// snapshot + free history is returned — no owner/private data.
	const share = first(req.query.share)
	if (share) {
		try {
			const { rows } = await sql`
				SELECT vin, tp, orv FROM vehicle_shares WHERE token = ${share} LIMIT 1;
			`
			if (!rows[0]) {
				return res.status(404).json({ error: 'Sdílené vozidlo nenalezeno.' })
			}
			vin = (rows[0].vin as string | null) ?? undefined
			tp = (rows[0].tp as string | null) ?? undefined
			orv = (rows[0].orv as string | null) ?? undefined
		} catch (error) {
			console.error('Share token resolution failed:', error)
			return res.status(500).json({ error: 'Server error' })
		}
	}

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
					// Dates + official protocol numbers are already public (STK/ISTP);
					// only the km values stay behind the paywall.
					readings: mileage.readings.map((r) => ({
						date: r.date,
						protocol: r.protocol
					})),
					// Whether an "expected mileage now" estimate is available — a
					// boolean teaser only; the figures themselves stay paid.
					hasPrediction: mileage.prediction != null
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
