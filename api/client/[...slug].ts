/**
 * Client-zone endpoints, consolidated into one Serverless Function (the Hobby
 * plan caps a deployment at 12 functions). Routes by the first path segment:
 *
 *   /api/client/vehicles           → saved vehicles (GET/POST/PATCH/DELETE)
 *   /api/client/reminders          → reminders (GET/POST/PATCH/DELETE)
 *   /api/client/odometer-readings  → odometer log (GET/POST/PATCH/DELETE)
 *   /api/client/preferences        → notification/marketing prefs (GET/PATCH)
 *
 * Each segment's logic lives in its own api/_client*.ts helper (underscore-
 * prefixed, so it is NOT itself counted as a function). The frontend URLs are
 * unchanged — this only changes which file Vercel invokes.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleOdometer } from '../_clientOdometer'
import { handlePreferences } from '../_clientPreferences'
import { handleReminders } from '../_clientReminders'
import { handleVehicles } from '../_clientVehicles'

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>

const ROUTES: Record<string, Handler> = {
	vehicles: handleVehicles,
	reminders: handleReminders,
	'odometer-readings': handleOdometer,
	preferences: handlePreferences
}

/**
 * First path segment after /api/client/. Parsed from req.url rather than the
 * filesystem `slug` param: vercel.json's explicit `/api/(.*)` rewrite invokes the
 * function but doesn't populate the catch-all param, so req.query.slug is empty.
 * (Same reason as api/certificate/[...slug].ts.)
 */
function segment(req: VercelRequest): string | undefined {
	const path = (req.url ?? '').split('?')[0]
	const m = path.match(/\/api\/client\/([^/?]+)/)
	return m ? decodeURIComponent(m[1]) : undefined
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const route = segment(req)
	const fn = route ? ROUTES[route] : undefined
	if (!fn) {
		return res.status(404).json({ error: 'Not found' })
	}
	return fn(req, res)
}
