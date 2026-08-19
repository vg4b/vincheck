import React, { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import Icon from '../components/Icon'
import Navigation from '../components/Navigation'
import ProductComparison from '../components/ProductComparison'
import { cebia } from '../config/affiliateCampaigns'
import { isCertificateEnabled } from '../config/featureFlags'

// Keep in sync with CERTIFICATE_PRICE_CZK (VehicleInfo.tsx / backend / Lemon Squeezy).
const PRICE_CZK = 99

const PAGE_TITLE = `Certifikát historie vozidla z registru ČR za ${PRICE_CZK} Kč | VIN Info.cz`
const PAGE_DESCRIPTION = `Přehledný certifikát historie vozidla zpracovaný z dat registru silničních vozidel ČR a STK — vlastníci, leasing a financování, STK, stav tachometru, dovoz a stav vozidla. Ihned, v ověřitelném PDF, za ${PRICE_CZK} Kč.`
const CANONICAL_URL = 'https://www.vininfo.cz/overeny-vypis-vozidla'

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
			// Required by Google for product/merchant rich results. A clean preview
			// of page 1 of the sample certificate (regenerate via
			// `pnpm tsx scripts/render-sample-cert.ts out.pdf --no-watermark` +
			// qlmanage). Absolute URL on the canonical host so it's crawlable.
			image: 'https://www.vininfo.cz/certificate-preview.png',
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
				<section
					className='py-5'
					style={{ backgroundColor: 'var(--brand-50)' }}
				>
					<div className='container' style={{ maxWidth: 760 }}>
						<h1 className='h2 mb-3'>
							Přehled historie vozidla z registru ČR za {PRICE_CZK} Kč
						</h1>
						<p className='lead mb-4'>
							Data z registru silničních vozidel ČR a STK jsou špatně čitelná —
							my je za vás zpracujeme do srozumitelného přehledu: vlastníci,
							leasing a financování, STK, stav tachometru, dovoz a stav vozidla.
							Ihned, v ověřitelném PDF — podklad pro koupi i prodej vozidla.
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

				{/* What the document contains. Split into "always" and "when the data
				    allows" on purpose: promising a mileage prediction we cannot always
				    produce would be a refund request waiting to happen. */}
				<section className='py-5'>
					<div className='container' style={{ maxWidth: 760 }}>
						<h2 className='h4 mb-4'>Co certifikát obsahuje</h2>
						<div className='row g-4'>
							<div className='col-md-6'>
								<h3 className='h6 text-uppercase text-muted-ink mb-3'>Vždy</h3>
								<ul className='product-features'>
									<li>
										<Icon name='check' size={15} /> Identifikace vozidla — VIN,
										značka, model, první registrace, stav a účel vozidla
									</li>
									<li>
										<Icon name='check' size={15} /> Vlastníci a provozovatelé —
										počty a časová osa držby
									</li>
									<li>
										<Icon name='check' size={15} /> Leasing a financování v
										historii vlastníků — včetně jasné odpovědi, když nic
										nenajdeme
									</li>
									<li>
										<Icon name='check' size={15} /> Historie STK — každá
										prohlídka, výsledek, druh a stanice
									</li>
									<li>
										<Icon name='check' size={15} /> Konkrétní závady z protokolů
										STK — oficiální znění podle vyhlášky, včetně závažnosti
									</li>
									<li>
										<Icon name='check' size={15} /> Historie stavu tachometru —
										všechny odečty ze STK s čísly protokolů
									</li>
									<li>
										<Icon name='check' size={15} /> Původ vozidla — zda šlo o
										dovoz, nebo první registraci v ČR
									</li>
									<li>
										<Icon name='check' size={15} /> Technické údaje — motor,
										rozměry, hmotnosti, kola a výbava
									</li>
								</ul>
							</div>
							<div className='col-md-6'>
								<h3 className='h6 text-uppercase text-muted-ink mb-3'>
									Když to data umožňují
								</h3>
								<ul className='product-features'>
									<li>
										<Icon name='chart' size={15} /> Odhad současného nájezdu —
										dopočítaný z tempa mezi prohlídkami. Potřebuje aspoň dva
										odečty a nezobrazuje se tam, kde je podezření na stočení.
									</li>
									<li>
										<Icon name='info' size={15} /> Upozornění na nesrovnalost v
										tachometru — když pozdější odečet je nižší než dřívější
									</li>
									<li>
										<Icon name='info' size={15} /> Detail dovozu — země a datum,
										pokud vozidlo přišlo ze zahraničí
									</li>
									<li>
										<Icon name='info' size={15} /> Závady u starších prohlídek —
										u prohlídek před rokem 2009 je registr neeviduje
									</li>
								</ul>
								<p className='small text-muted-ink mt-3 mb-0'>
									Co v datech není, v certifikátu nepředstíráme — místo mlčení
									uvidíte, že údaj chybí.
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* Why us, not just "why a certificate" — these are the things a buyer
				    cannot get from the free preview or from a competitor. */}
				<section className='py-5' style={{ backgroundColor: 'var(--surface)' }}>
					<div className='container' style={{ maxWidth: 760 }}>
						<h2 className='h4 mb-4'>Čím se náš certifikát liší</h2>
						<div className='row g-4'>
							<div className='col-md-6'>
								<h3 className='h6 mb-2'>
									<Icon name='car' size={16} /> Leasing a financování
								</h3>
								<p className='small mb-0'>
									Porovnáváme historii vlastníků se seznamem leasingových a
									úvěrových společností a autopůjčoven. Zjistíte, že vůz jezdil
									na leasing nebo v půjčovně — což z inzerátu nepoznáte.
								</p>
							</div>
							<div className='col-md-6'>
								<h3 className='h6 mb-2'>
									<Icon name='shield' size={16} /> Ověřitelnost
								</h3>
								<p className='small mb-0'>
									Každý certifikát má QR kód a veřejnou ověřovací stránku.
									Kupující si tak sám potvrdí, že dokument je pravý a že jste
									údaje neupravili.
								</p>
							</div>
							<div className='col-md-6'>
								<h3 className='h6 mb-2'>
									<Icon name='search' size={16} /> Závady z protokolů STK
								</h3>
								<p className='small mb-0'>
									Nejen „prospěl / neprospěl“, ale i na čem vozidlo propadlo —
									oficiální znění závady a její závažnost. Je rozdíl mezi
									povrchovou korozí a nefunkční brzdou.
								</p>
							</div>
							<div className='col-md-6'>
								<h3 className='h6 mb-2'>
									<Icon name='lock' size={16} /> Oficiální data, žádné odhady
								</h3>
								<p className='small mb-0'>
									Vše pochází z registru silničních vozidel ČR a z otevřených
									dat o technických prohlídkách. U každého údaje víte, odkud je.
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* Which product when — same comparison as the vehicle detail page. */}
				<section className='py-5' id='porovnani'>
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
								Na detailu vozidla koupíte certifikát za {PRICE_CZK} Kč (konečná
								cena).
							</li>
							<li>
								Certifikát v PDF dostanete e-mailem a ke stažení — s QR kódem
								pro ověření pravosti.
							</li>
						</ol>
					</div>
				</section>

				{/* Reasons to buy, framed around the two real audiences — a buyer
				    deciding, and a seller proving. */}
				<section className='py-5'>
					<div className='container' style={{ maxWidth: 760 }}>
						<h2 className='h4 mb-4'>Kdy se certifikát vyplatí</h2>
						<div className='row g-4'>
							<div className='col-md-6'>
								<h3 className='h6 mb-2'>Kupujete ojeté auto</h3>
								<ul className='product-features'>
									<li>
										<Icon name='check' size={15} /> Ověříte si, co prodávající
										tvrdí — počet majitelů, nájezd i výsledky STK
									</li>
									<li>
										<Icon name='check' size={15} /> Uvidíte, jestli nájezd v
										čase sedí, nebo někde klesl
									</li>
									<li>
										<Icon name='check' size={15} /> Opakované závady na stejné
										části jsou vyjednávací argument o ceně
									</li>
									<li>
										<Icon name='check' size={15} /> Za {PRICE_CZK} Kč zjistíte
										to, co může stát desítky tisíc na opravách
									</li>
								</ul>
							</div>
							<div className='col-md-6'>
								<h3 className='h6 mb-2'>Prodáváte vozidlo</h3>
								<ul className='product-features'>
									<li>
										<Icon name='check' size={15} /> Doložíte historii sami, dřív
										než se zeptá kupující
									</li>
									<li>
										<Icon name='check' size={15} /> Ověřitelné PDF s QR kódem
										působí věrohodněji než ústní ujištění
									</li>
									<li>
										<Icon name='check' size={15} /> Poctivě servisovaný vůz se
										snáz odliší od těch ostatních
									</li>
									<li>
										<Icon name='check' size={15} /> Certifikát přiložíte k
										inzerátu i k předávacímu protokolu
									</li>
								</ul>
							</div>
						</div>
						<p className='small text-muted-ink mt-4 mb-0'>
							Certifikát pracuje s tím, co o vozidle vedou české úřady.
							Nenajdete v něm záznamy o nehodách ani zástavy — na to{' '}
							<a href='#porovnani'>v porovnání výše</a> doporučujeme partnerskou
							prověrku.
						</p>
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
