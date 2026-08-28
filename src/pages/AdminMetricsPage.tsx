import type { FC, FormEvent } from 'react'
import { useEffect, useState } from 'react'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'

/**
 * Operator-only conversion funnel (GET /api/admin/metrics). The admin secret is
 * entered here and kept in sessionStorage — never placed in the URL — and sent as
 * a Bearer header. noindex; nothing renders without a valid key (the API 401s).
 */
interface Metrics {
	funnel: Array<{ type: string; total: number; d30: number }>
	daily: Array<{ day: string; lookups: number; sales: number }>
	placements: Array<{ placement: string; n: number }>
	sales: { sales: number; revenue_czk: number }
	generatedAt: string
}

const KEY_STORAGE = 'admin_metrics_key'

const pct = (n: number, d: number): string =>
	d > 0 ? `${((100 * n) / d).toFixed(1)} %` : '–'

const AdminMetricsPage: FC = () => {
	const [key, setKey] = useState('')
	const [data, setData] = useState<Metrics | null>(null)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		const meta = document.createElement('meta')
		meta.name = 'robots'
		meta.content = 'noindex'
		document.head.appendChild(meta)
		document.title = 'Metriky | VIN Info.cz'
		return () => {
			meta.remove()
		}
	}, [])

	const load = async (secret: string) => {
		setLoading(true)
		setError('')
		try {
			const res = await fetch('/api/admin/metrics', {
				headers: { Authorization: `Bearer ${secret}` }
			})
			if (res.status === 401) {
				setError('Neplatný klíč.')
				sessionStorage.removeItem(KEY_STORAGE)
				setData(null)
				return
			}
			if (!res.ok) {
				setError('Načtení selhalo.')
				return
			}
			sessionStorage.setItem(KEY_STORAGE, secret)
			setData((await res.json()) as Metrics)
		} catch {
			setError('Načtení selhalo.')
		} finally {
			setLoading(false)
		}
	}

	// Reuse a key from this tab session, if any.
	useEffect(() => {
		const stored = sessionStorage.getItem(KEY_STORAGE)
		if (stored) {
			setKey(stored)
			void load(stored)
		}
	}, [])

	const submit = (e: FormEvent) => {
		e.preventDefault()
		if (key.trim()) void load(key.trim())
	}

	const byType = (t: string): { total: number; d30: number } =>
		data?.funnel.find((f) => f.type === t) ?? { total: 0, d30: 0 }

	const lookups = byType('vin_lookup').total
	const comparison = byType('comparison_view').total
	const cta = byType('cert_cta_click').total
	const created = byType('certificate_created').total
	const issued = byType('certificate_issued').total

	return (
		<>
			<Navigation />
			<main className='container my-4 my-md-5'>
				<h1 className='h4 mb-3'>Metriky konverze</h1>

				{!data && (
					<form
						onSubmit={submit}
						className='d-flex gap-2 mb-3'
						style={{ maxWidth: '420px' }}
					>
						<input
							type='password'
							className='form-control'
							placeholder='Admin klíč'
							value={key}
							onChange={(e) => setKey(e.target.value)}
							aria-label='Admin klíč'
						/>
						<button
							type='submit'
							className='btn btn-primary'
							disabled={loading}
						>
							{loading ? '…' : 'Načíst'}
						</button>
					</form>
				)}

				{error && (
					<div className='alert alert-warning' role='alert'>
						{error}
					</div>
				)}

				{data && (
					<>
						<div className='alert alert-success'>
							<strong>Reálné prodeje:</strong> {data.sales.sales} ·{' '}
							<strong>Tržba:</strong>{' '}
							{data.sales.revenue_czk.toLocaleString('cs-CZ')} Kč
							<span
								className='text-muted-ink ms-2'
								style={{ fontSize: '0.8rem' }}
							>
								(bez testovacích plateb)
							</span>
						</div>

						<h2 className='h6 mt-4'>Trychtýř</h2>
						<div className='table-responsive'>
							<table className='table table-sm table-striped align-middle'>
								<thead>
									<tr>
										<th>Krok</th>
										<th className='text-end'>Celkem</th>
										<th className='text-end'>30 dní</th>
										<th className='text-end'>Konverze</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td>VIN lookup</td>
										<td className='text-end'>{lookups}</td>
										<td className='text-end'>{byType('vin_lookup').d30}</td>
										<td className='text-end'>–</td>
									</tr>
									<tr>
										<td>Zobrazení nabídky</td>
										<td className='text-end'>{comparison}</td>
										<td className='text-end'>
											{byType('comparison_view').d30}
										</td>
										<td className='text-end'>{pct(comparison, lookups)}</td>
									</tr>
									<tr>
										<td>Klik na CTA</td>
										<td className='text-end'>{cta}</td>
										<td className='text-end'>{byType('cert_cta_click').d30}</td>
										<td className='text-end'>{pct(cta, comparison)}</td>
									</tr>
									<tr>
										<td>Redirect na platbu</td>
										<td className='text-end'>{created}</td>
										<td className='text-end'>
											{byType('certificate_created').d30}
										</td>
										<td className='text-end'>{pct(created, cta)}</td>
									</tr>
									<tr>
										<td>Zaplaceno</td>
										<td className='text-end'>{issued}</td>
										<td className='text-end'>
											{byType('certificate_issued').d30}
										</td>
										<td className='text-end'>{pct(issued, created)}</td>
									</tr>
								</tbody>
							</table>
						</div>

						<h2 className='h6 mt-4'>CTA podle umístění</h2>
						<div className='table-responsive'>
							<table className='table table-sm table-striped align-middle'>
								<thead>
									<tr>
										<th>Placement</th>
										<th className='text-end'>Kliků</th>
									</tr>
								</thead>
								<tbody>
									{data.placements.map((p) => (
										<tr key={p.placement}>
											<td>{p.placement}</td>
											<td className='text-end'>{p.n}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<h2 className='h6 mt-4'>Denně (30 dní)</h2>
						<div className='table-responsive'>
							<table className='table table-sm table-striped align-middle'>
								<thead>
									<tr>
										<th>Den</th>
										<th className='text-end'>Lookupů</th>
										<th className='text-end'>Prodejů</th>
									</tr>
								</thead>
								<tbody>
									{data.daily.map((d) => (
										<tr key={d.day}>
											<td className='num'>{d.day}</td>
											<td className='text-end'>{d.lookups}</td>
											<td className='text-end'>{d.sales}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<p className='text-muted-ink mt-2' style={{ fontSize: '0.75rem' }}>
							Aktualizováno:{' '}
							{new Date(data.generatedAt).toLocaleString('cs-CZ')}
						</p>
					</>
				)}
			</main>
			<Footer />
		</>
	)
}

export default AdminMetricsPage
