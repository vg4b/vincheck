import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import VehicleInfo from '../components/VehicleInfo'
import { CebiaRemindersModal } from '../components/CebiaRemindersModal'
import { cebia } from '../config/affiliateCampaigns'
import { useAuth } from '../contexts/AuthContext'
import { VehicleDataArray } from '../types'
import { addVehicle, fetchVehicles } from '../utils/clientZoneApi'
import { ApiError } from '../utils/apiClient'
import { VehicleLookupError, fetchVehicleInfo, getDataValue } from '../utils/vehicleApi'

interface VehicleDetailPageProps {
	type?: 'vin' | 'tp' | 'orv'
}

const VehicleDetailPage: React.FC<VehicleDetailPageProps> = ({ type }) => {
	const params = useParams<{ code?: string }>()
	const navigate = useNavigate()
	const location = useLocation()
	const isVinDetailPath = location.pathname.startsWith('/vin/')
	const { user } = useAuth()
	const [vehicleData, setVehicleData] = useState<VehicleDataArray | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [willRedirectHome, setWillRedirectHome] = useState(false)
	const [saving, setSaving] = useState(false)
	const [saveMessage, setSaveMessage] = useState('')
	const [saveTitle, setSaveTitle] = useState('')
	const [isAlreadySaved, setIsAlreadySaved] = useState(false)
	const [checkingSaved, setCheckingSaved] = useState(false)
	const [vinPageCebiaRemindersModalOpen, setVinPageCebiaRemindersModalOpen] = useState(false)

	useEffect(() => {
		const controller = new AbortController()
		const { signal } = controller

		const loadVehicleData = async () => {
			// Get code from params
			const code = params.code

			if (!code) {
				navigate('/')
				return
			}

			// Reject known routes
			const knownRoutes = [
				'povinne-ruceni',
				'havarijni-pojisteni',
				'vin',
				'tp',
				'orv'
			]
			if (knownRoutes.includes(code.toLowerCase())) {
				navigate('/')
				return
			}

			// Clean the code (remove non-alphanumeric characters)
			const cleanCode = code.replace(/[^a-zA-Z0-9]/g, '')

			// Determine the search type (use prop or detect from code length for legacy routes)
			let searchType: 'vin' | 'tp' | 'orv'

			if (type) {
				// Explicit type from route (e.g., /vin/:code, /tp/:code, /orv/:code)
				searchType = type
			} else {
				// Legacy route - auto-detect type from code length
				if (cleanCode.length === 17) {
					searchType = 'vin'
				} else if (cleanCode.length >= 6 && cleanCode.length <= 10) {
					searchType = 'tp'
				} else if (cleanCode.length >= 5 && cleanCode.length <= 9) {
					searchType = 'orv'
				} else {
					// Invalid length, will fail validation below
					searchType = 'vin' // Default, but validation will catch it
				}
			}

			// Validate based on search type
			let isValid = false
			if (searchType === 'vin') {
				isValid = cleanCode.length === 17
			} else if (searchType === 'tp') {
				isValid = cleanCode.length >= 6 && cleanCode.length <= 10
			} else if (searchType === 'orv') {
				isValid = cleanCode.length >= 5 && cleanCode.length <= 9
			}

			if (!isValid) {
				navigate('/')
				return
			}

			setLoading(true)
			setError('')
			setWillRedirectHome(false)
			setSaveMessage('')

			try {
				const vinParam = searchType === 'vin' ? cleanCode : undefined
				const tpParam = searchType === 'tp' ? cleanCode : undefined
				const orvParam = searchType === 'orv' ? cleanCode : undefined

				const data = await fetchVehicleInfo(vinParam, tpParam, orvParam, {
					signal
				})
				setVehicleData(data)

				// Update page title
				const vinCode = getDataValue(data, 'VIN', cleanCode)
				const brand = getDataValue(data, 'TovarniZnacka', '')
				const model = getDataValue(data, 'Typ', '')
				document.title = `${brand} ${model} - ${vinCode} | VIN Info.cz`

				// Update meta description
				const metaDescription = document.querySelector(
					'meta[name="description"]'
				)
				if (metaDescription) {
					metaDescription.setAttribute(
						'content',
						`Informace o vozidle ${vinCode}: ${brand} ${model}. Zkontrolujte údaje o vozidle v českém registru vozidel zdarma.`
					)
				}
			} catch (err) {
				if (err instanceof DOMException && err.name === 'AbortError') {
					return
				}
				console.error('Chyba při načítání dat:', err)
				if (VehicleLookupError.isInstance(err)) {
					if (err.kind === 'server_error') {
						setWillRedirectHome(false)
						setError(
							'Registr dočasně neodpovídá. Zkuste stránku načíst znovu za chvíli.'
						)
						return
					}
					if (err.kind === 'unknown') {
						setWillRedirectHome(false)
						setError(err.message)
						return
					}
				}
				const errorMessage =
					searchType === 'vin'
						? 'Vozidlo s tímto VIN kódem nebylo nalezeno v registru.'
						: searchType === 'tp'
							? 'Vozidlo s tímto číslem TP nebylo nalezeno v registru.'
							: 'Vozidlo s tímto číslem ORV nebylo nalezeno v registru.'
				setWillRedirectHome(true)
				setError(errorMessage)
				setTimeout(() => {
					navigate('/')
				}, 2000)
			} finally {
				if (!signal.aborted) {
					setLoading(false)
				}
			}
		}

		loadVehicleData()
		return () => controller.abort()
	}, [params.code, type, navigate])

	useEffect(() => {
		if (vehicleData) {
			setSaveTitle('')
		}
	}, [vehicleData])

	// Check if vehicle is already saved when user is logged in
	useEffect(() => {
		const checkIfSaved = async () => {
			if (!user || !vehicleData) {
				setIsAlreadySaved(false)
				return
			}

			setCheckingSaved(true)
			try {
				const vehicles = await fetchVehicles()
				const vinValue = getDataValue(vehicleData, 'VIN', '').trim()
				const tpValue = getDataValue(vehicleData, 'CisloTp', '').trim()
				const orvValue = getDataValue(vehicleData, 'CisloOrv', '').trim()

				const isDuplicate = vehicles.some((vehicle) => {
					if (vinValue && vehicle.vin === vinValue) return true
					if (tpValue && vehicle.tp === tpValue) return true
					if (orvValue && vehicle.orv === orvValue) return true
					return false
				})

				setIsAlreadySaved(isDuplicate)
			} catch {
				// If check fails, allow saving attempt anyway
				setIsAlreadySaved(false)
			} finally {
				setCheckingSaved(false)
			}
		}

		checkIfSaved()
	}, [user, vehicleData])

	if (loading) {
		return (
			<>
				<Navigation />
				<div className='container mt-5'>
					<div className='text-center'>
						<div className='spinner-border' role='status'>
							<span className='visually-hidden'>Načítání...</span>
						</div>
						<p className='mt-3'>Načítání informací o vozidle...</p>
					</div>
				</div>
				<Footer />
			</>
		)
	}

	if (error || !vehicleData) {
		return (
			<>
				<Navigation />
				<div className='container mt-5'>
					<div
						className={
							willRedirectHome ? 'alert alert-warning' : 'alert alert-danger'
						}
						role='alert'
					>
						<h4 className='alert-heading'>
							{willRedirectHome ? 'Vozidlo nenalezeno' : 'Nelze načíst údaje'}
						</h4>
						<p className='mb-3'>{error || 'Vozidlo nebylo nalezeno.'}</p>
						{willRedirectHome ? (
							<p className='mb-0'>Za chvíli vás přesměrujeme na vyhledávání…</p>
						) : (
							<div className='d-flex flex-wrap gap-2'>
								<button
									type='button'
									className='btn btn-outline-danger'
									onClick={() => window.location.reload()}
								>
									Zkusit znovu
								</button>
								<Link to='/' className='btn btn-primary'>
									Zpět na vyhledávání
								</Link>
							</div>
						)}
					</div>
				</div>
				<Footer />
			</>
		)
	}

	const code = params.code || ''
	const vinCode = getDataValue(vehicleData, 'VIN', code)
	const brand = getDataValue(vehicleData, 'TovarniZnacka', '')
	const model = getDataValue(vehicleData, 'Typ', '')

	const cleanVinForCebia = vinCode.replace(/[^a-zA-Z0-9]/g, '')
	const cebiaVehicleDetailModalRetryUrl =
		cleanVinForCebia.length === 17
			? cebia.getTextLinkUrlWithVin(cleanVinForCebia, 'vehicle_detail_modal_reopen_cebia')
			: cebia.getTextLinkUrl('vehicle_detail_modal_reopen_cebia')

	const handleSaveVehicle = async () => {
		if (!user || !vehicleData) {
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
			setIsAlreadySaved(true)
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
			<div className='container mt-5'>
				<div className='mb-3'>
					<button
						type='button'
						className='btn btn-primary'
						onClick={() => navigate('/')}
					>
						← Vyhledat jiné vozidlo
					</button>
				</div>
				<VehicleInfo
					data={vehicleData}
					vinCode={vinCode}
					onCebiaExternalNavigate={
						!user && isVinDetailPath
							? () => setVinPageCebiaRemindersModalOpen(true)
							: undefined
					}
					saveAction={
						isAlreadySaved
							? {
									label: 'Už uloženo v Moje VINInfo',
									disabled: true,
									onClick: () => {},
									
								}
							: {
									label: user
										? saving
											? 'Ukládám...'
											: 'Uložit do Moje VINInfo'
										: 'Přihlásit se pro uložení',
									disabled: saving || checkingSaved,
									onClick: handleSaveVehicle
								}
					}
					saveMessage={saveMessage}
					promoSection={
						!user ? (
							<section
								className='mt-5 p-4 rounded'
								style={{ backgroundColor: '#c6dbad' }}
							>
								<div className='row align-items-center'>
									<div className='col-lg-8'>
										<h2 className='h4 mb-3'>
											Nechte se upozornit na důležité termíny
										</h2>
										<p className='mb-3'>
											Vytvořte si <strong>zdarma účet</strong> a uložte si toto vozidlo 
											do Moje VINInfo. Nastavte si upozornění a nikdy nezmeškejte:
										</p>
										<div className='row'>
											<div className='col-sm-6'>
												<ul className='list-unstyled mb-0'>
													<li className='mb-2'>🔧 Termín STK</li>
													<li className='mb-2'>🛡️ Povinné ručení</li>
													<li className='mb-2'>🚗 Havarijní pojištění</li>
												</ul>
											</div>
											<div className='col-sm-6'>
												<ul className='list-unstyled mb-0'>
													<li className='mb-2'>🔩 Servisní prohlídky</li>
													<li className='mb-2'>🛞 Přezutí pneumatik</li>
													<li className='mb-2'>🛣️ Dálniční známka</li>
												</ul>
											</div>
										</div>
										<p className='mt-3 mb-0'>
											<small className='text-muted'>
												📧 Pošleme vám email v termínu, který si zvolíte • ✨ 100% zdarma
											</small>
										</p>
									</div>
									<div className='col-lg-4 text-center mt-4 mt-lg-0'>
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
								</div>
							</section>
						) : isAlreadySaved ? (
							<section className='mt-5 p-4 bg-light rounded'>
								<div className='row align-items-center'>
									<div className='col-lg-8'>
										<h2 className='h5 mb-2'>
											✅ Toto vozidlo máte uložené v Moje VINInfo
										</h2>
										<p className='mb-0 text-muted'>
											Spravujte upozornění na STK, pojištění, servis a další termíny 
											přímo v klientské zóně.
										</p>
									</div>
									<div className='col-lg-4 text-center text-lg-end mt-3 mt-lg-0'>
										<a href='/klientska-zona' className='btn btn-outline-primary'>
											Přejít do Moje VINInfo
										</a>
									</div>
								</div>
							</section>
						) : (
							<section className='mt-5 p-4 bg-light rounded'>
								<div className='row align-items-center'>
									<div className='col-lg-8'>
										<h2 className='h5 mb-2'>
											💡 Uložte si vozidlo a nastavte upozornění
										</h2>
										<p className='mb-0 text-muted'>
											V Moje VINInfo si můžete nastavit upozornění na STK, pojištění, 
											servis a další termíny. Pošleme vám email v termínu, který si zvolíte.
										</p>
									</div>
									<div className='col-lg-4 text-center text-lg-end mt-3 mt-lg-0'>
										<button
											type='button'
											className='btn btn-primary'
											onClick={handleSaveVehicle}
											disabled={saving || checkingSaved}
										>
											{saving ? 'Ukládám...' : 'Uložit do Moje VINInfo'}
										</button>
									</div>
								</div>
							</section>
						)
					}
				/>
			</div>
			<CebiaRemindersModal
				open={vinPageCebiaRemindersModalOpen}
				onClose={() => setVinPageCebiaRemindersModalOpen(false)}
				user={user}
				cebiaRetryUrl={cebiaVehicleDetailModalRetryUrl}
				intro='vehicle_detail'
			/>
			<Footer />
		</>
	)
}

export default VehicleDetailPage
