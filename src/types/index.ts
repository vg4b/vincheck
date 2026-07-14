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
export type SubjectType = 'company' | 'private' | 'unknown'

/** Usage signals derived from the registry's equipment records. Mirrors
 *  `EquipmentFlag` in api/_vehicleEquipment.ts — keep the two in sync. */
export type EquipmentFlag =
	| 'drivingSchool'
	| 'emergency'
	| 'utility'
	| 'gasPowered'
	| 'towing'
	| 'heavyDuty'
	| 'adapted'

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
		/** Full owner/operator timeline (oldest first). Individuals are
		 *  anonymised — ico/nazev stay null, only dates + relation are shown. */
		timeline: Array<{
			subjectType: SubjectType
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
			/** Synthetic administrative record (e.g. new-vehicle initial validity),
			 *  not a real inspection — shown but not marked as a pravidelná STK. */
			administrative: boolean
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
	/** Import records. Non-empty = imported; the CZ registry has no foreign
	 *  history for it (where a Cebia report adds the most value). */
	imports: Array<{
		country: string | null
		date: string | null
	}>
	/** Additional equipment / modifications the registry records. The usage flags
	 *  (ex-driving-school, ex-emergency, LPG retrofit) are the valuable part — no
	 *  other field reveals them. ABS/airbag/ASR are excluded: the technical data
	 *  already covers them, better.
	 *
	 *  IMPORTANT: the registry's record may be incomplete, so a missing item is
	 *  NOT evidence the vehicle lacks it. Copy must say "registr eviduje…", never
	 *  "vozidlo nemá…".
	 *
	 *  Optional: absent from certificate snapshots frozen before this shipped, and
	 *  from responses served by the live-API fallback. */
	equipment?: {
		items: Array<{
			type: string
			label: string
			from: string | null
			/** Removal date, when recorded. Removed items stay listed: the usage
			 *  history is the point (a beacon removed in 2022 still means years of
			 *  emergency service), so they are marked, not hidden. */
			to: string | null
			removed: boolean
			flag: EquipmentFlag | null
		}>
		flags: Record<EquipmentFlag, boolean>
	}
	/** Odometer/mileage TEASER from the official STK/emission inspections (ISTP).
	 *  Exact km are a paid feature and are NOT sent to the client — only the
	 *  reading count, the inspection dates (already public via the STK history),
	 *  and whether a rollback is suspected. Full figures are in the certificate. */
	mileage: {
		count: number
		rollbackSuspected: boolean
		readings: Array<{ date: string; protocol: string | null }>
		/** True when an "expected mileage now" estimate is available. The figure
		 *  itself is paid — the free view shows only a blurred teaser. */
		hasPrediction?: boolean
	}
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
