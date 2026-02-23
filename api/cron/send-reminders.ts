import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import { ensureTables } from '../_db'
import { sendReminderEmailNow } from '../_reminderEmail'

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

				const success = await sendReminderEmailNow({
					reminderId: reminder.reminder_id,
					userId: reminder.user_id,
					userEmail: reminder.user_email,
					vehicleTitle: reminder.vehicle_title,
					vehicleBrand: reminder.vehicle_brand,
					vehicleModel: reminder.vehicle_model,
					reminderType: reminder.reminder_type,
					dueDate: reminder.due_date,
					note: reminder.note
				})

				if (success) {
					sentCount++
				} else {
					errors.push(`Failed to send reminder ${reminder.reminder_id}`)
				}
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
