import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import { ensureTables } from '../_db'
import { requireUserId } from '../_auth'

const getQueryString = (
	value: string | string[] | undefined
): string | undefined => {
	if (!value) {
		return undefined
	}
	return Array.isArray(value) ? value[0] : value
}

const TITLE_MAX_LENGTH = 60

const toJsonString = (value: unknown): string | null => {
	if (value === undefined || value === null) {
		return null
	}
	try {
		return JSON.stringify(value)
	} catch (error) {
		return null
	}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	await ensureTables()

	const userId = requireUserId(req, res)
	if (!userId) {
		return
	}

	if (req.method === 'GET') {
		const result = await sql`
			SELECT id, vin, tp, orv, title, brand, model, snapshot, created_at
			FROM vehicles
			WHERE user_id = ${userId}
			ORDER BY created_at DESC;
		`
		return res.status(200).json({ vehicles: result.rows })
	}

	if (req.method === 'POST') {
		const { vin, tp, orv, title, brand, model, snapshot } = req.body ?? {}
		const snapshotJson = toJsonString(snapshot)
		const normalizedTitle =
			typeof title === 'string' && title.trim().length > 0
				? title.trim().slice(0, TITLE_MAX_LENGTH)
				: null

		if (!vin && !tp && !orv) {
			return res
				.status(400)
				.json({ error: 'VIN, TP, or ORV is required' })
		}

		const existingVehicle = await sql`
			SELECT id
			FROM vehicles
			WHERE user_id = ${userId}
				AND (
					(${vin ?? null}::text IS NOT NULL AND vin = ${vin ?? null}::text)
					OR (${tp ?? null}::text IS NOT NULL AND tp = ${tp ?? null}::text)
					OR (${orv ?? null}::text IS NOT NULL AND orv = ${orv ?? null}::text)
				)
			LIMIT 1;
		`
		if ((existingVehicle.rowCount ?? 0) > 0) {
			return res.status(409).json({ error: 'Vehicle already exists' })
		}

		const insertResult = await sql`
			INSERT INTO vehicles (user_id, vin, tp, orv, title, brand, model, snapshot)
			VALUES (
				${userId},
				${vin ?? null},
				${tp ?? null},
				${orv ?? null},
				${normalizedTitle},
				${brand ?? null},
				${model ?? null},
				${snapshotJson}::jsonb
			)
			ON CONFLICT (user_id, vin)
			WHERE vin IS NOT NULL
			DO UPDATE SET
				tp = EXCLUDED.tp,
				orv = EXCLUDED.orv,
				title = COALESCE(EXCLUDED.title, vehicles.title),
				brand = EXCLUDED.brand,
				model = EXCLUDED.model,
				snapshot = EXCLUDED.snapshot
			RETURNING id, vin, tp, orv, title, brand, model, snapshot, created_at;
		`

		return res.status(201).json({ vehicle: insertResult.rows[0] })
	}

	if (req.method === 'PATCH') {
		const { id, title } = req.body ?? {}
		if (!id) {
			return res.status(400).json({ error: 'Vehicle id is required' })
		}
		if (typeof title === 'string' && title.length > TITLE_MAX_LENGTH) {
			return res.status(400).json({ error: 'Title is too long' })
		}

		const normalizedTitle =
			typeof title === 'string' && title.trim().length > 0
				? title.trim().slice(0, TITLE_MAX_LENGTH)
				: null

		const updateResult = await sql`
			UPDATE vehicles
			SET title = ${normalizedTitle}
			WHERE id = ${id} AND user_id = ${userId}
			RETURNING id, vin, tp, orv, title, brand, model, snapshot, created_at;
		`

		if (updateResult.rowCount === 0) {
			return res.status(404).json({ error: 'Vehicle not found' })
		}

		return res.status(200).json({ vehicle: updateResult.rows[0] })
	}

	if (req.method === 'DELETE') {
		const id = getQueryString(req.query.id)
		if (!id) {
			return res.status(400).json({ error: 'Vehicle id is required' })
		}

		await sql`
			DELETE FROM vehicles
			WHERE id = ${id} AND user_id = ${userId};
		`
		return res.status(200).json({ success: true })
	}

	return res.status(405).json({ error: 'Method not allowed' })
}
