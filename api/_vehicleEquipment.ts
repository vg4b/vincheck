/**
 * Classification of the RSV "doplňkové vybavení" registry rows
 * (vehicle_equipment) into display labels + buyer-relevant usage flags.
 *
 * Source: RSV_vozidla_doplnkove_vybaveni. 35 distinct types across ~12.5M rows.
 * See docs/plans/2026-07-14-001-feat-equipment-and-manufacturer-messages.md.
 *
 * WHAT THIS DATA IS (per the official dataset docs): equipment *additionally
 * fitted to the vehicle and recorded in the RSV* — NOT the factory equipment
 * spec. `Od` = "datum od kdy bylo/je vybavení na vozidle", `Do` = "datum do kdy
 * bylo vybavení na vozidle". Values are taken from the RSV without modification;
 * an empty value means the RSV simply doesn't hold it.
 *
 * That framing drives two rules:
 *   1. The UI must say so explicitly, or a bare "Klimatizace, Katalyzátor" list
 *      reads like a factory spec and a missing item reads as "the car lacks it".
 *   2. HONESTY CONSTRAINT: we cannot verify the record is complete for a given
 *      vehicle, so absence of a row is NOT evidence of absence of the equipment.
 *      Copy says "registr eviduje…", never "vozidlo nemá…".
 */

/** Usage signals worth surfacing prominently — not just an equipment list. */
export type EquipmentFlag =
	/** DVOJÍ OVLÁDÁNÍ — dual controls, i.e. an ex-driving-school car. */
	| 'drivingSchool'
	/** Blue/red beacon — ex-police / ambulance / fire. */
	| 'emergency'
	/** Orange beacon — ex-utility / service fleet. */
	| 'utility'
	/** LPG/CNG retrofit — affects value, insurance and STK obligations. */
	| 'gasPowered'
	/** Tow bar / coupling — a feature, but also towing wear. */
	| 'towing'
	/** Crane, plough, loader… — heavy commercial duty. */
	| 'heavyDuty'
	/** Disability / medical adaptation. */
	| 'adapted'

type EquipmentSpec = {
	/** Czech display label. */
	label: string
	/** Usage bucket, or null for plain equipment with no usage signal. */
	flag: EquipmentFlag | null
}

/**
 * Types deliberately NOT displayed: vehicle_registry already carries abs / asr
 * (explicit True/False) and airbag (an actual count), which is strictly more
 * informative than a presence-only row here. Rendering both would be redundant
 * and, worse, would imply "no row = no ABS" — which is false.
 */
const REDUNDANT_TYPES = new Set(['ABS', 'AIRBAG', 'ASR'])

/**
 * Keys are normalised (see `normaliseType`): the source has double spaces in
 * "MAJÁK  ORANŽOVÝ", "ZVEDACÍ  ČELO", "BOČNÍ  VOZÍK".
 */
const EQUIPMENT_TYPES: Record<string, EquipmentSpec> = {
	'TAŽNÉ ZAŘÍZENÍ': { label: 'Tažné zařízení', flag: 'towing' },
	ZÁVĚS: { label: 'Závěs', flag: 'towing' },
	TOČNICE: { label: 'Točnice (návěsový tahač)', flag: 'towing' },

	'POHON PLYNEM': { label: 'Pohon na plyn (LPG/CNG)', flag: 'gasPowered' },
	'PLYNOVÉ TOPENÍ': { label: 'Plynové topení', flag: null },

	'DVOJÍ OVLÁDÁNÍ': {
		label: 'Dvojí ovládání (autoškola)',
		flag: 'drivingSchool'
	},

	'MAJÁK MODRÝ': { label: 'Maják modrý', flag: 'emergency' },
	'MAJÁK ČERVENÝ': { label: 'Maják červený', flag: 'emergency' },
	'MAJÁK ORANŽOVÝ': { label: 'Maják oranžový', flag: 'utility' },

	'INVALIDNÍ ÚPRAVA': { label: 'Invalidní úprava', flag: 'adapted' },
	'ZDRAVOTNÍ ÚPRAVA': { label: 'Zdravotní úprava', flag: 'adapted' },

	'HYDRAULICKÁ RUKA': { label: 'Hydraulická ruka', flag: 'heavyDuty' },
	'SNĚHOVÝ PLUH': { label: 'Sněhový pluh', flag: 'heavyDuty' },
	RADLICE: { label: 'Radlice', flag: 'heavyDuty' },
	NAKLADAČ: { label: 'Nakladač', flag: 'heavyDuty' },
	'NAKLÁDACÍ PÁS': { label: 'Nakládací pás', flag: 'heavyDuty' },
	'ZVEDACÍ ČELO': { label: 'Zvedací čelo', flag: 'heavyDuty' },
	NAVIJÁK: { label: 'Naviják', flag: 'heavyDuty' },
	ČERPADLO: { label: 'Čerpadlo', flag: 'heavyDuty' },
	'PŘÍDAVNÝ FINIŠER': { label: 'Přídavný finišer', flag: 'heavyDuty' },
	'MĚŘÍCÍ APARATURA': { label: 'Měřící aparatura', flag: 'heavyDuty' },

	KATALYZÁTOR: { label: 'Katalyzátor', flag: null },
	KLIMATIZACE: { label: 'Klimatizace', flag: null },
	'OTVIRACÍ STŘECHA': { label: 'Otevírací střecha', flag: null },
	'NEZÁVISLÉ TOPENÍ': { label: 'Nezávislé topení', flag: null },
	'OMEZ. RYCHLOSTI': { label: 'Omezovač rychlosti', flag: null },
	'NESTANDARD. PNEU': { label: 'Nestandardní pneumatiky', flag: null },
	'DALŠÍ SVĚTLA': { label: 'Další světla', flag: null },
	'BOČNÍ VOZÍK': { label: 'Boční vozík', flag: null },
	PLACHTA: { label: 'Plachta', flag: null },
	'ZAVAZADL. SKŘÍŇ': { label: 'Zavazadlová skříň', flag: null },
	'ZVÝŠENÁ BOČNICE': { label: 'Zvýšená bočnice', flag: null }
}

