import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { generateVerificationCode, getJwtSecret, getUserById, setAuthCookie } from '../_auth'
import { ensureTables } from '../_db'
import { sendVerificationEmail } from '../_email'

const normalizeEmail = (email: string) => email.trim().toLowerCase()


export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	try {
		await ensureTables()

		const { email, password, termsAccepted, marketingEnabled } = req.body ?? {}
		if (!email || !password) {
			return res.status(400).json({ error: 'Email and password are required' })
		}

		if (typeof email !== 'string' || typeof password !== 'string') {
			return res.status(400).json({ error: 'Invalid payload' })
		}

		if (password.length < 8) {
			return res
				.status(400)
				.json({ error: 'Password must be at least 8 characters' })
		}

		if (!termsAccepted) {
			return res.status(400).json({ error: 'You must accept the terms and conditions' })
		}

		const normalizedEmail = normalizeEmail(email)
		const existing = await sql`
			SELECT id FROM users WHERE email = ${normalizedEmail} LIMIT 1;
		`
		if ((existing.rowCount ?? 0) > 0) {
			return res.status(409).json({ error: 'User already exists' })
		}

		const passwordHash = await bcrypt.hash(password, 10)
		const verificationCode = generateVerificationCode()
		const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
		const marketingEnabledValue = marketingEnabled !== false // default true (opt-out)

		const insertResult = await sql`
			INSERT INTO users (
				email,
				password_hash,
				terms_accepted_at,
				marketing_enabled,
				notifications_enabled,
				email_verification_code,
				email_verification_expires_at
			)
			VALUES (
				${normalizedEmail},
				${passwordHash},
				now(),
				${marketingEnabledValue},
				true,
				${verificationCode},
				${verificationExpiresAt.toISOString()}
			)
			RETURNING id;
		`

		const userId = insertResult.rows[0]?.id as string | undefined
		if (!userId) {
			return res.status(500).json({ error: 'Failed to create user' })
		}

		const token = jwt.sign({ userId }, getJwtSecret(), {
			expiresIn: '30d'
		})
		setAuthCookie(res, token)

		const user = await getUserById(userId)

		// Send verification email
		await sendVerificationEmail(normalizedEmail, verificationCode)

		// Return needsVerification flag so frontend knows to show verification form
		return res.status(201).json({
			user,
			needsVerification: true,
			verificationCode: process.env.NODE_ENV === 'development' ? verificationCode : undefined
		})
	} catch (error) {
		console.error('Register error:', error)
		return res.status(500).json({ error: 'Internal server error' })
	}
}
