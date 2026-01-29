import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import { ensureTables } from '../_db'
import { requireUserId } from '../_auth'

const reminderTypes = new Set([
	'stk',
	'povinne_ruceni',
	'havarijni_pojisteni',
	'servis',
	'prezuti_pneu',
	'dalnicni_znamka',
	'jine'
])
const NOTE_MAX_LENGTH = 200

const getQueryString = (
	value: string | string[] | undefined
): string | undefined => {
	if (!value) {
		return undefined
	}
	return Array.isArray(value) ? value[0] : value
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	await ensureTables()

	const userId = requireUserId(req, res)
	if (!userId) {
		return
	}

	if (req.method === 'GET') {
		const vehicleId = getQueryString(req.query.vehicleId)
		if (vehicleId) {
			const reminders = await sql`
				SELECT id, vehicle_id, type, due_date, note, is_done, created_at, email_enabled, email_send_at, email_sent_at
				FROM reminders
				WHERE user_id = ${userId} AND vehicle_id = ${vehicleId}
				ORDER BY due_date ASC;
			`
			return res.status(200).json({ reminders: reminders.rows })
		}

		const reminders = await sql`
			SELECT id, vehicle_id, type, due_date, note, is_done, created_at, email_enabled, email_send_at, email_sent_at
			FROM reminders
			WHERE user_id = ${userId}
			ORDER BY due_date ASC;
		`
		return res.status(200).json({ reminders: reminders.rows })
	}

	if (req.method === 'POST') {
		const { vehicleId, type, dueDate, note, emailEnabled, emailSendAt } = req.body ?? {}
		if (!vehicleId || !type || !dueDate) {
			return res
				.status(400)
				.json({ error: 'Vehicle, type, and due date are required' })
		}

		if (!reminderTypes.has(type)) {
			return res.status(400).json({ error: 'Invalid reminder type' })
		}
		if (typeof note === 'string' && note.length > NOTE_MAX_LENGTH) {
			return res.status(400).json({ error: 'Note is too long' })
		}

		const vehicleCheck = await sql`
			SELECT id FROM vehicles WHERE id = ${vehicleId} AND user_id = ${userId}
			LIMIT 1;
		`
		if (vehicleCheck.rowCount === 0) {
			return res.status(404).json({ error: 'Vehicle not found' })
		}

		// Calculate default email send date (1 day before due date)
		const emailEnabledValue = emailEnabled !== false // default true
		let emailSendAtValue = emailSendAt
		if (!emailSendAtValue && emailEnabledValue) {
			const dueDateObj = new Date(dueDate)
			dueDateObj.setDate(dueDateObj.getDate() - 1)
			emailSendAtValue = dueDateObj.toISOString().split('T')[0]
		}

		const insertResult = await sql`
			INSERT INTO reminders (user_id, vehicle_id, type, due_date, note, email_enabled, email_send_at)
			VALUES (${userId}, ${vehicleId}, ${type}, ${dueDate}, ${note ?? null}, ${emailEnabledValue}, ${emailSendAtValue ?? null})
			RETURNING id, vehicle_id, type, due_date, note, is_done, created_at, email_enabled, email_send_at, email_sent_at;
		`
		return res.status(201).json({ reminder: insertResult.rows[0] })
	}

	if (req.method === 'PATCH') {
		const { id, dueDate, note, isDone, emailEnabled, emailSendAt } = req.body ?? {}
		if (!id) {
			return res.status(400).json({ error: 'Reminder id is required' })
		}
		if (typeof note === 'string' && note.length > NOTE_MAX_LENGTH) {
			return res.status(400).json({ error: 'Note is too long' })
		}

		const updates: string[] = []
		const values: Array<string | boolean | null> = []

		if (dueDate) {
			updates.push(`due_date = $${updates.length + 1}`)
			values.push(dueDate)
		}
		if (note !== undefined) {
			updates.push(`note = $${updates.length + 1}`)
			values.push(note)
		}
		if (isDone !== undefined) {
			updates.push(`is_done = $${updates.length + 1}`)
			values.push(isDone)
		}
		if (emailEnabled !== undefined) {
			updates.push(`email_enabled = $${updates.length + 1}`)
			values.push(emailEnabled)
		}
		if (emailSendAt !== undefined) {
			updates.push(`email_send_at = $${updates.length + 1}`)
			values.push(emailSendAt)
		}

		if (updates.length === 0) {
			return res.status(400).json({ error: 'No fields to update' })
		}

		values.push(id)
		values.push(userId)

		const query = `
			UPDATE reminders
			SET ${updates.join(', ')}
			WHERE id = $${updates.length + 1} AND user_id = $${updates.length + 2}
			RETURNING id, vehicle_id, type, due_date, note, is_done, created_at, email_enabled, email_send_at, email_sent_at;
		`

		const result = await sql.query(query, values)
		return res.status(200).json({ reminder: result.rows[0] })
	}

	if (req.method === 'DELETE') {
		const id = getQueryString(req.query.id)
		if (!id) {
			return res.status(400).json({ error: 'Reminder id is required' })
		}

		await sql`
			DELETE FROM reminders
			WHERE id = ${id} AND user_id = ${userId};
		`
		return res.status(200).json({ success: true })
	}

	return res.status(405).json({ error: 'Method not allowed' })
}
