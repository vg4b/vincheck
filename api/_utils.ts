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

/**
 * Parse a Postgres connection string into a URL, tolerating unencoded passwords.
 *
 * Provider-generated passwords routinely contain characters that are structural
 * in a URL — `?` starts the query, `#` the fragment, `/` the path — so
 * `new URL()` rejects the whole string with a bare "Invalid URL" that names
 * nothing. In CI it is worse: the connection string is a masked secret, so the
 * error prints `input: '***'` and the real cause is invisible. Percent-encode
 * the credentials before parsing so any password works as typed, encoded or not.
 *
 * Splits on the LAST `@`, so a password containing `@` is handled too; the host
 * portion of a Postgres URL never contains one.
 */
export function parsePostgresUrl(raw: string): URL {
	const m = raw.match(/^([a-zA-Z][\w+.-]*:\/\/)(.*)$/s)
	if (!m) {
		throw new Error(
			'connection string is not a URL (expected postgres://user:password@host:port/db)'
		)
	}
	const [, scheme, rest] = m
	const at = rest.lastIndexOf('@')
	if (at === -1) return new URL(raw) // no credentials to encode

	const userinfo = rest.slice(0, at)
	const hostAndPath = rest.slice(at + 1)
	const colon = userinfo.indexOf(':')
	const user = colon === -1 ? userinfo : userinfo.slice(0, colon)
	const password = colon === -1 ? null : userinfo.slice(colon + 1)

	const encoded =
		password === null
			? encodeUserinfo(user)
			: `${encodeUserinfo(user)}:${encodeUserinfo(password)}`
	return new URL(`${scheme}${encoded}@${hostAndPath}`)
}

// Encode only what would break the parse, so an already-encoded password (%3F)
// survives untouched and is not double-encoded.
function encodeUserinfo(s: string): string {
	return (
		s
			// A lone `%` that does not begin a valid escape is itself invalid.
			.replace(/%(?![0-9A-Fa-f]{2})/g, '%25')
			.replace(/[?#/[\]@\\ ]/g, (c) => {
				return `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`
			})
	)
}