/** Collapse the source's repeated whitespace and casing so keys match. */
function normaliseType(raw: string): string {
	return raw.replace(/\s+/g, ' ').trim().toUpperCase()
}

export type EquipmentItem = {
	/** Normalised source type, e.g. "TAŽNÉ ZAŘÍZENÍ". */
	type: string
	/** Czech display label. */
	label: string
	/** Date fitted, when the registry records one. */
	from: string | null
	/** Date removed, when the registry records one. Non-null = no longer fitted. */
	to: string | null
	/** True when the equipment was removed again (`to` is set). */
	removed: boolean
	flag: EquipmentFlag | null
}

export type VehicleEquipment = {
	/** Buyer-relevant equipment the registry records; redundant types removed. */
	items: EquipmentItem[]
	/** True when at least one item carries that usage signal. */
	flags: Record<EquipmentFlag, boolean>
}

export const EMPTY_EQUIPMENT: VehicleEquipment = {
	items: [],
	flags: {
		drivingSchool: false,
		emergency: false,
		utility: false,
		gasPowered: false,
		towing: false,
		heavyDuty: false,
		adapted: false
	}
}

/**
 * Build the equipment section from raw vehicle_equipment rows.
 *
 * REMOVED EQUIPMENT IS KEPT, not dropped. A blue beacon fitted 2003 and removed
 * 2022 still means the car spent 19 years in emergency service; dual controls
 * removed before the sale still mean an ex-autoškola car. Stripping the hardware
 * doesn't strip the wear, and taking it out shortly before selling is exactly the
 * case the buyer needs to see — so removal marks the item (`removed` + `to`) and
 * still raises the usage flag.
 *
 * Unknown types pass through with their raw name as the label, so a
 * newly-introduced registry type degrades gracefully instead of vanishing.
 */
export function buildEquipment(
	rows: Array<{ typ?: unknown; od?: unknown; do_?: unknown }>
): VehicleEquipment {
	const flags: Record<EquipmentFlag, boolean> = { ...EMPTY_EQUIPMENT.flags }
	const byType = new Map<string, EquipmentItem>()

	for (const row of rows) {
		const raw = typeof row.typ === 'string' ? row.typ : ''
		const type = normaliseType(raw)
		if (!type || REDUNDANT_TYPES.has(type)) continue

		const nonEmpty = (v: unknown) =>
			typeof v === 'string' && v.trim() !== '' ? v.trim() : null
		const from = nonEmpty(row.od)
		const to = nonEmpty(row.do_)

		const spec = EQUIPMENT_TYPES[type]
		const item: EquipmentItem = {
			type,
			label: spec?.label ?? raw.replace(/\s+/g, ' ').trim(),
			from,
			to,
			removed: to != null,
			flag: spec?.flag ?? null
		}

		// The source repeats a type per vehicle (e.g. fitted, removed, refitted).
		// Prefer the row that is still fitted — the vehicle has the equipment today
		// — and otherwise keep the one with the later removal date.
		const existing = byType.get(type)
		if (
			!existing ||
			(existing.removed && !item.removed) ||
			(existing.removed &&
				item.removed &&
				(item.to ?? '') > (existing.to ?? ''))
		) {
			byType.set(type, item)
		}

		// The flag fires on the HISTORY, so a removed item still raises it.
		if (spec?.flag) flags[spec.flag] = true
	}

	const items = [...byType.values()]

	// Still-fitted flagged items first (what the buyer acts on), then removed
	// flagged items, then the rest — alphabetical within each group.
	items.sort((a, b) => {
		if (!!a.flag !== !!b.flag) return a.flag ? -1 : 1
		if (a.removed !== b.removed) return a.removed ? 1 : -1
		return a.label.localeCompare(b.label, 'cs')
	})

	return { items, flags }
}
