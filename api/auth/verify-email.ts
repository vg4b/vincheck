import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import { ensureTables } from '../_db'
import { getUserById, requireUserId } from '../_auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	try {
		await ensureTables()

		const userId = requireUserId(req, res)
		if (!userId) {
			return
		}

		const { code } = req.body ?? {}
		if (!code || typeof code !== 'string') {
			return res.status(400).json({ error: 'Ověřovací kód je povinný' })
		}

		// Check if the code matches and is not expired
		const result = await sql`
			SELECT id, email_verification_code, email_verification_expires_at, email_verified_at
			FROM users
			WHERE id = ${userId}
			LIMIT 1;
		`

		const userRow = result.rows[0]
		if (!userRow) {
			return res.status(404).json({ error: 'Uživatel nenalezen' })
		}

		if (userRow.email_verified_at) {
			return res.status(400).json({ error: 'Email je již ověřen' })
		}

		if (userRow.email_verification_code !== code) {
			return res.status(400).json({ error: 'Neplatný ověřovací kód' })
		}

		const expiresAt = new Date(userRow.email_verification_expires_at)
		if (expiresAt < new Date()) {
			return res.status(400).json({ error: 'Platnost ověřovacího kódu vypršela' })
		}

		// Mark email as verified
		await sql`
			UPDATE users
			SET email_verified_at = now(),
				email_verification_code = NULL,
				email_verification_expires_at = NULL
			WHERE id = ${userId};
		`

		const user = await getUserById(userId)
		return res.status(200).json({ user })
	} catch (error) {
		console.error('Verify email error:', error)
		return res.status(500).json({ error: 'Internal server error' })
	}
}
