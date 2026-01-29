import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import { ensureTables } from '../_db'
import { getUserById, requireUserId } from '../_auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
	await ensureTables()

	const userId = requireUserId(req, res)
	if (!userId) {
		return
	}

	if (req.method === 'GET') {
		const user = await getUserById(userId)
		if (!user) {
			return res.status(404).json({ error: 'User not found' })
		}

		return res.status(200).json({
			preferences: {
				notifications_enabled: user.notifications_enabled,
				marketing_enabled: user.marketing_enabled
			}
		})
	}

	if (req.method === 'PATCH') {
		const { notificationsEnabled, marketingEnabled } = req.body ?? {}

		const updates: string[] = []
		const values: (boolean | string)[] = []

		if (typeof notificationsEnabled === 'boolean') {
			updates.push(`notifications_enabled = $${updates.length + 1}`)
			values.push(notificationsEnabled)
		}

		if (typeof marketingEnabled === 'boolean') {
			updates.push(`marketing_enabled = $${updates.length + 1}`)
			values.push(marketingEnabled)
		}

		if (updates.length === 0) {
			return res.status(400).json({ error: 'No fields to update' })
		}

		values.push(userId)

		const query = `
			UPDATE users
			SET ${updates.join(', ')}
			WHERE id = $${updates.length + 1}
			RETURNING id, notifications_enabled, marketing_enabled;
		`

		const result = await sql.query(query, values)
		const updated = result.rows[0]

		return res.status(200).json({
			preferences: {
				notifications_enabled: updated.notifications_enabled,
				marketing_enabled: updated.marketing_enabled
			}
		})
	}

	return res.status(405).json({ error: 'Method not allowed' })
}
