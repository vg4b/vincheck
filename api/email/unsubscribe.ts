import type { VercelRequest, VercelResponse } from '@vercel/node'
import jwt from 'jsonwebtoken'
import { sql } from '@vercel/postgres'
import { ensureTables } from '../_db'

interface UnsubscribePayload {
	userId: string
	type: 'notifications' | 'marketing'
}

const getJwtSecret = (): string => {
	const secret = process.env.JWT_SECRET
	if (!secret) {
		throw new Error('JWT_SECRET environment variable is not set')
	}
	return secret
}

export const generateUnsubscribeToken = (
	userId: string,
	type: 'notifications' | 'marketing'
): string => {
	return jwt.sign({ userId, type } as UnsubscribePayload, getJwtSecret(), {
		expiresIn: '30d'
	})
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	try {
		await ensureTables()

		const token = req.query.token
		if (!token || typeof token !== 'string') {
			return res.status(400).send(renderHtml('Chybí token', 'Neplatný odkaz pro odhlášení z odběru.', false))
		}

		let payload: UnsubscribePayload
		try {
			payload = jwt.verify(token, getJwtSecret()) as UnsubscribePayload
		} catch {
			return res.status(400).send(renderHtml('Neplatný token', 'Odkaz pro odhlášení vypršel nebo je neplatný.', false))
		}

		const { userId, type } = payload
		if (!userId || (type !== 'notifications' && type !== 'marketing')) {
			return res.status(400).send(renderHtml('Neplatný token', 'Neplatný typ odběru.', false))
		}

		// Update user preferences
		if (type === 'notifications') {
			await sql`
				UPDATE users
				SET notifications_enabled = false
				WHERE id = ${userId};
			`
		} else {
			await sql`
				UPDATE users
				SET marketing_enabled = false
				WHERE id = ${userId};
			`
		}

		const typeLabel = type === 'notifications' ? 'notifikačních emailů' : 'marketingových emailů'
		return res.status(200).send(renderHtml(
			'Odběr zrušen',
			`Byli jste úspěšně odhlášeni z odběru ${typeLabel}. Nastavení můžete kdykoliv změnit v klientské zóně.`,
			true
		))
	} catch (error) {
		console.error('Unsubscribe error:', error)
		return res.status(500).send(renderHtml('Chyba', 'Došlo k neočekávané chybě. Zkuste to prosím znovu později.', false))
	}
}

function renderHtml(title: string, message: string, success: boolean): string {
	const bgColor = success ? '#d4edda' : '#f8d7da'
	const textColor = success ? '#155724' : '#721c24'

	return `<!DOCTYPE html>
<html lang="cs">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title} - VINInfo</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			margin: 0;
			background-color: #f5f5f5;
		}
		.container {
			text-align: center;
			padding: 40px;
			background: white;
			border-radius: 8px;
			box-shadow: 0 2px 10px rgba(0,0,0,0.1);
			max-width: 500px;
		}
		.alert {
			padding: 15px;
			border-radius: 4px;
			background-color: ${bgColor};
			color: ${textColor};
			margin-bottom: 20px;
		}
		h1 {
			margin: 0 0 20px;
			color: #333;
		}
		p {
			color: #666;
			line-height: 1.6;
		}
		a {
			color: #007bff;
			text-decoration: none;
		}
		a:hover {
			text-decoration: underline;
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>${title}</h1>
		<div class="alert">${message}</div>
		<p><a href="/">Zpět na VINInfo</a></p>
	</div>
</body>
</html>`
}
