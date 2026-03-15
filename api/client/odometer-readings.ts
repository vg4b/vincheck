import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'
import { requireUserId } from '../_auth'
import { ensureTables } from '../_db'

const NOTE_MAX_LENGTH = 70
const KM_MIN = 0
const KM_MAX = 9_999_999
const DATE_MIN = '1950-01-01'

const getToday = (): string => new Date().toISOString().split('T')[0]

const getQueryString = (
	value: string | string[] | undefined
): string | undefined => {
	if (!value) return undefined
	return Array.isArray(value) ? value[0] : value
}

const parseKm = (value: unknown): number | null => {
	let n: number
	if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
		n = Math.floor(value)
	} else if (typeof value === 'string') {
		const parsed = parseInt(value, 10)
		if (Number.isNaN(parsed) || parsed < 0) return null
		n = parsed
	} else {
		return null
	}
	return n >= KM_MIN && n <= KM_MAX ? n : null
}

const parseDate = (value: unknown): string | null => {
	if (typeof value !== 'string') return null
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
	if (!match) return null
	const d = new Date(value)
	if (Number.isNaN(d.getTime())) return null
	return match[0]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	await ensureTables()

	const userId = requireUserId(req, res)
	if (!userId) return

	if (req.method === 'GET') {
		const vehicleId = getQueryString(req.query.vehicleId)
		if (vehicleId) {
			// Single vehicle
			const result = await sql`
				SELECT id, vehicle_id, recorded_at, km, note, created_at
				FROM odometer_readings
				WHERE user_id = ${userId} AND vehicle_id = ${vehicleId}
				ORDER BY recorded_at DESC;
			`
			return res.status(200).json({ readings: result.rows })
		}
		// All vehicles (batch – one request instead of N)
		const result = await sql`
			SELECT id, vehicle_id, recorded_at, km, note, created_at
			FROM odometer_readings
			WHERE user_id = ${userId}
			ORDER BY vehicle_id, recorded_at DESC;
		`
		return res.status(200).json({ readings: result.rows })
	}

	if (req.method === 'POST') {
		const { vehicleId, recordedAt, km, note } = req.body ?? {}
		if (!vehicleId) {
			return res.status(400).json({ error: 'vehicleId is required' })
		}

		const kmValue = parseKm(km)
		if (kmValue === null) {
			return res.status(400).json({
				error: `Stav musí být číslo mezi ${KM_MIN.toLocaleString('cs-CZ')} a ${KM_MAX.toLocaleString('cs-CZ')} km.`
			})
		}

		const recordedAtValue = parseDate(recordedAt)
		if (!recordedAtValue) {
			return res.status(400).json({ error: 'recordedAt must be a valid date (YYYY-MM-DD)' })
		}
		if (recordedAtValue < DATE_MIN || recordedAtValue > getToday()) {
			return res.status(400).json({
				error: `Datum musí být mezi ${DATE_MIN} a dnešním dnem.`
			})
		}

		const noteValue =
			typeof note === 'string' && note.trim().length > 0
				? note.trim().slice(0, NOTE_MAX_LENGTH)
				: null

		const vehicleCheck = await sql`
			SELECT id FROM vehicles WHERE id = ${vehicleId} AND user_id = ${userId}
			LIMIT 1;
		`
		if (vehicleCheck.rowCount === 0) {
			return res.status(404).json({ error: 'Vehicle not found' })
		}

		// Chronological validation: km must increase over time
		const maxKmBeforeResult = await sql`
			SELECT COALESCE(MAX(km), 0) as max_km FROM odometer_readings
			WHERE vehicle_id = ${vehicleId} AND recorded_at < ${recordedAtValue};
		`
		const minKmAfterResult = await sql`
			SELECT MIN(km) as min_km FROM odometer_readings
			WHERE vehicle_id = ${vehicleId} AND recorded_at > ${recordedAtValue};
		`

		const maxKmBefore = Number((maxKmBeforeResult.rows[0] as { max_km: number })?.max_km ?? 0)
		const minKmAfterRaw = (minKmAfterResult.rows[0] as { min_km: number | null })?.min_km
		const minKmAfter = minKmAfterRaw != null ? Number(minKmAfterRaw) : null

		if (kmValue < maxKmBefore) {
			return res.status(400).json({
				error: `Pro datum ${recordedAtValue} musí být stav vyšší než ${maxKmBefore.toLocaleString('cs-CZ')} km (poslední záznam před tímto datem).`
			})
		}
		if (minKmAfter != null && kmValue > minKmAfter) {
			return res.status(400).json({
				error: `Pro datum ${recordedAtValue} musí být stav nižší než ${minKmAfter.toLocaleString('cs-CZ')} km (následující záznam).`
			})
		}

		const insertResult = await sql`
			INSERT INTO odometer_readings (user_id, vehicle_id, recorded_at, km, note)
			VALUES (${userId}, ${vehicleId}, ${recordedAtValue}, ${kmValue}, ${noteValue})
			RETURNING id, vehicle_id, recorded_at, km, note, created_at;
		`
		return res.status(201).json({ reading: insertResult.rows[0] })
	}

	if (req.method === 'PATCH') {
		const { id, recordedAt, km, note } = req.body ?? {}
		if (!id) {
			return res.status(400).json({ error: 'id is required' })
		}
		if (typeof note === 'string' && note.length > NOTE_MAX_LENGTH) {
			return res.status(400).json({
				error: `Poznámka může mít maximálně ${NOTE_MAX_LENGTH} znaků.`
			})
		}

		const existing = await sql`
			SELECT id, vehicle_id, recorded_at, km FROM odometer_readings WHERE id = ${id} AND user_id = ${userId}
			LIMIT 1;
		`
		if (existing.rowCount === 0) {
			return res.status(404).json({ error: 'Reading not found' })
		}

		const row = existing.rows[0] as { vehicle_id: string; recorded_at: string; km: number }
		const vehicleId = row.vehicle_id
		const finalRecordedAt = recordedAt !== undefined ? parseDate(recordedAt) : row.recorded_at
		const finalKm = km !== undefined ? parseKm(km) : row.km

		if (recordedAt !== undefined && finalRecordedAt && (finalRecordedAt < DATE_MIN || finalRecordedAt > getToday())) {
			return res.status(400).json({
				error: `Datum musí být mezi ${DATE_MIN} a dnešním dnem.`
			})
		}
		if (km !== undefined && finalKm === null) {
			return res.status(400).json({
				error: `Stav musí být číslo mezi ${KM_MIN.toLocaleString('cs-CZ')} a ${KM_MAX.toLocaleString('cs-CZ')} km.`
			})
		}

		if (finalRecordedAt && finalKm !== null) {
			const maxKmBeforeResult = await sql`
				SELECT COALESCE(MAX(km), 0) as max_km FROM odometer_readings
				WHERE vehicle_id = ${vehicleId} AND id != ${id} AND recorded_at < ${finalRecordedAt};
			`
			const minKmAfterResult = await sql`
				SELECT MIN(km) as min_km FROM odometer_readings
				WHERE vehicle_id = ${vehicleId} AND id != ${id} AND recorded_at > ${finalRecordedAt};
			`

			const maxKmBefore = Number((maxKmBeforeResult.rows[0] as { max_km: number })?.max_km ?? 0)
			const minKmAfterRaw = (minKmAfterResult.rows[0] as { min_km: number | null })?.min_km
			const minKmAfter = minKmAfterRaw != null ? Number(minKmAfterRaw) : null

			if (finalKm < maxKmBefore) {
				return res.status(400).json({
					error: `Pro datum ${finalRecordedAt} musí být stav vyšší než ${maxKmBefore.toLocaleString('cs-CZ')} km (záznam před tímto datem).`
				})
			}
			if (minKmAfter != null && finalKm > minKmAfter) {
				return res.status(400).json({
					error: `Pro datum ${finalRecordedAt} musí být stav nižší než ${minKmAfter.toLocaleString('cs-CZ')} km (následující záznam).`
				})
			}
		}

		const updates: string[] = []
		const values: unknown[] = []

		let pos = 1
		if (recordedAt !== undefined) {
			const d = parseDate(recordedAt)
			if (d) {
				updates.push(`recorded_at = $${pos}`)
				values.push(d)
				pos++
			}
		}
		if (km !== undefined) {
			const kmVal = parseKm(km)
			if (kmVal !== null) {
				updates.push(`km = $${pos}`)
				values.push(kmVal)
				pos++
			}
		}
		if (note !== undefined) {
			updates.push(`note = $${pos}`)
			values.push(
				typeof note === 'string' && note.trim().length > 0
					? note.trim().slice(0, NOTE_MAX_LENGTH)
					: null
			)
			pos++
		}

		if (updates.length === 0) {
			return res.status(400).json({ error: 'No fields to update' })
		}

		values.push(id, userId)
		const query = `
			UPDATE odometer_readings
			SET ${updates.join(', ')}
			WHERE id = $${pos} AND user_id = $${pos + 1}
			RETURNING id, vehicle_id, recorded_at, km, note, created_at;
		`
		const result = await sql.query(query, values)
		return res.status(200).json({ reading: result.rows[0] })
	}

	if (req.method === 'DELETE') {
		const id = getQueryString(req.query.id)
		if (!id) {
			return res.status(400).json({ error: 'id is required' })
		}

		await sql`
			DELETE FROM odometer_readings
			WHERE id = ${id} AND user_id = ${userId};
		`
		return res.status(200).json({ success: true })
	}

	return res.status(405).json({ error: 'Method not allowed' })
}
