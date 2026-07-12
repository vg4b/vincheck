/**
 * Composite-field formatting for the web technical-data table. MIRRORS
 * api/_vehicleFieldLabels.ts (COMPOSITE_FIELDS + formatCompositeField) — the
 * api/ and src/ projects compile separately and can't share a module, so keep
 * the two copies in sync by hand.
 *
 * Many registry fields pack several sub-values into one string with a `|`/`/`
 * separator hierarchy and frequently-empty parts. We parse each into labelled
 * segments (Variant 2), dropping empty/placeholder-zero parts POSITIONALLY (the
 * label is paired with a fixed index, so dropping a middle part never re-indexes
 * the survivors). Falls back to the raw value for shapes that don't match.
 * See docs/plans/2026-07-10-001-improve-technical-data-display.md.
 */

import { formatFuel } from './fuelLabels'

export interface FieldSegment {
	label?: string
	value: string
}
export interface FormattedComposite {
	segments: FieldSegment[]
	unit?: string
	/** Render each segment on its own line (long per-axle tyre specs). */
	multiline?: boolean
}

type ZeroPolicy = 'keep' | 'empty' | 'electric'
type CompositeSpec =
	| {
			kind: 'split'
			sep: string
			parts: { label?: string; unit?: string }[]
			zero: ZeroPolicy
			unit?: string
			/** Render an empty part as "0" instead of dropping it — only where a
			 *  missing count genuinely means zero (e.g. míst k stání). */
			fillZero?: boolean
			/** Strip a leading "- " artifact from each part (e.g. "2/ - 1 PŘEDNÍ"). */
			stripDash?: boolean
	  }
	| {
			kind: 'axles'
			groupSep: string
			zero: ZeroPolicy
			unit?: string
			tightSlash?: boolean
			/** Render each axle on its own line (long per-axle tyre specs). */
			multiline?: boolean
	  }

const COMPOSITE_FIELDS: Record<string, CompositeSpec> = {
	VozidloKaroserieMist: {
		kind: 'split',
		sep: '/',
		zero: 'keep',
		fillZero: true,
		parts: [{ label: 'celkem' }, { label: 'k sezení' }, { label: 'k stání' }]
	},
	Rozmery: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'mm',
		parts: [{ label: 'délka' }, { label: 'šířka' }, { label: 'výška' }]
	},
	RozmeryRozvor: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'mm',
		parts: [{}]
	},
	HmotnostiProvozni: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'kg',
		parts: [{}]
	},
	MotorZdvihObjem: {
		kind: 'split',
		sep: '/',
		zero: 'electric',
		unit: 'cm³',
		parts: [{}]
	},
	NejvyssiRychlost: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'km/h',
		parts: [{}]
	},
	Rozchod: { kind: 'axles', groupSep: '/', zero: 'empty', unit: 'mm' },
	HmotnostiPripPov: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'kg',
		parts: [{ label: 'přípustná' }, { label: 'povolená' }]
	},
	HmotnostiPripPovBrzdenePV: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'kg',
		parts: [{ label: 'přípustná' }, { label: 'povolená' }]
	},
	HmotnostiPripPovNebrzdenePV: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'kg',
		parts: [{ label: 'přípustná' }, { label: 'povolená' }]
	},
	HmotnostiPripPovJS: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'kg',
		parts: [{ label: 'přípustná' }, { label: 'povolená' }]
	},
	HmotnostiPripPovN: {
		kind: 'axles',
		groupSep: '|',
		zero: 'empty',
		unit: 'kg',
		tightSlash: true
	},
	NapravyPneuRafky: {
		kind: 'axles',
		groupSep: '|',
		zero: 'empty',
		multiline: true
	},
	HmotnostiProvozniDo: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'kg',
		parts: [{}]
	},
	RozmeryLoznaDelka: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'mm',
		parts: [{}]
	},
	RozmeryLoznaSirka: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'mm',
		parts: [{}]
	},
	MotorMaxVykon: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		parts: [{ unit: 'kW' }, { label: 'při', unit: 'min⁻¹' }]
	},
	NapravyPocetDruh: {
		kind: 'split',
		sep: '/',
		zero: 'keep',
		stripDash: true,
		parts: [{ label: 'počet' }, { label: 'poháněná' }]
	},
	HlukJizda: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		parts: [{ unit: 'dB(A)' }]
	},
	SpotrebaNa100Km: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'l/100 km',
		parts: [
			{ label: 'město' },
			{ label: 'mimo město' },
			{ label: 'kombinovaná' }
		]
	},
	SpotrebaPriRychlosti: {
		// Same quantity in two units (g/km and l/100 km) — units, not labels.
		kind: 'split',
		sep: '/',
		zero: 'empty',
		parts: [{ unit: 'g/km' }, { unit: 'l/100 km' }]
	},
	EmiseCO2: {
		kind: 'split',
		sep: '/',
		zero: 'electric',
		unit: 'g/km',
		parts: [
			{ label: 'město' },
			{ label: 'mimo město' },
			{ label: 'kombinovaná' }
		]
	},
	EmiseEHKOSNEHSES: {
		// The ES/EU part itself contains "/" (e.g. "566/2011F"), so the two
		// homologation fields are separated by " / " (spaces), not a bare "/".
		kind: 'split',
		sep: ' / ',
		zero: 'keep',
		parts: [{ label: 'EHK-OSN' }, { label: 'ES/EU' }]
	},
	HlukStojiciOtacky: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		parts: [
			{ label: 'hluk', unit: 'dB(A)' },
			{ label: 'otáčky', unit: 'min⁻¹' }
		]
	}
}

