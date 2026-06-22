import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Icon from '../components/Icon'
import Navigation from '../components/Navigation'
import { OdometerSection } from '../components/OdometerSection'
import { cebia, csob, dealora } from '../config/affiliateCampaigns'
import { useAuth } from '../contexts/AuthContext'
import {
	ClientVehicle,
	OdometerReading,
	Reminder,
	ReminderType,
	VehicleDataArray
} from '../types'
import { ApiError } from '../utils/apiClient'
import {
	addVehicle,
	createReminder,
	deleteReminder,
	deleteVehicle,
	fetchOdometerReadings,
	fetchPreferences,
	fetchReminders,
	fetchVehicles,
	UserPreferences,
	updatePreferences,
	updateReminder,
	updateVehicleTitle
} from '../utils/clientZoneApi'
import {
	fetchVehicleInfo,
	formatValue,
	getDataValue
} from '../utils/vehicleApi'

const reminderTypeLabels: Record<ReminderType, string> = {
	stk: 'Termín STK',
	povinne_ruceni: 'Povinné ručení',
	havarijni_pojisteni: 'Havarijní pojištění',
	servis: 'Servisní prohlídka',
	prezuti_pneu: 'Přezutí pneu',
	dalnicni_znamka: 'Dálniční známka',
	jine: 'Jiné'
}

/** Per-type emoji shown next to the label in the reminder list. */
const reminderTypeIcons: Record<ReminderType, string> = {
	stk: '🔧',
	povinne_ruceni: '🛡️',
	havarijni_pojisteni: '🚗',
	servis: '🔩',
	prezuti_pneu: '🛞',
	dalnicni_znamka: '🛣️',
	jine: '📝'
}

// Default lead time (days between `email_send_at` and `due_date`) per reminder type.
// KEEP IN SYNC with api/client/reminders.ts (reminderTypeEmailLeadDays).
// See docs/REMINDER_DEFAULT_DATES.md.
const reminderTypeEmailLeadDays: Record<ReminderType, number> = {
	stk: 14,
	povinne_ruceni: 56,
	havarijni_pojisteni: 56,
	servis: 14,
	prezuti_pneu: 14,
	dalnicni_znamka: 7,
	jine: 1
}

/** Human-readable lead-time label per type (for the Add Reminder form hint). */
const reminderTypeEmailLeadLabel: Record<ReminderType, string> = {
	stk: '2 týdny před termínem',
	povinne_ruceni: '8 týdnů před termínem',
	havarijni_pojisteni: '8 týdnů před termínem',
	servis: '2 týdny před termínem',
	prezuti_pneu: '2 týdny před termínem',
	dalnicni_znamka: '1 týden před termínem',
	jine: '1 den před termínem'
}

/**
 * Compute the default email-send date from a due date and reminder type.
 * Anchored at **local** midnight – `new Date('YYYY-MM-DD')` parses as UTC
 * midnight, which in CET can make `setDate` + `toISOString` drop a day.
 */
function getDefaultEmailSendDate(
	dueDateStr: string,
	type: ReminderType
): string {
	if (!dueDateStr) return ''
	const date = new Date(`${dueDateStr}T00:00:00`)
	date.setDate(date.getDate() - reminderTypeEmailLeadDays[type])
	return date.toISOString().split('T')[0]
}

/** Okno, ve kterém u vozidla zobrazujeme kontextovou nabídku pojištění. */
const INSURANCE_DEADLINE_WINDOW_DAYS = 60

interface InsuranceDeadline {
	kind: 'povinne' | 'havarijni'
	label: string
	daysLeft: number
}

/**
 * Nejbližší blížící se termín povinného ručení / havarijního pojištění
 * (0-60 dní) napříč upozorněními vozidla. `null`, pokud žádný takový není.
 */
function getUpcomingInsuranceDeadline(
	reminders: Reminder[]
): InsuranceDeadline | null {
	const today = new Date()
	today.setHours(0, 0, 0, 0)
	let best: InsuranceDeadline | null = null
	for (const reminder of reminders) {
		if (reminder.is_done) continue
		if (
			reminder.type !== 'povinne_ruceni' &&
			reminder.type !== 'havarijni_pojisteni'
		) {
			continue
		}
		const due = new Date(reminder.due_date)
		if (Number.isNaN(due.getTime())) continue
		due.setHours(0, 0, 0, 0)
		const daysLeft = Math.round((due.getTime() - today.getTime()) / 86_400_000)
		if (daysLeft < 0 || daysLeft > INSURANCE_DEADLINE_WINDOW_DAYS) continue
		if (!best || daysLeft < best.daysLeft) {
			best = {
				kind: reminder.type === 'havarijni_pojisteni' ? 'havarijni' : 'povinne',
				label: reminderTypeLabels[reminder.type],
				daysLeft
			}
		}
	}
	return best
}

/** Čeština: dnes / za 1 den / za 3 dny / za 12 dní. */
function formatDaysLeft(days: number): string {
	if (days === 0) return 'dnes'
	if (days === 1) return 'za 1 den'
	if (days >= 2 && days <= 4) return `za ${days} dny`
	return `za ${days} dní`
}

/** STK termín – naléhavost podle počtu zbývajících dní. */
type StkUrgency = 'overdue' | 'critical' | 'soon' | 'ok'

function getStkUrgency(daysLeft: number): StkUrgency {
	if (daysLeft < 0) return 'overdue'
	if (daysLeft <= 30) return 'critical'
	if (daysLeft <= 90) return 'soon'
	return 'ok'
}

/**
 * Parse a registry date string (ISO `2026-01-02T00:00:00` or Czech `2. 1. 2026`)
 * to a local-midnight Date, or null when unparseable.
 */
