import React, { useState } from 'react'
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer
} from 'recharts'
import { OdometerReading } from '../types'
import {
	createOdometerReading,
	deleteOdometerReading
} from '../utils/clientZoneApi'
import { ApiError } from '../utils/apiClient'

const formatDate = (value: string) => {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value
	return date.toLocaleDateString('cs-CZ')
}

const formatKm = (value: number) => {
	return new Intl.NumberFormat('cs-CZ').format(value) + ' km'
}

const KM_MIN = 0
const KM_MAX = 9_999_999
const NOTE_MAX_LENGTH = 70

const OdometerForm: React.FC<{
	vehicleId: string
	readings: OdometerReading[]
	onAdd: (reading: OdometerReading) => void
}> = ({ vehicleId, readings, onAdd }) => {
	const today = new Date().toISOString().split('T')[0]
	const [recordedAt, setRecordedAt] = useState(today)
	const [km, setKm] = useState('')
	const [note, setNote] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState('')

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setError('')
		const kmNum = parseInt(km.replace(/\s/g, ''), 10)
		if (Number.isNaN(kmNum) || kmNum < KM_MIN || kmNum > KM_MAX) {
			setError(`Stav musí být mezi ${KM_MIN.toLocaleString('cs-CZ')} a ${KM_MAX.toLocaleString('cs-CZ')} km.`)
			return
		}
		const dateMin = '1950-01-01'
		const dateMax = new Date().toISOString().split('T')[0]
		if (recordedAt < dateMin || recordedAt > dateMax) {
			setError(`Datum musí být mezi ${dateMin} a dnešním dnem.`)
			return
		}
		if (note.length > NOTE_MAX_LENGTH) {
			setError(`Poznámka může mít maximálně ${NOTE_MAX_LENGTH} znaků.`)
			return
		}
		const maxKmBefore = readings
			.filter((r) => r.recorded_at < recordedAt)
			.reduce((max, r) => Math.max(max, r.km), 0)
		const futureReadings = readings.filter((r) => r.recorded_at > recordedAt)
		const minKmAfter = futureReadings.length > 0
			? Math.min(...futureReadings.map((r) => r.km))
			: null

		if (kmNum < maxKmBefore) {
			setError(
				`Pro toto datum musí být stav vyšší než ${formatKm(maxKmBefore)} (záznam před tímto datem).`
			)
			return
		}
		if (minKmAfter != null && kmNum > minKmAfter) {
			setError(
				`Pro toto datum musí být stav nižší než ${formatKm(minKmAfter)} (následující záznam).`
			)
			return
		}

		setSubmitting(true)
		try {
			const reading = await createOdometerReading({
				vehicleId,
				recordedAt,
				km: kmNum,
				note: note.trim() || undefined
			})
			onAdd(reading)
			setKm('')
			setNote('')
		} catch (err) {
			if (err instanceof ApiError) {
				setError(err.message)
			} else {
				setError('Nepodařilo se uložit záznam.')
			}
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<form onSubmit={handleSubmit} className='mb-3'>
			<div className='row g-2'>
				<div className='col-md-3'>
					<label className='form-label small'>Datum</label>
					<input
						type='date'
						className='form-control form-control-sm'
						value={recordedAt}
						onChange={(e) => setRecordedAt(e.target.value)}
						min='1950-01-01'
						max={new Date().toISOString().split('T')[0]}
						required
					/>
				</div>
				<div className='col-md-3'>
					<label className='form-label small'>Stav (km)</label>
					<input
						type='number'
						className='form-control form-control-sm'
						value={km}
						onChange={(e) => setKm(e.target.value)}
						placeholder='např. 125000'
						min={KM_MIN}
						max={KM_MAX}
						required
					/>
				</div>
				<div className='col-md-4'>
					<label className='form-label small'>Poznámka</label>
					<input
						type='text'
						className='form-control form-control-sm'
						value={note}
						onChange={(e) => setNote(e.target.value)}
						placeholder='např. před STK'
						maxLength={NOTE_MAX_LENGTH}
					/>
				</div>
				<div className='col-md-2 d-flex align-items-end'>
					<button
						type='submit'
						className='btn btn-primary btn-sm w-100 text-nowrap'
						disabled={submitting}
					>
						{submitting ? '...' : 'Přidat'}
					</button>
				</div>
			</div>
			{error && (
				<div className='alert alert-danger py-2 mt-2 mb-0 small' role='alert'>
					{error}
				</div>
			)}
		</form>
	)
}

