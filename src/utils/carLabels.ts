// Display helpers for registry brand/model strings (stored ALL-CAPS). Shared by
// the brand/model stats page and the /znacky hub so labels render identically.

// Brands that must NOT be title-cased (acronyms). Everything else: Title Case.
const KEEP_UPPER = new Set(['BMW', 'VW', 'MG', 'DS', 'KGM', 'DFSK', 'SWM'])

/** Title-case a brand/model, preserving known acronyms: "ŠKODA" → "Škoda". */
export function titleCase(s: string): string {
	return s
		.split(/\s+/)
		.map((w) =>
			KEEP_UPPER.has(w.toUpperCase())
				? w.toUpperCase()
				: w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
		)
		.join(' ')
}

// Title-case an ALL-CAPS registry label, across spaces and hyphens:
// "ŠEDÁ-METAL" → "Šedá-Metal", "BÍLÁ" → "Bílá".
export function niceLabel(s: string): string {
	return s
		.toLowerCase()
		.replace(/(^|[\s-])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase())
}
