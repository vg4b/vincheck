import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import { csob } from '../config/affiliateCampaigns'

type PojisteniTyp = 'povinne' | 'havarijni' | 'oboje'
type VozidloTyp = 'vin' | 'spz'

const STEPS = [
	{ id: 1, title: 'Typ pojištění' },
	{ id: 2, title: 'Vozidlo' },
	{ id: 3, title: 'Shrnutí' },
] as const

const REMINDER_MODAL_COLUMNS: { emoji: string; label: string }[][] = [
	[
		{ emoji: '🔧', label: 'Termín STK' },
		{ emoji: '🛡️', label: 'Povinné ručení' },
		{ emoji: '🚗', label: 'Havarijní pojištění' },
	],
	[
		{ emoji: '🔩', label: 'Servisní prohlídky' },
		{ emoji: '🛞', label: 'Přezutí pneumatik' },
		{ emoji: '🛣️', label: 'Dálniční známka' },
	],
]

const ReminderModalLine: React.FC<{ emoji: string; label: string }> = ({ emoji, label }) => (
	<li className="d-flex align-items-start gap-2">
		<span
			className="flex-shrink-0 d-inline-flex justify-content-center"
			style={{ width: '1.5rem', lineHeight: 1.25 }}
			aria-hidden
		>
			{emoji}
		</span>
		<span>{label}</span>
	</li>
)

