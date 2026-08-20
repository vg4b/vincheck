import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import { ApiError, requestJson } from '../utils/apiClient'
import { titleCase } from '../utils/carLabels'

const BASE_URL = 'https://www.vininfo.cz'

const fmtInt = (n: number) => Math.round(n).toLocaleString('cs-CZ')
const fmtKm = (n: number) => `${fmtInt(n)} km`
const fmtNum1 = (n: number) =>
	n.toLocaleString('cs-CZ', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	})

type BrandStats = {
	brand: string
	vehicleCount: number
	modelCount: number
	firstYear: number | null
	lastYear: number | null
	avgAgeYears: number | null
	stkFailPct: number | null
	stkInspections: number | null
	medianKmByAge: Record<string, number> | null
	computedAt: string | null
}
type BrandModel = {
	brand: string
	model: string
	brandSlug: string
	modelSlug: string
	vehicleCount: number
}
type LoadState = 'loading' | 'ok' | 'notfound' | 'error'

const MILESTONE_AGES = [5, 10, 15]

const BrandStatsPage: React.FC = () => {
	const { brand: brandSlug = '' } = useParams<{ brand: string }>()
	const [state, setState] = useState<LoadState>('loading')
	const [stats, setStats] = useState<BrandStats | null>(null)
	const [models, setModels] = useState<BrandModel[]>([])

	useEffect(() => {
		let cancelled = false
		setState('loading')
		setStats(null)
		setModels([])
		const params = new URLSearchParams({
			type: 'brandjson',
			brand: brandSlug.toLowerCase()
		})
		requestJson<{ stats: BrandStats; models: BrandModel[] }>(
			`/api/stats?${params.toString()}`
		)
			.then((data) => {
				if (cancelled) return
				setStats(data.stats)
				setModels(data.models ?? [])
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
	}, [brandSlug])

	const name = useMemo(() => (stats ? titleCase(stats.brand) : ''), [stats])
	const canonical = `${BASE_URL}/znacky/${brandSlug.toLowerCase()}`

	// The server already injects title/description/canonical for crawlers; this
	// keeps them right after client-side navigation, and adopts the existing
	// elements rather than appending duplicates.
	useEffect(() => {
		const prevTitle = document.title
		const setMeta = (attr: 'name' | 'property', key: string, value: string) => {
			const sel = `meta[${attr}="${key}"]`
			let el = document.head.querySelector<HTMLMetaElement>(sel)
			if (!el) {
				el = document.createElement('meta')
				el.setAttribute(attr, key)
				document.head.appendChild(el)
			}
			el.setAttribute('content', value)
		}
		let canonicalEl = document.head.querySelector<HTMLLinkElement>(
			'link[rel="canonical"]'
		)
		const hadCanonical = Boolean(canonicalEl)
		if (!canonicalEl) {
			canonicalEl = document.createElement('link')
			canonicalEl.setAttribute('rel', 'canonical')
			document.head.appendChild(canonicalEl)
		}
		const prevCanonical = canonicalEl.getAttribute('href')

		if (state === 'ok' && stats) {
			const parts = [`Statistiky vozů ${name} z registru silničních vozidel`]
			if (stats.stkFailPct != null)
				parts.push(`poruchovost STK ${fmtNum1(stats.stkFailPct)} %`)
			parts.push(`${fmtInt(stats.vehicleCount)} vozidel`)
			const description = `${parts.join(', ')}.`
			document.title = `${name}: statistiky, spolehlivost a nájezd | VIN Info.cz`
			setMeta('name', 'description', description)
			setMeta('property', 'og:title', `${name}: statistiky a spolehlivost`)
			setMeta('property', 'og:description', description)
			setMeta('property', 'og:url', canonical)
			canonicalEl.setAttribute('href', canonical)
		} else if (state === 'notfound') {
			document.title = 'Stránka nenalezena | VIN Info.cz'
		}

		return () => {
			document.title = prevTitle
			if (hadCanonical) {
				if (prevCanonical) canonicalEl?.setAttribute('href', prevCanonical)
			} else {
				canonicalEl?.remove()
			}
		}
	}, [state, stats, name, canonical])

	const mileageRows = useMemo(() => {
		if (!stats?.medianKmByAge) return []
		return Object.entries(stats.medianKmByAge)
			.map(([age, km]) => [Number(age), km] as const)
			.filter(([age]) => MILESTONE_AGES.includes(age))
			.sort((a, b) => a[0] - b[0])
	}, [stats])

	return (
		<>
			<Navigation />
			<main className='container mt-5 pb-5' style={{ maxWidth: 860 }}>
				<nav aria-label='breadcrumb' className='small text-muted-ink mb-3'>
					<Link to='/znacky'>Značky</Link>
					{state === 'ok' && <> · {name}</>}
				</nav>

				{state === 'loading' && <p className='text-muted-ink'>Načítám…</p>}
				{state === 'notfound' && (
					<>
						<h1 className='h3 mb-3'>Značku jsme nenašli</h1>
						<p className='text-muted-ink'>
							Statistiky zveřejňujeme jen pro značky s dostatečným počtem
							vozidel v registru. <Link to='/znacky'>Zobrazit všechny</Link>.
						</p>
					</>
				)}
				{state === 'error' && (
					<p className='text-muted-ink'>
						Statistiky se teď nepodařilo načíst. Zkuste to prosím za chvíli.
					</p>
				)}

				{state === 'ok' && stats && (
					<>
						<h1 className='h3 mb-2'>{name}: statistiky z registru vozidel</h1>
						<p className='text-muted-ink'>
							{fmtInt(stats.vehicleCount)} provozovaných vozidel v ČR
							{stats.firstYear && stats.lastYear
								? `, registrace ${stats.firstYear}–${stats.lastYear}`
								: ''}
							.
						</p>

						<div className='row g-3 my-4'>
							{stats.stkFailPct != null && stats.stkInspections != null && (
								<div className='col-sm-6'>
									<h2 className='h6 mb-1'>Poruchovost při STK</h2>
									<p className='mb-0'>
										<strong>{fmtNum1(stats.stkFailPct)} %</strong> prohlídek
										skončilo závadou
										<span className='d-block small text-muted-ink'>
											z {fmtInt(stats.stkInspections)} prohlídek
										</span>
									</p>
								</div>
							)}
							{stats.avgAgeYears != null && (
								<div className='col-sm-6'>
									<h2 className='h6 mb-1'>Průměrné stáří</h2>
									<p className='mb-0'>
										<strong>{fmtNum1(stats.avgAgeYears)} let</strong>
									</p>
								</div>
							)}
						</div>

						{mileageRows.length > 0 && (
							<section className='mb-4'>
								<h2 className='h5 mb-3'>Obvyklý nájezd podle stáří</h2>
								<ul className='list-unstyled mb-0'>
									{mileageRows.map(([age, km]) => (
										<li key={age}>
											{age} let: <strong>{fmtKm(km)}</strong>
										</li>
									))}
								</ul>
							</section>
						)}

						<section>
							<h2 className='h5 mb-3'>Nejčastější modely</h2>
							{/* "Nejčastější", never "všechny": the brand total above covers
							    models below the publish floor, which have no page. */}
							<ul className='list-unstyled mb-2'>
								{models.map((m) => (
									<li key={m.modelSlug} className='mb-1'>
										<Link to={`/znacky/${m.brandSlug}/${m.modelSlug}`}>
											{titleCase(m.brand)} {titleCase(m.model)}
										</Link>{' '}
										<span className='small text-muted-ink'>
											{fmtInt(m.vehicleCount)} vozidel
										</span>
									</li>
								))}
							</ul>
							<p className='small text-muted-ink mb-0'>
								Statistiky zveřejňujeme jen pro modely s dostatečným počtem
								vozidel, aby čísla něco znamenala. Součet modelů je proto nižší
								než celkový počet vozidel značky.
							</p>
						</section>

						{stats.computedAt && (
							<p className='small text-muted-ink mt-4 mb-0'>
								Data z registru silničních vozidel ČR, přepočteno{' '}
								{stats.computedAt.slice(0, 10)}.
							</p>
						)}
					</>
				)}
			</main>
			<Footer />
		</>
	)
}

export default BrandStatsPage
