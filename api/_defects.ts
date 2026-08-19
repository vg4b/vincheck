/**
 * STK defect codes → Czech text.
 *
 * The ISTP feed reports each defect as a bare code ("4.1.1.2.1") plus a severity
 * letter. `_defectCatalog.json` is a vendored snapshot of příloha č. 1 to
 * vyhláška č. 211/2018 Sb. (refresh with scripts/fetch-defect-catalog.ts).
 *
 * Catalog coverage is era-dependent, so resolution degrades in three steps:
 *   1. exact catalog hit          → official Czech text
 *   2. dotted code, no hit        → group label from the leading segment
 *   3. non-dotted code, no hit    → severity only (pre-2018 4-digit numbering)
 *
 * Measured against 260 615 real defect occurrences from 2009–2026: 100 % of
 * codes resolve for 2021+, ~80–90 % for 2012–2018, and 0 % for 2009, which uses
 * the wholly different pre-2018 numeric system.
 */

import catalog from './_defectCatalog.json'

export type DefectSeverity = 'A' | 'B' | 'C' | 'unknown'

export interface ResolvedDefect {
	code: string
	severity: DefectSeverity
	/** Official text from the vyhláška; null when the code is not in the catalog. */
	text: string | null
	/** Group label from the leading segment; null for non-dotted legacy codes. */
	group: string | null
}

/**
 * Leading segment → inspection area. The grouping is Annex I of Directive
 * 2014/45/EU, which vyhláška 211/2018 transposes; labels verified against the
 * catalog's own entries for each group.
 */
const GROUP_LABEL: Record<string, string> = {
	'0': 'identifikace vozidla',
	'1': 'brzdy',
	'2': 'řízení',
	'3': 'výhled',
	'4': 'osvětlení',
	'5': 'nápravy, kola a pneumatiky',
	'6': 'podvozek a karoserie',
	'7': 'ostatní výbava',
	'8': 'obtěžování okolí',
	'9': 'doplňkové kontroly'
}

const BY_CODE: Map<string, { description: string; type: string }> = new Map(
	(catalog as Array<{ code: string; description: string; type: string }>).map(
		(e) => [e.code, { description: e.description, type: e.type }]
	)
)

function toSeverity(raw: string | null | undefined): DefectSeverity {
	const v = (raw ?? '').trim().toUpperCase()
	return v === 'A' || v === 'B' || v === 'C' ? v : 'unknown'
}

/** Most severe first; unknown sorts last so it never leads the list. */
const SEVERITY_RANK: Record<DefectSeverity, number> = {
	C: 0,
	B: 1,
	A: 2,
	unknown: 3
}

/**
 * Resolve one defect. `severity` is the feed's own `Zavaznost`; the catalog's
 * severity is used only as a fallback when the feed didn't supply one (the two
 * agree on 98.9 % of matched occurrences, so the feed is treated as canonical).
 */
export function resolveDefect(
	code: string,
	severity?: string | null
): ResolvedDefect {
	const trimmed = (code ?? '').trim()
	const hit = BY_CODE.get(trimmed)
	const resolved = toSeverity(severity)
	return {
		code: trimmed,
		severity: resolved === 'unknown' ? toSeverity(hit?.type) : resolved,
		text: hit?.description ?? null,
		group: trimmed.includes('.')
			? (GROUP_LABEL[trimmed.split('.')[0]] ?? null)
			: null
	}
}

/**
 * Resolve a stored defect list.
 *
 * `severities` is the compact per-code string from migration 007 — one letter
 * per code, positionally aligned with `codes` ("BBA" = 1st B, 2nd B, 3rd A). A
 * short or missing string degrades to catalog-derived severity rather than
 * throwing, so a malformed row still renders.
 */
export function resolveDefects(
	codes: readonly string[] | null | undefined,
	severities?: string | null
): ResolvedDefect[] {
	if (!codes?.length) return []
	return codes
		.map((c, i) => resolveDefect(c, severities?.[i]))
		.filter((d) => d.code !== '')
		.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
}

/**
 * Short display label for one defect, for surfaces without room for the full
 * sentence (the certificate's summary tiles, dense lists).
 */
export function defectShortLabel(d: ResolvedDefect): string {
	return d.text ?? d.group ?? d.code
}
