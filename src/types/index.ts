export interface VehicleDataItem {
	name: string
	value: string | number | boolean
	label: string
}

export interface VehicleData {
	Status?: string
	Data?: Record<string, string | number | boolean>
}

export type VehicleDataArray = VehicleDataItem[]

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