function parseRegistryDate(raw: string | null | undefined): Date | null {
	if (!raw || raw === 'Neznámé datum') return null
	const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(T.*)?$/)
	if (isoMatch) {
		return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`)
	}
	const [day, month, year] = raw.split('.').map((part) => part.trim())
	if (day && month && year) {
		return new Date(
			`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`
		)
	}
	return null
}

/** Local-timezone YYYY-MM-DD (avoids the UTC day-shift of toISOString). */
function toIsoDate(date: Date): string {
	const y = date.getFullYear()
	const m = String(date.getMonth() + 1).padStart(2, '0')
	const d = String(date.getDate()).padStart(2, '0')
	return `${y}-${m}-${d}`
}

/** Jedno vozidlo v přehledu termínů STK (odvozeno ze snapshotu registru). */
interface StkOverviewEntry {
	vehicle: ClientVehicle
	stkDate: Date
	stkIso: string
	daysLeft: number
	urgency: StkUrgency
	hasOpenStkReminder: boolean
}

/** Barva + text odznaku podle naléhavosti termínu STK. */
function getStkBadge(entry: StkOverviewEntry): {
	className: string
	label: string
} {
	if (entry.urgency === 'overdue') {
		return { className: 'bg-danger', label: 'Po splatnosti' }
	}
	if (entry.urgency === 'critical') {
		return { className: 'bg-danger', label: formatDaysLeft(entry.daysLeft) }
	}
	return {
		className: 'bg-warning text-dark',
		label: formatDaysLeft(entry.daysLeft)
	}
}

/** Čeština: "Další vozidlo / Další 3 vozidla / Dalších 7 vozidel má/mají…". */
function formatOkVehicles(count: number): string {
	if (count === 1) return 'Další vozidlo má STK v pořádku.'
	if (count >= 2 && count <= 4) {
		return `Další ${count} vozidla mají STK v pořádku.`
	}
	return `Dalších ${count} vozidel má STK v pořádku.`
}

/**
 * Kontextová nabídka srovnání pojištění na kartě vozidla - zobrazí se,
 * když se u vozidla blíží termín pojištění.
 */
const InsuranceDeadlineCallout: React.FC<{ deadline: InsuranceDeadline }> = ({
	deadline
}) => (
	<div
		className='d-flex flex-wrap align-items-center justify-content-between gap-2 rounded p-3 mb-3'
		style={{
			backgroundColor: 'var(--surface-soft)',
			border: '1px solid color-mix(in srgb, var(--brand-600) 25%, transparent)'
		}}
	>
		<span className='small'>
			<strong>{deadline.label}</strong> končí{' '}
			{formatDaysLeft(deadline.daysLeft)}. Porovnejte si nabídky a ušetřete.
		</span>
		<Link
			to={`/sjednat-pojisteni?typ=${deadline.kind}&src=vehicle_card_due`}
			className='btn btn-sm btn-primary text-nowrap'
		>
			Porovnat nabídky
		</Link>
	</div>
)
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
							<span
								className='placeholder btn btn-sm'
								style={{
									width: '115px',
									height: '31px',
									display: 'inline-block'
								}}
							></span>
						</div>
						<div className='placeholder-glow'>
							<span
								className='placeholder btn btn-sm'
								style={{
									width: '70px',
									height: '31px',
									display: 'inline-block'
								}}
							></span>
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
	const [searchParams] = useSearchParams()
	const {
		user,
		loading: authLoading,
		logout,
		verifyEmail,
		resendVerification
	} = useAuth()
	const [vehicles, setVehicles] = useState<ClientVehicle[]>([])
	const [reminders, setReminders] = useState<Reminder[]>([])
	const [odometerReadingsByVehicle, setOdometerReadingsByVehicle] = useState<
		Record<string, OdometerReading[]>
	>({})
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const tabFromUrl = searchParams.get('tab') as ZoneTab | null
	const isValidTab =
		tabFromUrl &&
		['vehicles', 'alerts', 'benefits', 'settings'].includes(tabFromUrl)
	const [activeTab, setActiveTab] = useState<ZoneTab>(
		isValidTab ? tabFromUrl : 'vehicles'
	)
	const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({})
	const [titleSavingId, setTitleSavingId] = useState<string | null>(null)
	const [titleError, setTitleError] = useState<Record<string, string>>({})
	const [titleEditingId, setTitleEditingId] = useState<string | null>(null)
	const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(
		null
	)
	const [deleteConfirmVehicleId, setDeleteConfirmVehicleId] = useState<
		string | null
	>(null)
	const [stkReminderBusyId, setStkReminderBusyId] = useState<string | null>(
		null
	)
	const [stkActionError, setStkActionError] = useState('')
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
		return [...reminders].sort((a, b) => a.due_date.localeCompare(b.due_date))
	}, [reminders])

	// Přehled termínů STK napříč vozidly – odvozeno ze snapshotu registru
	// (`PravidelnaTechnickaProhlidkaDo`), takže funguje i bez ručního upozornění.
	const stkOverview = useMemo<StkOverviewEntry[]>(() => {
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		const entries = vehicles.flatMap((vehicle) => {
			const snapshotData = parseSnapshot(vehicle.snapshot)
			const raw = snapshotData
				? getDataValue(snapshotData, 'PravidelnaTechnickaProhlidkaDo', '')
				: ''
			const stkDate = parseRegistryDate(raw)
			if (!stkDate) return []
			const daysLeft = Math.round(
				(stkDate.getTime() - today.getTime()) / 86_400_000
			)
			const vehicleReminders = remindersByVehicle[vehicle.id] ?? []
			const hasOpenStkReminder = vehicleReminders.some(
				(r) => r.type === 'stk' && !r.is_done
			)
			return [
				{
					vehicle,
					stkDate,
					stkIso: toIsoDate(stkDate),
					daysLeft,
					urgency: getStkUrgency(daysLeft),
					hasOpenStkReminder
				}
			]
		})
		entries.sort((a, b) => a.stkDate.getTime() - b.stkDate.getTime())
		return entries
	}, [vehicles, remindersByVehicle])

	const loadData = async () => {
		if (loadRef.current.inFlight) {
			return
		}
		loadRef.current.inFlight = true
		setLoading(true)
		setError('')
		try {
			const [vehicleData, reminderData, odometerData] = await Promise.all([
				fetchVehicles(),
				fetchReminders(),
				fetchOdometerReadings()
			])
			setVehicles(vehicleData)
			setReminders(reminderData)
			const byVehicle = odometerData.reduce<Record<string, OdometerReading[]>>(
				(acc, r) => {
					const list = acc[r.vehicle_id] ?? []
					list.push(r)
					acc[r.vehicle_id] = list
					return acc
				},
				{}
			)
			setOdometerReadingsByVehicle(byVehicle)
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
		if (user) {
			document.title =
				'Moje VINInfo – stav tachometru, upozornění na STK | VIN Info.cz'
			const meta = document.querySelector('meta[name="description"]')
			if (meta) {
				meta.setAttribute(
					'content',
					'Správa vozidel, evidence stavu tachometru, upozornění na STK, pojištění a servis. Sledujte trendy najetých kilometrů a nikdy nezmeškejte termín.'
				)
			}
		}
		return () => {
			document.title = 'VIN Info.cz'
		}
	}, [user])

	useEffect(() => {
		const tab = searchParams.get('tab') as ZoneTab | null
		if (tab && ['vehicles', 'alerts', 'benefits', 'settings'].includes(tab)) {
			setActiveTab(tab)
		}
	}, [searchParams])

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

	// Z termínu STK z registru udělá sledované upozornění (+ emailovou notifikaci).
	const handleQuickStkReminder = async (
		vehicle: ClientVehicle,
		stkIso: string
	) => {
		if (stkReminderBusyId) return
		setStkReminderBusyId(vehicle.id)
		setStkActionError('')
		try {
			await handleAddReminder(vehicle.id, 'stk', stkIso, '', true, null)
		} catch {
			setStkActionError('Nepodařilo se vytvořit připomínku STK.')
		} finally {
			setStkReminderBusyId(null)
		}
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

	const handleOdometerReadingsChange = (
		vehicleId: string,
		updater: (prev: OdometerReading[]) => OdometerReading[]
	) => {
		setOdometerReadingsByVehicle((prev) => ({
			...prev,
			[vehicleId]: updater(prev[vehicleId] ?? [])
		}))
	}

	const handleDeleteVehicle = async (vehicleId: string) => {
		if (deletingVehicleId) return
		setDeletingVehicleId(vehicleId)
		try {
			await deleteVehicle(vehicleId)
			setVehicles((prev) => prev.filter((item) => item.id !== vehicleId))
			setReminders((prev) =>
				prev.filter((item) => item.vehicle_id !== vehicleId)
			)
			setOdometerReadingsByVehicle((prev) => {
				const next = { ...prev }
				delete next[vehicleId]
				return next
			})
		} finally {
			setDeletingVehicleId(null)
		}
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
		const nextTitle =
			trimmed.length > 0 ? trimmed.slice(0, TITLE_MAX_LENGTH) : null

		setTitleSavingId(vehicle.id)
		setTitleError((prev) => ({ ...prev, [vehicle.id]: '' }))
		try {
			const updated = await updateVehicleTitle(vehicle.id, nextTitle)
			setVehicles((prev) =>
				prev.map((item) => (item.id === updated.id ? updated : item))
			)
			setTitleDrafts((prev) => ({ ...prev, [vehicle.id]: updated.title ?? '' }))
			setTitleEditingId((current) => (current === vehicle.id ? null : current))
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
				setVerificationError(
					'Nepodařilo se ověřit email. Zkontrolujte kód a zkuste to znovu.'
				)
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
							<span
								className='placeholder'
								style={{
									width: '110px',
									height: '38px',
									display: 'inline-block'
								}}
							></span>
						</div>
					</div>

					<nav className='mt-4'>
						<ul className='nav nav-tabs'>
							<li className='nav-item'>
								<div className='placeholder-glow'>
									<span
										className='placeholder nav-link'
										style={{
											width: '120px',
											height: '38px',
											display: 'inline-block'
										}}
									></span>
								</div>
							</li>
							<li className='nav-item'>
								<div className='placeholder-glow'>
									<span
										className='placeholder nav-link'
										style={{
											width: '140px',
											height: '38px',
											display: 'inline-block'
										}}
									></span>
								</div>
							</li>
							<li className='nav-item'>
								<div className='placeholder-glow'>
									<span
										className='placeholder nav-link'
										style={{
											width: '110px',
											height: '38px',
											display: 'inline-block'
										}}
									></span>
								</div>
							</li>
							<li className='nav-item'>
								<div className='placeholder-glow'>
									<span
										className='placeholder nav-link'
										style={{
											width: '100px',
											height: '38px',
											display: 'inline-block'
										}}
									></span>
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
						<p className='text-muted mb-0'>
							Přihlášen:{' '}
							<span className='client-zone-email'>{user?.email}</span>
						</p>
					</div>
					<button
						type='button'
						className='btn btn-outline-secondary'
						onClick={handleLogout}
					>
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
								Pro příjem emailových upozornění musíte nejprve ověřit svou
								emailovou adresu. Zadejte 6místný kód, který jsme vám poslali na{' '}
								<strong>{user.email}</strong>.
							</p>
							<form
								onSubmit={handleVerifyEmail}
								className='d-flex gap-2 align-items-end flex-wrap'
							>
								<div>
									<label htmlFor='verificationCode' className='form-label'>
										Ověřovací kód
									</label>
									<input
										id='verificationCode'
										type='text'
										className='form-control'
										value={verificationCode}
										onChange={(e) =>
											setVerificationCode(
												e.target.value.replace(/\D/g, '').slice(0, 6)
											)
										}
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
						<h2 className='h4'>
							<span className='heading-accent'>Uložená vozidla</span>
						</h2>
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
								const insuranceDeadline =
									getUpcomingInsuranceDeadline(vehicleReminders)
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
								const techInspectionDate = parseRegistryDate(techInspectionRaw)

								const isExpired = Boolean(
									techInspectionDate &&
										techInspectionDate.getTime() < currentDate.getTime()
								)
								const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000
								const stkStatus: 'ok' | 'warn' | 'alert' = !techInspectionDate
									? 'ok'
									: isExpired
										? 'alert'
										: techInspectionDate.getTime() - currentDate.getTime() <
												SIXTY_DAYS_MS
											? 'warn'
											: 'ok'
								return (
									<div key={vehicle.id} className='col-12 col-lg-6'>
										<div className='card h-100 shadow-sm'>
											<div className='card-body'>
												{titleEditingId === vehicle.id ? (
													<h3 className='plate-title plate-title--editing'>
														<input
															type='text'
															className='plate-title__input'
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
															autoFocus
															onKeyDown={(event) => {
																if (event.key === 'Enter') {
																	event.preventDefault()
																	handleSaveTitle(vehicle)
																} else if (event.key === 'Escape') {
																	event.preventDefault()
																	handleCancelEditTitle(vehicle.id)
																}
															}}
														/>
													</h3>
												) : (
													<h3 className='plate-title'>
														<button
															type='button'
															className='plate-title__face'
															onClick={() => handleStartEditTitle(vehicle)}
															aria-label='Upravit název vozidla'
															title='Klikněte pro úpravu názvu'
														>
															<span>
																{vehicle.title?.trim()
																	? vehicle.title
																	: `${vehicle.brand ?? 'Neznámá značka'} ${vehicle.model ?? ''}`.trim()}
															</span>
															<Icon
																name='pencil'
																size={14}
																className='plate-title__hint'
															/>
														</button>
														<button
															type='button'
															className='plate-title__delete'
															onClick={() =>
																setDeleteConfirmVehicleId(
																	deleteConfirmVehicleId === vehicle.id
																		? null
																		: vehicle.id
																)
															}
															disabled={deletingVehicleId === vehicle.id}
															aria-label='Odebrat vozidlo'
															aria-expanded={
																deleteConfirmVehicleId === vehicle.id
															}
															title='Odebrat vozidlo'
														>
															<Icon name='x' size={16} />
														</button>
													</h3>
												)}
												{titleEditingId === vehicle.id && (
													<>
														<div className='d-flex gap-2 mt-2'>
															<button
																type='button'
																className='btn btn-primary btn-sm'
																onClick={() => handleSaveTitle(vehicle)}
																disabled={titleSavingId === vehicle.id}
															>
																{titleSavingId === vehicle.id
																	? 'Ukládám...'
																	: 'Uložit'}
															</button>
															<button
																type='button'
																className='btn btn-outline-secondary btn-sm'
																onClick={() =>
																	handleCancelEditTitle(vehicle.id)
																}
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
													</>
												)}
												{deleteConfirmVehicleId === vehicle.id &&
													titleEditingId !== vehicle.id && (
														<div className='alert alert-danger d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mt-2 mb-0 py-2'>
															<span className='small'>
																Opravdu odebrat vozidlo? Smazána budou i všechna
																upozornění a záznamy tachometru.
															</span>
															<div className='d-flex gap-2 flex-shrink-0'>
																<button
																	type='button'
																	className='btn btn-danger btn-sm'
																	onClick={async () => {
																		await handleDeleteVehicle(vehicle.id)
																		setDeleteConfirmVehicleId(null)
																	}}
																	disabled={deletingVehicleId === vehicle.id}
																>
																	{deletingVehicleId === vehicle.id ? (
																		<>
																			<span
																				className='spinner-border spinner-border-sm me-2'
																				role='status'
																				aria-hidden='true'
																				style={{ width: 12, height: 12 }}
																			/>
																			Odebírám…
																		</>
																	) : (
																		'Ano, odebrat'
																	)}
																</button>
																<button
																	type='button'
																	className='btn btn-outline-secondary btn-sm'
																	onClick={() =>
																		setDeleteConfirmVehicleId(null)
																	}
																	disabled={deletingVehicleId === vehicle.id}
																>
																	Zrušit
																</button>
															</div>
														</div>
													)}
												{techInspectionDate && (
													<div className='stk-stat' data-status={stkStatus}>
														<span className='stk-stat__label'>STK do</span>
														<span className='stk-stat__value num'>
															{techInspection}
														</span>
													</div>
												)}
												<dl className='dl-grid mt-3 mb-3'>
													{vehicle.title &&
														(vehicle.brand || vehicle.model) && (
															<>
																<dt>Značka / Model</dt>
																<dd>
																	{`${vehicle.brand ?? ''} ${vehicle.model ?? ''}`.trim() ||
																		'—'}
																</dd>
															</>
														)}
													{vehicle.vin && (
														<>
															<dt>VIN</dt>
															<dd className='num'>{vehicle.vin}</dd>
														</>
													)}
													{vehicle.tp && (
														<>
															<dt>Číslo TP</dt>
															<dd className='num'>{vehicle.tp}</dd>
														</>
													)}
													{vehicle.orv && (
														<>
															<dt>Číslo ORV</dt>
															<dd className='num'>{vehicle.orv}</dd>
														</>
													)}
												</dl>
												{insuranceDeadline && (
													<InsuranceDeadlineCallout
														deadline={insuranceDeadline}
													/>
												)}
												<ul className='vehicle-actions'>
													{(vehicle.vin || vehicle.tp || vehicle.orv) && (
														<li>
															<Link
																to={
																	vehicle.vin
																		? `/vin/${encodeURIComponent(vehicle.vin)}`
																		: vehicle.tp
																			? `/tp/${encodeURIComponent(vehicle.tp)}`
																			: `/orv/${encodeURIComponent(vehicle.orv!)}`
																}
															>
																<Icon name='chevron-right' size={16} />
																Info z registru vozidel
															</Link>
														</li>
													)}
													{!insuranceDeadline && (
														<li>
															<Link to='/sjednat-pojisteni?typ=povinne&src=vehicle_card'>
																<Icon name='chevron-right' size={16} />
																Sjednat pojištění
															</Link>
														</li>
													)}
													{vehicle.vin && (
														<li className='vehicle-actions__affiliate'>
															<a
																href={cebia.getDirectUrl(
																	vehicle.vin,
																	'client_zone_vehicle'
																)}
																target='_blank'
																rel='noopener noreferrer'
																title='Partnerský odkaz'
															>
																<Icon name='external-link' size={14} />
																Prověřit historii vozidla
															</a>
														</li>
													)}
												</ul>

												<hr
													style={{
														borderTop: '1px solid var(--ink-300)',
														margin: 'var(--space-5) 0 var(--space-4)'
													}}
												/>
												<div>
													<h4 className='h6'>
														<span className='heading-accent'>Upozornění</span>
													</h4>
													{vehicleReminders.length === 0 ? (
														<div
															className='rounded p-3 mb-3 small text-muted-ink'
															style={{
																backgroundColor: 'var(--surface-soft)'
															}}
														>
															Zatím nemáte žádná upozornění – přidejte první
															níže.
														</div>
													) : (
														<ul className='list-unstyled mb-3 d-flex flex-column gap-2'>
															{vehicleReminders.map((reminder) => (
																<li
																	key={reminder.id}
																	className={`reminder-row reminder-${reminder.type} py-2 d-flex flex-wrap align-items-center justify-content-between gap-2${reminder.is_done ? ' opacity-50' : ''}`}
																>
																	<div className='flex-grow-1'>
																		<div className='fw-semibold d-flex align-items-center gap-2'>
																			<span aria-hidden='true'>
																				{reminderTypeIcons[reminder.type]}
																			</span>
																			<span
																				style={
																					reminder.is_done
																						? {
																								textDecoration: 'line-through'
																							}
																						: undefined
																				}
																			>
																				{reminderTypeLabels[reminder.type]}
																			</span>
																		</div>
																		<div className='small text-muted-ink'>
																			Termín: {formatDate(reminder.due_date)}
																			{reminder.email_enabled &&
																				reminder.email_send_at && (
																					<>
																						{' '}
																						· Email:{' '}
																						{formatDate(reminder.email_send_at)}
																					</>
																				)}
																			{reminder.note
																				? ` · ${reminder.note}`
																				: ''}
																		</div>
																	</div>
																	<div className='btn-group btn-group-sm'>
																		<button
																			type='button'
																			className={`btn ${reminder.is_done ? 'btn-success' : 'btn-outline-success'}`}
																			onClick={() =>
																				handleToggleReminder(reminder)
																			}
																		>
																			{reminder.is_done ? 'Splněno' : 'Splnit'}
																		</button>
																		<button
																			type='button'
																			className='btn btn-outline-danger'
																			onClick={() =>
																				handleDeleteReminder(reminder.id)
																			}
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
													<OdometerSection
														vehicleId={vehicle.id}
														vehicleName={
															vehicle.title?.trim() ||
															`${vehicle.brand ?? ''} ${vehicle.model ?? ''}`.trim()
														}
														readings={
															odometerReadingsByVehicle[vehicle.id] ?? []
														}
														onReadingsChange={handleOdometerReadingsChange}
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
						<h2 className='h4'>
							<span className='heading-accent'>Moje upozornění</span>
						</h2>

						{stkOverview.length > 0 &&
							(() => {
								const stkDueSoon = stkOverview.filter(
									(entry) => entry.urgency !== 'ok'
								)
								const stkOkCount = stkOverview.length - stkDueSoon.length
								return (
									<div
										className='rounded p-3 mt-3 mb-4'
										style={{
											backgroundColor: 'var(--surface-soft)',
											border:
												'1px solid color-mix(in srgb, var(--brand-600) 25%, transparent)'
										}}
									>
										<div className='d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2'>
											<h3 className='h6 mb-0 d-flex align-items-center gap-2'>
												<Icon name='calendar' size={16} />
												<span className='heading-accent'>
													Nadcházející termíny STK
												</span>
											</h3>
											<span className='small text-muted-ink'>
												Podle údajů z registru vozidel
											</span>
										</div>

										{stkDueSoon.length === 0 ? (
											<p className='small text-muted-ink mb-0'>
												Všechna vozidla mají STK v pořádku.
											</p>
										) : (
											<ul className='list-unstyled mb-0 d-flex flex-column gap-2'>
												{stkDueSoon.map((entry) => {
													const badge = getStkBadge(entry)
													const vehicleName =
														entry.vehicle.title?.trim() ||
														`${entry.vehicle.brand ?? ''} ${entry.vehicle.model ?? ''}`.trim() ||
														'Vozidlo'
													const detailHref = entry.vehicle.vin
														? `/vin/${encodeURIComponent(entry.vehicle.vin)}`
														: entry.vehicle.tp
															? `/tp/${encodeURIComponent(entry.vehicle.tp)}`
															: entry.vehicle.orv
																? `/orv/${encodeURIComponent(entry.vehicle.orv)}`
																: null
													return (
														<li
															key={entry.vehicle.id}
															className='d-flex flex-wrap align-items-center justify-content-between gap-2 rounded bg-white p-2 px-3'
														>
															<div className='flex-grow-1'>
																<div className='fw-semibold'>{vehicleName}</div>
																<div className='small text-muted-ink'>
																	STK do: {formatDate(entry.stkIso)}
																</div>
															</div>
															<div className='d-flex align-items-center gap-2 flex-wrap'>
																<span className={`badge ${badge.className}`}>
																	{badge.label}
																</span>
																{entry.urgency !== 'overdue' &&
																	(entry.hasOpenStkReminder ? (
																		<span className='small text-success d-inline-flex align-items-center gap-1'>
																			<Icon name='check' size={14} />
																			Hlídáme
																		</span>
																	) : (
																		<button
																			type='button'
																			className='btn btn-sm btn-primary'
																			onClick={() =>
																				handleQuickStkReminder(
																					entry.vehicle,
																					entry.stkIso
																				)
																			}
																			disabled={
																				stkReminderBusyId === entry.vehicle.id
																			}
																		>
																			{stkReminderBusyId === entry.vehicle.id
																				? 'Ukládám…'
																				: 'Připomenout'}
																		</button>
																	))}
																{detailHref && (
																	<Link
																		to={detailHref}
																		className='btn btn-sm btn-outline-secondary'
																	>
																		Detail
																	</Link>
																)}
															</div>
														</li>
													)
												})}
											</ul>
										)}

										{stkOkCount > 0 && stkDueSoon.length > 0 && (
											<p className='small text-muted-ink mb-0 mt-2'>
												{formatOkVehicles(stkOkCount)}
											</p>
										)}
										{stkActionError && (
											<div className='alert alert-danger mt-2 mb-0 py-2 small'>
												{stkActionError}
											</div>
										)}
									</div>
								)
							})()}

						{upcomingReminders.length === 0 ? (
							<div
								className='rounded p-3 mt-3 small text-muted-ink'
								style={{ backgroundColor: 'var(--surface-soft)' }}
							>
								Zatím nemáte žádná upozornění.
							</div>
						) : (
							<ul className='list-unstyled mt-3 d-flex flex-column gap-2'>
								{upcomingReminders.map((reminder) => (
									<li
										key={reminder.id}
										className={`reminder-row reminder-${reminder.type} py-2${reminder.is_done ? ' opacity-50' : ''}`}
									>
										<div className='d-flex flex-wrap align-items-center justify-content-between gap-2'>
											<div className='flex-grow-1'>
												<div className='fw-semibold d-flex align-items-center gap-2'>
													<span aria-hidden='true'>
														{reminderTypeIcons[reminder.type]}
													</span>
													<span
														style={
															reminder.is_done
																? { textDecoration: 'line-through' }
																: undefined
														}
													>
														{reminderTypeLabels[reminder.type]}
													</span>
												</div>
												<div className='small text-muted-ink'>
													Termín: {formatDate(reminder.due_date)}
													{reminder.note ? ` · ${reminder.note}` : ''}
												</div>
											</div>
											<div className='btn-group btn-group-sm'>
												<button
													type='button'
													className={`btn ${reminder.is_done ? 'btn-success' : 'btn-outline-success'}`}
													onClick={() => handleToggleReminder(reminder)}
												>
													{reminder.is_done ? 'Splněno' : 'Splnit'}
												</button>
												<button
													type='button'
													className='btn btn-outline-danger'
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
													Emailové upozornění{' '}
													{reminder.email_enabled ? 'zapnuto' : 'vypnuto'}
													{reminder.email_enabled && reminder.email_send_at && (
														<>
															{' '}
															• odeslání: {formatDate(reminder.email_send_at)}
														</>
													)}
													{reminder.email_enabled &&
														preferences &&
														!preferences.notifications_enabled && (
															<span
																className='text-warning ms-2'
																title='Globální notifikace jsou vypnuté v Nastavení'
															>
																<br />
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
						<h2 className='h4'>
							<span className='heading-accent'>Moje výhody</span>
						</h2>
						<p className='text-muted'>Doporučené služby pro vaše vozidla.</p>

						<div className='row g-4'>
							<div className='col-md-6'>
								<div className='card h-100'>
									<div className='card-body'>
										<h5 className='card-title'>Prověření historie vozidla</h5>
										<p className='card-text text-muted'>
											Zjistěte kompletní historii vozidla - havárie, servisní
											záznamy, stav tachometru a další důležité informace.
										</p>
										<a
											href={cebia.getTextLinkUrl('client_zone_benefits')}
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
										<h5 className='card-title'>{dealora.shortLabel}</h5>
										<p className='card-text text-muted'>{dealora.tagline}.</p>
										<a
											href={dealora.getUrl()}
											target='_blank'
											rel='noopener noreferrer'
											className='btn btn-outline-primary'
										>
											{dealora.label}
										</a>
									</div>
								</div>
							</div>

							<div className='col-md-6'>
								<div className='card h-100'>
									<div className='card-body'>
										<h5 className='card-title'>Pojištění vozidla</h5>
										<p className='card-text text-muted'>
											Porovnejte si povinné ručení i havarijní pojištění online.
										</p>
										<Link
											to='/sjednat-pojisteni?typ=povinne&src=client_zone_benefits'
											className='btn btn-outline-primary'
										>
											Porovnat pojištění
										</Link>
									</div>
								</div>
							</div>

							<div className='col-md-6'>
								<div className='card h-100'>
									<div className='card-body'>
										<h5 className='card-title'>Cestovní pojištění</h5>
										<p className='card-text text-muted small mb-2'>
											Pojištění léčebných výloh, úrazu, odpovědnosti i zavazadel
											na cesty po Evropě i do světa. Porovnejte si nabídky online.
										</p>
										<Link
											to='/sjednat-pojisteni?typ=cestovni&src=client_zone_benefits'
											className='btn btn-outline-primary'
										>
											Porovnat cestovní pojištění
										</Link>
									</div>
								</div>
							</div>

							{csob.getValidCoupons().length > 0 && (
								<div className='col-12'>
									<div className='card'>
										<div className='card-body'>
											<h5 className='card-title'>
												CSOB Pojišťovna – akční nabídky
											</h5>
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
										const vehicleName =
											vehicle.title?.trim() ||
											`${vehicle.brand || 'Vozidlo'} ${vehicle.model || ''}`.trim()
										return (
											<div key={vehicle.id} className='list-group-item'>
												<div className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
													<span className='fw-semibold'>{vehicleName}</span>
													<div className='d-flex gap-2 flex-wrap'>
														{(vehicle.vin || vehicle.tp || vehicle.orv) && (
															<Link
																to={
																	vehicle.vin
																		? `/vin/${encodeURIComponent(vehicle.vin)}`
																		: vehicle.tp
																			? `/tp/${encodeURIComponent(vehicle.tp)}`
																			: `/orv/${encodeURIComponent(vehicle.orv!)}`
																}
																className='btn btn-sm btn-outline-secondary'
															>
																Info z registru vozidel
															</Link>
														)}
														{vehicle.vin && (
															<a
																href={cebia.getDirectUrl(
																	vehicle.vin,
																	'client_zone_vehicle_list'
																)}
																target='_blank'
																rel='noopener noreferrer'
																className='btn btn-sm btn-outline-secondary'
															>
																Prověřit historii
															</a>
														)}
														<Link
															to='/sjednat-pojisteni?typ=povinne&src=vehicle_card'
															className='btn btn-sm btn-outline-secondary'
														>
															Sjednat pojištění
														</Link>
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
						<h2 className='h4'>
							<span className='heading-accent'>Nastavení</span>
						</h2>
						<p className='text-muted'>
							Spravujte své preference pro emailová upozornění.
						</p>

						{!user?.email_verified_at && (
							<div className='alert alert-warning'>
								<strong>Email není ověřen.</strong> Pro příjem emailových
								upozornění musíte nejprve ověřit svůj email.
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
											onChange={(e) =>
												setPreferences({
													...preferences,
													notifications_enabled: e.target.checked
												})
											}
										/>
										<label
											className='form-check-label'
											htmlFor='notificationsEnabled'
										>
											<strong>Notifikační emaily</strong>
											<div className='text-muted small'>
												Upozornění na blížící se termíny STK, pojištění, servisu
												a další.
											</div>
										</label>
									</div>
									<div className='form-check mb-3'>
										<input
											type='checkbox'
											className='form-check-input'
											id='marketingEnabled'
											checked={preferences.marketing_enabled}
											onChange={(e) =>
												setPreferences({
													...preferences,
													marketing_enabled: e.target.checked
												})
											}
										/>
										<label
											className='form-check-label'
											htmlFor='marketingEnabled'
										>
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

	// Get today's date in YYYY-MM-DD format for validation
	const today = new Date().toISOString().split('T')[0]
	// Get tomorrow's date for min attribute (earliest allowed date)
	const tomorrowDate = new Date()
	tomorrowDate.setDate(tomorrowDate.getDate() + 1)
	const tomorrow = tomorrowDate.toISOString().split('T')[0]

	// Default email-send date derived from due date + reminder type. When the due
	// date is sooner than the type's lead time, this lands in the past.
	const computedEmailSendAt = dueDate
		? getDefaultEmailSendDate(dueDate, type)
		: ''
	const computedDefaultIsPast =
		computedEmailSendAt !== '' && computedEmailSendAt <= today

	// Rather than silently firing the email immediately on save (a surprise),
	// force a custom future date when the default would be in the past — pre-fill
	// it to tomorrow so it's a nudge, not friction.
	const forceCustomEmailDate = emailEnabled && computedDefaultIsPast
	useEffect(() => {
		if (forceCustomEmailDate) {
			setUseCustomEmailDate(true)
			setEmailSendAt((prev) => prev || tomorrow)
		}
	}, [forceCustomEmailDate, tomorrow])

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

		// A custom send date must be a real future date — no silent fallback to an
		// immediate send via an empty or past value.
		if (emailEnabled && useCustomEmailDate) {
			if (!emailSendAt) {
				setError('Zvolte datum odeslání emailu.')
				return
			}
			if (emailSendAt <= today) {
				setError('Datum odeslání emailu musí být nejdříve zítra.')
				return
			}
		}

		const finalEmailSendAt = emailEnabled
			? useCustomEmailDate
				? emailSendAt
				: getDefaultEmailSendDate(dueDate, type)
			: null

		setSubmitting(true)
		try {
			await onAdd(
				vehicleId,
				type,
				dueDate,
				note,
				emailEnabled,
				finalEmailSendAt
			)
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
		<>
			<h5 className='h6 mt-2 mb-2'>Přidat upozornění</h5>
			<form
				className='rounded p-3'
				style={{ backgroundColor: 'var(--surface-soft)' }}
				onSubmit={handleSubmit}
			>
				<div className='row g-2 align-items-end'>
					<div className='col-md-5'>
						<label className='form-label'>Typ</label>
						<select
							className='form-select'
							value={type}
							onChange={(event) => setType(event.target.value as ReminderType)}
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
							<label
								className='form-check-label'
								htmlFor={`emailEnabled-${vehicleId}`}
							>
								Poslat emailové upozornění
							</label>
						</div>
					</div>
					{emailEnabled && (
						<div className='col-md-12'>
							{!useCustomEmailDate && (
								<div className='form-text mb-2'>
									Email se odešle{' '}
									<strong>{reminderTypeEmailLeadLabel[type]}</strong>
									{computedEmailSendAt && (
										<> ({formatDate(computedEmailSendAt)})</>
									)}
									.
								</div>
							)}
							{forceCustomEmailDate && (
								<div className='form-text text-amber mb-2'>
									Výchozí datum odeslání ({reminderTypeEmailLeadLabel[type]}) by
									bylo v minulosti. Zvolte prosím datum odeslání emailu
									(nejdříve zítra).
								</div>
							)}
							<div className='form-check mb-2'>
								<input
									type='checkbox'
									className='form-check-input'
									id={`customEmailDate-${vehicleId}`}
									checked={useCustomEmailDate}
									disabled={forceCustomEmailDate}
									onChange={(event) =>
										setUseCustomEmailDate(event.target.checked)
									}
								/>
								<label
									className='form-check-label'
									htmlFor={`customEmailDate-${vehicleId}`}
								>
									Zvolit vlastní datum odeslání
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
					className='btn btn-primary mt-3'
					disabled={submitting}
				>
					{submitting ? 'Ukládám...' : 'Přidat'}
				</button>
			</form>
		</>
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
	const [mode, setMode] = useState<'vin' | 'no-vin'>('vin')
	const [code, setCode] = useState('')
	const [customTitle, setCustomTitle] = useState('')
	const [customBrand, setCustomBrand] = useState('')
	const [customModel, setCustomModel] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')

	const resetFields = () => {
		setCode('')
		setCustomTitle('')
		setCustomBrand('')
		setCustomModel('')
	}

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setError('')
		setSuccess('')

		if (mode === 'vin') {
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
				const trimmedTitle = customTitle.trim()
				await onAdd({
					vin,
					tp: tp || undefined,
					orv: orv || undefined,
					title: trimmedTitle
						? trimmedTitle.slice(0, TITLE_MAX_LENGTH)
						: undefined,
					brand,
					model,
					snapshot: data
				})
				setSuccess('Vozidlo bylo přidáno.')
				resetFields()
			} catch (err) {
				if (err instanceof Error && err.message) {
					setError(err.message)
				} else {
					setError('Nepodařilo se přidat vozidlo.')
				}
			} finally {
				setLoading(false)
			}
		} else {
			const trimmedTitle = customTitle.trim()
			if (!trimmedTitle) {
				setError('Zadejte název vozidla.')
				return
			}
			setLoading(true)
			try {
				const trimmedBrand = customBrand.trim()
				const trimmedModel = customModel.trim()
				await onAdd({
					title: trimmedTitle.slice(0, TITLE_MAX_LENGTH),
					brand: trimmedBrand || undefined,
					model: trimmedModel || undefined
				})
				setSuccess('Vozidlo bylo přidáno.')
				resetFields()
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
	}

	return (
		<form className='border rounded p-3 mb-4' onSubmit={handleSubmit}>
			<h3 className='h6'>Přidat vozidlo ručně</h3>

			<div
				className='btn-group w-100 mb-3'
				role='radiogroup'
				aria-label='Způsob přidání vozidla'
			>
				<input
					type='radio'
					className='btn-check'
					name='addVehicleMode'
					id='addVehicleMode-vin'
					autoComplete='off'
					checked={mode === 'vin'}
					onChange={() => {
						setMode('vin')
						setError('')
						setSuccess('')
					}}
				/>
				<label className='btn btn-outline-primary' htmlFor='addVehicleMode-vin'>
					Mám VIN
				</label>
				<input
					type='radio'
					className='btn-check'
					name='addVehicleMode'
					id='addVehicleMode-no-vin'
					autoComplete='off'
					checked={mode === 'no-vin'}
					onChange={() => {
						setMode('no-vin')
						setError('')
						setSuccess('')
					}}
				/>
				<label
					className='btn btn-outline-primary'
					htmlFor='addVehicleMode-no-vin'
				>
					VIN nemám
				</label>
			</div>

			{mode === 'vin' ? (
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
					<div className='col-12'>
						<label className='form-label'>
							Vlastní název <span className='text-muted-ink'>(volitelné)</span>
						</label>
						<input
							type='text'
							className='form-control'
							value={customTitle}
							onChange={(event) => setCustomTitle(event.target.value)}
							placeholder='např. Auto bílé, Rodinná Octavia'
							maxLength={TITLE_MAX_LENGTH}
						/>
						<div className='form-text text-muted-ink'>
							Pomůže vám rozlišit více vozidel. Můžete změnit kdykoliv později.
						</div>
					</div>
				</div>
			) : (
				<div className='row g-2 align-items-end'>
					<div className='col-12'>
						<label className='form-label'>Název vozidla</label>
						<input
							type='text'
							className='form-control'
							value={customTitle}
							onChange={(event) => setCustomTitle(event.target.value)}
							placeholder='např. Auto bílé, Rodinná Octavia'
							maxLength={TITLE_MAX_LENGTH}
							required
						/>
					</div>
					<div className='col-md-6'>
						<label className='form-label'>
							Značka <span className='text-muted-ink'>(volitelné)</span>
						</label>
						<input
							type='text'
							className='form-control'
							value={customBrand}
							onChange={(event) => setCustomBrand(event.target.value)}
							placeholder='např. Škoda'
							maxLength={40}
						/>
					</div>
					<div className='col-md-6'>
						<label className='form-label'>
							Model <span className='text-muted-ink'>(volitelné)</span>
						</label>
						<input
							type='text'
							className='form-control'
							value={customModel}
							onChange={(event) => setCustomModel(event.target.value)}
							placeholder='např. Octavia'
							maxLength={40}
						/>
					</div>
					<div className='col-12'>
						<div className='alert alert-info small mb-0' role='note'>
							Bez VIN nenačteme údaje z registru. Upozornění a stav tachometru
							fungují normálně.
						</div>
					</div>
					<div className='col-12'>
						<button
							type='submit'
							className='btn btn-primary w-100'
							disabled={loading}
						>
							{loading ? 'Přidávám...' : 'Přidat'}
						</button>
					</div>
				</div>
			)}

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
