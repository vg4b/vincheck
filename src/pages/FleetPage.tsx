import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import type { FleetResult } from '../types'
import { fetchFleetByIco } from '../utils/vehicleApi'

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

/**
 * Vehicles registered to a legal entity (IČO) — public-registry "fleet" view.
 * Shows a bounded sample (the endpoint caps big leasing fleets).
 * See docs/VEHICLE_HISTORY_PANEL.md.
 */
const FleetPage: FC = () => {
	const { ico } = useParams<{ ico: string }>()
	const [data, setData] = useState<FleetResult | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

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
				const res = await fetchFleetByIco(ico, { signal: controller.signal })
				if (!res) {
					setError('Pro toto IČO nebyla v registru nalezena žádná vozidla.')
				} else {
					setData(res)
					document.title = `Vozidla — ${res.nazev ?? `IČO ${ico}`} | VIN Info.cz`
				}
			} catch (err) {
				if (err instanceof DOMException && err.name === 'AbortError') return
				setError('Nepodařilo se načíst vozidla pro toto IČO.')
			} finally {
				setLoading(false)
			}
		}
		run()
		return () => controller.abort()
	}, [ico])

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

	return (
		<>
			<Navigation />
			<main className='container my-4 my-md-5'>
				<h1 className='h4 mb-1'>Vozidla podle IČO</h1>
				<p className='text-muted-ink num mb-3'>{ico}</p>

				{error && (
					<div className='alert alert-warning' role='alert'>
						{error}
					</div>
				)}

				{!loading && data && (
					<>
						<p>
							{data.nazev && (
								<>
									<strong>{data.nazev}</strong> —{' '}
								</>
							)}
							{data.countCapped ? `${data.count}+` : data.count}{' '}
							{vehicleWord(data.count)} v registru
							{data.countCapped && ' (zobrazena ukázka)'}.
						</p>

						<div className='table-responsive'>
							<table className='table table-striped align-middle'>
								<thead>
									<tr>
										<th>VIN</th>
										<th>Vozidlo</th>
										<th>Rok</th>
										<th>Vztah</th>
									</tr>
								</thead>
								<tbody>
									{data.vehicles.map((v, i) => (
										<tr key={v.vin ?? `row-${i}`}>
											<td className='num'>
												{v.vin && v.vin.length === 17 ? (
													<Link to={`/vin/${v.vin}`}>{v.vin}</Link>
												) : (
													(v.vin ?? '—')
												)}
											</td>
											<td>
												{[v.znacka, v.model, v.oznaceni]
													.filter(Boolean)
													.join(' ') || '—'}
											</td>
											<td>{v.rok ?? '—'}</td>
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
									))}
								</tbody>
							</table>
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
