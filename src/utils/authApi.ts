import { AuthUser } from '../types'
import { requestJson } from './apiClient'

export const fetchCurrentUser = async (): Promise<AuthUser | null> => {
	try {
		const response = await requestJson<{ user: AuthUser }>('/api/auth/me')
		return response.user
	} catch {
		return null
	}
}

export const loginUser = async (
	email: string,
	password: string
): Promise<AuthUser> => {
	const response = await requestJson<{ user: AuthUser }>('/api/auth/login', {
		method: 'POST',
		body: JSON.stringify({ email, password })
	})
	return response.user
}

export interface RegisterOptions {
	email: string
	password: string
	termsAccepted: boolean
	marketingEnabled: boolean
}

export interface RegisterResponse {
	user: AuthUser
	needsVerification: boolean
	verificationCode?: string // only in development
}

export const registerUser = async (
	options: RegisterOptions
): Promise<RegisterResponse> => {
	const response = await requestJson<RegisterResponse>('/api/auth/register', {
		method: 'POST',
		body: JSON.stringify(options)
	})
	return response
}

export const verifyEmail = async (code: string): Promise<AuthUser> => {
	const response = await requestJson<{ user: AuthUser }>('/api/auth/verify-email', {
		method: 'POST',
		body: JSON.stringify({ code })
	})
	return response.user
}

export const resendVerification = async (): Promise<{ success: boolean }> => {
	return requestJson<{ success: boolean }>('/api/auth/resend-verification', {
		method: 'POST'
	})
}

export const logoutUser = async (): Promise<void> => {
	await requestJson('/api/auth/logout', {
		method: 'POST'
	})
}
