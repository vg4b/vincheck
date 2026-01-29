import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sql } from '@vercel/postgres'
import { ensureTables } from '../_db'
import { getUserById, setAuthCookie } from '../_auth'

const getJwtSecret = (): string => {
	const secret = process.env.JWT_SECRET
	if (!secret) {
		throw new Error('JWT_SECRET environment variable is not set')
	}
	return secret
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	try {
		await ensureTables()

		const { email, password } = req.body ?? {}
		if (!email || !password) {
			return res.status(400).json({ error: 'Email and password are required' })
		}

		if (typeof email !== 'string' || typeof password !== 'string') {
			return res.status(400).json({ error: 'Invalid payload' })
		}

		const normalizedEmail = normalizeEmail(email)
		const userResult = await sql`
			SELECT id, password_hash
			FROM users
			WHERE email = ${normalizedEmail}
			LIMIT 1;
		`

		const userRow = userResult.rows[0]
		if (!userRow) {
			return res.status(401).json({ error: 'Invalid credentials' })
		}

		const matches = await bcrypt.compare(password, userRow.password_hash)
		if (!matches) {
			return res.status(401).json({ error: 'Invalid credentials' })
		}

		const token = jwt.sign({ userId: userRow.id }, getJwtSecret(), {
			expiresIn: '30d'
		})
		setAuthCookie(res, token)

		const user = await getUserById(userRow.id)
		return res.status(200).json({ user })
	} catch (error) {
		console.error('Login error:', error)
		return res.status(500).json({ error: 'Internal server error' })
	}
}
