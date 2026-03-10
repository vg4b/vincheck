import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
	generateReminderEmailHtml,
	getBaseUrl,
	formatDate,
	reminderTypeLabels
} from '../_reminderEmail'

const REMINDER_TYPES = [
	'stk',
	'povinne_ruceni',
	'havarijni_pojisteni',
	'servis',
	'prezuti_pneu',
	'dalnicni_znamka',
	'jine'
] as const

/**
 * Dev endpoint pro náhled reminder emailů.
 * GET /api/dev/preview-reminder-email?type=povinne_ruceni&vin=WF0FXXWPCFHD05923
 *
 * Parametry:
 * - type: typ připomínky (stk, povinne_ruceni, havarijni_pojisteni, servis, ...)
 * - vin: volitelné, pro typy které ho využívají
 *
 * Bezpečnost: pouze v development nebo s ?secret=DEV_PREVIEW_SECRET
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	const devSecret = process.env.DEV_PREVIEW_SECRET
	const isDev = process.env.NODE_ENV === 'development'
	const secretMatch = devSecret && req.query.secret === devSecret

	if (!isDev && !secretMatch) {
		return res.status(403).json({
			error: 'Preview only in development or with valid DEV_PREVIEW_SECRET'
		})
	}

	const type = (req.query.type as string) || 'povinne_ruceni'
	const vin = (req.query.vin as string) || null

	if (!REMINDER_TYPES.includes(type as (typeof REMINDER_TYPES)[number])) {
		return res.status(400).json({
			error: `Invalid type. Use one of: ${REMINDER_TYPES.join(', ')}`
		})
	}

	const baseUrl = getBaseUrl()
	const dueDate = new Date()
	dueDate.setDate(dueDate.getDate() + 14)

	const html = generateReminderEmailHtml({
		vehicleName: 'Škoda Octavia 1.6 TDI',
		reminderType: reminderTypeLabels[type] || type,
		reminderTypeRaw: type,
		dueDate: formatDate(dueDate.toISOString()),
		note: type === 'stk' ? 'Kontrola brzd a podvozku' : null,
		unsubscribeUrl: `${baseUrl}/api/email/unsubscribe?token=preview`,
		vehicleVin: vin?.trim() || null,
		baseUrl
	})

	res.setHeader('Content-Type', 'text/html; charset=utf-8')
	return res.status(200).send(html)
}
