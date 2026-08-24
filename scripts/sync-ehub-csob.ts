/**
 * Syncs everything we track about the ČSOB campaign from the eHub v3 API:
 *
 *   1. src/config/csobCoupons.generated.json — the live coupon list (runtime).
 *   2. docs/ehub/csob-campaign.json — a snapshot of the campaign TERMS
 *      (commission rates, restrictions, cookie lifetime).
 *
 * (2) exists because ČSOB is becoming our only insurance partner, so a silent
 * change to its terms is a business risk, not a detail. A newly added restriction
 * can retroactively invalidate how we promote it ("dotčené provize" get rejected),
 * and a commission cut changes the economics. The job fails loudly on either.
 *
 * Why this exists: ČSOB rotates its discount coupons MONTHLY (the "Sleva X %"
 * ones all expire on the last day of the month). Hand-maintaining the list means
 * the coupon block silently empties out — between 2026-04 and 2026-08 every
 * coupon in the repo was expired and the ČSOB section rendered nothing on all
 * three insurance pages, with nothing to signal it.
 *
 * Usage:
 *   EHUB_PARTNER_ID=… EHUB_API_KEY=… npx tsx scripts/sync-ehub-coupons.ts
 *   …                                 npx tsx scripts/sync-ehub-coupons.ts --check
 *
 * --check exits 1 when the file would change, without writing (for CI drift
 * detection). Without it the file is written and the exit code is 0.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** ČSOB Pojišťovna on eHub. Same id the publisher manager shows. */
const CAMPAIGN_ID = '174174d6'
const API_BASE = 'https://api.ehub.cz/v3'
const OUT_PATH = resolve(
	import.meta.dirname,
	'../src/config/csobCoupons.generated.json'
)
const CAMPAIGN_SNAPSHOT_PATH = resolve(
	import.meta.dirname,
	'../docs/ehub/csob-campaign.json'
)

/** The voucher list is not filterable server-side, so it has to be paged whole. */
const PAGE_SIZE = 50
const MAX_PAGES = 200

type EhubVoucher = {
	id: number
	campaignId: string
	campaignName: string
	code: string | null
	type: string
	rules: string
	/** Ready-made tracking URL. Already carries a_aid/a_bid and, where the
	 *  campaign defines one, the desturl. Use it verbatim: rebuilding it from
	 *  destinationUrl would be wrong, because destinationUrl can contain
	 *  unresolved template variables such as {$publisherNumericId}. */
	url: string
	destinationUrl: string | null
	validFrom: string
	validTill: string
	isValid: boolean
}

export type CsobCoupon = {
	id: string
	label: string
	shortLabel: string
	url: string
	validFrom: string
	validTo: string
	sortOrder: number
}

/**
 * Short chip label. The API only gives the long `rules` text, so derive one.
 * Anything unrecognised falls back to the full text: too long on the page, but
 * never wrong, which is the right way round for money-facing copy.
 */
function shortLabelFor(rules: string): string {
	const r = rules.trim()

	const sleva = r.match(/^Sleva\s+(\d+)\s*%\s+na\s+(.+?)\s+při\s+online/i)
	if (sleva) {
		const [, pct, productRaw] = sleva
		const product = productRaw.toLowerCase()
		const short = product.includes('auto')
			? 'autopojištění'
			: product.includes('cestovní')
				? 'cestovní'
				: product.includes('odpovědnosti')
					? 'odpovědnost'
					: product.includes('majetku')
						? 'majetek'
						: productRaw
		return `${pct} % ${short}`
	}

	if (/EuroOil/i.test(r)) return 'Poukázka EuroOil 1 000 Kč'
	if (/CCS karta/i.test(r)) return 'CCS karta 1 000 Kč'
	if (/e-kniha/i.test(r)) return 'E-kniha zdarma'

	return r
}

/**
 * Ordering on the page. This is a car site, so vehicle offers lead, travel
 * follows, everything else after; ties break on the soonest expiry.
 */
function sortKey(rules: string, validTo: string): [number, string] {
	const r = rules.toLowerCase()
	const group =
		r.includes('autopojištění') || r.includes('vozidel')
			? 0
			: r.includes('cestov')
				? 1
				: 2
	return [group, validTo]
}

type EhubCommission = {
	commissionType: string
	name?: string
	valueType: string
	value: number
}

type EhubCampaign = {
	id: string
	name: string
	commissionGroups: {
		name: string
		status: string
		commissions: EhubCommission[]
	}[]
	restrictions: { name: string; description: string; note: string | null }[]
	restrictedWords: string
	averageAmount: number
	cookieLifetime: number
	maxApprovalInterval: number
	defaultLink: string
}

