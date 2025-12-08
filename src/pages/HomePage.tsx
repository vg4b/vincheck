import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import VehicleInfo from '../components/VehicleInfo'
import { VehicleDataArray } from '../types'
import { fetchVehicleInfo, getDataValue } from '../utils/vehicleApi'

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
				'Zdarma zkontrolujte VIN kód, číslo TP nebo ORV vozidla v českém registru. Získejte informace o stáří vozidla, technické údaje, datum první registrace, platnost STK a dalších 90+ údajů o vozidle. Rychlá a bezplatná kontrola vozidel v ČR.'
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
				'Bezplatná kontrola VIN kódu, čísla TP a ORV vozidla v českém registru vozidel. Získejte technické údaje, historii vozidla a další informace.',
			url: 'https://vininfo.cz',
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
				'Historie vozidla'
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
	const [vin, setVin] = useState('')
	const [tp, setTp] = useState('')
	const [orv, setOrv] = useState('')
	const [vehicleData, setVehicleData] = useState<VehicleDataArray | null>(null)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)
	const [showSearch, setShowSearch] = useState(true)

	const vinInputRef = useRef<HTMLInputElement>(null)
	const tpInputRef = useRef<HTMLInputElement>(null)
	const orvInputRef = useRef<HTMLInputElement>(null)

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
		setError('')
		setLoading(true)

		try {
			const data = await fetchVehicleInfo(
				vin || undefined,
				tp || undefined,
				orv || undefined
			)

			// Navigate to appropriate detail page based on search type
			if (vin && vin.trim().length === 17) {
				// Get VIN from response data or use the input value
				const vinCode = getDataValue(data, 'VIN', vin)

				// Navigate to the VIN detail page if we have a valid VIN
				if (vinCode && vinCode.length === 17) {
					navigate(`/vin/${vinCode}`)
					return // Exit early, navigation will handle the rest
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
			setShowSearch(false)
		} catch (err) {
			console.error('Chyba při načítání dat:', err)
			setError(
				'Chyba při načítání dat. Zadaný VIN/TP/ORV pravděpodobně neexistuje v Registru silničních vozidel.\nZkontrolujte kód a zkuste to znovu.'
			)
		} finally {
			setLoading(false)
		}
	}

	const handleNewSearch = () => {
		setVehicleData(null)
		setError('')
		setVin('')
		setTp('')
		setOrv('')
		setShowSearch(true)
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

	return (
		<>
			<Navigation />
			<main className='container mt-5'>
				<header>
					<h1>Kontrola VIN kódu zdarma - Prověření vozidla v registru ČR</h1>
					<p className='lead'>
						Bezplatná kontrola vozidla v českém registru vozidel. Zkontrolujte
						VIN kód, číslo TP nebo ORV a získejte okamžitý přístup k technickým
						údajům, datu první registrace, platnosti STK a dalším důležitým
						informacím o vozidle.
					</p>
				</header>

				<section aria-labelledby='search-heading'>
					<h2 id='search-heading' className='visually-hidden'>
						Vyhledávání vozidla
					</h2>
					<p>
						Při koupi ojetého vozidla je nezbytné prověřit jeho historii a
						technický stav. Naše služba umožňuje zdarma zkontrolovat klíčové
						informace o vozidle přímo z oficiálního registru vozidel České
						republiky. Stačí zadat VIN kód (17 znaků), číslo TP (6-10 znaků)
						nebo číslo ORV (5-9 znaků) a během několika sekund získáte přístup k
						více než 90 údajům o vozidle.
					</p>

					{showSearch && (
						<div className='row mt-5' id='searchSection'>
							<div className='col-md-12 mb-4'>
								<div className='alert alert-info' role='alert'>
									<h3 className='h5 mb-2'>Jak zkontrolovat vozidlo?</h3>
									<p className='mb-2'>
										<strong>VIN kód</strong> je unikátní 17místný identifikátor
										vozidla (Vehicle Identification Number), který najdete na
										technickém průkazu nebo v motorovém prostoru vozidla.
									</p>
									<p className='mb-2'>
										<strong>Číslo TP</strong> (6-10 znaků) je číslo velkého
										technického průkazu vozidla, které je také unikátní
										identifikátor vozidla v České republice.
									</p>
									<p className='mb-0'>
										<strong>Číslo ORV</strong> (5-9 znaků) je číslo osvědčení o
										registraci vozidla, známé také jako "malý techničák". Tento
										identifikátor můžete použít pro kontrolu vozidla v registru.
									</p>
								</div>
							</div>

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
									placeholder='Např. WF0FXXWPCFHD05923'
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

							<div className='col-md-6 mt-5'>
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

							<div className='col-md-6 mt-5'>
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

							{error && (
								<div className='mt-4 mb-1'>
									<p className='text-danger'>{error}</p>
								</div>
							)}

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
						</div>
					)}

					{/* New Publisher Content Section for AdSense Approval */}
					<article className='mt-5 pt-4 border-top'>
						<div className='row justify-content-center'>
							<div className='col-lg-10'>
								<h2 className='mb-4'>
									Vše o kontrole VIN kódu a historii vozidla
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
									<h3 className='h4'>Často kladené dotazy (FAQ)</h3>

									<h4 className='h6 mt-4'>Je tato služba opravdu zdarma?</h4>
									<p>
										Ano, kontrola základních technických údajů z registru
										vozidel je na VIN Info.cz zcela zdarma. Neplatíte žádné
										poplatky za zobrazení dat o motoru, karoserii, STK a
										registraci.
									</p>

									<h4 className='h6 mt-3'>
										Zobrazí se i historie najetých kilometrů?
									</h4>
									<p>
										Základní registr vozidel obsahuje technické údaje, ale
										nikoliv historii nájezdu kilometrů z STK. Pro kontrolu
										tachometru doporučujeme využít specializované placené služby
										nebo stránky Ministerstva dopravy (kontrolatachometru.cz),
										kde je však potřeba znát i číslo protokolu poslední STK.
									</p>

									<h4 className='h6 mt-3'>Mohu zjistit majitele vozidla?</h4>
									<p>
										Ne. Z důvodu ochrany osobních údajů není možné veřejně
										zjistit jméno ani adresu vlastníka nebo provozovatele
										vozidla. Registr poskytuje pouze technická data o vozidle,
										nikoliv o jeho majiteli.
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
						<VehicleInfo data={vehicleData} vinCode={vinCode} />
					</section>
				)}
			</main>
			<Footer />
		</>
	)
}

export default HomePage