const OdometerChart: React.FC<{
	readings: OdometerReading[]
}> = ({ readings }) => {
	if (readings.length < 2) return null

	const data = [...readings]
		.sort(
			(a, b) =>
				a.recorded_at.localeCompare(b.recorded_at) || a.km - b.km
		)
		.map((r) => ({
			date: formatDate(r.recorded_at),
			km: r.km,
			fullDate: r.recorded_at
		}))

	return (
		<div style={{ width: '100%', height: 200 }}>
			<ResponsiveContainer>
				<LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
					<CartesianGrid strokeDasharray='3 3' />
					<XAxis
						dataKey='date'
						tick={{ fontSize: 11 }}
						interval='preserveStartEnd'
					/>
					<YAxis
						tick={{ fontSize: 11 }}
						tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
					/>
					<Tooltip
						formatter={(value: unknown) =>
							typeof value === 'number' ? [formatKm(value), 'Stav'] : ''
						}
						labelFormatter={(_label, payload) =>
							payload?.[0]?.payload?.fullDate
								? formatDate(payload[0].payload.fullDate)
								: ''
						}
					/>
					<Line
						type='monotone'
						dataKey='km'
						stroke='#5a8f3e'
						strokeWidth={2}
						dot={{ r: 3 }}
					/>
				</LineChart>
			</ResponsiveContainer>
		</div>
	)
}

export const OdometerSection: React.FC<{
	vehicleId: string
	vehicleName: string
	readings: OdometerReading[]
	onReadingsChange: (
		vehicleId: string,
		updater: (prev: OdometerReading[]) => OdometerReading[]
	) => void
}> = ({ vehicleId, vehicleName: _vehicleName, readings, onReadingsChange }) => {
	const [showChart, setShowChart] = useState(false)

	const handleAdd = (reading: OdometerReading) => {
		onReadingsChange(vehicleId, (prev) => [reading, ...prev])
	}

	const handleDelete = async (id: string) => {
		try {
			await deleteOdometerReading(id)
			onReadingsChange(vehicleId, (prev) => prev.filter((r) => r.id !== id))
		} catch {
			// ignore
		}
	}

	return (
		<div className='mt-3 border rounded p-3'>
			<h4 className='h6'>Stav tachometru</h4>
			<OdometerForm vehicleId={vehicleId} readings={readings} onAdd={handleAdd} />

			{readings.length === 0 ? (
				<p className='text-muted small'>
					Zatím nemáte žádné záznamy. Přidejte první měření.
				</p>
			) : (
				<>
					<ul className='list-group list-group-flush mb-2'>
						{readings.slice(0, 10).map((r) => (
							<li
								key={r.id}
								className='list-group-item d-flex justify-content-between align-items-center py-2 px-3 small'
							>
								<span>
									{formatDate(r.recorded_at)} – {formatKm(r.km)}
									{r.note && (
										<span className='text-muted ms-1'>• {r.note}</span>
									)}
								</span>
								<button
									type='button'
									className='btn btn-outline-danger btn-sm py-0 px-1'
									onClick={() => handleDelete(r.id)}
									aria-label='Smazat'
								>
									×
								</button>
							</li>
						))}
					</ul>
					{readings.length > 10 && (
						<p className='text-muted small'>
							Zobrazeno 10 z {readings.length} záznamů.
						</p>
					)}

					{readings.length >= 2 && (
						<>
							<button
								type='button'
								className='btn btn-outline-secondary btn-sm mb-2'
								onClick={() => setShowChart((s) => !s)}
							>
								{showChart ? 'Skrýt trend' : 'Zobrazit trend'}
							</button>
							{showChart && (
								<div className='border rounded p-2 bg-white'>
									<OdometerChart readings={readings} />
								</div>
							)}
						</>
					)}
				</>
			)}
		</div>
	)
}