const SjednatPojisteniPage: React.FC = () => {
	const [searchParams] = useSearchParams()
	const vinFromUrl = searchParams.get('vin')?.replace(/[^a-zA-Z0-9]/g, '').trim() ?? ''
	const spzFromUrl = searchParams.get('spz')?.replace(/[^a-zA-Z0-9]/g, '').trim().toUpperCase() ?? ''
	const initialVozidloTyp: VozidloTyp | null = vinFromUrl ? 'vin' : spzFromUrl ? 'spz' : null
	const [step, setStep] = useState(1)
	const [typ, setTyp] = useState<PojisteniTyp | null>(null)
	const [vozidloTyp, setVozidloTyp] = useState<VozidloTyp | null>(initialVozidloTyp)
	const [vinOrSpz, setVinOrSpz] = useState(vinFromUrl || spzFromUrl)
	const [showKalkulackaModal, setShowKalkulackaModal] = useState(false)
	const [kalkulackaPopupBlocked, setKalkulackaPopupBlocked] = useState(false)

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

	useEffect(() => {
		if (!showKalkulackaModal) return
		const prevOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => {
			document.body.style.overflow = prevOverflow
		}
	}, [showKalkulackaModal])

	useEffect(() => {
		if (!showKalkulackaModal) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setShowKalkulackaModal(false)
				setKalkulackaPopupBlocked(false)
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [showKalkulackaModal])

	const cleanVinOrSpz = vinOrSpz.replace(/[^a-zA-Z0-9]/g, '').trim()
	const isValidVin = vozidloTyp === 'vin' && cleanVinOrSpz.length === 17
	const isValidSpz = vozidloTyp === 'spz' && cleanVinOrSpz.length >= 5 && cleanVinOrSpz.length <= 8
	const hasVinOrSpz = isValidVin || isValidSpz

	const getKalkulackaUrl = (): string => {
		if (!typ) {
			return csob.getVehicleKalkulackaUrl('povinne_ruceni', 'sjednat_pojisteni')
		}
		const kind =
			typ === 'povinne'
				? 'povinne_ruceni'
				: typ === 'havarijni'
					? 'havarijni'
					: 'komplexni'
		return csob.getVehicleKalkulackaUrl(kind, 'sjednat_pojisteni')
	}

	const openKalkulackaInNewTab = (): boolean => {
		const url = getKalkulackaUrl()
		const w = window.open(url, '_blank', 'noopener,noreferrer')
		return Boolean(w)
	}

	const handleContinue = () => {
		if (step < 3) {
			setStep(step + 1)
			return
		}
		const opened = openKalkulackaInNewTab()
		setKalkulackaPopupBlocked(!opened)
		// Modal až poté, co se nový tab stihne otevřít (další úloha ve frontě)
		window.setTimeout(() => {
			setShowKalkulackaModal(true)
		}, 0)
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
			title: 'Sleva online',
			desc: 'Zvýhodnění při sjednání přes kalkulačku na webu',
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
					Vyberte typ pojištění a přejděte na kalkulačku. {csob.vehicleKalkulackaTagline}
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
									<strong>Připraveno.</strong> Kliknutím se nejdřív otevře kalkulačka v novém tabu, poté se zobrazí tip k upozorněním v Moje VINInfo.
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
								disabled={!canContinue()}
							>
								{step < 3 ? 'Pokračovat' : 'Na kalkulačku →'}
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

			{showKalkulackaModal && (
				<div
					className="modal fade show d-block"
					tabIndex={-1}
					role="dialog"
					aria-modal="true"
					aria-labelledby="sjednat-kalkulacka-modal-title"
					style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							setShowKalkulackaModal(false)
							setKalkulackaPopupBlocked(false)
						}
					}}
				>
					<div
						className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="modal-content">
							<div className="modal-header">
								<h2 id="sjednat-kalkulacka-modal-title" className="modal-title h5 mb-0">
									Upozornění na termíny
								</h2>
								<button
									type="button"
									className="btn-close"
									aria-label="Zavřít"
									onClick={() => {
										setShowKalkulackaModal(false)
										setKalkulackaPopupBlocked(false)
									}}
								/>
							</div>
							<div className="modal-body">
								{!kalkulackaPopupBlocked && (
									<p className="mb-3">
										Kalkulačka pojištění vozidla se otevřela v <strong>novém tabu</strong>. Tady na VIN Info.cz
										můžete dál prohlížet web nebo si níže nastavit upozornění.
									</p>
								)}
								{kalkulackaPopupBlocked && (
									<div className="alert alert-warning mb-3" role="alert">
										<strong>Nový tab se nepodařilo otevřít.</strong> Povolte vyskakovací okna pro tento web, nebo
										použijte tlačítko níže.
									</div>
								)}

								<div className="border rounded p-3 bg-light mt-0">
									<h3 className="h6 mb-2">Nechte se upozornit na důležité termíny</h3>
									<p className="small mb-3">
										V Moje VINInfo si uložíte vozidlo a nastavíte upozornění – nikdy nezmeškejte:
									</p>
									<div className="row small g-3 align-items-start">
										{REMINDER_MODAL_COLUMNS.map((column, colIdx) => (
											<div key={colIdx} className="col-sm-6">
												<ul className="list-unstyled mb-0 d-flex flex-column gap-2">
													{column.map((item) => (
														<ReminderModalLine key={item.label} emoji={item.emoji} label={item.label} />
													))}
												</ul>
											</div>
										))}
									</div>
									<p className="small text-muted mb-3 mt-2">
										📧 Pošleme vám email v termínu, který si zvolíte • ✨ 100 % zdarma
									</p>
									<p className="small mb-0">
										<Link to="/klientska-zona">Přejít do Moje VINInfo</Link>
										{' · '}
										<Link to="/registrace">Vytvořit účet zdarma</Link>
									</p>
								</div>
							</div>
							<div className="modal-footer flex-wrap gap-2">
								<button
									type="button"
									className="btn btn-primary"
									onClick={() => {
										setShowKalkulackaModal(false)
										setKalkulackaPopupBlocked(false)
									}}
								>
									Zavřít
								</button>
								{kalkulackaPopupBlocked && (
									<>
										<button
											type="button"
											className="btn btn-outline-primary"
											onClick={() => {
												if (openKalkulackaInNewTab()) {
													setKalkulackaPopupBlocked(false)
												}
											}}
										>
											Zkusit znovu otevřít
										</button>
										<button
											type="button"
											className="btn btn-outline-secondary"
											onClick={async () => {
												try {
													await navigator.clipboard.writeText(getKalkulackaUrl())
												} catch {
													/* ignore */
												}
											}}
										>
											Zkopírovat odkaz
										</button>
									</>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			<Footer />
		</>
	)
}

export default SjednatPojisteniPage
