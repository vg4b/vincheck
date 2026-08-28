import type { FC } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import type { FleetResult, FleetVehicle } from '../types'
import { FLEET_MAX_LIMIT, fetchFleetByIco } from '../utils/vehicleApi'

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const
const DEFAULT_PAGE_SIZE = 25
const TOP_BRANDS = 5

type VztahFilter = 'all' | 'current' | 'past'
type SortKey =
	| 'vin'
	| 'vehicle'
	| 'rok'
	| 'prvniRegistrace'
	| 'status'
	| 'vztah'
type SortDir = 'asc' | 'desc'

function vehicleWord(n: number): string {
	if (n === 1) return 'vozidlo'
	if (n >= 2 && n <= 4) return 'vozidla'
	return 'vozidel'
}

function fmtDate(s: string | null): string {
	if (!s) return '—'
	const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
	return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}` : s
}

function vehicleLabel(v: FleetVehicle): string {
	return [v.znacka, v.model, v.oznaceni].filter(Boolean).join(' ')
}

// Sort comparator for one column; nulls/blanks always sort to the end.
function compareBy(a: FleetVehicle, b: FleetVehicle, key: SortKey): number {
	switch (key) {
		case 'rok': {
			const na = a.rok ? Number(a.rok) : Number.NaN
			const nb = b.rok ? Number(b.rok) : Number.NaN
			if (Number.isNaN(na) && Number.isNaN(nb)) return 0
			if (Number.isNaN(na)) return 1
			if (Number.isNaN(nb)) return -1
			return na - nb
		}
		case 'vztah':
			return Number(a.current) - Number(b.current)
		case 'vehicle':
			return vehicleLabel(a).localeCompare(vehicleLabel(b), 'cs')
		default: {
			const va = (a[key] ?? '') as string
			const vb = (b[key] ?? '') as string
			if (!va && !vb) return 0
			if (!va) return 1
			if (!vb) return -1
			return va.localeCompare(vb, 'cs')
		}
	}
}

/**
 * Vehicles registered to a legal entity (IČO) — public-registry "fleet" view.
 * The whole bounded working set (capped at FLEET_MAX_LIMIT) is fetched once and
 * filtered / sorted / paged / summarised client-side. See docs/VEHICLE_HISTORY_PANEL.md.
 */
const FleetPage: FC = () => {
	const { ico } = useParams<{ ico: string }>()
	const [data, setData] = useState<FleetResult | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	const [q, setQ] = useState('')
	const [brand, setBrand] = useState('')
	const [vztah, setVztah] = useState<VztahFilter>('all')
	const [yearFrom, setYearFrom] = useState('')
	const [yearTo, setYearTo] = useState('')
	const [sortKey, setSortKey] = useState<SortKey | null>(null)
	const [sortDir, setSortDir] = useState<SortDir>('asc')
	const [page, setPage] = useState(0)
	const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)

	// Results expose owner/registry data — keep this page out of the search index
	// (the /firma search form stays indexable).
	useEffect(() => {
		const meta = document.createElement('meta')
		meta.name = 'robots'
		meta.content = 'noindex'
		document.head.appendChild(meta)
		return () => {
			meta.remove()
		}
	}, [])

	useEffect(() => {
		const controller = new AbortController()
		const run = async () => {
			if (!ico) return
			setLoading(true)
			setError('')
			try {
				const res = await fetchFleetByIco(ico, {
					limit: FLEET_MAX_LIMIT,
					signal: controller.signal
				})
				if (!res) {
					setError('Pro toto IČO nebyla v registru nalezena žádná vozidla.')
				} else {
					setData(res)
					document.title = `Vozidla – ${res.nazev ?? `IČO ${ico}`} | VIN Info.cz`
				}
			} catch (err) {
				if (err instanceof DOMException && err.name === 'AbortError') return
				setError('Nepodařilo se načíst vozidla pro toto IČO.')
			} finally {
				// Don't clear loading for a request we aborted (StrictMode's
				// double-invoke, or an ico change) — the superseding request is still
				// in flight and owns the spinner.
				if (!controller.signal.aborted) setLoading(false)
			}
		}
		run()
		return () => controller.abort()
	}, [ico])

	const vehicles = useMemo(() => data?.vehicles ?? [], [data])

	// Distinct brands (for the filter dropdown), sorted Czech-alphabetically.
	const brands = useMemo(() => {
		const set = new Set<string>()
		for (const v of vehicles) if (v.znacka) set.add(v.znacka)
		return Array.from(set).sort((a, b) => a.localeCompare(b, 'cs'))
	}, [vehicles])

	// Whole-set summary (the dashboard) — stays stable while filters narrow the table.
	const summary = useMemo(() => {
		let current = 0
		let minYear = Number.POSITIVE_INFINITY
		let maxYear = Number.NEGATIVE_INFINITY
		const brandCounts = new Map<string, number>()
		for (const v of vehicles) {
			if (v.current) current += 1
			if (v.znacka)
				brandCounts.set(v.znacka, (brandCounts.get(v.znacka) ?? 0) + 1)
			const y = v.rok ? Number(v.rok) : Number.NaN
			if (!Number.isNaN(y)) {
				if (y < minYear) minYear = y
				if (y > maxYear) maxYear = y
			}
		}
		const topBrands = Array.from(brandCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, TOP_BRANDS)
		return {
			current,
			past: vehicles.length - current,
			topBrands,
			minYear: Number.isFinite(minYear) ? minYear : null,
			maxYear: Number.isFinite(maxYear) ? maxYear : null
		}
	}, [vehicles])

	// The dashboard prefers the precomputed true aggregates (fleet_stats). Without
	// them, a full fleet's sample IS the whole fleet, so the sample stats are
	// accurate; but a *sampled* big fleet has no honest summary to show yet, so we
	// only state the true total there and defer the breakdown to the build.
	const dashboard = useMemo(() => {
		if (!data) return null
		if (data.stats) {
			return {
				accurate: true as const,
				current: data.stats.current,
				past: data.count - data.stats.current,
				minYear: data.stats.minRok,
				maxYear: data.stats.maxRok,
				brands: data.stats.brands.slice(0, TOP_BRANDS)
			}
		}
		if (!data.sampled) {
			return {
				accurate: true as const,
				current: summary.current,
				past: summary.past,
				minYear: summary.minYear,
				maxYear: summary.maxYear,
				brands: summary.topBrands.map(([znacka, n]) => ({ znacka, n }))
			}
		}
		return { accurate: false as const }
	}, [data, summary])

	const filtered = useMemo(() => {
		const needle = q.trim().toLowerCase()
		const from = yearFrom ? Number(yearFrom) : null
		const to = yearTo ? Number(yearTo) : null
		return vehicles.filter((v) => {
			if (brand && v.znacka !== brand) return false
			if (vztah === 'current' && !v.current) return false
			if (vztah === 'past' && v.current) return false
			if (from != null || to != null) {
				const y = v.rok ? Number(v.rok) : Number.NaN
				if (Number.isNaN(y)) return false
				if (from != null && y < from) return false
				if (to != null && y > to) return false
			}
			if (needle) {
				const hay = `${v.vin ?? ''} ${vehicleLabel(v)}`.toLowerCase()
				if (!hay.includes(needle)) return false
			}
			return true
		})
	}, [vehicles, q, brand, vztah, yearFrom, yearTo])

	const sorted = useMemo(() => {
		if (!sortKey) return filtered
		const dir = sortDir === 'asc' ? 1 : -1
		return [...filtered].sort((a, b) => compareBy(a, b, sortKey) * dir)
	}, [filtered, sortKey, sortDir])

	const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
	const safePage = Math.min(page, totalPages - 1)
	const pageRows = sorted.slice(
		safePage * pageSize,
		safePage * pageSize + pageSize
	)

	// Any filter/sort change sends the user back to the first page.
	useEffect(() => {
		setPage(0)
	}, [q, brand, vztah, yearFrom, yearTo, sortKey, sortDir, pageSize])

	const toggleSort = (key: SortKey) => {
		if (sortKey === key) {
			setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
		} else {
			setSortKey(key)
			setSortDir('asc')
		}
	}

	const sortIndicator = (key: SortKey) =>
		sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

	const filtersActive =
		q !== '' ||
		brand !== '' ||
		vztah !== 'all' ||
		yearFrom !== '' ||
		yearTo !== ''

	const resetFilters = () => {
		setQ('')
		setBrand('')
		setVztah('all')
		setYearFrom('')
		setYearTo('')
	}

	const downloadCsv = () => {
		const header = [
			'VIN',
			'Značka',
			'Model',
			'Obchodní označení',
			'Rok výroby',
			'První registrace',
			'Status',
			'Vztah'
		]
		const cell = (value: string | null): string => {
			const s = value ?? ''
			return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
		}
		const lines = sorted.map((v) =>
			[
				v.vin,
				v.znacka,
				v.model,
				v.oznaceni,
				v.rok,
				v.prvniRegistrace,
				v.status,
				v.current ? 'aktuální' : 'minulý'
			]
				.map(cell)
				.join(',')
		)
		// UTF-8 BOM so Excel reads Czech diacritics correctly.
		const csv = `﻿${[header.join(','), ...lines].join('\r\n')}\r\n`
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `vozidla-ico-${ico}.csv`
		document.body.appendChild(a)
		a.click()
		a.remove()
		URL.revokeObjectURL(url)
	}

	// Full-page loader, matching the vehicle detail page.
	if (loading) {
		return (
			<>
				<Navigation />
				<div className='container mt-5'>
					<div className='text-center'>
						<div className='spinner-border' role='status'>
							<span className='visually-hidden'>Načítání...</span>
						</div>
						<p className='mt-3'>Načítání vozidel firmy...</p>
					</div>
				</div>
				<Footer />
			</>
		)
	}

	const sortableTh = (key: SortKey, label: string) => (
		<th>
			<button
				type='button'
				className='btn btn-link p-0 text-decoration-none fw-bold text-reset'
				onClick={() => toggleSort(key)}
			>
				{label}
				{sortIndicator(key)}
			</button>
		</th>
	)

	return (
		<>
			<Navigation />
			<main className='container my-4 my-md-5'>
				<h1 className='h4 mb-1'>Vozidla podle IČO</h1>
				<p className='text-muted-ink mb-3'>
					<span className='num'>{ico}</span>
					{ico && (
						<>
							{' · '}
							<a
								href={`https://verejnerejstriky.msp.gov.cz/vysledky?resultsType=search&hledanyText=${encodeURIComponent(
									ico
								)}&rejstriky=VR`}
								target='_blank'
								rel='noopener noreferrer'
							>
								Ověřit v obchodním rejstříku
							</a>
						</>
					)}
				</p>

				{error && (
					<div className='alert alert-warning' role='alert'>
						{error}
					</div>
				)}

				{data && (
					<>
						<div className='d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3'>
							<div>
								<p className='mb-1'>
									{data.nazev && (
										<>
											<strong>{data.nazev}</strong> –{' '}
										</>
									)}
									<strong>{data.count.toLocaleString('cs-CZ')}</strong>{' '}
									{vehicleWord(data.count)} v registru.
								</p>
								{dashboard?.accurate ? (
									<p
										className='text-muted-ink mb-0'
										style={{ fontSize: '0.85rem' }}
									>
										Aktuálně vedených: <strong>{dashboard.current}</strong> ·
										Minulých: <strong>{dashboard.past}</strong>
										{dashboard.minYear && dashboard.maxYear && (
											<>
												{' '}
												· Roky: {dashboard.minYear}
												{dashboard.maxYear !== dashboard.minYear
													? `–${dashboard.maxYear}`
													: ''}
											</>
										)}
										{dashboard.brands.length > 0 && (
											<>
												{' '}
												· Značky:{' '}
												{dashboard.brands
													.map(
														(b) =>
															`${b.znacka} (${b.n.toLocaleString('cs-CZ')})`
													)
													.join(', ')}
											</>
										)}
									</p>
								) : (
									<p
										className='text-muted-ink mb-0'
										style={{ fontSize: '0.85rem' }}
									>
										Níže je zobrazeno {vehicles.length.toLocaleString('cs-CZ')}{' '}
										nejnovějších vozidel; podrobný souhrn celé flotily bude
										doplněn po přepočtu.
									</p>
								)}
							</div>
							<button
								type='button'
								className='btn btn-outline-secondary btn-sm text-nowrap'
								onClick={downloadCsv}
							>
								Stáhnout CSV
							</button>
						</div>

						<div className='row g-2 align-items-end mb-3'>
							<div className='col-12 col-md-4'>
								<label
									className='form-label mb-1'
									htmlFor='fleet-q'
									style={{ fontSize: '0.8rem' }}
								>
									Hledat (VIN, model)
								</label>
								<input
									id='fleet-q'
									type='text'
									className='form-control form-control-sm'
									value={q}
									onChange={(e) => setQ(e.target.value)}
									placeholder='např. OCTAVIA nebo TMB…'
								/>
							</div>
							<div className='col-6 col-md-3'>
								<label
									className='form-label mb-1'
									htmlFor='fleet-brand'
									style={{ fontSize: '0.8rem' }}
								>
									Značka
								</label>
								<select
									id='fleet-brand'
									className='form-select form-select-sm'
									value={brand}
									onChange={(e) => setBrand(e.target.value)}
								>
									<option value=''>Všechny</option>
									{brands.map((b) => (
										<option key={b} value={b}>
											{b}
										</option>
									))}
								</select>
							</div>
							<div className='col-6 col-md-2'>
								<label
									className='form-label mb-1'
									htmlFor='fleet-vztah'
									style={{ fontSize: '0.8rem' }}
								>
									Vztah
								</label>
								<select
									id='fleet-vztah'
									className='form-select form-select-sm'
									value={vztah}
									onChange={(e) => setVztah(e.target.value as VztahFilter)}
								>
									<option value='all'>Vše</option>
									<option value='current'>Aktuální</option>
									<option value='past'>Minulé</option>
								</select>
							</div>
							<div className='col-6 col-md-3'>
								<div className='form-label mb-1' style={{ fontSize: '0.8rem' }}>
									Rok výroby
								</div>
								<div className='d-flex align-items-center gap-1'>
									<input
										type='number'
										className='form-control form-control-sm'
										value={yearFrom}
										onChange={(e) => setYearFrom(e.target.value)}
										placeholder='od'
										aria-label='Rok od'
									/>
									<span className='text-muted-ink'>–</span>
									<input
										type='number'
										className='form-control form-control-sm'
										value={yearTo}
										onChange={(e) => setYearTo(e.target.value)}
										placeholder='do'
										aria-label='Rok do'
									/>
								</div>
							</div>
						</div>

						<div className='d-flex align-items-center justify-content-between mb-2'>
							<span className='text-muted-ink' style={{ fontSize: '0.85rem' }}>
								{filtersActive
									? `Filtr: ${sorted.length} z ${vehicles.length} zobrazených`
									: data.sampled
										? `Zobrazeno ${vehicles.length.toLocaleString(
												'cs-CZ'
											)} nejnovějších z ${data.count.toLocaleString('cs-CZ')} ${vehicleWord(
												data.count
											)}`
										: `${vehicles.length} ${vehicleWord(vehicles.length)}`}
							</span>
							{filtersActive && (
								<button
									type='button'
									className='btn btn-link btn-sm p-0'
									onClick={resetFilters}
								>
									Zrušit filtry
								</button>
							)}
						</div>

						<div className='table-responsive'>
							<table className='table table-striped align-middle'>
								<thead>
									<tr>
										{sortableTh('vin', 'VIN')}
										{sortableTh('vehicle', 'Vozidlo')}
										{sortableTh('rok', 'Rok')}
										{sortableTh('prvniRegistrace', 'První registrace')}
										{sortableTh('status', 'Status')}
										{sortableTh('vztah', 'Vztah')}
									</tr>
								</thead>
								<tbody>
									{pageRows.length === 0 ? (
										<tr>
											<td
												colSpan={6}
												className='text-center text-muted-ink py-4'
											>
												Žádné vozidlo neodpovídá filtru.
											</td>
										</tr>
									) : (
										pageRows.map((v, i) => (
											<tr key={v.vin ?? `row-${i}`}>
												<td className='num'>
													{v.vin && v.vin.length === 17 ? (
														<Link to={`/vin/${v.vin}`}>{v.vin}</Link>
													) : (
														(v.vin ?? '—')
													)}
												</td>
												<td>{vehicleLabel(v) || '—'}</td>
												<td>{v.rok ?? '—'}</td>
												<td className='num'>{fmtDate(v.prvniRegistrace)}</td>
												<td>{v.status ?? '—'}</td>
												<td>
													{v.current ? (
														<span className='badge text-bg-success'>
															aktuální
														</span>
													) : (
														<span className='badge text-bg-light border'>
															minulý
														</span>
													)}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>

						<div className='d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2'>
							<div className='d-flex align-items-center gap-2'>
								<label
									className='text-muted-ink mb-0'
									htmlFor='fleet-page-size'
									style={{ fontSize: '0.85rem' }}
								>
									Na stránku
								</label>
								<select
									id='fleet-page-size'
									className='form-select form-select-sm w-auto'
									value={pageSize}
									onChange={(e) => setPageSize(Number(e.target.value))}
								>
									{PAGE_SIZE_OPTIONS.map((n) => (
										<option key={n} value={n}>
											{n}
										</option>
									))}
								</select>
							</div>

							{sorted.length > 0 && (
								<span
									className='text-muted-ink'
									style={{ fontSize: '0.85rem' }}
								>
									{safePage * pageSize + 1}–
									{safePage * pageSize + pageRows.length} z {sorted.length}
								</span>
							)}

							<div className='btn-group btn-group-sm' role='group'>
								<button
									type='button'
									className='btn btn-outline-secondary'
									disabled={safePage === 0}
									onClick={() => setPage((p) => Math.max(0, p - 1))}
								>
									← Předchozí
								</button>
								<span className='btn btn-outline-secondary disabled'>
									{safePage + 1} / {totalPages}
								</span>
								<button
									type='button'
									className='btn btn-outline-secondary'
									disabled={safePage + 1 >= totalPages}
									onClick={() => setPage((p) => p + 1)}
								>
									Další →
								</button>
							</div>
						</div>

						<p className='text-muted-ink mt-2' style={{ fontSize: '0.75rem' }}>
							Údaje z veřejného registru silničních vozidel
							{data.snapshot ? `, stav k ${fmtDate(data.snapshot)}` : ''}.
						</p>
					</>
				)}
			</main>
			<Footer />
		</>
	)
}

export default FleetPage
