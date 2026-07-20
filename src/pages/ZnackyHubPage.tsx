import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import { ApiError, requestJson } from '../utils/apiClient'
import { titleCase } from '../utils/carLabels'

interface IndexModel {
	brand: string
	model: string
	brandSlug: string
	modelSlug: string
	vehicleCount: number
}

const BASE_URL = 'https://www.vininfo.cz'
const CANONICAL = `${BASE_URL}/znacky`
const PAGE_TITLE = 'Statistiky vozidel podle značky a modelu | VIN Info.cz'
const PAGE_DESCRIPTION =
	'Přehled statistik vozidel podle značky a modelu z registru silničních vozidel ČR: spolehlivost při STK, obvyklý nájezd, palivo a stáří. Vyberte značku a model.'

type LoadState = 'loading' | 'ok' | 'error'

const ZnackyHubPage: React.FC = () => {
	const [state, setState] = useState<LoadState>('loading')
	const [models, setModels] = useState<IndexModel[]>([])

	useEffect(() => {
		let cancelled = false
		requestJson<{ models: IndexModel[] }>('/api/stats?type=index')
			.then((data) => {
				if (cancelled) return
				setModels(data.models)
				setState('ok')
			})
			.catch((err: unknown) => {
				if (cancelled) return
				setState(err instanceof ApiError ? 'error' : 'error')
			})
		return () => {
			cancelled = true
		}
	}, [])

	// SEO meta — same approach as the other content pages.
	useEffect(() => {
		const prevTitle = document.title
		document.title = PAGE_TITLE

		const setMeta = (attr: 'name' | 'property', key: string, value: string) => {
			let el = document.head.querySelector<HTMLMetaElement>(
				`meta[${attr}="${key}"]`
			)
			if (!el) {
				el = document.createElement('meta')
				el.setAttribute(attr, key)
				document.head.appendChild(el)
			}
			el.setAttribute('content', value)
		}
		setMeta('name', 'description', PAGE_DESCRIPTION)
		setMeta('property', 'og:title', 'Statistiky vozidel podle značky')
		setMeta('property', 'og:description', PAGE_DESCRIPTION)
		setMeta('property', 'og:url', CANONICAL)

		let canonical = document.head.querySelector<HTMLLinkElement>(
			'link[rel="canonical"]'
		)
		const hadCanonical = Boolean(canonical)
		const prevCanonical = canonical?.getAttribute('href') ?? null
		if (!canonical) {
			canonical = document.createElement('link')
			canonical.setAttribute('rel', 'canonical')
			document.head.appendChild(canonical)
		}
		canonical.setAttribute('href', CANONICAL)

		return () => {
			document.title = prevTitle
			if (hadCanonical) {
				if (prevCanonical) canonical?.setAttribute('href', prevCanonical)
			} else {
				canonical?.remove()
			}
		}
	}, [])

	// Group models by brand, preserving the API's brand-then-size ordering.
	const byBrand = useMemo(() => {
		const map = new Map<string, IndexModel[]>()
		for (const m of models) {
			const list = map.get(m.brand)
			if (list) list.push(m)
			else map.set(m.brand, [m])
		}
		return Array.from(map.entries()).sort((a, b) =>
			titleCase(a[0]).localeCompare(titleCase(b[0]), 'cs')
		)
	}, [models])

	return (
		<>
			<Navigation />
			<main className='container mt-5 pb-5'>
				<h1 className='mb-2'>Statistiky vozidel podle značky a modelu</h1>
				<p className='text-muted-ink' style={{ fontSize: '1.05rem' }}>
					Vyberte značku a model a zobrazte souhrn z registru silničních vozidel
					ČR: spolehlivost při STK, obvyklý nájezd, palivo, stáří a další.
				</p>

				{state === 'loading' && (
					<div className='py-5 text-muted-ink'>Načítám značky…</div>
				)}

				{state === 'error' && (
					<div className='py-5 text-muted-ink'>
						Seznam se nepodařilo načíst. Zkuste to prosím později.
					</div>
				)}

				{state === 'ok' && (
					<>
						{/* CSS multi-column (masonry) so brands pack tightly regardless of
						    how many models each has — no fixed-height grid gaps. Each brand
						    block stays intact across the column break. */}
						<style>{`
							.znacky-cols{column-gap:2rem}
							@media (min-width:768px){.znacky-cols{column-count:2}}
							@media (min-width:992px){.znacky-cols{column-count:3}}
							.znacky-brand{break-inside:avoid;-webkit-column-break-inside:avoid;display:inline-block;width:100%;margin-bottom:1.5rem}
						`}</style>
						<div className='znacky-cols mt-2'>
							{byBrand.map(([brand, list]) => (
								<div key={brand} className='znacky-brand'>
									<h2 className='h6 fw-bold mb-2'>
										<span className='heading-accent'>{titleCase(brand)}</span>
									</h2>
									<ul className='list-unstyled mb-0'>
										{list.map((m) => (
											<li key={m.modelSlug} className='mb-1'>
												<Link
													to={`/znacky/${m.brandSlug}/${m.modelSlug}`}
													className='text-decoration-none small'
												>
													{titleCase(m.model)}
												</Link>
											</li>
										))}
									</ul>
								</div>
							))}
						</div>
					</>
				)}
			</main>
			<Footer />
		</>
	)
}

export default ZnackyHubPage
