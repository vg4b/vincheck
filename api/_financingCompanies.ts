/**
 * Server-side derivation over the public company list in
 * src/data/financingCompanies.ts. The list itself lives under src/ because it is
 * published at /leasingove-spolecnosti — the certificate points buyers at it, so
 * the page and the matching logic must never drift apart.
 */
import {
	FINANCING_COMPANIES,
	type FinancingKind
} from '../src/data/financingCompanies'

export { FINANCING_COMPANIES, type FinancingKind }

/** One matched financing/fleet/rental owner spell. `name` is ours, not the registry's. */
export type FinancingRecord = {
	ico: string
	name: string
	kind: FinancingKind
	relation: 'owner' | 'operator' | 'other'
	from: string | null
	to: string | null
	current: boolean
}

export type VehicleFinancing = {
	/** A leasing/fleet/rental subject appears anywhere in the owner history. */
	hasHistory: boolean
	/** A leasing/fleet subject is the CURRENT owner — the case that blocks a sale.
	 *  A current *operator* does not count (it isn't an ownership claim), and a
	 *  rental company's current ownership means "still in the fleet", which is a
	 *  different statement and gets different copy. */
	active: boolean
	records: FinancingRecord[]
}

export const EMPTY_FINANCING: VehicleFinancing = {
	hasHistory: false,
	active: false,
	records: []
}

/** Structural shape of an owner-timeline entry — kept local so this module never
 *  imports from _vehicleCache.ts (which imports this one). */
type TimelineEntry = {
	ico: string | null
	relation: 'owner' | 'operator' | 'other'
	from: string | null
	to: string | null
	current: boolean
}

/**
 * Match the owner/operator timeline against the curated allowlist.
 *
 * Pure — no query, no extra latency. Operating-lease vehicles carry the lessor
 * twice (once as owner, once as operator) for the same period; those collapse to
 * one record, keeping the owner row because ownership is what the buyer needs.
 */
export function buildFinancing(timeline: TimelineEntry[]): VehicleFinancing {
	const byPeriod = new Map<string, FinancingRecord>()
	for (const t of timeline) {
		if (!t.ico) continue
		const company = FINANCING_COMPANIES[t.ico]
		if (!company) continue
		// A rental company counts only where it OWNED the vehicle — rental fleets
		// are owned, so an operator-only row is weak evidence. It is also where the
		// renamed-IČO trap bites hardest: an IČO that trades as a carsharing
		// operator today may have been an unrelated business in 2002, and we would
		// otherwise badge a 20-year-old one-day operator row as "ex-půjčovna".
		if (company.kind === 'rental' && t.relation !== 'owner') continue
		// An IČO outlives the business behind it. Where the register shows the
		// entity previously traded as something else, ownership that STARTED
		// before the switch belongs to that earlier business — a Škoda 105 bought
		// by AUTOSALON LOUDA in 1999 did not become a carsharing car when the same
		// IČO renamed to CAR4WAY in 2013. Undated ownership is skipped too: we
		// can't place it, and inventing a claim is worse than staying quiet.
		if (company.since && (!t.from || t.from < company.since)) continue
		const key = `${t.ico}|${t.from ?? ''}|${t.to ?? ''}`
		const existing = byPeriod.get(key)
		// Ownership outranks the operator row for the same company and period.
		if (existing && existing.relation === 'owner') continue
		byPeriod.set(key, {
			ico: t.ico,
			name: company.name,
			kind: company.kind,
			relation: t.relation,
			from: t.from,
			to: t.to,
			current: t.current
		})
	}

	const sorted = [...byPeriod.values()].sort((a, b) =>
		(a.from ?? '').localeCompare(b.from ?? '')
	)

	// Merge back-to-back spells of the SAME company (registry churn splits one
	// lease into adjacent rows, e.g. 2013-12-18–2013-12-18 followed by
	// 2013-12-18–2015-05-14). Only contiguous spells merge — a genuine gap means
	// the vehicle was financed twice, which the buyer should see as two records.
	const records: FinancingRecord[] = []
	for (const r of sorted) {
		const prev = records[records.length - 1]
		if (prev && prev.ico === r.ico && prev.to && prev.to === r.from) {
			prev.to = r.to
			prev.current = r.current
			if (r.relation === 'owner') prev.relation = 'owner'
			continue
		}
		records.push({ ...r })
	}

	return {
		hasHistory: records.length > 0,
		active: records.some(
			(r) => r.current && r.relation === 'owner' && r.kind !== 'rental'
		),
		records
	}
}
