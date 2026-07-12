// Friendly labels for the registry `Palivo` (fuel) field. MIRRORS
// src/utils/fuelLabels.ts — the api/ and src/ projects compile separately and
// can't share a module, so keep the two copies in sync by hand.
//
// The column is uncurated free-text — ~1700+ distinct values in the cache:
// clean codes (NM, BA 95 B), octane variants, two-stroke "SMĚS" recipes, typos,
// and dual-fuel combos written many ways (`BA 95 B+LPG`, `BA 95 B / LPG`, …).
// An exhaustive enum is impossible, so we:
//   1. exact-match the clean high-frequency codes to a nice label, else
//   2. classify by recognizable tokens (base fuel + LPG/CNG/electro add-ons),
//      else
//   3. fall back to the raw value.
// In all cases the original registry value is shown in brackets, e.g.
// "Benzín Natural 95 (BA 95 B)", so nothing is hidden.

/** Normalize for lookup: trim, collapse inner whitespace, uppercase. */
function normalize(raw: string): string {
	return raw.trim().replace(/\s+/g, ' ').toUpperCase()
}

/** Registry placeholders that mean "unknown" rather than a fuel. */
const PLACEHOLDERS = new Set([
	'',
	'.',
	'-',
	'--',
	'---',
	'***',
	'**',
	'///',
	'0',
	'NAP'
])

function isPlaceholder(norm: string): boolean {
	return (
		PLACEHOLDERS.has(norm) ||
		norm.startsWith('- POLOŽKA') ||
		norm.startsWith('POLOŽKA NEBYLA') ||
		/^X{5,}$/.test(norm)
	)
}

/** Clean, high-frequency codes → friendly Czech label (keys are normalized). */
const FUEL_LABELS: Record<string, string> = {
	NM: 'Nafta',
	'BIO NM': 'Bionafta',
	'NM I NM BIO 48': 'Nafta (s biosložkou)',
	BA: 'Benzín',
	'BA 95 B': 'Benzín Natural 95',
	'BA 95': 'Benzín Natural 95',
	'BA 98 B': 'Benzín Natural 98',
	'BA 98': 'Benzín Natural 98',
	'BA 91 B': 'Benzín 91',
	'BA 91': 'Benzín 91',
	'BA 92 B': 'Benzín 92',
	'BA 90': 'Benzín Special 90',
	'BA 96': 'Benzín Super 96',
	'BA 80': 'Benzín 80',
	'BA 84': 'Benzín 84',
	'BA 88': 'Benzín 88',
	'BA SMĚS': 'Benzínová směs (2T)',
	EL: 'Elektřina',
	CNG: 'CNG (stlačený zemní plyn)',
	ZP: 'CNG (zemní plyn)',
	LPG: 'LPG',
	LNG: 'LNG',
	NG: 'Zemní plyn',
	VODÍK: 'Vodík'
}

/**
 * Classify the messy long tail by recognizable tokens. Returns a base label
 * (optionally with "+ LPG / + CNG / + elektro" for dual-fuel) or null if nothing
 * recognizable is found.
 */
function classifyFuel(norm: string): string | null {
	const lpg = /\bLPG\b/.test(norm)
	const cng = /\bCNG\b/.test(norm)
	const electro = /\bEL\b|ELEKTR|EL\./.test(norm)

	let base: string | null = null
	// `\bBA(\b|\d)` so the leading BA token matches whether written "BA 95 B",
	// "BA95B" or "BA+LPG" (no space before the digit / separator).
	if (/\bNM(\b|\d)|NAFTA|BIO ?NM|\bMN\b/.test(norm)) base = 'Nafta'
	else if (/\bBA(\b|\d)|BENZ|NATURAL|OKT/.test(norm)) base = 'Benzín'
	else if (electro) base = 'Elektřina'
	else if (/VODÍK|VODIK/.test(norm)) base = 'Vodík'
	else if (cng || /\bZP\b/.test(norm)) base = 'CNG'
	else if (/\bLNG\b/.test(norm)) base = 'LNG'
	else if (lpg) base = 'LPG'
	else if (/\bNG\b/.test(norm)) base = 'Zemní plyn'

	if (!base) return null

	const extras: string[] = []
	if (base !== 'LPG' && lpg) extras.push('LPG')
	if (base !== 'CNG' && cng) extras.push('CNG')
	if (base !== 'Elektřina' && electro) extras.push('elektro')
	return extras.length > 0 ? `${base} + ${extras.join(' + ')}` : base
}

/**
 * Full display for the spec table: "Friendly (raw)". Placeholders become
 * "Neuvedeno"; unclassifiable values fall back to the raw text unchanged.
 */
export function formatFuel(raw: string): string {
	if (!raw) return 'Neuvedeno'
	const trimmed = raw.trim()
	const norm = normalize(raw)
	if (isPlaceholder(norm)) return 'Neuvedeno'
	const label = FUEL_LABELS[norm] ?? classifyFuel(norm)
	return label ? `${label} (${trimmed})` : trimmed
}
