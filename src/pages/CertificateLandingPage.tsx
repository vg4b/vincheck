import React, { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import ProductComparison from '../components/ProductComparison'
import { cebia } from '../config/affiliateCampaigns'
import { isCertificateEnabled } from '../config/featureFlags'

// Keep in sync with CERTIFICATE_PRICE_CZK (VehicleInfo.tsx / backend / Lemon Squeezy).
const PRICE_CZK = 99

const PAGE_TITLE = `Certifikát historie vozidla z registru ČR za ${PRICE_CZK} Kč | VIN Info.cz`
const PAGE_DESCRIPTION = `Přehledný certifikát historie vozidla zpracovaný z dat registru silničních vozidel ČR — vlastníci, STK, dovoz a stav vozidla. Ihned, v ověřitelném PDF, za ${PRICE_CZK} Kč.`
const CANONICAL_URL = 'https://vininfo.cz/overeny-vypis-vozidla'

const CertificateLandingPage: React.FC = () => {
	const navigate = useNavigate()
	const [vin, setVin] = useState('')
	const enabled = isCertificateEnabled()

	useEffect(() => {
		// Skip SEO/meta injection while the product is hidden — the page redirects.
		if (!enabled) {
			return
		}
		const prevTitle = document.title
		document.title = PAGE_TITLE

		const setMeta = (selector: string, attr: string, value: string) => {
			let el = document.head.querySelector<HTMLMetaElement>(selector)
			if (!el) {
				el = document.createElement('meta')
				const [, name] = attr.split('=')
				el.setAttribute(attr.startsWith('property') ? 'property' : 'name', name)
				document.head.appendChild(el)
			}
			el.setAttribute('content', value)
		}
		setMeta('meta[name="description"]', 'name=description', PAGE_DESCRIPTION)
		setMeta('meta[property="og:title"]', 'property=og:title', PAGE_TITLE)
		setMeta(
			'meta[property="og:description"]',
			'property=og:description',
			PAGE_DESCRIPTION
		)

		let canonical = document.head.querySelector<HTMLLinkElement>(
			'link[rel="canonical"]'
		)
		const hadCanonical = Boolean(canonical)
		if (!canonical) {
			canonical = document.createElement('link')
			canonical.setAttribute('rel', 'canonical')
			document.head.appendChild(canonical)
		}
		const prevCanonical = canonical.getAttribute('href')
		canonical.setAttribute('href', CANONICAL_URL)

		// JSON-LD structured data for rich results (priced product page).
		const ld = document.createElement('script')
		ld.type = 'application/ld+json'
		ld.dataset.certificateLd = 'true'
		ld.textContent = JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'Product',
			name: 'Certifikát historie vozidla',
			description: PAGE_DESCRIPTION,
			brand: { '@type': 'Brand', name: 'VINInfo.cz' },
			offers: {
				'@type': 'Offer',
				price: String(PRICE_CZK),
				priceCurrency: 'CZK',
				availability: 'https://schema.org/InStock',
				url: CANONICAL_URL
			}
		})
		document.head.appendChild(ld)

		return () => {
			document.title = prevTitle
			if (hadCanonical && prevCanonical) {
				canonical?.setAttribute('href', prevCanonical)
			}
			ld.remove()
		}
	}, [enabled])

	// Product not launched yet — keep the route from being publicly reachable.
	if (!enabled) {
		return <Navigate to='/' replace />
	}

	const cleanVin = vin.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
	const canSubmit = cleanVin.length === 17

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (canSubmit) navigate(`/vin/${cleanVin}`)
	}

	return (
		<>
			<Navigation />
			<main>
				{/* Hero */}
				<section className='py-5' style={{ backgroundColor: 'var(--brand-50)' }}>
					<div className='container' style={{ maxWidth: 760 }}>
						<h1 className='h2 mb-3'>
							Přehled historie vozidla z registru ČR za {PRICE_CZK} Kč
						</h1>
						<p className='lead mb-4'>
							Data z registru silničních vozidel ČR jsou špatně čitelná — my je
							za vás zpracujeme do srozumitelného přehledu: vlastníci, STK, dovoz
							a stav vozidla. Ihned, v ověřitelném PDF — podklad pro koupi i
							prodej vozidla.
						</p>
						<form onSubmit={handleSubmit}>
							<label htmlFor='landing-vin' className='form-label fw-semibold'>
								Zadejte VIN vozidla
							</label>
							<div className='d-flex flex-wrap gap-2'>
								<input
									id='landing-vin'
									type='text'
									className='form-control form-control-lg'
									style={{ maxWidth: 360 }}
									value={vin}
									onChange={(ev) => setVin(ev.target.value)}
									placeholder='např. TMBJJ7NE5J0123456'
									maxLength={20}
									autoComplete='off'
								/>
								<button
									type='submit'
									className='btn btn-primary btn-lg'
									disabled={!canSubmit}
								>
									Zobrazit vozidlo ➜
								</button>
							</div>
							<div className='form-text'>
								VIN má 17 znaků. Nejdřív uvidíte náhled zdarma, certifikát
								koupíte na detailu vozidla.
							</div>
							<div className='mt-2'>
								<a
									href='/api/certificate/sample'
									target='_blank'
									rel='noopener noreferrer'
								>
									Prohlédnout ukázku certifikátu (PDF) ↗
								</a>
							</div>
						</form>
					</div>
				</section>

				{/* Which product when — same comparison as the vehicle detail page. */}
				<section className='py-5'>
					<div className='container' style={{ maxWidth: 760 }}>
						<h2 className='h4 mb-4'>Který produkt si vybrat</h2>
						<ProductComparison
							priceCzk={PRICE_CZK}
							certificateCta={
								<a href='#landing-vin' className='btn btn-primary mt-auto'>
									Zadat VIN a získat certifikát ➜
								</a>
							}
							cebiaCta={
								<a
									href={cebia.getTextLinkUrl('certificate_landing')}
									target='_blank'
									rel='noopener noreferrer'
									className='btn btn-outline-primary mt-auto'
								>
									Prověřit u našeho partnera ➜
								</a>
							}
						/>
					</div>
				</section>

				{/* How it works */}
				<section className='py-5' style={{ backgroundColor: 'var(--surface)' }}>
					<div className='container' style={{ maxWidth: 760 }}>
						<h2 className='h4 mb-4'>Jak to funguje</h2>
						<ol className='mb-0' style={{ lineHeight: 2 }}>
							<li>Zadáte VIN a zobrazíte si vozidlo (náhled je zdarma).</li>
							<li>
								Na detailu vozidla koupíte certifikát za {PRICE_CZK} Kč (vč. DPH).
							</li>
							<li>
								Certifikát v PDF dostanete e-mailem a ke stažení — s QR kódem pro
								ověření pravosti.
							</li>
						</ol>
					</div>
				</section>

				{/* Bottom CTA */}
				<section
					className='py-5 text-center'
					style={{ backgroundColor: 'var(--brand-50)' }}
				>
					<div className='container' style={{ maxWidth: 760 }}>
						<h2 className='h4 mb-3'>Prověřte historii vozidla hned teď</h2>
						<a href='#landing-vin' className='btn btn-primary btn-lg'>
							Zadat VIN
						</a>
					</div>
				</section>
			</main>
			<Footer />
		</>
	)
}

export default CertificateLandingPage
