import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserById, requireUserId } from '../_auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	const userId = requireUserId(req, res)
	if (!userId) {
		return
	}

	try {
		const user = await getUserById(userId)
		if (!user) {
			return res.status(404).json({ error: 'User not found' })
		}

		return res.status(200).json({ user })
	} catch (error) {
		console.error('Me error:', error)
		return res.status(500).json({ error: 'Internal server error' })
	}
}