/** The fields worth diffing. The full record carries volatile stats we do not
 *  want to churn the snapshot on (averageAmount moves every day). */
type CampaignSnapshot = {
	id: string
	name: string
	cookieLifetime: number
	maxApprovalInterval: number
	defaultLink: string
	restrictedWords: string
	commissions: { key: string; type: string; value: number; unit: string }[]
	restrictions: string[]
}

function snapshotOf(c: EhubCampaign): CampaignSnapshot {
	const commissions = c.commissionGroups
		.flatMap((g) => g.commissions)
		.map((k) => ({
			key: k.name?.trim() || '(default)',
			type: k.commissionType,
			value: k.value,
			unit: k.valueType
		}))
		.sort((a, b) => a.key.localeCompare(b.key) || a.type.localeCompare(b.type))
	return {
		id: c.id,
		name: c.name,
		cookieLifetime: c.cookieLifetime,
		maxApprovalInterval: c.maxApprovalInterval,
		defaultLink: c.defaultLink,
		restrictedWords: c.restrictedWords,
		commissions,
		restrictions: c.restrictions.map((r) => r.name).sort()
	}
}

async function fetchCampaign(
	partnerId: string,
	apiKey: string
): Promise<EhubCampaign | null> {
	for (let page = 1; page <= 40; page++) {
		const res = await fetch(
			`${API_BASE}/publishers/${partnerId}/campaigns?apiKey=${apiKey}&page=${page}`
		)
		if (!res.ok)
			throw new Error(`eHub campaigns page ${page}: HTTP ${res.status}`)
		const body = (await res.json()) as { campaigns?: EhubCampaign[] }
		const batch = body.campaigns ?? []
		if (batch.length === 0) return null
		const hit = batch.find((c) => c.id === CAMPAIGN_ID)
		if (hit) return hit
		if (batch.length < PAGE_SIZE) return null
	}
	return null
}

/**
 * Compares the new snapshot with the committed one.
 * Returns the lines to print and whether the change needs a human NOW.
 */
function diffCampaign(
	prev: CampaignSnapshot | null,
	next: CampaignSnapshot
): { lines: string[]; breaking: boolean } {
	if (!prev) return { lines: ['campaign: first snapshot'], breaking: false }

	const lines: string[] = []
	let breaking = false

	const addedRestrictions = next.restrictions.filter(
		(r) => !prev.restrictions.includes(r)
	)
	const removedRestrictions = prev.restrictions.filter(
		(r) => !next.restrictions.includes(r)
	)
	// A NEW restriction can retroactively make how we already promote the
	// campaign a violation, so it must stop the job rather than land in a diff
	// nobody reads.
	for (const r of addedRestrictions) {
		lines.push(`BREAKING new restriction: ${r}`)
		breaking = true
	}
	for (const r of removedRestrictions) lines.push(`restriction lifted: ${r}`)

	const prevByKey = new Map(
		prev.commissions.map((c) => [`${c.key}|${c.type}`, c])
	)
	for (const c of next.commissions) {
		const before = prevByKey.get(`${c.key}|${c.type}`)
		if (!before) {
			lines.push(`new commission: ${c.key} ${c.type} ${c.value}${c.unit}`)
			continue
		}
		if (before.value !== c.value) {
			const dir = c.value < before.value ? 'BREAKING cut' : 'raise'
			lines.push(
				`${dir}: ${c.key} ${c.type} ${before.value}${before.unit} -> ${c.value}${c.unit}`
			)
			if (c.value < before.value) breaking = true
		}
	}
	const nextKeys = new Set(next.commissions.map((c) => `${c.key}|${c.type}`))
	for (const c of prev.commissions) {
		if (!nextKeys.has(`${c.key}|${c.type}`)) {
			lines.push(`BREAKING commission removed: ${c.key} ${c.type}`)
			breaking = true
		}
	}

	if (prev.cookieLifetime !== next.cookieLifetime) {
		const dir = next.cookieLifetime < prev.cookieLifetime ? 'BREAKING ' : ''
		lines.push(
			`${dir}cookie: ${prev.cookieLifetime}d -> ${next.cookieLifetime}d`
		)
		if (next.cookieLifetime < prev.cookieLifetime) breaking = true
	}
	if (prev.defaultLink !== next.defaultLink) lines.push('default link changed')
	if (prev.restrictedWords !== next.restrictedWords) {
		lines.push(
			`restricted words: "${prev.restrictedWords}" -> "${next.restrictedWords}"`
		)
	}

	return { lines, breaking }
}

