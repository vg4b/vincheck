import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CebiaRemindersModal } from '../components/CebiaRemindersModal'
import Footer from '../components/Footer'
import Icon from '../components/Icon'
import Navigation from '../components/Navigation'
import VehicleInfo from '../components/VehicleInfo'
import { cebia } from '../config/affiliateCampaigns'
import { isCertificateEnabled } from '../config/featureFlags'
import { useAuth } from '../contexts/AuthContext'
import { VehicleDataArray, VehicleHistory } from '../types'
import { ApiError } from '../utils/apiClient'
import { addVehicle } from '../utils/clientZoneApi'
import {
	fetchVehicleInfoWithHistory,
	getDataValue,
	VehicleLookupError,
	type VehicleLookupErrorKind
} from '../utils/vehicleApi'

const HomePage: React.FC = () => {
	const navigate = useNavigate()

	useEffect(() => {
		document.title =
			'Kontrola VIN kódu zdarma | Prověření vozidla v registru ČR | VIN Info.cz'

		// Update meta description
		const metaDescription = document.querySelector('meta[name="description"]')
		if (metaDescription) {
			metaDescription.setAttribute(
				'content',
				'Zdarma zkontrolujte VIN kód, číslo TP nebo ORV vozidla v českém registru. Technické údaje, platnost STK, sledování stavu tachometru. Uložte si vozidlo, evidujte najeté km a nastavte upozornění na STK, pojištění – emailem zdarma.'
			)
		}

		// Add structured data (JSON-LD) for better SEO
		const script = document.createElement('script')
		script.type = 'application/ld+json'
		script.text = JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'WebApplication',
			name: 'VIN Info.cz - Kontrola vozidel zdarma',
			description:
				'Bezplatná kontrola VIN kódu, čísla TP a ORV vozidla v českém registru vozidel. Získejte technické údaje, historii vozidla a další informace. Uložte si vozidla a nastavte upozornění na STK, pojištění a servis.',
			url: 'https://www.vininfo.cz',
			applicationCategory: 'UtilityApplication',
			operatingSystem: 'Web',
			offers: {
				'@type': 'Offer',
				price: '0',
				priceCurrency: 'CZK'
			},
			featureList: [
				'Kontrola VIN kódu',
				'Kontrola čísla TP',
				'Kontrola čísla ORV',
				'Technické údaje vozidla',
				'Datum první registrace',
				'Platnost technické prohlídky STK',
				'Historie vozidla',
				'Sledování stavu tachometru',
				'Evidence najetých kilometrů',
				'Upozornění na termíny STK',
				'Upozornění na pojištění',
				'Upozornění na servisní prohlídky',
				'Emailové notifikace',
				'Správa více vozidel'
			]
		})
		document.head.appendChild(script)

		return () => {
			// Cleanup: remove script on unmount
			const existingScript = document.querySelector(
				'script[type="application/ld+json"]'
			)
			if (existingScript?.textContent?.includes('VIN Info')) {
				existingScript.remove()
			}
		}
	}, [])
	const [searchMethod, setSearchMethod] = useState<'vin' | 'tp' | 'orv'>('vin')
	const [searchAlsoCebia, setSearchAlsoCebia] = useState(false) // skryto do opravy
	const [vin, setVin] = useState('')
	const [tp, setTp] = useState('')
	const [orv, setOrv] = useState('')
	const [vehicleData, setVehicleData] = useState<VehicleDataArray | null>(null)
	const [vehicleHistory, setVehicleHistory] = useState<VehicleHistory | null>(
		null
	)
	const [lookupError, setLookupError] = useState<{
		kind: VehicleLookupErrorKind
		message?: string
	} | null>(null)
	const [loading, setLoading] = useState(false)
	const [showSearch, setShowSearch] = useState(true)
	const [saving, setSaving] = useState(false)
	const [saveMessage, setSaveMessage] = useState('')
	const [saveTitle, setSaveTitle] = useState('')
	const [notFoundRemindersModalOpen, setNotFoundRemindersModalOpen] =
		useState(false)
	const { user } = useAuth()

	const vinInputRef = useRef<HTMLInputElement>(null)
	const tpInputRef = useRef<HTMLInputElement>(null)
	const orvInputRef = useRef<HTMLInputElement>(null)
	const lookupErrorRef = useRef<HTMLDivElement>(null)

	const identifierLabel =
		searchMethod === 'vin'
			? 'VIN'
			: searchMethod === 'tp'
				? 'Číslo TP'
				: 'Číslo ORV'

	const focusActiveSearchField = () => {
		if (searchMethod === 'vin') {
			vinInputRef.current?.focus()
		} else if (searchMethod === 'tp') {
			tpInputRef.current?.focus()
		} else {
			orvInputRef.current?.focus()
		}
	}

	const cebiaNotFoundUrl =
		searchMethod === 'vin' && vin.trim().length === 17
			? cebia.getTextLinkUrlWithVin(vin.trim(), 'homepage_error')
			: cebia.getTextLinkUrl('homepage_error')

	/** Opětovné otevření prověrky z modalu (po not_found) – vlastní data1 pro eHub */
	const cebiaNotFoundModalRetryUrl =
		searchMethod === 'vin' && vin.trim().length === 17
			? cebia.getTextLinkUrlWithVin(
					vin.trim(),
					'homepage_not_found_modal_reopen_cebia'
				)
			: cebia.getTextLinkUrl('homepage_not_found_modal_reopen_cebia')

	useLayoutEffect(() => {
		if (lookupError) {
			lookupErrorRef.current?.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest'
			})
		}
	}, [lookupError])

	useEffect(() => {
		if (!lookupError || lookupError.kind !== 'not_found') {
			setNotFoundRemindersModalOpen(false)
		}
	}, [lookupError])

	// Button disabled states
	const isVinValid = vin.trim().length === 17
	const isTpValid = tp.trim().length >= 6 && tp.trim().length <= 10
	const isOrvValid = orv.trim().length >= 5 && orv.trim().length <= 9

	const handleVinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '')
		setVin(value)
	}

	const handleTpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '')
		setTp(value)
	}

	const handleOrvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '')
		setOrv(value)
	}

	const handleSubmit = async () => {
		setLookupError(null)
		setLoading(true)
		setSaveMessage('')

		const openCebiaInCurrentTab =
			searchMethod === 'vin' && searchAlsoCebia && vin.trim().length === 17
		let newTab: Window | null = null
		if (openCebiaInCurrentTab) {
			newTab = window.open(
				`${window.location.origin}/vin/${vin.trim()}`,
				'_blank',
				'noopener,noreferrer'
			)
		}

		try {
			const { fields: data, history } = await fetchVehicleInfoWithHistory(
				vin || undefined,
				tp || undefined,
				orv || undefined
			)

			// Navigate to appropriate detail page based on search type
			if (vin && vin.trim().length === 17) {
				const vinCode = getDataValue(data, 'VIN', vin)

				if (vinCode && vinCode.length === 17) {
					if (openCebiaInCurrentTab) {
						if (newTab && newTab !== window) {
							window.location.href = cebia.getTextLinkUrlWithVin(
								vin.trim(),
								'homepage_vin'
							)
						} else {
							navigate(`/vin/${vinCode}`)
						}
					} else {
						navigate(`/vin/${vinCode}`)
					}
					return
				}
			} else if (tp && tp.trim().length >= 6 && tp.trim().length <= 10) {
				// Navigate to TP detail page
				const cleanTp = tp.replace(/[^a-zA-Z0-9]/g, '')
				navigate(`/tp/${cleanTp}`)
				return
			} else if (orv && orv.trim().length >= 5 && orv.trim().length <= 9) {
				// Navigate to ORV detail page
				const cleanOrv = orv.replace(/[^a-zA-Z0-9]/g, '')
				navigate(`/orv/${cleanOrv}`)
				return
			}

			// Fallback: show on homepage if navigation didn't happen
			setVehicleData(data)
			setVehicleHistory(history)
			setShowSearch(false)
		} catch (err) {
			console.error('Chyba při načítání dat:', err)
			if (VehicleLookupError.isInstance(err)) {
				setLookupError({ kind: err.kind, message: err.message })
			} else {
				setLookupError({ kind: 'unknown' })
			}
		} finally {
			setLoading(false)
		}
	}

	const handleNewSearch = () => {
		setVehicleData(null)
		setVehicleHistory(null)
		setLookupError(null)
		setVin('')
		setTp('')
		setOrv('')
		setShowSearch(true)
		setSaveMessage('')
		setSaveTitle('')
	}

	const handleKeyPress = (
		e: React.KeyboardEvent<HTMLInputElement>,
		isValid: boolean
	) => {
		if (e.key === 'Enter' && isValid && !loading) {
			handleSubmit()
		}
	}

	const vinCode = vehicleData
		? getDataValue(vehicleData, 'VIN', 'Neznámý VIN')
		: ''
	const brand = vehicleData
		? getDataValue(vehicleData, 'TovarniZnacka', '')
		: ''
	const model = vehicleData ? getDataValue(vehicleData, 'Typ', '') : ''

	const handleSaveVehicle = async () => {
		if (!vehicleData) {
			return
		}

		if (!user) {
			navigate('/prihlaseni')
			return
		}

		setSaving(true)
		setSaveMessage('')

		try {
			const vinValue = getDataValue(vehicleData, 'VIN', vinCode).trim()
			const tpValue = getDataValue(vehicleData, 'CisloTp', '').trim()
			const orvValue = getDataValue(vehicleData, 'CisloOrv', '').trim()

			await addVehicle({
				vin: vinValue || undefined,
				tp: tpValue || undefined,
				orv: orvValue || undefined,
				title: saveTitle.trim() ? saveTitle.trim().slice(0, 60) : undefined,
				brand,
				model,
				snapshot: vehicleData
			})
			setSaveMessage('Vozidlo bylo uloženo do klientské zóny.')
		} catch (error) {
			if (error instanceof ApiError && error.status === 409) {
				setSaveMessage('Vozidlo už je uložené v Moje VINInfo.')
			} else {
				setSaveMessage('Nepodařilo se uložit vozidlo. Zkuste to znovu.')
			}
		} finally {
			setSaving(false)
		}
	}

	return (
		<>
			<Navigation />
			<main className='container mt-5'>
				<header className='text-center mx-auto' style={{ maxWidth: '780px' }}>
					<span className='eyebrow'>Kontrola vozidla zdarma</span>
					<h1 className='display-tight mb-3'>
						Prověřte vozidlo v registru ČR ihned
					</h1>
					<p className='lead-tight mx-auto'>
						Zadejte VIN, číslo TP nebo ORV a získejte okamžitý přístup k
						technickým údajům, datu první registrace a platnosti STK – přímo z
						oficiálního registru.
					</p>

					<ul className='list-unstyled d-flex flex-wrap justify-content-center column-gap-4 row-gap-2 mt-4 mb-5 small text-muted-ink'>
						<li className='d-inline-flex align-items-center gap-1'>
							<Icon name='check-circle' size={16} className='text-brand' />
							Zdarma, bez registrace
						</li>
						<li className='d-inline-flex align-items-center gap-1'>
							<Icon name='shield-check' size={16} className='text-brand' />
							Data z Ministerstva dopravy
						</li>
						<li className='d-inline-flex align-items-center gap-1'>
							<Icon name='bell' size={16} className='text-brand' />
							STK &amp; pojištění upozornění
						</li>
						<li className='d-inline-flex align-items-center gap-1'>
							<Icon name='file-text' size={16} className='text-brand' />
							Více než 90 údajů o vozidle
						</li>
					</ul>
				</header>

				<section aria-labelledby='search-heading'>
					<h2 id='search-heading' className='visually-hidden'>
						Vyhledávání vozidla
					</h2>
					{showSearch && (
						<div className='row' id='searchSection'>
							<div className='col-12 mb-3'>
								<label className='form-label'>
									<strong>Vyberte způsob vyhledávání:</strong>
								</label>
								<div className='btn-group w-100' role='group'>
									<input
										type='radio'
										className='btn-check'
										name='searchMethod'
										id='methodVin'
										checked={searchMethod === 'vin'}
										onChange={() => setSearchMethod('vin')}
									/>
									<label
										className='btn btn-outline-primary'
										htmlFor='methodVin'
									>
										VIN kód
									</label>
									<input
										type='radio'
										className='btn-check'
										name='searchMethod'
										id='methodTp'
										checked={searchMethod === 'tp'}
										onChange={() => setSearchMethod('tp')}
									/>
									<label className='btn btn-outline-primary' htmlFor='methodTp'>
										Číslo TP
									</label>
									<input
										type='radio'
										className='btn-check'
										name='searchMethod'
										id='methodOrv'
										checked={searchMethod === 'orv'}
										onChange={() => setSearchMethod('orv')}
									/>
									<label
										className='btn btn-outline-primary'
										htmlFor='methodOrv'
									>
										Číslo ORV
									</label>
								</div>
							</div>

							{searchMethod === 'vin' && (
								<>
									<div className='col-md-6'>
										<label htmlFor='vinInput' className='form-label'>
											<strong>Zadejte VIN kód vozidla:</strong>
											<br />
											<small className='text-muted'>
												Unikátní 17místný identifikátor vozidla
											</small>
										</label>
										<input
											ref={vinInputRef}
											type='text'
											className='form-control'
											id='vinInput'
											name='vin'
											placeholder='Např. WVWZZZ1KZDP015799'
											value={vin}
											onChange={handleVinChange}
											onKeyPress={(e) => handleKeyPress(e, isVinValid)}
											aria-label='VIN kód vozidla (17 znaků)'
											maxLength={17}
											autoComplete='off'
										/>
									</div>
									<div className='col-md-6 d-flex align-items-end justify-content-md-end mt-md-0 mt-3'>
										<button
											type='button'
											className='btn btn-primary w-100'
											onClick={handleSubmit}
											id='getInfoBtn'
											disabled={!isVinValid || loading}
										>
											Vyhledat vozidlo dle VIN
										</button>
									</div>
									{/* Cebia checkbox prozatím skryt - otevření nového tabu nefunguje spolehlivě */}
									{false && (
										<div className='col-12 mt-2'>
											<div className='form-check'>
												<input
													type='checkbox'
													className='form-check-input'
													id='searchAlsoCebia'
													checked={searchAlsoCebia}
													onChange={(e) => setSearchAlsoCebia(e.target.checked)}
												/>
												<label
													className='form-check-label'
													htmlFor='searchAlsoCebia'
												>
													Vyhledat také na Cebia.cz (historie vozidla)
												</label>
											</div>
										</div>
									)}
								</>
							)}

							{searchMethod === 'tp' && (
								<>
									<div className='col-md-6'>
										<label htmlFor='tpInput' className='form-label'>
											<strong>Zadejte číslo TP vozidla:</strong>
											<br />
											<small className='text-muted'>
												Číslo velkého technického průkazu (6-10 znaků)
											</small>
										</label>
										<input
											ref={tpInputRef}
											type='text'
											className='form-control'
											id='tpInput'
											name='tp'
											placeholder='Např. UI036202'
											value={tp}
											onChange={handleTpChange}
											onKeyPress={(e) => handleKeyPress(e, isTpValid)}
											aria-label='Číslo TP vozidla (6-10 znaků)'
											maxLength={10}
											autoComplete='off'
										/>
									</div>
									<div className='col-md-6 d-flex align-items-end justify-content-md-end mt-md-0 mt-3'>
										<button
											type='button'
											className='btn btn-primary w-100'
											onClick={handleSubmit}
											id='getTpInfoBtn'
											disabled={!isTpValid || loading}
										>
											Vyhledat vozidlo dle TP
										</button>
									</div>
								</>
							)}

							{searchMethod === 'orv' && (
								<>
									<div className='col-md-6'>
										<label htmlFor='orvInput' className='form-label'>
											<strong>Zadejte číslo ORV vozidla:</strong>
											<br />
											<small className='text-muted'>
												Číslo osvědčení o registraci vozidla (5-9 znaků)
											</small>
										</label>
										<input
											ref={orvInputRef}
											type='text'
											className='form-control'
											id='orvInput'
											name='orv'
											placeholder='Např. UAA000000'
											value={orv}
											onChange={handleOrvChange}
											onKeyPress={(e) => handleKeyPress(e, isOrvValid)}
											aria-label='Číslo ORV vozidla (5-9 znaků)'
											maxLength={9}
											autoComplete='off'
										/>
									</div>
									<div className='col-md-6 d-flex align-items-end justify-content-md-end mt-md-0 mt-3'>
										<button
											type='button'
											className='btn btn-primary w-100'
											onClick={handleSubmit}
											id='getOrvInfoBtn'
											disabled={!isOrvValid || loading}
										>
											Vyhledat vozidlo dle ORV
										</button>
									</div>
								</>
							)}

							{lookupError?.kind === 'not_found' && (
								<div className='col-12 mt-4' ref={lookupErrorRef}>
									<div
										className='alert alert-info border-info shadow-sm'
										role='status'
									>
										<h3 className='alert-heading h6 mb-2'>
											{identifierLabel} nebylo nalezeno v registru silničních
											vozidel ČR.
										</h3>
										<p className='small mb-2'>
											<strong>1)</strong> Zkontrolujte překlepy (
											<strong>I/l</strong>, <strong>O/0</strong>) a případně
											zkuste jiný způsob hledání (VIN / TP / ORV).
										</p>
										<button
											type='button'
											className='btn btn-primary btn-sm mb-3'
											onClick={focusActiveSearchField}
										>
											Upravit zadání
										</button>
										<p className='small mb-2 pt-2 border-top'>
											<strong>2)</strong> Zkuste vyhledat v rozšířeném registru:
										</p>
										<a
											href={cebiaNotFoundUrl}
											target='_blank'
											rel='noopener noreferrer'
											className='btn btn-primary'
											onClick={() => {
												// Nový tab z výchozí akce odkazu má přednost; modal až v další úloze (stejné jako VehicleInfo).
												window.setTimeout(
													() => setNotFoundRemindersModalOpen(true),
													0
												)
											}}
										>
											Otevřít rozšířenou prověrku vozidla
										</a>
									</div>
								</div>
							)}

							{lookupError?.kind === 'server_error' && (
								<div className='col-12 mt-4' ref={lookupErrorRef}>
									<div className='alert alert-danger' role='alert'>
										<strong>Registr dočasně neodpovídá.</strong> Zkuste
										vyhledání znovu za chvíli. Pokud problém přetrvává, zkuste
										obnovit stránku.
									</div>
								</div>
							)}

							{lookupError?.kind === 'unknown' && (
								<div className='col-12 mt-4' ref={lookupErrorRef}>
									<div className='alert alert-danger' role='alert'>
										<p className='mb-2'>
											{lookupError.message ??
												'Nepodařilo se načíst údaje. Zkontrolujte připojení k internetu a zkuste to znovu.'}
										</p>
										<button
											type='button'
											className='btn btn-sm btn-outline-danger'
											onClick={focusActiveSearchField}
										>
											Zkusit znovu — upravit zadání
										</button>
									</div>
								</div>
							)}

							<div className='col-12 mt-4'>
								<details className='spec-group'>
									<summary className='spec-summary'>
										<Icon name='info' size={18} className='text-brand' />
										<span>Kde najdu VIN, číslo TP nebo ORV?</span>
										<Icon
											name='chevron-right'
											size={18}
											className='spec-chevron'
										/>
									</summary>
									<div className='spec-body'>
										<p className='mb-2'>
											<strong>VIN kód</strong> je unikátní 17místný
											identifikátor vozidla (Vehicle Identification Number),
											který najdete na technickém průkazu nebo v motorovém
											prostoru vozidla.
										</p>
										<p className='mb-2'>
											<strong>Číslo TP</strong> (6-10 znaků) je číslo velkého
											technického průkazu vozidla, které je také unikátní
											identifikátor vozidla v České republice.
										</p>
										<p className='mb-0'>
											<strong>Číslo ORV</strong> (5-9 znaků) je číslo osvědčení
											o registraci vozidla, známé také jako "malý techničák".
											Tento identifikátor můžete použít pro kontrolu vozidla v
											registru.
										</p>
									</div>
								</details>
							</div>

							<div className='col-12 mt-4'>
								<p className='mb-0'>
									Při koupi ojetého vozidla je nezbytné prověřit jeho historii a
									technický stav. Naše služba umožňuje zdarma zkontrolovat
									klíčové informace o vozidle přímo z oficiálního registru
									vozidel České republiky. Stačí zadat VIN kód (17 znaků), číslo
									TP (6-10 znaků) nebo číslo ORV (5-9 znaků) a během několika
									sekund získáte přístup k více než 90 údajům o vozidle.
								</p>
							</div>

							<section
								className='jumbotron jumbotron-fluid mt-5'
								aria-labelledby='features-heading'
							>
								<div className='container'>
									<h3 id='features-heading' className='h4 mb-3'>
										Co zjistíte při kontrole vozidla zdarma?
									</h3>
									<ul className='list-unstyled'>
										<li className='mb-2'>
											✅ <strong>Základní údaje o vozidle</strong> - značka,
											model, obchodní označení
										</li>
										<li className='mb-2'>
											✅ <strong>Datum první registrace</strong> - kdy bylo
											vozidlo poprvé zaregistrováno
										</li>
										<li className='mb-2'>
											✅ <strong>Platnost technické prohlídky STK</strong> - do
											kdy je vozidlo technicky způsobilé
										</li>
										{isCertificateEnabled() && (
											<li className='mb-2'>
												✅ <strong>Náhled historie tachometru</strong> - počet
												záznamů z STK a upozornění na možné stočení (přesné
												hodnoty v certifikátu)
											</li>
										)}
										<li className='mb-2'>
											✅ <strong>Upozornění na termíny</strong> - uložte si
											vozidlo a nechte se emailem připomenout STK, pojištění a
											servis
										</li>
										<li className='mb-2'>
											✅ <strong>Technické údaje vozidla</strong> - motorizace,
											objem motoru, výkon, palivo
										</li>
										<li className='mb-2'>
											✅ <strong>Více než 90 dalších údajů</strong> - barva,
											karoserie, počet míst, emisní norma a další
										</li>
										<li className='mb-0'>
											❌ <strong>Poznámka:</strong> Vozidlo musí být
											zaregistrované v českém registru vozidel
										</li>
									</ul>
								</div>
							</section>

							{/* Moje VINInfo Promo Section */}
							<section
								className='mt-5 brand-callout'
								aria-labelledby='moje-vininfo-heading'
							>
								<span className='eyebrow'>Moje VINInfo</span>
								<div className='row align-items-center'>
									<div className='col-lg-8'>
										<h3 id='moje-vininfo-heading' className='h4 mb-3'>
											Váš osobní asistent pro správu vozidel
										</h3>
										<p className='mb-3'>
											Vytvořte si <strong>zdarma účet</strong> a mějte všechna
											svá vozidla pod kontrolou. Už nikdy nezmeškáte důležitý
											termín!
										</p>
										<div className='row'>
											<div className='col-md-6'>
												<ul className='list-unstyled mb-0'>
													<li className='mb-2'>
														<strong>🚗 Správa vozidel</strong>
														<br />
														<small className='text-muted'>
															Uložte si všechna svá vozidla na jedno místo
														</small>
													</li>
													<li className='mb-2'>
														<strong>🔔 Upozornění na termíny</strong>
														<br />
														<small className='text-muted'>
															STK, pojištění, servis, přezutí pneu, dálniční
															známka
														</small>
													</li>
													<li className='mb-2'>
														<strong>📧 Emailové notifikace</strong>
														<br />
														<small className='text-muted'>
															Připomeneme vám blížící se termíny emailem
														</small>
													</li>
												</ul>
											</div>
											<div className='col-md-6'>
												<ul className='list-unstyled mb-0'>
													<li className='mb-2'>
														<strong>📏 Stav tachometru</strong>
														<br />
														<small className='text-muted'>
															Evidence najetých km a trend v čase
														</small>
													</li>
													<li className='mb-2'>
														<strong>📊 Přehled na jednom místě</strong>
														<br />
														<small className='text-muted'>
															Všechny důležité informace o vozidlech
														</small>
													</li>
													<li className='mb-2'>
														<strong>💰 Srovnání pojištění</strong>
														<br />
														<small className='text-muted'>
															Rychlý přístup k výhodným nabídkám pojištění
														</small>
													</li>
													<li className='mb-2'>
														<strong>✨ 100% zdarma</strong>
														<br />
														<small className='text-muted'>
															Žádné skryté poplatky ani předplatné
														</small>
													</li>
												</ul>
											</div>
										</div>
									</div>
									<div className='col-lg-4 text-center mt-4 mt-lg-0'>
										{user ? (
											<div>
												<p className='mb-3'>
													Jste přihlášeni jako <strong>{user.email}</strong>
												</p>
												<a
													href='/klientska-zona'
													className='btn btn-primary btn-lg'
												>
													Přejít do Moje VINInfo
												</a>
											</div>
										) : (
											<div>
												<a
													href='/registrace'
													className='btn btn-primary btn-lg mb-2 w-100'
												>
													Vytvořit účet zdarma
												</a>
												<p className='mb-0'>
													<small>
														Již máte účet?{' '}
														<a href='/prihlaseni' className='text-dark'>
															Přihlásit se
														</a>
													</small>
												</p>
											</div>
										)}
									</div>
								</div>
							</section>
						</div>
					)}

					{/* VIN guide — long-form SEO content */}
					<article className='section border-top'>
						<div className='row justify-content-center'>
							<div className='col-lg-10'>
								<span className='eyebrow'>Průvodce</span>
								<h2 className='mb-4'>
									<span className='heading-accent'>
										Vše o kontrole VIN kódu a historii vozidla
									</span>
								</h2>

								<section className='mb-5'>
									<h3 className='h4'>Co je to VIN kód?</h3>
									<p>
										<strong>VIN (Vehicle Identification Number)</strong> je
										unikátní 17místný alfanumerický kód, který slouží jako
										"rodné číslo" každého vyrobeného vozidla. Tento mezinárodní
										standard (ISO 3779) zaručuje, že žádná dvě vozidla na světě
										(vyrobená za posledních 30 let) nemají stejný identifikátor.
									</p>
									<p>
										VIN kód obsahuje zakódované informace o výrobci, modelu,
										roce výroby, místě výroby, motorizaci a výbavě. Je nezbytný
										pro identifikaci vozidla při koupi, prodeji, servisu,
										pojištění nebo policejním pátrání.
									</p>
								</section>

								<section className='mb-5'>
									<h3 className='h4'>Kde najít VIN kód na vozidle?</h3>
									<p>
										VIN kód je na vozidle umístěn na několika místech, aby bylo
										ztíženo jeho padělání. Nejčastěji ho naleznete:
									</p>
									<ul>
										<li>
											<strong>Pod čelním sklem</strong> - na straně řidiče,
											viditelné zvenčí.
										</li>
										<li>
											<strong>V motorovém prostoru</strong> - vyražený na
											karoserii nebo na výrobním štítku.
										</li>
										<li>
											<strong>Na B-sloupku</strong> - na štítku u dveří řidiče
											nebo spolujezdce.
										</li>
										<li>
											<strong>Pod podlahou</strong> - často u sedadla
											spolujezdce.
										</li>
										<li>
											<strong>V dokladech</strong> - v malém i velkém technickém
											průkazu (řádek E) a v zelené kartě.
										</li>
									</ul>
								</section>

								<section className='mb-5'>
									<h3 className='h4'>Proč je kontrola VIN zdarma důležitá?</h3>
									<p>
										Kontrola VIN kódu v registru vozidel vám poskytne ověřená
										data přímo od Ministerstva dopravy ČR. Tato data jsou
										klíčová zejména při nákupu ojetého vozu. Zjistíte například:
									</p>
									<ul>
										<li>
											Zda technické údaje v inzerátu odpovídají skutečnosti
											(výkon, objem, palivo).
										</li>
										<li>Skutečné datum první registrace (stáří vozidla).</li>
										<li>
											Platnost technické prohlídky (STK) - vyhnete se nákupu
											vozu bez platné STK.
										</li>
										<li>Počet míst k sezení, barvu a další parametry.</li>
									</ul>
									<p>
										Tato bezplatná kontrola je prvním krokem. Pokud základní
										údaje nesedí, může to být signál, že s vozidlem není něco v
										pořádku (např. vyměněný motor, přelakovaná karoserie, chyby
										v dokladech).
									</p>
								</section>

								<section className='mb-5'>
									<h3 className='h4'>Co je registr silničních vozidel?</h3>
									<p>
										Centrální registr silničních vozidel (CRV) je informační
										systém veřejné správy vedený Ministerstvem dopravy ČR.
										Obsahuje údaje o všech vozidlech registrovaných v České
										republice. Naše služba využívá oficiální data z tohoto
										registru (prostřednictvím otevřených dat), takže máte
										jistotu, že informace jsou aktuální a přesné.
									</p>
									<p>
										V registru jsou evidovány osobní automobily, motocykly,
										nákladní vozy, autobusy, přípojná vozidla i traktory. Pokud
										vozidlo bylo dovezeno ze zahraničí a ještě nemá české
										doklady, v tomto registru ho nenajdete.
									</p>
								</section>

								<section className='mb-5'>
									<h3 className='h4'>
										Moje VINInfo - Bezplatná správa vozidel
									</h3>
									<p>
										<strong>Moje VINInfo</strong> je bezplatná služba pro
										všechny majitele vozidel, která vám pomůže mít přehled o
										důležitých termínech. Po vytvoření účtu si můžete:
									</p>
									<ul>
										<li>
											<strong>Uložit všechna svá vozidla</strong> - osobní i
											firemní, a mít je přehledně na jednom místě.
										</li>
										<li>
											<strong>Nastavit upozornění</strong> - na termín STK,
											povinné ručení, havarijní pojištění, servisní prohlídky,
											přezutí pneumatik nebo platnost dálniční známky.
										</li>
										<li>
											<strong>Dostávat emailové notifikace</strong> -
											připomeneme vám blížící se termíny v den, který si
											zvolíte, abyste nic nezmeškali.
										</li>
										<li>
											<strong>Rychle srovnat pojištění</strong> - přímý přístup
											k výhodným nabídkám povinného ručení a havarijního
											pojištění.
										</li>
									</ul>
									<p>
										Registrace je jednoduchá a trvá jen minutu. Stačí zadat
										email a heslo. Služba je a vždy bude{' '}
										<strong>zcela zdarma</strong>.
									</p>
								</section>

								<section className='mb-5'>
									<h3 className='h4'>Často kladené dotazy (FAQ)</h3>

									<h4 className='h6 mt-4'>Je tato služba opravdu zdarma?</h4>
									<p>
										Ano, kontrola základních technických údajů z registru
										vozidel je na VIN Info.cz zcela zdarma. Stejně tak je zdarma
										vytvoření účtu v Moje VINInfo, ukládání vozidel a nastavení
										upozornění na důležité termíny. Neplatíte žádné poplatky.
									</p>

									<h4 className='h6 mt-3'>
										Zobrazí se i historie najetých kilometrů?
									</h4>
									{isCertificateEnabled() ? (
										<p>
											Ano. V certifikátu zobrazujeme historii stavu tachometru
											ze záznamů technických a emisních prohlídek (STK/ME),
											včetně upozornění na možné stočení. V náhledu zdarma
											uvidíte počet záznamů a případné podezření na stočení,
											přesné hodnoty jsou součástí certifikátu. Údaje pocházejí
											z otevřených dat (stejný zdroj jako kontrolatachometru.cz
											Ministerstva dopravy) – jde o stav počítadla zjištěný při
											prohlídkách, který nemusí odpovídat aktuálnímu celkovému
											nájezdu, a nejsou k dispozici pro každé vozidlo. Záznamy o
											nehodách či nájezd ze zahraničí registr neobsahuje – ty
											prověříte v{' '}
											<a
												href={cebia.getTextLinkUrl('homepage_faq')}
												target='_blank'
												rel='noopener noreferrer'
											>
												placené zprávě partnera
											</a>
											.
										</p>
									) : (
										<p>
											Základní registr obsahuje technické údaje, ale historii
											stavu tachometru z prohlídek nezobrazuje. Stav počítadla
											ze záznamů STK je veřejně dostupný na stránkách
											Ministerstva dopravy (kontrolatachometru.cz). Kompletní
											prověření tachometru, nehod a původu ze zahraničí nabízí{' '}
											<a
												href={cebia.getTextLinkUrl('homepage_faq')}
												target='_blank'
												rel='noopener noreferrer'
											>
												placená zpráva partnera
											</a>
											.
										</p>
									)}

									<h4 className='h6 mt-3'>Mohu zjistit majitele vozidla?</h4>
									<p>
										U fyzických osob ne – z důvodu ochrany osobních údajů
										nezveřejňujeme jméno ani adresu vlastníka či provozovatele.
										Výjimkou jsou vozidla registrovaná na firmu (IČO): u nich
										zobrazujeme název společnosti a IČO, protože nejde o osobní
										údaje. U každého vozidla navíc najdete časovou osu vlastníků
										a provozovatelů (počty a období držby, u fyzických osob bez
										jmen).
									</p>

									<h4 className='h6 mt-3'>
										Jak funguje upozornění na termín STK?
									</h4>
									<p>
										Po registraci v Moje VINInfo si můžete ke každému vozidlu
										nastavit upozornění na různé termíny - STK, pojištění,
										servis a další. Systém vám pošle email v termínu, který si
										zvolíte, abyste měli čas vše zařídit. Upozornění můžete
										kdykoliv upravit nebo vypnout.
									</p>

									<h4 className='h6 mt-3'>Kolik vozidel si mohu uložit?</h4>
									<p>
										V Moje VINInfo si můžete uložit neomezený počet vozidel.
										Služba je vhodná jak pro jednotlivce s jedním autem, tak pro
										rodiny nebo firmy s více vozidly. Ke každému vozidlu můžete
										přidat vlastní název pro snadnou orientaci.
									</p>
								</section>
							</div>
						</div>
					</article>
				</section>

				{!showSearch && (
					<div
						className='mt-4'
						style={{ display: 'flex', justifyContent: 'center' }}
					>
						<button
							type='button'
							className='btn btn-primary w-75'
							onClick={handleNewSearch}
						>
							Vyhledat jiné vozidlo
						</button>
					</div>
				)}

				{vehicleData && (
					<section aria-labelledby='vehicle-info-heading'>
						<h2 id='vehicle-info-heading' className='visually-hidden'>
							Informace o vozidle
						</h2>
						<div className='mb-4 d-flex flex-column align-items-start'>
							<button
								type='button'
								className='btn btn-outline-primary'
								onClick={handleSaveVehicle}
								disabled={saving}
							>
								{user
									? saving
										? 'Ukládám...'
										: 'Uložit do Moje VINInfo'
									: 'Přihlásit se pro uložení'}
							</button>
							<div className='mt-3 w-100'>
								<label htmlFor='saveVehicleTitle' className='form-label'>
									Vlastní název vozidla (volitelné)
								</label>
								<input
									id='saveVehicleTitle'
									type='text'
									className='form-control'
									value={saveTitle}
									onChange={(event) => setSaveTitle(event.target.value)}
									placeholder='Např. Firemní Passat'
									maxLength={60}
								/>
							</div>
							{saveMessage && (
								<div className='alert alert-info mt-3' role='alert'>
									{saveMessage}
								</div>
							)}
						</div>
						<VehicleInfo
							data={vehicleData}
							vinCode={vinCode}
							history={vehicleHistory}
						/>
					</section>
				)}
			</main>

			<CebiaRemindersModal
				open={notFoundRemindersModalOpen}
				onClose={() => setNotFoundRemindersModalOpen(false)}
				user={user}
				cebiaRetryUrl={cebiaNotFoundModalRetryUrl}
				intro='not_found'
			/>

			<Footer />
		</>
	)
}

export default HomePage
