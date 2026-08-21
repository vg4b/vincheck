import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import { ApiError, requestJson } from '../utils/apiClient'
import { niceLabel, titleCase } from '../utils/carLabels'

// Mirror of api/_statsData.ts ModelStats (the JSON shape /api/stats returns).
interface ModelStats {
	brand: string
	model: string
	vehicleCount: number
	firstYear: number | null
	lastYear: number | null
	avgAgeYears: number | null
	fuelSplit: Record<string, number> | null
	avgOwners: number | null
	pctImported: number | null
	pctLpg: number | null
	pctTowbar: number | null
	stkFailPct: number | null
	stkInspections: number | null
	medianKmByAge: Record<string, number> | null
	colorSplit: Record<string, number> | null
	motorisations: Array<{ name: string; count: number }> | null
	/** Defect codes already resolved to Czech text by the API — the 246 KB
	 *  catalog stays on the server. */
	topDefectsResolved: Array<{
		code: string
		count: number
		share: number
		text: string
	}> | null
	computedAt: string | null
}

const BASE_URL = 'https://www.vininfo.cz'

// Czech number formatting via Intl (space thousands separator, comma decimal).
const fmtInt = (n: number) => Math.round(n).toLocaleString('cs-CZ')
const fmtKm = (n: number) => `${fmtInt(n)} km`
const fmtPct = (frac: number) =>
	`${(frac * 100).toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} %`
