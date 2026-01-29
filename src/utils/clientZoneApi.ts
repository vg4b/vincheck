import { ClientVehicle, Reminder, ReminderType } from '../types'
import { requestJson } from './apiClient'

export const fetchVehicles = async (): Promise<ClientVehicle[]> => {
	const response = await requestJson<{ vehicles: ClientVehicle[] }>(
		'/api/client/vehicles'
	)
	return response.vehicles
}

export const addVehicle = async (payload: {
	vin?: string
	tp?: string
	orv?: string
	title?: string
	brand?: string
	model?: string
	snapshot?: unknown
}): Promise<ClientVehicle> => {
	const response = await requestJson<{ vehicle: ClientVehicle }>(
		'/api/client/vehicles',
		{
			method: 'POST',
			body: JSON.stringify(payload)
		}
	)
	return response.vehicle
}

export const deleteVehicle = async (id: string): Promise<void> => {
	await requestJson(`/api/client/vehicles?id=${encodeURIComponent(id)}`, {
		method: 'DELETE'
	})
}

export const updateVehicleTitle = async (
	id: string,
	title: string | null
): Promise<ClientVehicle> => {
	const response = await requestJson<{ vehicle: ClientVehicle }>(
		'/api/client/vehicles',
		{
			method: 'PATCH',
			body: JSON.stringify({ id, title })
		}
	)
	return response.vehicle
}

export const fetchReminders = async (
	vehicleId?: string
): Promise<Reminder[]> => {
	const url = vehicleId
		? `/api/client/reminders?vehicleId=${encodeURIComponent(vehicleId)}`
		: '/api/client/reminders'
	const response = await requestJson<{ reminders: Reminder[] }>(url)
	return response.reminders
}

export const createReminder = async (payload: {
	vehicleId: string
	type: ReminderType
	dueDate: string
	note?: string
	emailEnabled?: boolean
	emailSendAt?: string
}): Promise<Reminder> => {
	const response = await requestJson<{ reminder: Reminder }>(
		'/api/client/reminders',
		{
			method: 'POST',
			body: JSON.stringify(payload)
		}
	)
	return response.reminder
}

export const updateReminder = async (payload: {
	id: string
	dueDate?: string
	note?: string
	isDone?: boolean
	emailEnabled?: boolean
	emailSendAt?: string | null
}): Promise<Reminder> => {
	const response = await requestJson<{ reminder: Reminder }>(
		'/api/client/reminders',
		{
			method: 'PATCH',
			body: JSON.stringify(payload)
		}
	)
	return response.reminder
}

export const deleteReminder = async (id: string): Promise<void> => {
	await requestJson(`/api/client/reminders?id=${encodeURIComponent(id)}`, {
		method: 'DELETE'
	})
}

// Preferences API
export interface UserPreferences {
	notifications_enabled: boolean
	marketing_enabled: boolean
}

export const fetchPreferences = async (): Promise<UserPreferences> => {
	const response = await requestJson<{ preferences: UserPreferences }>(
		'/api/client/preferences'
	)
	return response.preferences
}

export const updatePreferences = async (payload: {
	notificationsEnabled?: boolean
	marketingEnabled?: boolean
}): Promise<UserPreferences> => {
	const response = await requestJson<{ preferences: UserPreferences }>(
		'/api/client/preferences',
		{
			method: 'PATCH',
			body: JSON.stringify(payload)
		}
	)
	return response.preferences
}
