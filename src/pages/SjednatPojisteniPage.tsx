import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import { direct } from '../config/affiliateCampaigns'

type PojisteniTyp = 'povinne' | 'havarijni' | 'oboje'
type VozidloTyp = 'vin' | 'spz'

const STEPS = [
	{ id: 1, title: 'Typ pojištění' },
	{ id: 2, title: 'Vozidlo' },
	{ id: 3, title: 'Shrnutí' },
] as const

const SjednatPojisteniPage: React.FC = () => {
	const [searchParams] = useSearchParams()
	const vinFromUrl = searchParams.get('vin')?.replace(/[^a-zA-Z0-9]/g, '').trim() ?? ''
	const spzFromUrl = searchParams.get('spz')?.replace(/[^a-zA-Z0-9]/g, '').trim().toUpperCase() ?? ''
	const initialVozidloTyp: VozidloTyp | null = vinFromUrl ? 'vin' : spzFromUrl ? 'spz' : null
	const [step, setStep] = useState(1)
	const [typ, setTyp] = useState<PojisteniTyp | null>(null)
	const [vozidloTyp, setVozidloTyp] = useState<VozidloTyp | null>(initialVozidloTyp)
	const [vinOrSpz, setVinOrSpz] = useState(vinFromUrl || spzFromUrl)
	const [isRedirecting, setIsRedirecting] = useState(false)

	useEffect(() => {
		document.title = 'Sjednat pojištění | VIN Info.cz'
		const meta = document.querySelector('meta[name="description"]')
		if (meta) {
			meta.setAttribute(
				'content',
				'Sjednejte si povinné ručení nebo havarijní pojištění. Porovnejte nabídky a najděte výhodné pojištění pro vaše vozidlo.'
			)
		}
	}, [])

	const cleanVinOrSpz = vinOrSpz.replace(/[^a-zA-Z0-9]/g, '').trim()
	const isValidVin = vozidloTyp === 'vin' && cleanVinOrSpz.length === 17
	const isValidSpz = vozidloTyp === 'spz' && cleanVinOrSpz.length >= 5 && cleanVinOrSpz.length <= 8
	const hasVinOrSpz = isValidVin || isValidSpz

	const getDirectUrl = (): string => {
		const code = hasVinOrSpz ? cleanVinOrSpz : undefined
		switch (typ) {
			case 'povinne':
				return direct.getDirectUrl(code)
			case 'havarijni':
				return direct.getHavarijniUrlWithVin(code)
			case 'oboje':
				return direct.getAutoUrl(code)
			default:
				return direct.getTextLinkUrl()
		}
	}

	const handleContinue = () => {
		if (step < 3) {
			setStep(step + 1)
		} else {
			setIsRedirecting(true)
			window.location.href = getDirectUrl()
		}
	}

	const handleBack = () => {
		if (step > 1) setStep(step - 1)
	}

	const canContinue = (): boolean => {
		if (step === 1) return typ !== null
		if (step === 2) return true
		return true
	}

	const benefits = [
		{
			icon: '💰',
			title: 'Nízká cena',
			desc: 'Výhodné pojistné při online sjednání',
		},
		{
			icon: '📋',
			title: 'Online bez volání',
			desc: 'Sjednání i správa pojištění zdarma, bez telefonátů',
		},
		{
			icon: '🛡️',
			title: 'Vysoké plnění',
			desc: 'Spolehlivé krytí při pojistné události',
		},
	]

	return (
		<>
			<Navigation />
			<div className="container mt-5 mb-5">
				<h1 className="mb-4">Sjednat pojištění</h1>
				<p className="text-muted mb-4">
					Vyberte typ pojištění a přejděte k online sjednání.
				</p>

				<div className="row g-4">
					{/* Průvodce – hlavní box */}
					<div className="col-lg-7">
						{/* Progress */}
						<div className="d-flex justify-content-between mb-4">
					{STEPS.map((s) => (
						<div
							key={s.id}
							className={`flex-grow-1 text-center py-2 px-1 ${
								s.id <= step ? 'text-primary fw-bold' : 'text-muted'
							}`}
							style={{
								borderBottom: s.id <= step ? '3px solid var(--bs-primary)' : '3px solid #dee2e6',
							}}
						>
							{s.id}. {s.title}
						</div>
					))}
				</div>

				<div className="card shadow-sm">
					<div className="card-body p-4">
						{/* Krok 1: Typ pojištění */}
						{step === 1 && (
							<>
								<h5 className="mb-3">Co chcete sjednat?</h5>
								<div className="d-grid gap-2">
									<button
										type="button"
										className={`btn btn-lg ${typ === 'povinne' ? 'btn-primary' : 'btn-outline-primary'}`}
										onClick={() => setTyp('povinne')}
									>
										Povinné ručení
									</button>
									<button
										type="button"
										className={`btn btn-lg ${typ === 'havarijni' ? 'btn-primary' : 'btn-outline-primary'}`}
										onClick={() => setTyp('havarijni')}
									>
										Havarijní pojištění
									</button>
									<button
										type="button"
										className={`btn btn-lg ${typ === 'oboje' ? 'btn-primary' : 'btn-outline-primary'}`}
										onClick={() => setTyp('oboje')}
									>
										Oboje (povinné + havarijní)
									</button>
								</div>
							</>
						)}

						{/* Krok 2: Vozidlo (nepovinný) */}
						{step === 2 && (
							<>
								<h5 className="mb-3">Máte VIN nebo SPZ vozidla?</h5>
								{vozidloTyp === null ? (
									<div className="d-grid gap-2">
										<button
											type="button"
											className="btn btn-lg btn-outline-primary"
											onClick={() => setVozidloTyp('vin')}
										>
											VIN
										</button>
										<button
											type="button"
											className="btn btn-lg btn-outline-primary"
											onClick={() => setVozidloTyp('spz')}
										>
											SPZ
										</button>
									</div>
								) : (
									<>
										<input
											type="text"
											className="form-control form-control-lg"
											placeholder={vozidloTyp === 'vin' ? '17 znaků' : 'Např. 1AB2345'}
											value={vinOrSpz}
											onChange={(e) =>
												setVinOrSpz(
													vozidloTyp === 'spz'
														? e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
														: e.target.value.replace(/[^a-zA-Z0-9]/g, '')
												)
											}
											maxLength={vozidloTyp === 'vin' ? 17 : 8}
											autoFocus
										/>
										<button
											type="button"
											className="btn btn-link btn-sm mt-2 p-0 text-muted"
											onClick={() => {
												setVozidloTyp(null)
												setVinOrSpz('')
											}}
										>
											Změnit na {vozidloTyp === 'vin' ? 'SPZ' : 'VIN'}
										</button>
									</>
								)}
								<p className="text-muted small mt-3 mb-0">
									Nepovinné – můžete pokračovat bez vyplnění.
								</p>
							</>
						)}

						{/* Krok 3: Shrnutí */}
						{step === 3 && (
							<>
								<h5 className="mb-3">Shrnutí</h5>
								<dl className="row mb-0">
									<dt className="col-sm-4">Typ pojištění</dt>
									<dd className="col-sm-8">
										{typ === 'povinne' && 'Povinné ručení'}
										{typ === 'havarijni' && 'Havarijní pojištění'}
										{typ === 'oboje' && 'Povinné ručení + havarijní'}
									</dd>
									<dt className="col-sm-4">Vozidlo</dt>
									<dd className="col-sm-8">
										{hasVinOrSpz ? `${vozidloTyp === 'vin' ? 'VIN: ' : 'SPZ: '}${cleanVinOrSpz}` : 'Bez předvyplnění'}
									</dd>
								</dl>
								<div className="alert alert-success mt-3 mb-0">
									<strong>Připraveno.</strong> Kliknutím přejdete na srovnání nabídek, kde dokončíte sjednání.
								</div>
							</>
						)}

						{/* Navigace */}
						<div className="d-flex justify-content-between mt-4 pt-3 border-top">
							<button
								type="button"
								className="btn btn-outline-secondary"
								onClick={handleBack}
								disabled={step === 1}
							>
								Zpět
							</button>
							<button
								type="button"
								className="btn btn-primary px-4"
								onClick={handleContinue}
								disabled={!canContinue() || isRedirecting}
							>
								{step < 3
									? 'Pokračovat'
									: isRedirecting
										? 'Přesměrovávám...'
										: 'Porovnat nabídky →'}
							</button>
						</div>
					</div>
				</div>
					</div>

					{/* Výhody – vedlejší box */}
					<div className="col-lg-5">
						<div className="card shadow-sm h-100 border-0">
							<div className="card-body p-4">
								<h5 className="card-title mb-4">Co získáte</h5>
								{benefits.map((b, i) => (
									<div
										key={i}
										className={`d-flex align-items-start gap-3 ${i < benefits.length - 1 ? 'mb-4 pb-3 border-bottom border-light' : ''}`}
									>
										<div
											className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
											style={{
												width: 48,
												height: 48,
												backgroundColor: 'rgba(90, 143, 62, 0.15)',
												fontSize: '1.5rem',
											}}
										>
											{b.icon}
										</div>
										<div>
											<div className="fw-semibold">{b.title}</div>
											<div className="text-muted small">{b.desc}</div>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
			<Footer />
		</>
	)
}

export default SjednatPojisteniPage