// Defect shares need a decimal. The existing fmtPct rounds to whole numbers,
// which printed 6.3% and 6.1% as "6 %" and "6 %" on consecutive rows — an
// ordered list where two neighbours show the same figure reads as broken.
const fmtShare = (frac: number) =>
	`${(frac * 100).toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
const fmtNum1 = (n: number) =>
	n.toLocaleString('cs-CZ', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	})

const MILESTONE_AGES = [1, 3, 5, 8, 10, 12, 15, 20]
const ageWord = (age: number) => (age >= 5 ? 'let' : age >= 2 ? 'roky' : 'rok')

// A labelled fraction bar list (fuel / colour split), top `limit` by share.
function SplitBars({
	split,
	limit,
	fmtLabel = (s) => s
}: {
	split: Record<string, number>
	limit: number
	fmtLabel?: (s: string) => string
}) {
	// Drop entries that would render as "0 %" (rounds below 1 %) — e.g. Elektro/
	// Ostatní with a rounding-to-zero share — so no meaningless empty bars show.
	const rows = Object.entries(split)
		.filter(([, frac]) => Math.round(frac * 100) >= 1)
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
	return (
		<div className='d-flex flex-column gap-2'>
			{rows.map(([label, frac]) => (
				<div key={label} className='d-flex align-items-center gap-3'>
					<span
						className='text-truncate'
						style={{ flex: '0 0 130px', fontSize: '.9rem' }}
					>
						{fmtLabel(label)}
					</span>
					<div
						className='progress flex-grow-1'
						style={{
							height: 10,
							backgroundColor: 'var(--surface-soft, #f7f8fa)'
						}}
						role='progressbar'
						aria-valuenow={Math.round(frac * 100)}
						aria-valuemin={0}
						aria-valuemax={100}
					>
						<div
							className='progress-bar'
							style={{
								width: `${(frac * 100).toFixed(1)}%`,
								backgroundColor: 'var(--brand-600, #2f7a3e)'
							}}
						/>
					</div>
					<span
						className='text-muted-ink text-end'
						style={{ flex: '0 0 56px', fontSize: '.85rem' }}
					>
						{fmtPct(frac)}
					</span>
				</div>
			))}
		</div>
	)
}

function StatCard({
	value,
	label,
	sub
}: {
	value: string
	label: string
	sub?: string
}) {
	return (
		<div className='col'>
			<div
				className='h-100 rounded-3 p-3'
				style={{ backgroundColor: 'var(--surface-soft, #f7f8fa)' }}
			>
				<div
					className='fw-bold'
					style={{ fontSize: '1.6rem', color: 'var(--ink-900, #0f172a)' }}
				>
					{value}
				</div>
				<div className='text-muted-ink' style={{ fontSize: '.85rem' }}>
					{label}
				</div>
				{sub && (
					<div
						className='text-muted-ink'
						style={{ fontSize: '.75rem', opacity: 0.8 }}
					>
						{sub}
					</div>
				)}
			</div>
		</div>
	)
}

type LoadState = 'loading' | 'ok' | 'notfound' | 'error'

/**
 * Label for one motorisation row.
 *
 * Two reasons not to reuse titleCase() here: it lowercases engine designations
 * ("OCTAVIA 1.9 TDI" becomes "Octavia 1.9 Tdi", which looks like a typo on a
 * page selling data accuracy), and the model name is already the page heading,
 * so repeating it in every row is noise. Strip the model prefix and leave the
 * engine string exactly as the registry has it.
 */
function motorisationLabel(variant: string, model: string): string {
	const v = variant.trim()
	const m = model.trim()
	if (v.toUpperCase() === m.toUpperCase()) return 'bez upřesnění motorizace'
	if (v.toUpperCase().startsWith(`${m.toUpperCase()} `)) {
		return v.slice(m.length).trim()
	}
	return v
}

const BrandModelStatsPage: React.FC = () => {
	const { brand: brandSlug = '', model: modelSlug = '' } = useParams<{
		brand: string
		model: string
	}>()
	const [state, setState] = useState<LoadState>('loading')
	const [stats, setStats] = useState<ModelStats | null>(null)

	// Fetch the precomputed stats for this brand/model slug.
	useEffect(() => {
		let cancelled = false
		setState('loading')
		setStats(null)
		const params = new URLSearchParams({
			type: 'model',
			brand: brandSlug.toLowerCase(),
			model: modelSlug.toLowerCase()
		})
		requestJson<{ stats: ModelStats }>(`/api/stats?${params.toString()}`)
			.then((data) => {
				if (cancelled) return
				setStats(data.stats)
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
	}, [brandSlug, modelSlug])

	const name = useMemo(
		() => (stats ? `${titleCase(stats.brand)} ${titleCase(stats.model)}` : ''),
		[stats]
	)
	const canonical = `${BASE_URL}/znacky/${brandSlug.toLowerCase()}/${modelSlug.toLowerCase()}`

	// SEO meta injection (title, description, OG, canonical, JSON-LD) — same
	// approach as CertificateLandingPage. Google renders the SPA and reads these.
	useEffect(() => {
		const prevTitle = document.title

		const setMeta = (attr: 'name' | 'property', key: string, value: string) => {
			const selector = `meta[${attr}="${key}"]`
			let el = document.head.querySelector<HTMLMetaElement>(selector)
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
		const prevCanonical = canonicalEl?.getAttribute('href') ?? null
		if (!canonicalEl) {
			canonicalEl = document.createElement('link')
			canonicalEl.setAttribute('rel', 'canonical')
			document.head.appendChild(canonicalEl)
		}

		let robotsEl = document.head.querySelector<HTMLMetaElement>(
			'meta[name="robots"]'
		)
		const hadRobots = Boolean(robotsEl)
		const prevRobots = robotsEl?.getAttribute('content') ?? null
		const setRobots = (value: string) => {
			if (!robotsEl) {
				robotsEl = document.createElement('meta')
				robotsEl.setAttribute('name', 'robots')
				document.head.appendChild(robotsEl)
			}
			robotsEl.setAttribute('content', value)
		}

		let ld: HTMLScriptElement | null = null
		// Only true when this effect created the node, so cleanup never removes
		// the server-rendered one and leaves the crawl-time markup poorer.
		let ldOwned = false

		if (state === 'ok' && stats) {
			const descParts = [
				`Statistiky vozu ${name} z registru silničních vozidel`
			]
			if (stats.stkFailPct != null)
				descParts.push(`poruchovost STK ${fmtNum1(stats.stkFailPct)} %`)
			if (stats.medianKmByAge?.['10'])
				descParts.push(
					`obvyklý nájezd v 10 letech ${fmtKm(stats.medianKmByAge['10'])}`
				)
			descParts.push(`${fmtInt(stats.vehicleCount)} vozidel`)
			const description = `${descParts.join(', ')}.`

			document.title = `${name}: statistiky, spolehlivost a nájezd | VIN Info.cz`
			setMeta('name', 'description', description)
			setMeta('property', 'og:title', `${name}: statistiky a spolehlivost`)
			setMeta('property', 'og:description', description)
			setMeta('property', 'og:url', canonical)
			setMeta('property', 'og:type', 'website')
			canonicalEl.setAttribute('href', canonical)
			setRobots('index, follow')

			// api/stats.ts already emitted this at crawl time. Adopt that element
			// instead of appending a second one, or every hydrated page ends up
			// with two Dataset nodes. Only remove it on cleanup if we created it.
			ld = document.head.querySelector<HTMLScriptElement>(
				'script[data-stats-ld="true"]'
			)
			const ldWasServerRendered = ld !== null
			if (!ld) {
				ld = document.createElement('script')
				ld.type = 'application/ld+json'
				ld.dataset.statsLd = 'true'
				document.head.appendChild(ld)
			}
			ldOwned = !ldWasServerRendered
			ld.textContent = JSON.stringify({
				'@context': 'https://schema.org',
				'@type': 'Dataset',
				name: `Statistiky vozu ${name}`,
				description,
				url: canonical,
				creator: { '@type': 'Organization', name: 'VIN Info.cz' },
				// Fills the `license` field Google's Dataset report asks for without
				// granting redistribution rights — terms of use govern reuse.
				license: `${BASE_URL}/podminky`,
				...(stats.computedAt
					? { dateModified: stats.computedAt.slice(0, 10) }
					: {})
			})
		} else if (state === 'notfound') {
			document.title = 'Stránka nenalezena | VIN Info.cz'
			setRobots('noindex')
		}

		return () => {
			document.title = prevTitle
			if (hadCanonical) {
				if (prevCanonical) canonicalEl?.setAttribute('href', prevCanonical)
			} else {
				canonicalEl?.remove()
			}
			if (hadRobots) {
				if (prevRobots) robotsEl?.setAttribute('content', prevRobots)
			} else {
				robotsEl?.remove()
			}
			if (ldOwned) ld?.remove()
		}
	}, [state, stats, name, canonical])

	const mileageRows = useMemo(() => {
		if (!stats?.medianKmByAge) return []
		return Object.entries(stats.medianKmByAge)
			.map(([age, km]) => [Number(age), km] as const)
			.filter(([age]) => MILESTONE_AGES.includes(age))
			.sort((a, b) => a[0] - b[0])
	}, [stats])

	const years =
		stats?.firstYear && stats?.lastYear
			? `${stats.firstYear}–${stats.lastYear}`
			: ''

	const eqBits: string[] = []
	if (stats?.pctLpg != null && stats.pctLpg > 0)
		eqBits.push(`pohon na plyn (LPG/CNG) u ${fmtPct(stats.pctLpg)} vozů`)
	if (stats?.pctTowbar != null && stats.pctTowbar > 0)
		eqBits.push(`tažné zařízení u ${fmtPct(stats.pctTowbar)} vozů`)

	return (
		<>
			<Navigation />
			<main className='container mt-5 pb-5' style={{ maxWidth: 860 }}>
				{state === 'loading' && (
					<div className='text-center py-5 text-muted-ink'>
						Načítám statistiky…
					</div>
				)}

				{(state === 'notfound' || state === 'error') && (
					<div className='text-center py-5'>
						<h1 className='mb-3'>Stránka nenalezena</h1>
						<p className='text-muted-ink'>
							{state === 'error'
								? 'Statistiky se nepodařilo načíst. Zkuste to prosím později.'
								: 'Pro tuto značku a model zatím statistiky nemáme.'}
						</p>
						<Link to='/' className='btn-brand d-inline-block mt-2'>
							Přejít na hlavní stránku →
						</Link>
					</div>
				)}

				{state === 'ok' && stats && (
					<>
						{/* Links back up the hierarchy. Every model page used to have a
						    single inbound link and none outbound, which is part of why
						    the section is crawled so thinly. */}
						<nav aria-label='breadcrumb' className='small text-muted-ink mb-3'>
							<Link to='/znacky'>Značky</Link>
							{' · '}
							<Link to={`/znacky/${brandSlug.toLowerCase()}`}>
								{titleCase(stats.brand)}
							</Link>
						</nav>
						<h1 className='mb-2'>{name}: statistiky a spolehlivost</h1>
						<p className='text-muted-ink' style={{ fontSize: '1.05rem' }}>
							Souhrn z veřejného registru silničních vozidel ČR za{' '}
							{fmtInt(stats.vehicleCount)} provozovaných vozů {name}
							{years ? ` (první registrace ${years})` : ''}. Jde o statistiku
							celé skupiny vozidel, ne o konkrétní vůz.
						</p>

						<div className='row row-cols-2 row-cols-md-4 g-3 my-3'>
							<StatCard
								value={fmtInt(stats.vehicleCount)}
								label='vozidel v provozu'
								sub={years || undefined}
							/>
							{stats.avgAgeYears != null && (
								<StatCard
									value={`${fmtNum1(stats.avgAgeYears)} let`}
									label='průměrné stáří'
								/>
							)}
							{stats.avgOwners != null && (
								<StatCard
									value={fmtNum1(stats.avgOwners)}
									label='průměrně majitelů'
								/>
							)}
							{stats.pctImported != null && (
								<StatCard
									value={fmtPct(stats.pctImported)}
									label='dovezených'
								/>
							)}
						</div>

						{stats.stkFailPct != null && stats.stkInspections != null && (
							<section className='border-top pt-3 mt-4'>
								<h2 className='h5'>Poruchovost při STK</h2>
								<p style={{ fontSize: '1.1rem' }}>
									<strong>{fmtNum1(stats.stkFailPct)} %</strong> technických
									prohlídek skončilo se závadou (stupeň B/C).
								</p>
								<p className='text-muted-ink' style={{ fontSize: '.85rem' }}>
									Vypočteno z {fmtInt(stats.stkInspections)} skutečných
									prohlídek vozů {name} v ČR.
								</p>
							</section>
						)}

						{mileageRows.length > 0 && (
							<section className='border-top pt-3 mt-4'>
								<h2 className='h5'>Obvyklý nájezd podle stáří</h2>
								<div className='table-responsive'>
									<table
										className='table table-sm align-middle'
										style={{ maxWidth: 440 }}
									>
										<thead>
											<tr className='text-muted-ink'>
												<th>Stáří vozidla</th>
												<th>Obvyklý nájezd (medián)</th>
											</tr>
										</thead>
										<tbody>
											{mileageRows.map(([age, km]) => (
												<tr key={age}>
													<td>
														{age} {ageWord(age)}
													</td>
													<td>{fmtKm(km)}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
								<p className='text-muted-ink' style={{ fontSize: '.85rem' }}>
									Medián stavu tachometru z technických a emisních prohlídek
									(STK/ME).
								</p>
							</section>
						)}

						{stats.fuelSplit && (
							<section className='border-top pt-3 mt-4'>
								<h2 className='h5 mb-3'>Palivo</h2>
								<SplitBars split={stats.fuelSplit} limit={6} />
							</section>
						)}

						{eqBits.length > 0 && (
							<section className='border-top pt-3 mt-4'>
								<h2 className='h5'>Výbava a úpravy</h2>
								<p>Registr eviduje {eqBits.join(' a ')}.</p>
							</section>
						)}

						{/* The question forums answer with anecdotes, answered from 138.8M
						    real inspection defects. Shares are out of inspections that
						    recorded a defect, which is what the caption says. */}
						{stats.topDefectsResolved &&
							stats.topDefectsResolved.length > 0 && (
								<section className='border-top pt-3 mt-4'>
									<h2 className='h5 mb-3'>Nejčastější závady na STK</h2>
									<ul className='list-unstyled mb-2'>
										{stats.topDefectsResolved.slice(0, 8).map((d) => (
											<li key={d.code} className='border-bottom py-1'>
												<div className='d-flex justify-content-between gap-3'>
													<span>{d.text}</span>
													<span className='text-muted-ink small text-nowrap'>
														{fmtShare(d.share)}
													</span>
												</div>
											</li>
										))}
									</ul>
									<p className='small text-muted-ink mb-0'>
										Podíl z prohlídek, u kterých je závada evidovaná. Údaje z
										otevřených dat o technických prohlídkách.
									</p>
								</section>
							)}

						{/* Motorisations live here rather than at their own URL level:
						    2 180 of the section's urls are already discovered and never
						    crawled, so another thousand thin pages is the last thing it
						    needs. Null when the model has only one, so there is no
						    single-row table. */}
						{stats.motorisations && stats.motorisations.length > 1 && (
							<section className='border-top pt-3 mt-4'>
								<h2 className='h5 mb-3'>Motorizace a verze</h2>
								<ul className='list-unstyled mb-2'>
									{stats.motorisations.slice(0, 12).map((m) => (
										<li
											key={m.name}
											className='d-flex justify-content-between border-bottom py-1'
										>
											<span>{motorisationLabel(m.name, stats.model)}</span>
											<span className='text-muted-ink small'>
												{fmtInt(m.count)} vozidel
											</span>
										</li>
									))}
								</ul>
								<p className='small text-muted-ink mb-0'>
									Označení tak, jak je vedou v registru silničních vozidel —
									zápis se u stejného vozu může lišit.
								</p>
							</section>
						)}

						{stats.colorSplit && (
							<section className='border-top pt-3 mt-4'>
								<h2 className='h5 mb-3'>Nejčastější barvy</h2>
								<SplitBars
									split={stats.colorSplit}
									limit={6}
									fmtLabel={niceLabel}
								/>
							</section>
						)}

						<Link to='/' className='btn-brand d-inline-block mt-4'>
							Prověřit konkrétní vozidlo podle VIN →
						</Link>

						<p
							className='text-muted-ink mt-4'
							style={{ fontSize: '.8rem', opacity: 0.85 }}
						>
							{stats.computedAt
								? `Data z veřejného registru silničních vozidel ČR, aktualizováno ${stats.computedAt.slice(0, 10)}.`
								: 'Data z veřejného registru silničních vozidel ČR.'}{' '}
							Údaje jsou orientační a mají statistický charakter.
						</p>
					</>
				)}
			</main>
			<Footer />
		</>
	)
}

export default BrandModelStatsPage
