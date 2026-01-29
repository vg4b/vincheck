import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import { ensureTables } from '../_db'
import { generateUnsubscribeToken } from '../email/unsubscribe'

// Interface for reminder with user info
interface ReminderWithUser {
	reminder_id: string
	vehicle_id: string
	reminder_type: string
	due_date: string
	note: string | null
	user_id: string
	user_email: string
	vehicle_title: string | null
	vehicle_brand: string | null
	vehicle_model: string | null
	vehicle_vin: string | null
}

const reminderTypeLabels: Record<string, string> = {
	stk: 'Termín STK',
	povinne_ruceni: 'Povinné ručení',
	havarijni_pojisteni: 'Havarijní pojištění',
	servis: 'Servisní prohlídka',
	prezuti_pneu: 'Přezutí pneu',
	dalnicni_znamka: 'Dálniční známka',
	jine: 'Jiné'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	// Only allow GET requests (Vercel Cron sends GET)
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	// Verify cron secret if set
	const cronSecret = process.env.CRON_SECRET
	if (cronSecret) {
		const authHeader = req.headers.authorization
		if (authHeader !== `Bearer ${cronSecret}`) {
			return res.status(401).json({ error: 'Unauthorized' })
		}
	}

	try {
		await ensureTables()

		const today = new Date().toISOString().split('T')[0]

		// Find all reminders that need to be sent
		// Conditions:
		// - email_enabled = true
		// - email_send_at <= today
		// - email_sent_at IS NULL
		// - user has email_verified_at IS NOT NULL
		// - user has notifications_enabled = true
		const remindersResult = await sql`
			SELECT
				r.id as reminder_id,
				r.vehicle_id,
				r.type as reminder_type,
				r.due_date,
				r.note,
				u.id as user_id,
				u.email as user_email,
				v.title as vehicle_title,
				v.brand as vehicle_brand,
				v.model as vehicle_model,
				v.vin as vehicle_vin
			FROM reminders r
			JOIN users u ON r.user_id = u.id
			JOIN vehicles v ON r.vehicle_id = v.id
			WHERE r.email_enabled = true
				AND r.email_send_at <= ${today}
				AND r.email_sent_at IS NULL
				AND u.email_verified_at IS NOT NULL
				AND u.notifications_enabled = true
			ORDER BY r.due_date ASC;
		`

		const reminders = remindersResult.rows as ReminderWithUser[]

		if (reminders.length === 0) {
			return res.status(200).json({ message: 'No reminders to send', sent: 0 })
		}

		// Check if Resend API key is configured
		const resendApiKey = process.env.RESEND_API_KEY
		if (!resendApiKey) {
			console.error('RESEND_API_KEY is not configured')
			return res.status(500).json({ error: 'Email service not configured' })
		}

		let sentCount = 0
		const errors: string[] = []

		// Helper to add delay between API calls (Resend rate limit: 2 req/s)
		const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

		for (const reminder of reminders) {
			try {
				// Add delay to respect rate limit (600ms = ~1.6 req/s, under 2/s limit)
				if (sentCount > 0) {
					await delay(600)
				}
				const vehicleName = reminder.vehicle_title?.trim()
					|| `${reminder.vehicle_brand || 'Vozidlo'} ${reminder.vehicle_model || ''}`.trim()

				const unsubscribeToken = generateUnsubscribeToken(reminder.user_id, 'notifications')
				const unsubscribeUrl = `${getBaseUrl()}/api/email/unsubscribe?token=${unsubscribeToken}`

				const emailHtml = generateReminderEmailHtml({
					vehicleName,
					reminderType: reminderTypeLabels[reminder.reminder_type] || reminder.reminder_type,
					dueDate: formatDate(reminder.due_date),
					note: reminder.note,
					unsubscribeUrl
				})

				// Send email via Resend
				const response = await fetch('https://api.resend.com/emails', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${resendApiKey}`
					},
					body: JSON.stringify({
						from: 'VINInfo <noreply@mail.vininfo.cz>',
						to: reminder.user_email,
						subject: `Připomínka: ${reminderTypeLabels[reminder.reminder_type] || reminder.reminder_type} - ${vehicleName}`,
						html: emailHtml
					})
				})

				if (!response.ok) {
					const errorText = await response.text()
					throw new Error(`Resend API error: ${response.status} - ${errorText}`)
				}

				// Mark reminder as sent
				await sql`
					UPDATE reminders
					SET email_sent_at = now()
					WHERE id = ${reminder.reminder_id};
				`

				sentCount++
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error'
				errors.push(`Failed to send reminder ${reminder.reminder_id}: ${errorMessage}`)
				console.error(`Failed to send reminder ${reminder.reminder_id}:`, error)
			}
		}

		return res.status(200).json({
			message: `Sent ${sentCount} of ${reminders.length} reminders`,
			sent: sentCount,
			total: reminders.length,
			errors: errors.length > 0 ? errors : undefined
		})
	} catch (error) {
		console.error('Cron send-reminders error:', error)
		return res.status(500).json({ error: 'Internal server error' })
	}
}

function getBaseUrl(): string {
	return process.env.VERCEL_URL
		? `https://${process.env.VERCEL_URL}`
		: 'http://localhost:3000'
}

function formatDate(dateStr: string): string {
	const date = new Date(dateStr)
	return date.toLocaleDateString('cs-CZ', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	})
}

interface ReminderEmailParams {
	vehicleName: string
	reminderType: string
	dueDate: string
	note: string | null
	unsubscribeUrl: string
}

function generateReminderEmailHtml(params: ReminderEmailParams): string {
	const { vehicleName, reminderType, dueDate, note, unsubscribeUrl } = params

	return `<!DOCTYPE html>
<html lang="cs">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Připomínka - VIN Info.cz</title>
</head>
<body style="font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
	<div style="background-color: #c6dbad; padding: 25px 30px; border-radius: 8px 8px 0 0; text-align: center;">
		<h1 style="margin: 0; font-size: 22px; color: #333; font-weight: 600;">VIN Info.cz</h1>
	</div>

	<div style="background: #ffffff; padding: 30px; border-left: 1px solid #e9ecef; border-right: 1px solid #e9ecef;">
		<h2 style="color: #333; margin-top: 0; font-size: 20px;">Blíží se termín: ${reminderType}</h2>

		<div style="background: #c6dbad; padding: 20px; border-radius: 8px; margin: 20px 0;">
			<p style="margin: 0 0 10px; color: #333;"><strong>Vozidlo:</strong> ${vehicleName}</p>
			<p style="margin: 0 0 10px; color: #333;"><strong>Typ upozornění:</strong> ${reminderType}</p>
			<p style="margin: 0; color: #333;"><strong>Termín:</strong> <span style="color: #c0392b; font-weight: bold;">${dueDate}</span></p>
			${note ? `<p style="margin: 10px 0 0; color: #333;"><strong>Poznámka:</strong> ${note}</p>` : ''}
		</div>

		<p style="color: #555;">Nezapomeňte si včas zajistit splnění tohoto termínu. V případě potřeby můžete termín upravit v klientské zóně.</p>

		<div style="text-align: center; margin: 30px 0;">
			<a href="${getBaseUrl()}/klientska-zona" style="display: inline-block; background: #5a8f3e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: 600;">Přejít do Moje VINInfo</a>
		</div>
	</div>

	<div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef; border-top: none; text-align: center; font-size: 12px; color: #888;">
		<p style="margin: 0 0 10px;">Tento email byl odeslán ze služby <a href="https://vininfo.cz" style="color: #555; text-decoration: none;">VIN Info.cz</a></p>
		<p style="margin: 0;">
			<a href="${unsubscribeUrl}" style="color: #888;">Odhlásit se z odběru notifikací</a>
		</p>
	</div>
</body>
</html>`
}
