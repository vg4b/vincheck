/**
 * Read layer for the precomputed aggregate statistics (stats_model), powering the
 * public brand/model SEO pages. Lives in the vehicle-cache DB
 * (VEHICLE_CACHE_DATABASE_URL) alongside the registry cache; populated monthly by
 * scripts/compute-stats.sql. All reads are tiny indexed lookups over a few-hundred-
 * row table — the heavy aggregation is done at precompute time, never here.
 */
import { Pool } from 'pg'

const CACHE_URL = process.env.VEHICLE_CACHE_DATABASE_URL

let pool: Pool | null = null

// Same Scaleway SSL handling as _vehicleCache.ts: strip sslmode (newer
// pg-connection-string maps sslmode=require to verify-full, which would reject the
// self-signed cert), then encrypt without CA verification.
function getPool(): Pool | null {
	if (!CACHE_URL) return null
	if (!pool) {
		const url = new URL(CACHE_URL)
		const needsSsl = url.searchParams.has('sslmode')
		url.searchParams.delete('sslmode')
		pool = new Pool({
			connectionString: url.toString(),
			ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
			max: 2,
			idleTimeoutMillis: 10_000,
			connectionTimeoutMillis: 5_000
		})
		pool.on('error', (err) => {
			console.error('stats pool error:', err.message)
		})
	}
	return pool
}

export type ModelStats = {
	brand: string
	model: string
	vehicleCount: number
	firstYear: number | null
	lastYear: number | null
	avgAgeYears: number | null
	fuelSplit: Record<string, number> | null
	avgOwners: number | null
	pctImported: number | null
	pctLpg: number | null
	pctTowbar: number | null
	stkFailPct: number | null
	stkInspections: number | null
	medianKmByAge: Record<string, number> | null
	colorSplit: Record<string, number> | null
	computedAt: string | null
}

function mapRow(r: Record<string, unknown>): ModelStats {
	const num = (v: unknown): number | null =>
		v === null || v === undefined ? null : Number(v)
	return {
		brand: String(r.brand),
		model: String(r.model),
		vehicleCount: Number(r.vehicle_count),
		firstYear: num(r.first_year),
		lastYear: num(r.last_year),
		avgAgeYears: num(r.avg_age_years),
		fuelSplit: (r.fuel_split as Record<string, number>) ?? null,
		avgOwners: num(r.avg_owners),
		pctImported: num(r.pct_imported),
		pctLpg: num(r.pct_lpg),
		pctTowbar: num(r.pct_towbar),
		stkFailPct: num(r.stk_fail_pct),
		stkInspections: num(r.stk_inspections),
		medianKmByAge: (r.median_km_by_age as Record<string, number>) ?? null,
		colorSplit: (r.color_split as Record<string, number>) ?? null,
		computedAt: r.computed_at ? String(r.computed_at) : null
	}
}

const SELECT_COLS = `brand, model, vehicle_count, first_year, last_year,
  avg_age_years, fuel_split, avg_owners, pct_imported, pct_lpg, pct_towbar,
  stk_fail_pct, stk_inspections, median_km_by_age, color_split,
  computed_at::text AS computed_at`

// Diacritic fold, shared by slugify (JS) and the SQL lookup so a URL slug and a DB
// value map to the SAME string. Covers the European Latin diacritics that appear
// in car-brand names (Citroën, Škoda, …), not just Czech. Keep the two maps
// identical and lowercase (both sides lowercase first).
const CZ_FROM = 'àáâãäåçèéêëìíîïðñòóôõöùúûüýÿčďěňřšťůž'
const CZ_TO = 'aaaaaaceeeeiiiidnooooouuuuyycdenrstuz'

/** URL slug for a brand/model value: fold Czech diacritics, lowercase, hyphenate. */
export function slugify(s: string): string {
	let out = ''
	for (const ch of s.toLowerCase()) {
		const i = CZ_FROM.indexOf(ch)
		out += i >= 0 ? CZ_TO[i] : ch
	}
	return out.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// SQL expression mirroring slugify() for a column, so WHERE matches a URL slug.
const slugSql = (col: string) =>
	`btrim(regexp_replace(translate(lower(${col}), '${CZ_FROM}', '${CZ_TO}'), '[^a-z0-9]+', '-', 'g'), '-')`

/**
 * One model's stats by URL slug (e.g. "skoda", "octavia"). Returns null on a miss,
 * a missing table (42P01 — not yet computed), or a missing grant (42501), so the
 * caller can 404 cleanly rather than error.
 */
export async function getModelStatsBySlug(
	brandSlug: string,
	modelSlug: string
): Promise<ModelStats | null> {
	const p = getPool()
	if (!p) return null
	try {
		const { rows } = await p.query(
			`SELECT ${SELECT_COLS} FROM stats_model
       WHERE ${slugSql('brand')} = $1 AND ${slugSql('model')} = $2 LIMIT 1`,
			[brandSlug, modelSlug]
		)
		return rows[0] ? mapRow(rows[0]) : null
	} catch (e: unknown) {
		const code = (e as { code?: string })?.code
		if (code === '42P01' || code === '42501') return null
		throw e
	}
}

export type PublishedModel = {
	brandSlug: string
	modelSlug: string
	lastmod: string | null
}

export type IndexModel = {
	brand: string
	model: string
	brandSlug: string
	modelSlug: string
	vehicleCount: number
}

/**
 * All published cohorts for the /znacky hub: raw names (for display) + slugs (for
 * links) + count (for ordering/grouping). Ordered by brand then size. Empty on a
 * missing table/grant.
 */
export async function getModelIndex(): Promise<IndexModel[]> {
	const p = getPool()
	if (!p) return []
	try {
		const { rows } = await p.query(
			`SELECT brand, model,
			        ${slugSql('brand')} AS brand_slug,
			        ${slugSql('model')} AS model_slug,
			        vehicle_count
			 FROM stats_model
			 ORDER BY brand, vehicle_count DESC`
		)
		return rows.map((r) => ({
			brand: String(r.brand),
			model: String(r.model),
			brandSlug: String(r.brand_slug),
			modelSlug: String(r.model_slug),
			vehicleCount: Number(r.vehicle_count)
		}))
	} catch (e: unknown) {
		const code = (e as { code?: string })?.code
		if (code === '42P01' || code === '42501') return []
		throw e
	}
}

/**
 * Every published cohort as URL slugs, for the sitemap. Slugs are built in SQL
 * with the SAME fold as slugify()/getModelStatsBySlug, so each emitted URL
 * resolves. Ordered by size so the most important pages lead. Empty on a missing
 * table/grant (same tolerance as the single-row lookup).
 */
export async function getAllPublishedModels(): Promise<PublishedModel[]> {
	const p = getPool()
	if (!p) return []
	try {
		const { rows } = await p.query(
			`SELECT ${slugSql('brand')} AS brand_slug,
			        ${slugSql('model')} AS model_slug,
			        computed_at::date::text AS lastmod
			 FROM stats_model
			 ORDER BY vehicle_count DESC`
		)
		return rows.map((r) => ({
			brandSlug: String(r.brand_slug),
			modelSlug: String(r.model_slug),
			lastmod: r.lastmod ? String(r.lastmod) : null
		}))
	} catch (e: unknown) {
		const code = (e as { code?: string })?.code
		if (code === '42P01' || code === '42501') return []
		throw e
	}
}
