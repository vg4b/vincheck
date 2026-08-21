import type React from 'react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import { ApiError, requestJson } from '../utils/apiClient'
import { titleCase } from '../utils/carLabels'

const fmtInt = (n: number) => Math.round(n).toLocaleString('cs-CZ')
const fmtPct = (n: number) =>
	`${n.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`

type RankingDef = {
	slug: string
	title: string
	lede: string
	unit: 'pct' | 'fraction' | 'count'
	contextLabel: string
	contextUnit: 'pct' | 'fraction' | 'count'
	valueLabel: string
	minValue: number
	minColumn: string
}
type RankingRow = {
	brand: string
	model: string
	brandSlug: string
	modelSlug: string
	value: number
	context: number | null
}
type LoadState = 'loading' | 'ok' | 'notfound' | 'error'

const RankingPage: React.FC = () => {
	const { slug = '' } = useParams<{ slug: string }>()
	const [state, setState] = useState<LoadState>('loading')
	const [def, setDef] = useState<RankingDef | null>(null)
	const [rows, setRows] = useState<RankingRow[]>([])

	useEffect(() => {
		let cancelled = false
		setState('loading')
		setDef(null)
		setRows([])
		requestJson<{ def: RankingDef; rows: RankingRow[] }>(
			`/api/stats?type=rankingjson&slug=${encodeURIComponent(slug)}`
		)
			.then((data) => {
				if (cancelled) return
				setDef(data.def)
				setRows(data.rows ?? [])
				setState('ok')
			})
			.catch((err: unknown) => {
				if (cancelled) return
				setState(
					err instanceof ApiError && err.status === 404 ? 'notfound' : 'error'
				)
			})
		return () => {
			cancelled = true
		}
	}, [slug])

	// The server already wrote the head for crawlers; this keeps it correct after
	// a client-side navigation.
	useEffect(() => {
		const prevTitle = document.title
		if (state === 'ok' && def) document.title = `${def.title} | VIN Info.cz`
		else if (state === 'notfound')
			document.title = 'Stránka nenalezena | VIN Info.cz'
		return () => {
			document.title = prevTitle
		}
	}, [state, def])

	// 'fraction' columns are stored 0..1 and 'pct' columns 0..100 — see
	// RankingDef. Rendering both the same way printed a 17.2 % LPG share as
	// "0.2 %".
	const fmtValue = (v: number) => {
		if (def?.unit === 'pct') return fmtPct(v)
		if (def?.unit === 'fraction') return fmtPct(v * 100)
		return fmtInt(v)
	}

	return (
		<>
			<Navigation />
			<main className='container mt-5 pb-5' style={{ maxWidth: 800 }}>
				<nav aria-label='breadcrumb' className='small text-muted-ink mb-3'>
					<Link to='/znacky'>Statistiky vozů</Link>
					{state === 'ok' && def && <> · {def.title}</>}
				</nav>

				{state === 'loading' && <p className='text-muted-ink'>Načítám…</p>}
				{state === 'notfound' && (
					<>
						<h1 className='h3 mb-3'>Žebříček jsme nenašli</h1>
						<p className='text-muted-ink'>
							<Link to='/znacky'>Zpět na statistiky vozů</Link>
						</p>
					</>
				)}
				{state === 'error' && (
					<p className='text-muted-ink'>
						Žebříček se teď nepodařilo načíst. Zkuste to prosím za chvíli.
					</p>
				)}

				{state === 'ok' && def && (
					<>
						<h1 className='h3 mb-2'>{def.title}</h1>
						<p className='text-muted-ink'>{def.lede}</p>

						{/* Column headers. Without them the list showed "701 130" and
						    "4,7 %" side by side with nothing to say what either was. */}
						<div className='d-flex align-items-baseline gap-2 border-bottom pb-1 mt-4 small text-muted-ink'>
							<span style={{ minWidth: '1.8rem' }} />
							<span className='flex-grow-1'>Model</span>
							<span className='text-nowrap fw-semibold'>{def.valueLabel}</span>
							{rows.some((r) => r.context !== null) && (
								<span
									className='text-nowrap d-none d-sm-inline'
									style={{ minWidth: '9rem', textAlign: 'right' }}
								>
									{def.contextLabel}
								</span>
							)}
						</div>

						<ol className='list-unstyled mb-3'>
							{rows.map((r, i) => (
								<li
									key={`${r.brandSlug}-${r.modelSlug}`}
									className='d-flex align-items-baseline gap-2 border-bottom py-2'
								>
									<span
										className='text-muted-ink small'
										style={{ minWidth: '1.8rem' }}
									>
										{i + 1}.
									</span>
									<Link
										to={`/znacky/${r.brandSlug}/${r.modelSlug}`}
										className='flex-grow-1'
									>
										{titleCase(r.brand)} {titleCase(r.model)}
									</Link>
									<strong className='text-nowrap'>{fmtValue(r.value)}</strong>
									{r.context !== null && (
										<span
											className='small text-muted-ink text-nowrap d-none d-sm-inline'
											style={{ minWidth: '9rem', textAlign: 'right' }}
										>
											{def.contextUnit === 'pct'
												? fmtPct(r.context)
												: def.contextUnit === 'fraction'
													? fmtPct(r.context * 100)
													: fmtInt(r.context)}
										</span>
									)}
								</li>
							))}
						</ol>

						{/* The floor is stated, not hidden: a rate over a handful of cars
						    is noise, and a reader who cannot see the denominator has no
						    way to judge the number. */}
						{/* Only where a floor actually applies: the "most common cars"
						    ranking has none, and printing "alespoň 0" made the caption
						    read as a bug. */}
						<p className='small text-muted-ink'>
							{def.minValue > 0 && (
								<>
									Do žebříčku se dostanou jen modely s dostatečným počtem
									záznamů (alespoň {fmtInt(def.minValue)}), aby procento něco
									znamenalo.{' '}
								</>
							)}
							Údaje pocházejí z registru silničních vozidel ČR a z evidence
							technických prohlídek.
						</p>

						<Link to='/znacky' className='btn-brand d-inline-block mt-3'>
							Statistiky podle značky a modelu →
						</Link>
					</>
				)}
			</main>
			<Footer />
		</>
	)
}

export default RankingPage
