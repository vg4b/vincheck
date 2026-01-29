import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

export function setAuthCookie(res: VercelResponse, token: string): void {
	res.setHeader('Set-Cookie', [
		`token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
	])
}

export function clearAuthCookie(res: VercelResponse): void {
	res.setHeader('Set-Cookie', [
		`token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
	])
}

export function getJwtSecret(): string {
	const secret = process.env.JWT_SECRET
	if (!secret) {
		throw new Error('JWT_SECRET is not defined')
	}
	return secret
}

// Get user from token without verification (for decoding only)
export function getUserFromToken(req: VercelRequest): string | null {
	const token = req.cookies.token
	if (!token) return null

	try {
		const decoded = jwt.decode(token) as { userId: string }
		return decoded?.userId || null
	} catch {
		return null
	}
}

// Require authentication middleware
export function requireUserId(
	req: VercelRequest,
	res: VercelResponse
): string | null {
	const token = req.cookies.token

	if (!token) {
		res.status(401).json({ error: 'Unauthorized' })
		return null
	}

	try {
		const secret = getJwtSecret()
		const decoded = jwt.verify(token, secret) as { userId: string }
		return decoded.userId
	} catch {
		res.status(401).json({ error: 'Invalid token' })
		return null
	}
}

export async function getUserById(userId: string) {
	const { rows } = await sql`
        SELECT 
            id, 
            email, 
            created_at, 
            terms_accepted_at,
            email_verified_at,
            notifications_enabled,
            marketing_enabled
        FROM users 
        WHERE id = ${userId}
    `
	return rows[0]
}

export const generateVerificationCode = (): string => {
	// Generate a secure random integer between 100000 and 999999
	return crypto.randomInt(100000, 1000000).toString()
}
