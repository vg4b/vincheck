import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { AuthUser } from '../types'
import {
	fetchCurrentUser,
	loginUser,
	logoutUser,
	registerUser,
	RegisterOptions,
	RegisterResponse,
	verifyEmail as verifyEmailApi,
	resendVerification as resendVerificationApi
} from '../utils/authApi'

interface AuthContextValue {
	user: AuthUser | null
	loading: boolean
	login: (email: string, password: string) => Promise<void>
	register: (options: RegisterOptions) => Promise<RegisterResponse>
	logout: () => Promise<void>
	verifyEmail: (code: string) => Promise<void>
	resendVerification: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const STORAGE_KEY = 'vininfo_user'

const readStoredUser = (): AuthUser | null => {
	if (typeof window === 'undefined') {
		return null
	}
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY)
		if (!raw) {
			return null
		}
		const parsed = JSON.parse(raw) as AuthUser
		if (parsed?.id && parsed?.email) {
			return parsed
		}
	} catch {
		// ignore storage errors
	}
	return null
}

const persistUser = (user: AuthUser | null) => {
	if (typeof window === 'undefined') {
		return
	}
	try {
		if (user) {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
		} else {
			window.localStorage.removeItem(STORAGE_KEY)
		}
	} catch {
		// ignore storage errors
	}
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
	children
}) => {
	const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())
	const [loading, setLoading] = useState(() => !readStoredUser())

	useEffect(() => {
		const storedUser = readStoredUser()
		
		// Only call /api/auth/me if we have a stored user (to validate session)
		// If no stored user, assume not logged in and skip the API call
		if (!storedUser) {
			setLoading(false)
			return
		}

		let isMounted = true
		fetchCurrentUser()
			.then((currentUser) => {
				if (isMounted) {
					setUser(currentUser)
					setLoading(false)
					persistUser(currentUser)
				}
			})
			.catch(() => {
				if (isMounted) {
					setUser(null)
					setLoading(false)
					persistUser(null)
				}
			})

		return () => {
			isMounted = false
		}
	}, [])

	const login = async (email: string, password: string) => {
		const nextUser = await loginUser(email, password)
		setUser(nextUser)
		persistUser(nextUser)
	}

	const register = async (options: RegisterOptions): Promise<RegisterResponse> => {
		const response = await registerUser(options)
		setUser(response.user)
		persistUser(response.user)
		return response
	}

	const verifyEmail = async (code: string) => {
		const verifiedUser = await verifyEmailApi(code)
		setUser(verifiedUser)
		persistUser(verifiedUser)
	}

	const resendVerification = async () => {
		await resendVerificationApi()
	}

	const logout = async () => {
		await logoutUser()
		setUser(null)
		persistUser(null)
	}

	const value = useMemo(
		() => ({
			user,
			loading,
			login,
			register,
			logout,
			verifyEmail,
			resendVerification
		}),
		[user, loading]
	)

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
	const context = useContext(AuthContext)
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider')
	}
	return context
}
