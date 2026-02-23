import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import { useAuth } from '../contexts/AuthContext'
import { ClientVehicle, Reminder, ReminderType, VehicleDataArray } from '../types'
import {
	createReminder,
	deleteReminder,
	deleteVehicle,
	fetchReminders,
	fetchVehicles,
	updateReminder,
	addVehicle,
	updateVehicleTitle,
	fetchPreferences,
	updatePreferences,
	UserPreferences
} from '../utils/clientZoneApi'
import { ApiError } from '../utils/apiClient'
import { fetchVehicleInfo, formatValue, getDataValue } from '../utils/vehicleApi'
import { cebia, csob, pojisteni } from '../config/affiliateCampaigns'

const reminderTypeLabels: Record<ReminderType, string> = {
	stk: 'Termín STK',
	povinne_ruceni: 'Povinné ručení',
	havarijni_pojisteni: 'Havarijní pojištění',
	servis: 'Servisní prohlídka',
	prezuti_pneu: 'Přezutí pneu',
	dalnicni_znamka: 'Dálniční známka',
	jine: 'Jiné'
}
const NOTE_MAX_LENGTH = 200
const TITLE_MAX_LENGTH = 60

const formatDate = (value: string) => {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) {
		return value
	}
	return date.toLocaleDateString('cs-CZ')
}

const parseSnapshot = (snapshot: unknown): VehicleDataArray | null => {
	if (Array.isArray(snapshot)) {
		return snapshot as VehicleDataArray
	}
	if (typeof snapshot === 'string') {
		try {
			const parsed = JSON.parse(snapshot)
			return Array.isArray(parsed) ? (parsed as VehicleDataArray) : null
		} catch {
			return null
		}
	}
	return null
}

const zoneTitle = 'Moje VINInfo'

type ZoneTab = 'vehicles' | 'alerts' | 'benefits' | 'settings'

const VehicleCardSkeleton: React.FC = () => (
	<div className='col-12 col-lg-6'>
		<div className='card h-100 shadow-sm'>
			<div className='card-body'>
				<div className='d-flex align-items-start justify-content-between'>
					<div className='flex-grow-1'>
						<div className='placeholder-glow'>
							<span className='placeholder col-7 h5'></span>
						</div>
						<div className='placeholder-glow mt-2'>
							<span className='placeholder col-5'></span>
						</div>
						<div className='placeholder-glow mt-2'>
							<span className='placeholder col-4'></span>
						</div>
						<div className='placeholder-glow mt-2'>
							<span className='placeholder col-6'></span>
						</div>
					</div>
					<div className='btn-group'>
						<div className='placeholder-glow'>
							<span className='placeholder btn btn-sm' style={{ width: '115px', height: '31px', display: 'inline-block' }}></span>
						</div>
						<div className='placeholder-glow'>
							<span className='placeholder btn btn-sm' style={{ width: '70px', height: '31px', display: 'inline-block' }}></span>
						</div>
					</div>
				</div>
				<div className='mt-3'>
					<div className='placeholder-glow'>
						<span className='placeholder col-3 h6'></span>
					</div>
					<div className='placeholder-glow mt-2'>
						<span className='placeholder col-8'></span>
					</div>
				</div>
			</div>
		</div>
	</div>
)

