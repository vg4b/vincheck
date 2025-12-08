/**
 * Vercel Serverless Function
 * Deploy to Vercel - this file will automatically be available at /api/vehicle
 */

const API_KEY = process.env.API_KEY
const API_BASE_URL = process.env.API_BASE_URL

// Helper function to set CORS headers
function setCorsHeaders(req, res) {
	const origin = req.headers.origin
	// Allow requests from vininfo.cz, localhost (for development), and the Vercel preview URL
	const allowedOrigins = [
		'https://vininfo.cz',
		'https://www.vininfo.cz',
		'http://localhost:3000',
		'http://localhost:3001',
		'http://127.0.0.1:3000',
		'http://127.0.0.1:3001'
	]

	// Check if origin is allowed
	if (origin && allowedOrigins.includes(origin)) {
		res.setHeader('Access-Control-Allow-Origin', origin)
	} else if (!origin) {
		// No origin header (same-origin request or server-to-server)
		res.setHeader('Access-Control-Allow-Origin', '*')
	} else if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
		// Allow any localhost for development
		res.setHeader('Access-Control-Allow-Origin', origin)
	} else {
		// For production, only allow vininfo.cz
		res.setHeader('Access-Control-Allow-Origin', 'https://vininfo.cz')
	}

	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
	res.setHeader('Access-Control-Max-Age', '86400')
}

export default async function handler(req, res) {
	// Set CORS headers for all responses
	setCorsHeaders(req, res)

	// Handle preflight
	if (req.method === 'OPTIONS') {
		return res.status(200).end()
	}

	// Only allow GET requests
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	try {
		// Validate environment variables
		if (!API_KEY) {
			console.error('API_KEY environment variable is not set')
			return res.status(500).json({ error: 'Server configuration error' })
		}

		const { vin, tp, orv } = req.query

		// Validate that at least one parameter is provided
		if (!vin && !tp && !orv) {
			return res
				.status(400)
				.json({ error: 'Missing required parameter: vin, tp, or orv' })
		}

		// Build API URL
		let apiUrl = API_BASE_URL
		if (vin) {
			apiUrl += `?vin=${encodeURIComponent(vin)}`
		} else if (tp) {
			apiUrl += `?tp=${encodeURIComponent(tp)}`
		} else if (orv) {
			apiUrl += `?orv=${encodeURIComponent(orv)}`
		}

		// Make request to the API
		const response = await fetch(apiUrl, {
			headers: {
				api_key: API_KEY
			}
		})

		if (!response.ok) {
			return res.status(response.status).json({
				error: `API error: ${response.status} ${response.statusText}`
			})
		}

		const data = await response.json()
		return res.status(200).json(data)
	} catch (error) {
		console.error('Proxy error:', error)
		return res.status(500).json({ error: 'Internal server error' })
	}
}
