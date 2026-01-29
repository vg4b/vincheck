import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import { ensureTables } from '../_db'
import { generateUnsubscribeToken } from '../email/unsubscribe'

// Helper to add delay between API calls (Resend rate limit: 2 req/s)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const getResendApiKey = (): string | null => {
	return process.env.RESEND_API_KEY || null
}

const getAdminSecret = (): string | null => {
	return process.env.ADMIN_SECRET || process.env.CRON_SECRET || null
}

const getBaseUrl = (): string => {
	return process.env.VERCEL_URL
		? `https://${process.env.VERCEL_URL}`
		: 'https://vininfo.cz'
}

interface MarketingEmailParams {
	subject: string
	preheader?: string
	heading: string
	content: string // HTML content for the main body
	ctaText?: string
	ctaUrl?: string
}

function generateMarketingEmailHtml(params: MarketingEmailParams, unsubscribeUrl: string): string {
	const { subject, preheader, heading, content, ctaText, ctaUrl } = params

	return `<!DOCTYPE html>
<html lang="cs">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${subject}</title>
	${preheader ? `<meta name="description" content="${preheader}">` : ''}
</head>
<body style="font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
	${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ''}
	
	<div style="background-color: #c6dbad; padding: 25px 30px; border-radius: 8px 8px 0 0; text-align: center;">
		<h1 style="margin: 0; font-size: 22px; color: #333; font-weight: 600;">VIN Info.cz</h1>
	</div>

	<div style="background: #ffffff; padding: 30px; border-left: 1px solid #e9ecef; border-right: 1px solid #e9ecef;">
		<h2 style="color: #333; margin-top: 0; font-size: 20px;">${heading}</h2>
		
		<div style="color: #555;">
			${content}
		</div>

		${ctaText && ctaUrl ? `
		<div style="text-align: center; margin: 30px 0;">
			<a href="${ctaUrl}" style="display: inline-block; background-color: #333; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">${ctaText}</a>
		</div>
		` : ''}
	</div>

	<div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef; border-top: none; text-align: center; font-size: 12px; color: #888;">
		<p style="margin: 0 0 10px;">Tento email byl odeslán ze služby <a href="https://vininfo.cz" style="color: #555; text-decoration: none;">VIN Info.cz</a></p>
		<p style="margin: 0;">
			<a href="${unsubscribeUrl}" style="color: #888; text-decoration: underline;">Odhlásit se z marketingových emailů</a>
		</p>
	</div>
</body>
</html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	// Only allow POST requests
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	// Verify admin secret
	const adminSecret = getAdminSecret()
	if (adminSecret) {
		const authHeader = req.headers.authorization
		if (authHeader !== `Bearer ${adminSecret}`) {
			return res.status(401).json({ error: 'Unauthorized' })
		}
	} else {
		return res.status(500).json({ error: 'ADMIN_SECRET or CRON_SECRET not configured' })
	}

	try {
		await ensureTables()

		const { subject, preheader, heading, content, ctaText, ctaUrl, testEmail } = req.body ?? {}

		// Validate required fields
		if (!subject || !heading || !content) {
			return res.status(400).json({ 
				error: 'Missing required fields: subject, heading, content',
				example: {
					subject: 'Novinka na VIN Info.cz',
					preheader: 'Podívejte se, co je nového...',
					heading: 'Nová funkce: Upozornění na termíny',
					content: '<p>Nyní si můžete nastavit upozornění na důležité termíny...</p>',
					ctaText: 'Vyzkoušet',
					ctaUrl: 'https://vininfo.cz/klientska-zona',
					testEmail: 'optional@test.com'
				}
			})
		}

		const resendApiKey = getResendApiKey()
		if (!resendApiKey) {
			return res.status(500).json({ error: 'RESEND_API_KEY not configured' })
		}

		// If testEmail is provided, only send to that email (for testing)
		let recipients: Array<{ id: string; email: string }>

		if (testEmail) {
			// Test mode - send only to specified email
			// Check if this email exists in the database
			const testUserResult = await sql`
				SELECT id, email FROM users WHERE email = ${testEmail} LIMIT 1;
			`
			if (testUserResult.rows.length === 0) {
				// Create a fake user ID for testing unsubscribe link
				recipients = [{ id: 'test-user-id', email: testEmail }]
			} else {
				recipients = testUserResult.rows as Array<{ id: string; email: string }>
			}
		} else {
			// Production mode - get all users with marketing enabled
			const usersResult = await sql`
				SELECT id, email 
				FROM users 
				WHERE marketing_enabled = true
				ORDER BY created_at ASC;
			`
			recipients = usersResult.rows as Array<{ id: string; email: string }>
		}

		if (recipients.length === 0) {
			return res.status(200).json({ 
				message: 'No recipients found',
				sent: 0,
				total: 0
			})
		}

		let sentCount = 0
		const errors: string[] = []

		for (const recipient of recipients) {
			try {
				// Add delay to respect rate limit (600ms = ~1.6 req/s, under 2/s limit)
				if (sentCount > 0) {
					await delay(600)
				}

				const unsubscribeToken = generateUnsubscribeToken(recipient.id, 'marketing')
				const unsubscribeUrl = `${getBaseUrl()}/api/email/unsubscribe?token=${unsubscribeToken}`

				const emailHtml = generateMarketingEmailHtml(
					{ subject, preheader, heading, content, ctaText, ctaUrl },
					unsubscribeUrl
				)

				const response = await fetch('https://api.resend.com/emails', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${resendApiKey}`
					},
					body: JSON.stringify({
						from: 'VINInfo <noreply@mail.vininfo.cz>',
						to: recipient.email,
						subject: subject,
						html: emailHtml
					})
				})

				if (!response.ok) {
					const errorText = await response.text()
					throw new Error(`Resend API error: ${response.status} - ${errorText}`)
				}

				sentCount++
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error'
				errors.push(`Failed to send to ${recipient.email}: ${errorMessage}`)
				console.error(`Failed to send marketing email to ${recipient.email}:`, error)
			}
		}

		return res.status(200).json({
			message: `Sent ${sentCount} of ${recipients.length} marketing emails`,
			sent: sentCount,
			total: recipients.length,
			testMode: !!testEmail,
			errors: errors.length > 0 ? errors : undefined
		})
	} catch (error) {
		console.error('Send marketing error:', error)
		return res.status(500).json({ error: 'Internal server error' })
	}
}
