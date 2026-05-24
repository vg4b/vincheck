export interface VehicleDataItem {
	name: string
	value: string | number | boolean
	label: string
}

export interface VehicleData {
	Status?: string
	Data?: Record<string, string | number | boolean>
	History?: VehicleHistory
}

export type VehicleDataArray = VehicleDataItem[]

export type StkResult = 'pass' | 'defects' | 'unfit' | 'unknown'
export type OwnerRelation = 'owner' | 'operator' | 'other'

/** Public-registry "history-lite" composed server-side from the companion
 *  tables; present only on a cache hit. See docs/VEHICLE_HISTORY_PANEL.md. */
export interface VehicleHistory {
	owners: {
		total: number
		operators: number
		companies: number
		everCompanyOwned: boolean
		currentlyCompany: boolean
		companyOwners: Array<{
			ico: string | null
			nazev: string | null
			from: string | null
			to: string | null
			current: boolean
			relation: OwnerRelation
		}>
	}
	inspections: {
		total: number
		failed: number
		distinctStations: number
		latest: {
			result: StkResult
			platnostDo: string | null
			nazevStk: string | null
		} | null
		history: Array<{
			date: string | null
			result: StkResult
			nazevStk: string | null
			typ: string | null
		}>
	}
	flags: {
		stolen: boolean
		exported: boolean
		deregistered: boolean
		insuranceLapsed: boolean
		statusLabel: string | null
	}
	deregistrations: Array<{
		from: string | null
		to: string | null
		reason: string | null
	}>
	snapshot: string | null
}

export interface FleetVehicle {
	vin: string | null
	znacka: string | null
	model: string | null
	oznaceni: string | null
	rok: string | null
	prvniRegistrace: string | null
	status: string | null
	current: boolean
}

/** Result of the reverse "vehicles by IČO" lookup (/api/fleet). */
export interface FleetResult {
	ico: string
	nazev: string | null
	count: number
	countCapped: boolean
	vehicles: FleetVehicle[]
	snapshot: string | null
}

export interface AuthUser {
	id: string
	email: string
	created_at?: string
	terms_accepted_at?: string | null
	email_verified_at?: string | null
	notifications_enabled?: boolean
	marketing_enabled?: boolean
}

export interface ClientVehicle {
	id: string
	vin?: string | null
	tp?: string | null
	orv?: string | null
	title?: string | null
	brand?: string | null
	model?: string | null
	snapshot?: unknown
	created_at?: string
}

export type ReminderType =
	| 'stk'
	| 'povinne_ruceni'
	| 'havarijni_pojisteni'
	| 'servis'
	| 'prezuti_pneu'
	| 'dalnicni_znamka'
	| 'jine'

export interface Reminder {
	id: string
	vehicle_id: string
	type: ReminderType
	due_date: string
	note?: string | null
	is_done: boolean
	created_at?: string
	email_enabled?: boolean
	email_send_at?: string | null
	email_sent_at?: string | null
}

export interface OdometerReading {
	id: string
	vehicle_id: string
	recorded_at: string
	km: number
	note?: string | null
	created_at?: string
}