async function fetchPage(
	partnerId: string,
	apiKey: string,
	page: number
): Promise<EhubVoucher[]> {
	const url = `${API_BASE}/publishers/${partnerId}/vouchers?apiKey=${apiKey}&page=${page}`
	const res = await fetch(url)
	if (!res.ok) {
		// Never echo the URL: it carries the API key.
		throw new Error(`eHub vouchers page ${page}: HTTP ${res.status}`)
	}
	const body = (await res.json()) as { vouchers?: EhubVoucher[] }
	return body.vouchers ?? []
}

async function main() {
	const partnerId = process.env.EHUB_PARTNER_ID
	const apiKey = process.env.EHUB_API_KEY
	if (!partnerId || !apiKey) {
		console.error('EHUB_PARTNER_ID and EHUB_API_KEY must be set')
		process.exit(1)
	}

	const checkOnly = process.argv.includes('--check')

	// --- campaign terms -------------------------------------------------------
	const campaign = await fetchCampaign(partnerId, apiKey)
	if (!campaign) {
		console.error(`campaign ${CAMPAIGN_ID} not found — is it still approved?`)
		process.exit(1)
	}
	const snapshot = snapshotOf(campaign)
	const prevRaw = existsSync(CAMPAIGN_SNAPSHOT_PATH)
		? readFileSync(CAMPAIGN_SNAPSHOT_PATH, 'utf8')
		: ''
	const prev = prevRaw ? (JSON.parse(prevRaw) as CampaignSnapshot) : null
	const { lines, breaking } = diffCampaign(prev, snapshot)
	for (const l of lines) console.log(`campaign: ${l}`)

	const snapshotPayload = `${JSON.stringify(snapshot, null, '\t')}\n`
	if (snapshotPayload !== prevRaw && !checkOnly) {
		writeFileSync(CAMPAIGN_SNAPSHOT_PATH, snapshotPayload)
		console.log(`wrote ${CAMPAIGN_SNAPSHOT_PATH}`)
	}

	// --- coupons --------------------------------------------------------------
	const byId = new Map<number, EhubVoucher>()
	let pages = 0
	for (let page = 1; page <= MAX_PAGES; page++) {
		const batch = await fetchPage(partnerId, apiKey, page)
		pages = page
		if (batch.length === 0) break
		for (const v of batch) byId.set(v.id, v)
		if (batch.length < PAGE_SIZE) break
	}

	const mine = [...byId.values()].filter((v) => v.campaignId === CAMPAIGN_ID)
	const valid = mine.filter((v) => v.isValid)

	console.log(
		`stats: pages=${pages} vouchers=${byId.size} csob=${mine.length} valid=${valid.length}`
	)

	// A campaign with zero live coupons is possible but far more likely to mean
	// the feed changed shape. Refuse to blank the site's coupon block on it.
	if (valid.length === 0) {
		console.error(
			'refusing to write an empty coupon list — check the campaign on ehub.cz'
		)
		process.exit(1)
	}

	const coupons: CsobCoupon[] = valid
		.sort((a, b) => {
			const ka = sortKey(a.rules, a.validTill)
			const kb = sortKey(b.rules, b.validTill)
			return ka[0] - kb[0] || ka[1].localeCompare(kb[1])
		})
		.map((v, i) => ({
			id: String(v.id),
			label: v.rules.trim(),
			shortLabel: shortLabelFor(v.rules),
			url: v.url,
			validFrom: v.validFrom,
			validTo: v.validTill,
			sortOrder: i
		}))

	const payload = `${JSON.stringify(coupons, null, '\t')}\n`
	const current = existsSync(OUT_PATH) ? readFileSync(OUT_PATH, 'utf8') : ''

	for (const c of coupons) {
		console.log(`  ${c.validFrom}..${c.validTo}  ${c.shortLabel}`)
	}

	if (payload === current) {
		console.log('coupons unchanged')
		if (breaking) {
			console.error(
				'campaign terms changed in a way that needs review — see BREAKING lines above'
			)
			process.exit(1)
		}
		return
	}

	if (checkOnly) {
		console.error('coupon list is out of date — run without --check to update')
		process.exit(1)
	}

	writeFileSync(OUT_PATH, payload)
	console.log(`wrote ${OUT_PATH}`)

	// Deliberately last: the files are already written, so a breaking change is
	// still committed and visible in the diff. The non-zero exit is the alarm,
	// not a rollback.
	if (breaking) {
		console.error(
			'campaign terms changed in a way that needs review — see BREAKING lines above'
		)
		process.exit(1)
	}
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : String(err))
	process.exit(1)
})
