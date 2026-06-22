import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import ProductComparison from '../components/ProductComparison'
import { cebia } from '../config/affiliateCampaigns'

// Keep in sync with CERTIFICATE_PRICE_CZK (VehicleInfo.tsx / backend / Creem).
const PRICE_CZK = 99

const CertificateLandingPage: React.FC = () => {
	const navigate = useNavigate()
	const [vin, setVin] = useState('')

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
							a stav vozidla. Ihned, v ověřitelném PDF, které dáte kupujícímu
							jako podklad.
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
									Prověřit na Cebia ➜
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