const ClientZonePage: React.FC = () => {
	const navigate = useNavigate()
	const { user, loading: authLoading, logout, verifyEmail, resendVerification } = useAuth()
	const [vehicles, setVehicles] = useState<ClientVehicle[]>([])
	const [reminders, setReminders] = useState<Reminder[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [activeTab, setActiveTab] = useState<ZoneTab>('vehicles')
	const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({})
	const [titleSavingId, setTitleSavingId] = useState<string | null>(null)
	const [titleError, setTitleError] = useState<Record<string, string>>({})
	const [titleEditingId, setTitleEditingId] = useState<string | null>(null)
	const [preferences, setPreferences] = useState<UserPreferences | null>(null)
	const [preferencesLoading, setPreferencesLoading] = useState(false)
	const [preferencesSaving, setPreferencesSaving] = useState(false)
	const [preferencesError, setPreferencesError] = useState('')
	const [preferencesSuccess, setPreferencesSuccess] = useState('')
	// Email verification state
	const [verificationCode, setVerificationCode] = useState('')
	const [verificationLoading, setVerificationLoading] = useState(false)
	const [verificationError, setVerificationError] = useState('')
	const [resendLoading, setResendLoading] = useState(false)
	const [resendSuccess, setResendSuccess] = useState(false)
	const loadRef = useRef<{ userId: string | null; inFlight: boolean }>({
		userId: null,
		inFlight: false
	})

	const remindersByVehicle = useMemo(() => {
		return reminders.reduce<Record<string, Reminder[]>>((acc, reminder) => {
			const list = acc[reminder.vehicle_id] ?? []
			list.push(reminder)
			acc[reminder.vehicle_id] = list
			return acc
		}, {})
	}, [reminders])

	const upcomingReminders = useMemo(() => {
		return [...reminders].sort((a, b) =>
			a.due_date.localeCompare(b.due_date)
		)
	}, [reminders])

	const loadData = async () => {
		if (loadRef.current.inFlight) {
			return
		}
		loadRef.current.inFlight = true
		setLoading(true)
		setError('')
		try {
			const [vehicleData, reminderData] = await Promise.all([
				fetchVehicles(),
				fetchReminders()
			])
			setVehicles(vehicleData)
			setReminders(reminderData)
		} catch (error) {
			if (error instanceof ApiError) {
				setError(error.message)
			} else {
				setError('Nepodařilo se načíst data Moje VINInfo.')
			}
		} finally {
			setLoading(false)
			loadRef.current.inFlight = false
		}
	}

	useEffect(() => {
		if (!authLoading && !user) {
			navigate('/prihlaseni')
			return
		}
		if (user) {
			if (loadRef.current.userId === user.id) {
				return
			}
			loadRef.current.userId = user.id
			loadData()
		}
	}, [authLoading, user, navigate])

	const handleAddReminder = async (
		vehicleId: string,
		type: ReminderType,
		dueDate: string,
		note: string,
		emailEnabled: boolean,
		emailSendAt: string | null
	) => {
		const reminder = await createReminder({
			vehicleId,
			type,
			dueDate,
			note,
			emailEnabled,
			emailSendAt: emailSendAt || undefined
		})
		setReminders((prev) => [...prev, reminder])
	}

	const loadPreferences = async () => {
		setPreferencesLoading(true)
		setPreferencesError('')
		try {
			const prefs = await fetchPreferences()
			setPreferences(prefs)
		} catch (err) {
			if (err instanceof ApiError) {
				setPreferencesError(err.message)
			} else {
				setPreferencesError('Nepodařilo se načíst nastavení.')
			}
		} finally {
			setPreferencesLoading(false)
		}
	}

	const handleSavePreferences = async () => {
		if (!preferences) return
		setPreferencesSaving(true)
		setPreferencesError('')
		setPreferencesSuccess('')
		try {
			const updated = await updatePreferences({
				notificationsEnabled: preferences.notifications_enabled,
				marketingEnabled: preferences.marketing_enabled
			})
			setPreferences(updated)
			setPreferencesSuccess('Nastavení bylo uloženo.')
		} catch (err) {
			if (err instanceof ApiError) {
				setPreferencesError(err.message)
			} else {
				setPreferencesError('Nepodařilo se uložit nastavení.')
			}
		} finally {
			setPreferencesSaving(false)
		}
	}

	// Load preferences on mount (needed for reminders tab warning and settings tab)
	useEffect(() => {
		if (!preferences && !preferencesLoading) {
			loadPreferences()
		}
	}, [preferences, preferencesLoading])

	const handleAddVehicle = async (payload: {
		vin?: string
		tp?: string
		orv?: string
		title?: string
		brand?: string
		model?: string
		snapshot?: VehicleDataArray
	}) => {
		try {
			const vehicle = await addVehicle(payload)
			setVehicles((prev) => [vehicle, ...prev])
		} catch (error) {
			if (error instanceof ApiError && error.status === 409) {
				throw new Error('Vozidlo už je uložené.')
			}
			throw error
		}
	}

	const handleToggleReminder = async (reminder: Reminder) => {
		const newIsDone = !reminder.is_done
		const updated = await updateReminder({
			id: reminder.id,
			isDone: newIsDone,
			// Disable email reminder when marking as done
			...(newIsDone && { emailEnabled: false })
		})
		setReminders((prev) =>
			prev.map((item) => (item.id === updated.id ? updated : item))
		)
	}

	const handleToggleEmailReminder = async (reminder: Reminder) => {
		const updated = await updateReminder({
			id: reminder.id,
			emailEnabled: !reminder.email_enabled
		})
		setReminders((prev) =>
			prev.map((item) => (item.id === updated.id ? updated : item))
		)
	}

	const handleDeleteReminder = async (reminderId: string) => {
		await deleteReminder(reminderId)
		setReminders((prev) => prev.filter((item) => item.id !== reminderId))
	}

	const handleDeleteVehicle = async (vehicleId: string) => {
		await deleteVehicle(vehicleId)
		setVehicles((prev) => prev.filter((item) => item.id !== vehicleId))
		setReminders((prev) => prev.filter((item) => item.vehicle_id !== vehicleId))
	}

	const handleTitleChange = (vehicleId: string, value: string) => {
		setTitleDrafts((prev) => ({ ...prev, [vehicleId]: value }))
		setTitleError((prev) => ({ ...prev, [vehicleId]: '' }))
	}

	const handleStartEditTitle = (vehicle: ClientVehicle) => {
		setTitleEditingId(vehicle.id)
		setTitleDrafts((prev) => ({
			...prev,
			[vehicle.id]: prev[vehicle.id] ?? vehicle.title ?? ''
		}))
		setTitleError((prev) => ({ ...prev, [vehicle.id]: '' }))
	}

	const handleCancelEditTitle = (vehicleId: string) => {
		setTitleEditingId((current) => (current === vehicleId ? null : current))
		setTitleError((prev) => ({ ...prev, [vehicleId]: '' }))
	}

	const handleSaveTitle = async (vehicle: ClientVehicle) => {
		const draft = titleDrafts[vehicle.id] ?? vehicle.title ?? ''
		const trimmed = draft.trim()
		const nextTitle = trimmed.length > 0 ? trimmed.slice(0, TITLE_MAX_LENGTH) : null

		setTitleSavingId(vehicle.id)
		setTitleError((prev) => ({ ...prev, [vehicle.id]: '' }))
		try {
			const updated = await updateVehicleTitle(vehicle.id, nextTitle)
			setVehicles((prev) =>
				prev.map((item) => (item.id === updated.id ? updated : item))
			)
			setTitleDrafts((prev) => ({ ...prev, [vehicle.id]: updated.title ?? '' }))
			setTitleEditingId((current) =>
				current === vehicle.id ? null : current
			)
		} catch {
			setTitleError((prev) => ({
				...prev,
				[vehicle.id]: 'Nepodařilo se uložit název.'
			}))
		} finally {
			setTitleSavingId(null)
		}
	}

	const handleLogout = async () => {
		await logout()
		navigate('/')
	}

	const handleVerifyEmail = async (event: React.FormEvent) => {
		event.preventDefault()
		setVerificationError('')

		if (verificationCode.length !== 6) {
			setVerificationError('Zadejte 6místný ověřovací kód.')
			return
		}

		setVerificationLoading(true)
		try {
			await verifyEmail(verificationCode)
			setVerificationCode('')
		} catch (err) {
			if (err instanceof ApiError) {
				setVerificationError(err.message)
			} else {
				setVerificationError('Nepodařilo se ověřit email. Zkontrolujte kód a zkuste to znovu.')
			}
		} finally {
			setVerificationLoading(false)
		}
	}

	const handleResendVerification = async () => {
		setResendLoading(true)
		setResendSuccess(false)
		setVerificationError('')

		try {
			await resendVerification()
			setResendSuccess(true)
		} catch (err) {
			if (err instanceof ApiError) {
				setVerificationError(err.message)
			} else {
				setVerificationError('Nepodařilo se odeslat nový kód.')
			}
		} finally {
			setResendLoading(false)
		}
	}

	if (authLoading || loading) {
		return (
			<div className='d-flex flex-column min-vh-100'>
				<Navigation />
				<main className='container mt-5 flex-grow-1 pb-4'>
					<div className='d-flex flex-wrap align-items-center justify-content-between'>
						<div>
							<div className='placeholder-glow'>
								<span className='placeholder col-4 h1'></span>
							</div>
							<div className='placeholder-glow mt-2'>
								<span className='placeholder col-6'></span>
							</div>
						</div>
						<div className='placeholder-glow'>
							<span className='placeholder' style={{ width: '110px', height: '38px', display: 'inline-block' }}></span>
						</div>
					</div>

					<nav className='mt-4'>
						<ul className='nav nav-tabs'>
							<li className='nav-item'>
								<div className='placeholder-glow'>
									<span className='placeholder nav-link' style={{ width: '120px', height: '38px', display: 'inline-block' }}></span>
								</div>
							</li>
							<li className='nav-item'>
								<div className='placeholder-glow'>
									<span className='placeholder nav-link' style={{ width: '140px', height: '38px', display: 'inline-block' }}></span>
								</div>
							</li>
							<li className='nav-item'>
								<div className='placeholder-glow'>
									<span className='placeholder nav-link' style={{ width: '110px', height: '38px', display: 'inline-block' }}></span>
								</div>
							</li>
							<li className='nav-item'>
								<div className='placeholder-glow'>
									<span className='placeholder nav-link' style={{ width: '100px', height: '38px', display: 'inline-block' }}></span>
								</div>
							</li>
						</ul>
					</nav>

					<section className='mt-4'>
						<div className='placeholder-glow'>
							<span className='placeholder col-3 h4'></span>
						</div>
						<div className='placeholder-glow mt-2'>
							<span className='placeholder col-8'></span>
						</div>
						<div className='border rounded p-3 mb-4 mt-3'>
							<div className='placeholder-glow'>
								<span className='placeholder col-2 h6'></span>
							</div>
							<div className='row g-2 mt-2'>
								<div className='col-md-8'>
									<div className='placeholder-glow'>
										<span className='placeholder col-12 form-control'></span>
									</div>
								</div>
								<div className='col-md-4'>
									<div className='placeholder-glow'>
										<span className='placeholder col-12 btn'></span>
									</div>
								</div>
							</div>
						</div>
						<div className='row g-4 mt-1'>
							<VehicleCardSkeleton />
							<VehicleCardSkeleton />
						</div>
					</section>
				</main>
				<Footer />
			</div>
		)
	}

	return (
		<div className='d-flex flex-column min-vh-100'>
			<Navigation />
			<main className='container mt-5 flex-grow-1 pb-4'>
				<div className='d-flex flex-wrap align-items-center justify-content-between'>
					<div>
						<h1>{zoneTitle}</h1>
						<p className='text-muted mb-0'>Přihlášen: {user?.email}</p>
					</div>
					<button type='button' className='btn btn-outline-secondary' onClick={handleLogout}>
						Odhlásit se
					</button>
				</div>

				{error && (
					<div className='alert alert-danger mt-4' role='alert'>
						{error}
					</div>
				)}

				{user && !user.email_verified_at && (
					<div className='card mt-4 border-warning'>
						<div className='card-body'>
							<h5 className='card-title text-warning'>Ověřte svůj email</h5>
							<p className='card-text'>
								Pro příjem emailových upozornění musíte nejprve ověřit svou emailovou adresu.
								Zadejte 6místný kód, který jsme vám poslali na <strong>{user.email}</strong>.
							</p>
							<form onSubmit={handleVerifyEmail} className='d-flex gap-2 align-items-end flex-wrap'>
								<div>
									<label htmlFor='verificationCode' className='form-label'>Ověřovací kód</label>
									<input
										id='verificationCode'
										type='text'
										className='form-control'
										value={verificationCode}
										onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
										placeholder='000000'
										maxLength={6}
										style={{ width: '120px' }}
									/>
								</div>
								<button
									type='submit'
									className='btn btn-warning'
									disabled={verificationLoading}
								>
									{verificationLoading ? 'Ověřuji...' : 'Ověřit'}
								</button>
								<button
									type='button'
									className='btn btn-outline-secondary'
									onClick={handleResendVerification}
									disabled={resendLoading}
								>
									{resendLoading ? 'Odesílám...' : 'Poslat znovu'}
								</button>
							</form>
							{verificationError && (
								<div className='alert alert-danger mt-3 mb-0' role='alert'>
									{verificationError}
								</div>
							)}
							{resendSuccess && (
								<div className='alert alert-success mt-3 mb-0' role='alert'>
									Nový ověřovací kód byl odeslán na váš email.
								</div>
							)}
						</div>
					</div>
				)}

				<nav className='mt-4'>
					<ul className='nav nav-tabs'>
						<li className='nav-item'>
							<button
								type='button'
								className={`nav-link ${activeTab === 'vehicles' ? 'active' : ''}`}
								onClick={() => setActiveTab('vehicles')}
							>
								Moje vozidla
							</button>
						</li>
						<li className='nav-item'>
							<button
								type='button'
								className={`nav-link ${activeTab === 'alerts' ? 'active' : ''}`}
								onClick={() => setActiveTab('alerts')}
							>
								Moje upozornění
							</button>
						</li>
						<li className='nav-item'>
							<button
								type='button'
								className={`nav-link ${activeTab === 'benefits' ? 'active' : ''}`}
								onClick={() => setActiveTab('benefits')}
							>
								Moje výhody
							</button>
						</li>
						<li className='nav-item'>
							<button
								type='button'
								className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
								onClick={() => setActiveTab('settings')}
							>
								Nastavení
							</button>
						</li>
					</ul>
				</nav>

				{activeTab === 'vehicles' && (
					<section className='mt-4'>
						<h2 className='h4'>Uložená vozidla</h2>
						<p className='text-muted'>
							Vozidlo můžete přidat ručně nebo z výsledků vyhledávání.
						</p>
						<AddVehicleForm onAdd={handleAddVehicle} />
						{vehicles.length === 0 && (
							<div className='alert alert-info mt-4'>
								Zatím nemáte žádné uložené vozidlo.
							</div>
						)}

						<div className='row g-4 mt-1'>
						{vehicles.map((vehicle) => {
								const vehicleReminders = remindersByVehicle[vehicle.id] ?? []
							const snapshotData = parseSnapshot(vehicle.snapshot)
							const techInspectionRaw = snapshotData
								? getDataValue(
										snapshotData,
										'PravidelnaTechnickaProhlidkaDo',
										'Neznámé datum'
									)
								: 'Neznámé datum'
							const techInspection = formatValue(techInspectionRaw)

							// Parse and check tech inspection date
							const currentDate = new Date()
							let techInspectionDate: Date | null = null
							if (techInspectionRaw && techInspectionRaw !== 'Neznámé datum') {
								// Try to parse ISO date format first
								const isoDateRegex = /^(\d{4})-(\d{2})-(\d{2})(T.*)?$/
								const isoMatch = techInspectionRaw.match(isoDateRegex)
								if (isoMatch) {
									const year = isoMatch[1]
									const month = isoMatch[2]
									const day = isoMatch[3]
									techInspectionDate = new Date(`${year}-${month}-${day}`)
								} else {
									// Fall back to Czech format (d.m.yyyy)
									const [day, month, year] = techInspectionRaw.split('.')
									if (day && month && year) {
										techInspectionDate = new Date(`${year}-${month}-${day}`)
									}
								}
							}

							const isExpired =
								techInspectionDate && techInspectionDate.getTime() < currentDate.getTime()
							const techInspectionColor = isExpired ? 'red' : 'green'
								return (
									<div key={vehicle.id} className='col-12 col-lg-6'>
										<div className='card h-100 shadow-sm'>
											<div className='card-body'>
												<div className='d-flex align-items-start justify-content-between'>
													<div>
													<h3 className='h5'>
														{vehicle.title?.trim()
															? vehicle.title
															: `${vehicle.brand ?? 'Neznámá značka'} ${vehicle.model ?? ''}`.trim()}
													</h3>
													{titleEditingId === vehicle.id && (
													<div className='mt-3'>
														<label className='form-label'>Název vozidla</label>
														<div className='input-group'>
															<input
																type='text'
																className='form-control'
																value={
																	titleDrafts[vehicle.id] ?? vehicle.title ?? ''
																}
																onChange={(event) =>
																	handleTitleChange(
																		vehicle.id,
																		event.target.value
																	)
																}
																placeholder='Např. Rodinný Golf'
																maxLength={TITLE_MAX_LENGTH}
															/>
															<button
																type='button'
																className='btn btn-outline-primary'
																onClick={() => handleSaveTitle(vehicle)}
																disabled={titleSavingId === vehicle.id}
															>
																{titleSavingId === vehicle.id
																	? 'Ukládám...'
																	: 'Uložit'}
															</button>
															<button
																type='button'
																className='btn btn-outline-secondary'
																onClick={() => handleCancelEditTitle(vehicle.id)}
																disabled={titleSavingId === vehicle.id}
															>
																Zrušit
															</button>
														</div>
														{titleError[vehicle.id] && (
															<div className='text-danger small mt-1'>
																{titleError[vehicle.id]}
															</div>
														)}
													</div>
												)}
													{vehicle.title && (
														<p className='mb-1 text-muted'>
															{vehicle.brand ?? 'Neznámá značka'}{' '}
															{vehicle.model ?? ''}
														</p>
													)}
														<p className='mb-1 text-muted'>
															VIN: {vehicle.vin ?? 'N/A'}
														</p>
														{vehicle.tp && (
															<p className='mb-1 text-muted'>TP: {vehicle.tp}</p>
														)}
													{vehicle.orv && (
														<p className='mb-1 text-muted'>ORV: {vehicle.orv}</p>
													)}
													<p className='mb-1 text-muted'>
														STK do:{' '}
														<span style={{ color: techInspectionColor }}>
															{techInspection}
														</span>
													</p>
													<div className='mt-2'>
														<a
															href={cebia.getDirectUrl(vehicle.vin ?? undefined)}
															target='_blank'
															rel='noopener noreferrer'
															className='link-primary'
														>
															Prověřit historii vozidla ➜
														</a>
													</div>
													</div>
													<div className='btn-group'>
														<button
															type='button'
															className='btn btn-outline-primary btn-sm'
															onClick={() => handleStartEditTitle(vehicle)}
														>
															Upravit název
														</button>
														<button
															type='button'
															className='btn btn-outline-danger btn-sm'
															onClick={() => handleDeleteVehicle(vehicle.id)}
														>
															Odebrat
														</button>
													</div>
												</div>
												{/* {titleEditingId === vehicle.id && (
													<div className='mt-3'>
														<label className='form-label'>Název vozidla</label>
														<div className='input-group'>
															<input
																type='text'
																className='form-control'
																value={
																	titleDrafts[vehicle.id] ?? vehicle.title ?? ''
																}
																onChange={(event) =>
																	handleTitleChange(
																		vehicle.id,
																		event.target.value
																	)
																}
																placeholder='Např. Rodinný Golf'
																maxLength={TITLE_MAX_LENGTH}
															/>
															<button
																type='button'
																className='btn btn-outline-primary'
																onClick={() => handleSaveTitle(vehicle)}
																disabled={titleSavingId === vehicle.id}
															>
																{titleSavingId === vehicle.id
																	? 'Ukládám...'
																	: 'Uložit'}
															</button>
															<button
																type='button'
																className='btn btn-outline-secondary'
																onClick={() => handleCancelEditTitle(vehicle.id)}
																disabled={titleSavingId === vehicle.id}
															>
																Zrušit
															</button>
														</div>
														{titleError[vehicle.id] && (
															<div className='text-danger small mt-1'>
																{titleError[vehicle.id]}
															</div>
														)}
													</div>
												)} */}

												<div className='mt-3'>
													<h4 className='h6'>Upozornění</h4>
													{vehicleReminders.length === 0 ? (
														<p className='text-muted'>
															Zatím nemáte žádná upozornění.
														</p>
													) : (
														<ul className='list-group mb-3'>
															{vehicleReminders.map((reminder) => (
																<li
																	key={reminder.id}
																	className='list-group-item d-flex align-items-center justify-content-between'
																>
																	<div>
																		<div className='fw-semibold'>
																			{reminderTypeLabels[reminder.type]}
																		</div>
																		<div className='text-muted'>
																			{formatDate(reminder.due_date)}
																			{reminder.note ? ` • ${reminder.note}` : ''}
																		</div>
																	</div>
																	<div className='btn-group'>
																		<button
																			type='button'
																			className={`btn btn-sm ${reminder.is_done ? 'btn-success' : 'btn-outline-success'}`}
																			onClick={() => handleToggleReminder(reminder)}
																		>
																			{reminder.is_done ? 'Splněno' : 'Označit splněno'}
																		</button>
																		<button
																			type='button'
																			className='btn btn-sm btn-outline-danger'
																			onClick={() => handleDeleteReminder(reminder.id)}
																		>
																			Smazat
																		</button>
																	</div>
																</li>
															))}
														</ul>
													)}
													<ReminderForm
														vehicleId={vehicle.id}
														onAdd={handleAddReminder}
													/>
												</div>
											</div>
										</div>
									</div>
								)
							})}
						</div>
					</section>
				)}

				{activeTab === 'alerts' && (
					<section className='mt-4'>
						<h2 className='h4'>Moje upozornění</h2>
						{upcomingReminders.length === 0 ? (
							<div className='alert alert-info'>
								Zatím nemáte žádná upozornění.
							</div>
						) : (
							<ul className='list-group'>
								{upcomingReminders.map((reminder) => (
									<li
										key={reminder.id}
										className='list-group-item'
									>
										<div className='d-flex align-items-center justify-content-between'>
											<div>
												<div className='fw-semibold'>
													{reminderTypeLabels[reminder.type]}
												</div>
												<div className='text-muted'>
													{formatDate(reminder.due_date)}
													{reminder.note ? ` • ${reminder.note}` : ''}
												</div>
											</div>
											<div className='btn-group'>
												<button
													type='button'
													className={`btn btn-sm ${reminder.is_done ? 'btn-success' : 'btn-outline-success'}`}
													onClick={() => handleToggleReminder(reminder)}
												>
													{reminder.is_done ? 'Splněno' : 'Označit splněno'}
												</button>
												<button
													type='button'
													className='btn btn-sm btn-outline-danger'
													onClick={() => handleDeleteReminder(reminder.id)}
												>
													Smazat
												</button>
											</div>
										</div>
										<div className='mt-2 d-flex align-items-center'>
											<div className='form-check form-switch mb-0'>
												<input
													type='checkbox'
													className='form-check-input'
													id={`emailToggle-${reminder.id}`}
													checked={reminder.email_enabled ?? true}
													onChange={() => handleToggleEmailReminder(reminder)}
												/>
												<label
													className='form-check-label text-muted small'
													htmlFor={`emailToggle-${reminder.id}`}
												>
													Emailové upozornění {reminder.email_enabled ? 'zapnuto' : 'vypnuto'}
													{reminder.email_enabled && reminder.email_send_at && (
														<> • odeslání: {formatDate(reminder.email_send_at)}</>
													)}
													{reminder.email_enabled && preferences && !preferences.notifications_enabled && (
														<span className='text-warning ms-2' title='Globální notifikace jsou vypnuté v Nastavení'><br/> 
															⚠️ Notifikační emaily jsou vypnuté v Nastavení
														</span>
													)}
												</label>
											</div>
										</div>
									</li>
								))}
							</ul>
						)}
					</section>
				)}

				{activeTab === 'benefits' && (
					<section className='mt-4'>
						<h2 className='h4'>Moje výhody</h2>
						<p className='text-muted'>
							Doporučené služby pro vaše vozidla.
						</p>

						<div className='row g-4'>
							<div className='col-md-6'>
								<div className='card h-100'>
									<div className='card-body'>
										<h5 className='card-title'>Prověření historie vozidla</h5>
										<p className='card-text text-muted'>
											Zjistěte kompletní historii vozidla - havárie, servisní záznamy, 
											stav tachometru a další důležité informace.
										</p>
										<a
											href={cebia.getTextLinkUrl()}
											target='_blank'
											rel='noopener noreferrer'
											className='btn btn-outline-primary'
										>
											Prověřit na Cebia.cz
										</a>
									</div>
								</div>
							</div>

							<div className='col-md-6'>
								<div className='card h-100'>
									<div className='card-body'>
										<h5 className='card-title'>Srovnání pojištění</h5>
										<p className='card-text text-muted'>
											{pojisteni.getProvider(pojisteni.defaultProviderId).tagline}.
											{' '}Srovnejte nabídky od všech pojišťoven a najděte nejvýhodnější 
											povinné ručení i havarijní pojištění.
										</p>
										<a
											href={pojisteni.getUrl()}
											target='_blank'
											rel='noopener noreferrer'
											className='btn btn-outline-primary'
										>
											Srovnat na Pojisteni.cz
										</a>
									</div>
								</div>
							</div>

							{csob.getValidCoupons().length > 0 && (
								<div className='col-12'>
									<div className='card'>
										<div className='card-body'>
											<h5 className='card-title'>CSOB Pojišťovna – akční nabídky</h5>
											<p className='card-text text-muted'>
												{csob.tagline}. Aktuální slevy a dárky:
											</p>
											<div className='d-flex flex-wrap gap-2'>
												{csob.getValidCoupons().map(({ id, shortLabel }) => (
													<a
														key={id}
														href={csob.getCouponUrl(id)}
														target='_blank'
														rel='noopener noreferrer'
														className='btn btn-outline-success btn-sm'
													>
														{shortLabel}
													</a>
												))}
											</div>
										</div>
									</div>
								</div>
							)}
						</div>

						{vehicles.length > 0 && (
							<div className='mt-4'>
								<h5>Rychlé odkazy pro vaše vozidla</h5>
								<div className='list-group'>
									{vehicles.map((vehicle) => {
										const vehicleName = vehicle.title?.trim()
											|| `${vehicle.brand || 'Vozidlo'} ${vehicle.model || ''}`.trim()
										return (
											<div key={vehicle.id} className='list-group-item'>
												<div className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
													<span className='fw-semibold'>{vehicleName}</span>
													<div className='d-flex gap-2 flex-wrap'>
														{vehicle.vin && (
															<a
																href={cebia.getDirectUrl(vehicle.vin)}
																target='_blank'
																rel='noopener noreferrer'
																className='btn btn-sm btn-outline-secondary'
															>
																Prověřit historii
															</a>
														)}
														<a
															href={pojisteni.getUrl()}
															target='_blank'
															rel='noopener noreferrer'
															className='btn btn-sm btn-outline-secondary'
														>
															Srovnat pojištění
														</a>
													</div>
												</div>
											</div>
										)
									})}
								</div>
							</div>
						)}
					</section>
				)}

				{activeTab === 'settings' && (
					<section className='mt-4'>
						<h2 className='h4'>Nastavení</h2>
						<p className='text-muted'>
							Spravujte své preference pro emailová upozornění.
						</p>

						{!user?.email_verified_at && (
							<div className='alert alert-warning'>
								<strong>Email není ověřen.</strong> Pro příjem emailových upozornění musíte nejprve ověřit svůj email.
							</div>
						)}

						{preferencesLoading ? (
							<div className='placeholder-glow'>
								<div className='card'>
									<div className='card-body'>
										<span className='placeholder col-4 h5 d-block mb-3'></span>
										<span className='placeholder col-8 d-block mb-2'></span>
										<span className='placeholder col-8 d-block mb-3'></span>
										<span className='placeholder col-3 btn'></span>
									</div>
								</div>
							</div>
						) : preferences ? (
							<div className='card'>
								<div className='card-body'>
									<h3 className='h5'>Emailové preference</h3>
									<div className='form-check mb-3'>
										<input
											type='checkbox'
											className='form-check-input'
											id='notificationsEnabled'
											checked={preferences.notifications_enabled}
											onChange={(e) => setPreferences({
												...preferences,
												notifications_enabled: e.target.checked
											})}
										/>
										<label className='form-check-label' htmlFor='notificationsEnabled'>
											<strong>Notifikační emaily</strong>
											<div className='text-muted small'>
												Upozornění na blížící se termíny STK, pojištění, servisu a další.
											</div>
										</label>
									</div>
									<div className='form-check mb-3'>
										<input
											type='checkbox'
											className='form-check-input'
											id='marketingEnabled'
											checked={preferences.marketing_enabled}
											onChange={(e) => setPreferences({
												...preferences,
												marketing_enabled: e.target.checked
											})}
										/>
										<label className='form-check-label' htmlFor='marketingEnabled'>
											<strong>Marketingové emaily</strong>
											<div className='text-muted small'>
												Informace o novinkách, akcích a partnerských nabídkách.
											</div>
										</label>
									</div>

									{preferencesError && (
										<div className='alert alert-danger' role='alert'>
											{preferencesError}
										</div>
									)}
									{preferencesSuccess && (
										<div className='alert alert-success' role='alert'>
											{preferencesSuccess}
										</div>
									)}

									<button
										type='button'
										className='btn btn-primary'
										onClick={handleSavePreferences}
										disabled={preferencesSaving}
									>
										{preferencesSaving ? 'Ukládám...' : 'Uložit nastavení'}
									</button>
								</div>
							</div>
						) : preferencesError ? (
							<div className='alert alert-danger'>
								{preferencesError}
								<button
									type='button'
									className='btn btn-link'
									onClick={loadPreferences}
								>
									Zkusit znovu
								</button>
							</div>
						) : null}
					</section>
				)}
			</main>
			<Footer />
		</div>
	)
}

const ReminderForm: React.FC<{
	vehicleId: string
	onAdd: (
		vehicleId: string,
		type: ReminderType,
		dueDate: string,
		note: string,
		emailEnabled: boolean,
		emailSendAt: string | null
	) => Promise<void>
}> = ({ vehicleId, onAdd }) => {
	const [type, setType] = useState<ReminderType>('stk')
	const [dueDate, setDueDate] = useState('')
	const [note, setNote] = useState('')
	const [emailEnabled, setEmailEnabled] = useState(true)
	const [emailSendAt, setEmailSendAt] = useState('')
	const [useCustomEmailDate, setUseCustomEmailDate] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState('')

	// Calculate default email send date (1 day before due date)
	const getDefaultEmailSendDate = (dueDateStr: string): string => {
		if (!dueDateStr) return ''
		const date = new Date(dueDateStr)
		date.setDate(date.getDate() - 1)
		return date.toISOString().split('T')[0]
	}

	// Get today's date in YYYY-MM-DD format for validation
	const today = new Date().toISOString().split('T')[0]
	// Get tomorrow's date for min attribute (earliest allowed date)
	const tomorrowDate = new Date()
	tomorrowDate.setDate(tomorrowDate.getDate() + 1)
	const tomorrow = tomorrowDate.toISOString().split('T')[0]

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setError('')

		if (!dueDate) {
			setError('Vyberte datum upozornění.')
			return
		}

		// Validate date is tomorrow at earliest
		if (dueDate <= today) {
			setError('Datum termínu musí být nejdříve zítra.')
			return
		}

		// Validate custom email send date is tomorrow at earliest
		if (emailEnabled && useCustomEmailDate && emailSendAt && emailSendAt <= today) {
			setError('Datum odeslání emailu musí být nejdříve zítra.')
			return
		}

		const finalEmailSendAt = emailEnabled
			? (useCustomEmailDate ? emailSendAt : getDefaultEmailSendDate(dueDate))
			: null

		setSubmitting(true)
		try {
			await onAdd(vehicleId, type, dueDate, note, emailEnabled, finalEmailSendAt)
			setDueDate('')
			setNote('')
			setType('stk')
			setEmailEnabled(true)
			setEmailSendAt('')
			setUseCustomEmailDate(false)
		} catch {
			setError('Nepodařilo se uložit upozornění.')
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<form className='border rounded p-3' onSubmit={handleSubmit}>
			<div className='row g-2 align-items-end'>
				<div className='col-md-5'>
					<label className='form-label'>Typ</label>
					<select
						className='form-select'
						value={type}
						onChange={(event) =>
							setType(event.target.value as ReminderType)
						}
					>
						{Object.entries(reminderTypeLabels).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</div>
				<div className='col-md-4'>
					<label className='form-label'>Datum termínu</label>
					<input
						type='date'
						className='form-control'
						value={dueDate}
						onChange={(event) => setDueDate(event.target.value)}
						min={tomorrow}
						required
					/>
				</div>
				<div className='col-md-12'>
					<label className='form-label'>Poznámka</label>
					<input
						type='text'
						className='form-control'
						value={note}
						onChange={(event) => setNote(event.target.value)}
						placeholder='Např. přezutí na zimní pneumatiky'
						maxLength={NOTE_MAX_LENGTH}
					/>
					<div className='form-text text-muted'>
						{note.length}/{NOTE_MAX_LENGTH}
					</div>
				</div>
				<div className='col-md-12'>
					<div className='form-check'>
						<input
							type='checkbox'
							className='form-check-input'
							id={`emailEnabled-${vehicleId}`}
							checked={emailEnabled}
							onChange={(event) => setEmailEnabled(event.target.checked)}
						/>
						<label className='form-check-label' htmlFor={`emailEnabled-${vehicleId}`}>
							Poslat emailové upozornění
						</label>
					</div>
				</div>
				{emailEnabled && (
					<div className='col-md-12'>
						<div className='form-check mb-2'>
							<input
								type='checkbox'
								className='form-check-input'
								id={`customEmailDate-${vehicleId}`}
								checked={useCustomEmailDate}
								onChange={(event) => setUseCustomEmailDate(event.target.checked)}
							/>
							<label className='form-check-label' htmlFor={`customEmailDate-${vehicleId}`}>
								Vlastní datum odeslání (jinak 1 den před termínem)
							</label>
						</div>
						{useCustomEmailDate && (
							<div>
								<label className='form-label'>Datum odeslání emailu</label>
								<input
									type='date'
									className='form-control'
									value={emailSendAt}
									onChange={(event) => setEmailSendAt(event.target.value)}
									min={tomorrow}
								/>
							</div>
						)}
					</div>
				)}
			</div>
			{error && (
				<div className='alert alert-danger mt-3' role='alert'>
					{error}
				</div>
			)}
			<button
				type='submit'
				className='btn btn-primary btn-sm mt-3'
				disabled={submitting}
			>
				{submitting ? 'Ukládám...' : 'Přidat upozornění'}
			</button>
		</form>
	)
}

const AddVehicleForm: React.FC<{
	onAdd: (payload: {
		vin?: string
		tp?: string
		orv?: string
		title?: string
		brand?: string
		model?: string
		snapshot?: VehicleDataArray
	}) => Promise<void>
}> = ({ onAdd }) => {
	const [code, setCode] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setError('')
		setSuccess('')

		const cleanCode = code.replace(/[^a-zA-Z0-9]/g, '')
		if (cleanCode.length !== 17) {
			setError('Zkontrolujte zadaný kód.')
			return
		}

		setLoading(true)
		try {
			const data = await fetchVehicleInfo(cleanCode, undefined, undefined)
			const brand = getDataValue(data, 'TovarniZnacka', '')
			const model = getDataValue(data, 'Typ', '')
			const vin = getDataValue(data, 'VIN', cleanCode)
			const tp = getDataValue(data, 'CisloTp', '').trim()
			const orv = getDataValue(data, 'CisloOrv', '').trim()

			await onAdd({
				vin,
				tp: tp || undefined,
				orv: orv || undefined,
				brand,
				model,
				snapshot: data
			})
			setSuccess('Vozidlo bylo přidáno.')
			setCode('')
		} catch (err) {
			if (err instanceof Error && err.message) {
				setError(err.message)
			} else {
				setError('Nepodařilo se přidat vozidlo.')
			}
		} finally {
			setLoading(false)
		}
	}

	return (
		<form className='border rounded p-3 mb-4' onSubmit={handleSubmit}>
			<h3 className='h6'>Přidat vozidlo ručně</h3>
			<div className='row g-2 align-items-end'>
				<div className='col-md-8'>
					<label className='form-label'>VIN</label>
					<input
						type='text'
						className='form-control'
						value={code}
						onChange={(event) => setCode(event.target.value)}
						placeholder='Zadejte VIN (17 znaků)'
						required
					/>
				</div>
				<div className='col-md-4 d-flex'>
					<button
						type='submit'
						className='btn btn-primary w-100'
						disabled={loading}
					>
						{loading ? 'Přidávám...' : 'Přidat'}
					</button>
				</div>
			</div>
			{error && (
				<div className='alert alert-danger mt-3' role='alert'>
					{error}
				</div>
			)}
			{success && (
				<div className='alert alert-success mt-3' role='alert'>
					{success}
				</div>
			)}
		</form>
	)
}

export default ClientZonePage
