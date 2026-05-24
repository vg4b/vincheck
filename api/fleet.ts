/**
 * Vercel Serverless Function — available at /api/fleet.
 *
 * Reverse lookup: vehicles owned/operated by a legal entity (IČO), composed from
 * the registry cache. Cache-only (the live dataovozidlech.cz API has no
 * reverse-by-IČO capability). Returns a bounded sample + capped count — big
 * leasing fleets reach hundreds of thousands of vehicles.
 *
 * Public business-register data. TODO (follow-up): per-IP rate limiting.
 * See docs/VEHICLE_HISTORY_PANEL.md.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isCacheConfigured, lookupVehiclesByIco } from './_vehicleCache'

const first = (value: string | string[] | undefined): string | undefined =>
	Array.isArray(value) ? value[0] : value

function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
	const origin = req.headers.origin
	if (!origin) {
		res.setHeader('Access-Control-Allow-Origin', '*')
	} else if (
		origin.includes('vininfo.cz') ||
		origin.includes('localhost') ||
		origin.includes('127.0.0.1') ||
		origin.endsWith('.vercel.app')
	) {
		res.setHeader('Access-Control-Allow-Origin', origin)
	} else {
		res.setHeader('Access-Control-Allow-Origin', 'https://vininfo.cz')
	}
	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
	res.setHeader('Vary', 'Origin')
}

// Registry data changes monthly; a day of CDN caching absorbs repeat lookups.
function setEdgeCacheHeaders(res: VercelResponse) {
	res.setHeader(
		'Cache-Control',
		'public, s-maxage=86400, stale-while-revalidate=604800'
	)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	setCorsHeaders(req, res)

	if (req.method === 'OPTIONS') {
		return res.status(200).end()
	}
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	// Czech IČO is 8 digits; accept 5–9 to be lenient on leading zeros / edge cases.
	const ico = first(req.query.ico)?.replace(/\D/g, '')
	if (!ico || ico.length < 5 || ico.length > 9) {
		return res.status(400).json({ error: 'Neplatné IČO' })
	}

	if (!isCacheConfigured()) {
		return res.status(503).json({ error: 'Služba je dočasně nedostupná' })
	}

	try {
		const result = await lookupVehiclesByIco(ico)
		if (!result) {
			return res
				.status(404)
				.json({ error: 'Pro toto IČO nebyla nalezena žádná vozidla' })
		}
		setEdgeCacheHeaders(res)
		return res.status(200).json(result)
	} catch (error) {
		console.error('Fleet lookup failed:', error)
		return res.status(500).json({ error: 'Interní chyba serveru' })
	}
}
