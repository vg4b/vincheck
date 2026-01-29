export class ApiError extends Error {
	status: number

	constructor(message: string, status: number) {
		super(message)
		this.status = status
	}
}

export const requestJson = async <T>(
	url: string,
	options: RequestInit = {}
): Promise<T> => {
	const response = await fetch(url, {
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...(options.headers ?? {})
		},
		...options
	})

	if (!response.ok) {
		let message = 'Request failed'
		try {
			const payload = await response.json()
			if (payload?.error) {
				message = payload.error
			}
		} catch (error) {
			// ignore parsing errors
		}
		throw new ApiError(message, response.status)
	}

	return response.json()
}
