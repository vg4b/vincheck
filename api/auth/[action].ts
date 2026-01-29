import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import {
	clearAuthCookie,
	generateVerificationCode,
	getJwtSecret,
	getUserById,
	requireUserId,
	setAuthCookie
} from '../_auth'
import { ensureTables } from '../_db'
import { sendVerificationEmail } from '../_email'

const normalizeEmail = (email: string) => email.trim().toLowerCase()

// POST /api/auth/login
async function handleLogin(req: VercelRequest, res: VercelResponse) {
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

// POST /api/auth/logout
async function handleLogout(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	clearAuthCookie(res)
	return res.status(200).json({ success: true })
}

// POST /api/auth/register
async function handleRegister(req: VercelRequest, res: VercelResponse) {
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

// GET /api/auth/me
async function handleMe(req: VercelRequest, res: VercelResponse) {
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

// POST /api/auth/verify-email
async function handleVerifyEmail(req: VercelRequest, res: VercelResponse) {
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

// POST /api/auth/resend-verification
async function handleResendVerification(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	try {
		await ensureTables()

		const userId = requireUserId(req, res)
		if (!userId) {
			return
		}

		// Check if user is already verified and get last verification time
		const userCheck = await sql`
			SELECT email_verified_at, email_verification_expires_at, email
			FROM users
			WHERE id = ${userId}
			LIMIT 1;
		`

		if (!userCheck.rows[0]) {
			return res.status(404).json({ error: 'Uživatel nenalezen' })
		}

		if (userCheck.rows[0].email_verified_at) {
			return res.status(400).json({ error: 'Email je již ověřen' })
		}

		// Check cooldown - can only resend every 60 seconds
		const lastExpiresAt = userCheck.rows[0].email_verification_expires_at
		if (lastExpiresAt) {
			const lastSentAt = new Date(lastExpiresAt).getTime() - 24 * 60 * 60 * 1000 // expires_at - 24h = sent_at
			const secondsSinceLastSend = (Date.now() - lastSentAt) / 1000
			if (secondsSinceLastSend < 60) {
				const waitSeconds = Math.ceil(60 - secondsSinceLastSend)
				return res.status(429).json({
					error: `Počkejte ${waitSeconds} sekund před dalším odesláním.`,
					retryAfter: waitSeconds
				})
			}
		}

		const userEmail = userCheck.rows[0].email as string

		// Generate new verification code
		const verificationCode = generateVerificationCode()
		const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

		await sql`
			UPDATE users
			SET email_verification_code = ${verificationCode},
				email_verification_expires_at = ${verificationExpiresAt.toISOString()}
			WHERE id = ${userId};
		`

		// Send verification email
		await sendVerificationEmail(userEmail, verificationCode)

		return res.status(200).json({
			success: true,
			verificationCode: process.env.NODE_ENV === 'development' ? verificationCode : undefined
		})
	} catch (error) {
		console.error('Resend verification error:', error)
		return res.status(500).json({ error: 'Internal server error' })
	}
}

// Main handler - routes to specific action
export default async function handler(req: VercelRequest, res: VercelResponse) {
	const { action } = req.query

	switch (action) {
		case 'login':
			return handleLogin(req, res)
		case 'logout':
			return handleLogout(req, res)
		case 'register':
			return handleRegister(req, res)
		case 'me':
			return handleMe(req, res)
		case 'verify-email':
			return handleVerifyEmail(req, res)
		case 'resend-verification':
			return handleResendVerification(req, res)
		default:
			return res.status(404).json({ error: 'Not found' })
	}
}
