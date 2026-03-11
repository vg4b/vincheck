/**
 * Shared API utilities
 */

export function getBaseUrl(): string {
	if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
		return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
	}
	return process.env.VERCEL_URL
		? `https://${process.env.VERCEL_URL}`
		: 'http://localhost:3000'
}

export function formatDate(dateStr: string): string {
	const date = new Date(dateStr)
	return date.toLocaleDateString('cs-CZ', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	})
}