function isEmptySubpart(v: string): boolean {
	return v.replace(/[.,;|/\s-]/g, '') === ''
}
function isZeroLike(v: string): boolean {
	return /^0+([.,]0+)?$/.test(v.replace(/\s/g, ''))
}

/**
 * Parse a composite registry field into labelled segments. Returns `null` for a
 * non-composite field, `'hide'` when every part is empty after policy, else the
 * labelled segments.
 */
export function formatCompositeField(
	key: string,
	raw: string,
	opts: { electric: boolean }
): FormattedComposite | 'hide' | null {
	const spec = COMPOSITE_FIELDS[key]
	if (!spec) return null
	const dropZero =
		spec.zero === 'empty' || (spec.zero === 'electric' && !opts.electric)
	const isEmpty = (v: string): boolean =>
		isEmptySubpart(v) || (dropZero && isZeroLike(v.trim()))

	const segments: FieldSegment[] = []
	if (spec.kind === 'split') {
		const raws = String(raw).split(spec.sep)
		let hasReal = false
		spec.parts.forEach((p, i) => {
			let v = (raws[i] ?? '').trim()
			if (spec.stripDash) v = v.replace(/^[-–]\s*/, '').trim()
			if (isEmpty(v)) {
				if (!spec.fillZero) return
				v = '0'
			} else {
				hasReal = true
			}
			segments.push({ label: p.label, value: p.unit ? `${v} ${p.unit}` : v })
		})
		// fillZero fabricates "0" for empty parts; if EVERY part was empty the
		// whole field is meaningless (e.g. seats " /  / ") — drop it entirely so
		// the PDF matches the web, which already hides the blank raw value.
		if (spec.fillZero && !hasReal) return 'hide'
	} else {
		String(raw)
			.split(spec.groupSep)
			.forEach((g, i) => {
				let v = g.trim()
				if (isEmpty(v)) return
				if (spec.tightSlash) v = v.replace(/\s*\/\s*/g, '/')
				segments.push({ label: `${i + 1}. náprava`, value: v })
			})
	}
	if (segments.length === 0) return 'hide'
	return {
		segments,
		unit: spec.unit,
		multiline: spec.kind === 'axles' ? spec.multiline : undefined
	}
}

// Vehicle category (J) — https://cs.wikipedia.org/wiki/Kategorie_vozidel
const CATEGORY_LABELS_MAP: Record<string, string> = {
	M1: 'osobní automobil',
	M2: 'autobus (do 5 t)',
	M3: 'autobus (nad 5 t)',
	N1: 'nákladní (do 3,5 t)',
	N2: 'nákladní (3,5–12 t)',
	N3: 'nákladní (nad 12 t)',
	O1: 'přípojné (do 0,75 t)',
	O2: 'přípojné (0,75–3,5 t)',
	O3: 'přípojné (3,5–10 t)',
	O4: 'přípojné (nad 10 t)',
	T: 'traktor',
	C: 'pásový traktor',
	R: 'přípojné zemědělské',
	S: 'tažené stroje'
}

// Registration-plate type by "Varianta RZ" code range.
const RZ_VARIANT_RANGES: [number, number, string][] = [
	[101, 119, 'běžná (silniční)'],
	[131, 138, 'manipulační'],
	[151, 158, 'zemědělská / pracovní'],
	[161, 178, 'vývozní (převozní)'],
	[201, 219, 'diplomatická'],
	[221, 239, 'diplomatická (omezená)'],
	[241, 259, 'ambasáda – služební personál'],
	[261, 278, 'honorární konzul'],
	[351, 357, 'zkušební'],
	[401, 419, 'historické vozidlo'],
	[501, 519, 'sportovní vozidlo'],
	[581, 599, 'sportovní vozidlo'],
	[602, 602, 'nosič jízdních kol'],
	[701, 719, 'na přání'],
	[801, 819, 'elektromobil']
]

/**
 * Map a coded scalar value ("M1", "101") to "code – human label". Returns null
 * for keys/values without a mapping (caller keeps the raw value).
 */
export function mapCodeValue(key: string, raw: string): string | null {
	const v = raw.trim()
	if (key === 'Palivo') {
		return formatFuel(v)
	}
	if (key === 'Kategorie') {
		const label =
			CATEGORY_LABELS_MAP[v.toUpperCase()] ??
			(/^L\d/i.test(v) ? 'motocykl / moped' : null)
		return label ? `${v} – ${label}` : null
	}
	if (key === 'VariantaRz' || key === 'RzVarianta') {
		const n = Number.parseInt(v, 10)
		if (Number.isNaN(n)) return null
		const hit = RZ_VARIANT_RANGES.find(([lo, hi]) => n >= lo && n <= hi)
		return hit ? `${v} – ${hit[2]}` : null
	}
	return null
}
