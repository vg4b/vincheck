import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import { generateVerificationCode, requireUserId } from '../_auth'
import { ensureTables } from '../_db'
import { sendVerificationEmail } from '../_email'

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
