/**
 * Shared helpers for the certificate endpoints: code/token generation, price and
 * base-URL config, VIN masking. Kept separate so create/webhook/[code] stay DRY.
 */
import crypto from 'crypto'

// Unambiguous alphabet (no 0/O/1/I) for human-readable, phone-friendly codes.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Public certificate code, e.g. `VI-7F3K-9Q2T`. Printed on the PDF + verify page. */
export function generateCode(): string {
	const pick = (n: number) =>
		Array.from(
			{ length: n },
			() => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]
		).join('')
	return `VI-${pick(4)}-${pick(4)}`
}

/** Opaque token gating PDF re-download (lives in the emailed link). */
export function generateDownloadToken(): string {
	return crypto.randomBytes(24).toString('hex')
}

/**
 * Certificate display price in whole crowns (VAT-inclusive). Display-only — the
 * real charge is the Creem product's configured price, so keep them in sync.
 */
export function getCertificatePriceCzk(): number {
	const raw = Number(process.env.CERTIFICATE_PRICE_CZK)
	return Number.isFinite(raw) && raw > 0 ? raw : 99
}

/** Public site origin for building success/verify/download URLs. No trailing slash. */
export function getPublicBaseUrl(): string {
	return (process.env.PUBLIC_BASE_URL ?? 'https://vininfo.cz').replace(/\/$/, '')
}

/** Mask a VIN for public display: keep the first 3 and last 4 chars. */
export function maskVin(vin: string): string {
	if (vin.length <= 7) return vin
	return `${vin.slice(0, 3)}…${vin.slice(-4)}`
}
