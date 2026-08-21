/**
 * Read layer for the precomputed aggregate statistics (stats_model), powering the
 * public brand/model SEO pages. Lives in the vehicle-cache DB
 * (VEHICLE_CACHE_DATABASE_URL) alongside the registry cache; populated monthly by
 * scripts/compute-stats.sql. All reads are tiny indexed lookups over a few-hundred-
 * row table — the heavy aggregation is done at precompute time, never here.
 */
import { Pool } from 'pg'
import { parsePostgresUrl } from './_utils'

const CACHE_URL = process.env.VEHICLE_CACHE_DATABASE_URL

let pool: Pool | null = null

// Same Scaleway SSL handling as _vehicleCache.ts: strip sslmode (newer
// pg-connection-string maps sslmode=require to verify-full, which would reject the
// self-signed cert), then encrypt without CA verification.
function getPool(): Pool | null {
	if (!CACHE_URL) return null
	if (!pool) {
		const url = parsePostgresUrl(CACHE_URL)
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
	/** Engine variants the cohort fold merged, biggest first. Null when the model
	 *  has only one, so the page shows no breakdown rather than a list of one. */
	motorisations: Array<{ name: string; count: number }> | null
	/** Most frequent STK defect codes for the cohort. Codes only — the Czech text
	 *  is resolved at read time from the vendored catalog. */
	topDefects: Array<{ code: string; count: number; share: number }> | null
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
		motorisations:
			(r.motorisations as Array<{ name: string; count: number }>) ?? null,
		topDefects:
			(r.top_defects as Array<{
				code: string
				count: number
				share: number
			}>) ?? null,
		computedAt: r.computed_at ? String(r.computed_at) : null
	}
}

const SELECT_COLS = `brand, model, vehicle_count, first_year, last_year,
  avg_age_years, fuel_split, avg_owners, pct_imported, pct_lpg, pct_towbar,
  stk_fail_pct, stk_inspections, median_km_by_age, color_split, motorisations,
  top_defects,
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

/**
 * A retired model slug's replacement, or null when there is none.
 *
 * compute-stats.sql folds engine variants into one cohort ("OCTAVIA 1.9 TDI" ->
 * "OCTAVIA") and records every slug it retires. Without this the fold would turn
 * ~500 URLs Google has already seen into 404s and discard their ranking.
 * Tolerates a missing table/grant like the other readers, so deploying this
 * before migration 008 lands degrades to a plain 404 rather than an error.
 */
export async function resolveModelAlias(
	brandSlug: string,
	modelSlug: string
): Promise<string | null> {
	const p = getPool()
	if (!p) return null
	try {
		const { rows } = await p.query(
			`SELECT model_slug FROM stats_model_alias
       WHERE brand_slug = $1 AND old_slug = $2 LIMIT 1`,
			[brandSlug, modelSlug]
		)
		return rows[0] ? String(rows[0].model_slug) : null
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

export type BrandStats = {
	brand: string
	/** The whole brand, including models below the publish floor — so this is
	 *  larger than the sum of the models listed on the hub. See migration 009. */
	vehicleCount: number
	modelCount: number
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

const BRAND_COLS = `brand, vehicle_count, model_count, first_year, last_year,
  avg_age_years, fuel_split, avg_owners, pct_imported, pct_lpg, pct_towbar,
  stk_fail_pct, stk_inspections, median_km_by_age, color_split,
  computed_at::text AS computed_at`

function mapBrand(r: Record<string, unknown>): BrandStats {
	const num = (v: unknown): number | null =>
		v === null || v === undefined ? null : Number(v)
	return {
		brand: String(r.brand),
		vehicleCount: Number(r.vehicle_count),
		modelCount: Number(r.model_count),
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

export type IndexBrand = {
	brand: string
	brandSlug: string
	vehicleCount: number
	modelCount: number
}

/**
 * Brands for the /znacky hub. Shipped alongside the model index in the same
 * response so the hub needs one request, not two.
 */
export async function getBrandIndex(): Promise<IndexBrand[]> {
	const p = getPool()
	if (!p) return []
	try {
		const { rows } = await p.query(
			`SELECT brand, ${slugSql('brand')} AS brand_slug, vehicle_count, model_count
			 FROM stats_brand ORDER BY vehicle_count DESC`
		)
		return rows.map((r) => ({
			brand: String(r.brand),
			brandSlug: String(r.brand_slug),
			vehicleCount: Number(r.vehicle_count),
			modelCount: Number(r.model_count)
		}))
	} catch (e: unknown) {
		const code = (e as { code?: string })?.code
		if (code === '42P01' || code === '42501') return []
		throw e
	}
}

/** One brand's stats by URL slug. Same 42P01/42501 tolerance as the model reader. */
export async function getBrandStatsBySlug(
	brandSlug: string
): Promise<BrandStats | null> {
	const p = getPool()
	if (!p) return null
	try {
		const { rows } = await p.query(
			`SELECT ${BRAND_COLS} FROM stats_brand
       WHERE ${slugSql('brand')} = $1 LIMIT 1`,
			[brandSlug]
		)
		return rows[0] ? mapBrand(rows[0]) : null
	} catch (e: unknown) {
		const code = (e as { code?: string })?.code
		if (code === '42P01' || code === '42501') return null
		throw e
	}
}

/** The models listed on a brand hub, biggest first. */
export async function getModelsForBrand(
	brandSlug: string
): Promise<IndexModel[]> {
	const p = getPool()
	if (!p) return []
	try {
		const { rows } = await p.query(
			`SELECT brand, model,
			        ${slugSql('brand')} AS brand_slug,
			        ${slugSql('model')} AS model_slug,
			        vehicle_count
			 FROM stats_model
			 WHERE ${slugSql('brand')} = $1
			 ORDER BY vehicle_count DESC`,
			[brandSlug]
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

/** Every brand hub as a slug, for the sitemap. */
export async function getAllPublishedBrands(): Promise<
	Array<{ brandSlug: string; lastmod: string | null }>
> {
	const p = getPool()
	if (!p) return []
	try {
		const { rows } = await p.query(
			`SELECT ${slugSql('brand')} AS brand_slug,
			        computed_at::date::text AS lastmod
			 FROM stats_brand ORDER BY vehicle_count DESC`
		)
		return rows.map((r) => ({
			brandSlug: String(r.brand_slug),
			lastmod: r.lastmod ? String(r.lastmod) : null
		}))
	} catch (e: unknown) {
		const code = (e as { code?: string })?.code
		if (code === '42P01' || code === '42501') return []
		throw e
	}
}

/**
 * The published ranking pages.
 *
 * Every entry is a RATE or an absolute the reader actually asked for, never a
 * raw count that just re-sorts the population. A "most stolen cars" list built
 * on counts reads ŠKODA 6 162 / VOLKSWAGEN 1 070 / FORD 920 — which is a list of
 * common cars, not stolen ones. Hence `minColumn`/`minValue`: a rate over a
 * small denominator is noise, and publishing it invites a correction.
 */
export type RankingDef = {
	slug: string
	title: string
	/** One sentence explaining what the number means, shown under the heading. */
	lede: string
	/** Column ranked on, and which way. */
	column: string
	direction: 'DESC' | 'ASC'
	/** Denominator guard: rows below this are excluded, not shown small. */
	minColumn: string
	minValue: number
	/**
	 * How the value renders. The distinction matters: stk_fail_pct is stored
	 * 0..100 while pct_lpg is stored 0..1, so treating both as 'pct' would print
	 * a 17.2 % LPG share as "0.2 %".
	 */
	unit: 'pct' | 'fraction' | 'count'
	/** Shown beside each row so the reader can judge the number. */
	contextColumn: string
	contextLabel: string
	/** How the context value renders — same distinction as `unit`. */
	contextUnit: 'pct' | 'fraction' | 'count'
	/** Column header for the ranked value, so a bare "4,7 %" is not left to
	 *  guesswork. The first version shipped without these and a reader had no
	 *  way to tell a failure rate from a share of anything else. */
	valueLabel: string
}

export const RANKINGS: RankingDef[] = [
	{
		slug: 'nejporuchovejsi-vozy',
		title: 'Vozy s nejvyšší poruchovostí při STK',
		lede: 'Podíl technických prohlídek, které skončily závadou. Počítáno z evidovaných prohlídek, ne z odhadů.',
		column: 'stk_fail_pct',
		direction: 'DESC',
		minColumn: 'stk_inspections',
		minValue: 2000,
		unit: 'pct',
		contextColumn: 'stk_inspections',
		contextLabel: 'prohlídek',
		contextUnit: 'count',
		valueLabel: 'závadných prohlídek'
	},
	{
		slug: 'nejspolehlivejsi-vozy',
		title: 'Vozy s nejnižší poruchovostí při STK',
		lede: 'Tytéž údaje z opačného konce: modely, které na technické prohlídce propadají nejméně často.',
		column: 'stk_fail_pct',
		direction: 'ASC',
		minColumn: 'stk_inspections',
		minValue: 2000,
		unit: 'pct',
		contextColumn: 'stk_inspections',
		contextLabel: 'prohlídek',
		contextUnit: 'count',
		valueLabel: 'závadných prohlídek'
	},
	{
		slug: 'nejrozsirenejsi-vozy',
		title: 'Nejrozšířenější vozy na českých silnicích',
		lede: 'Počet provozovaných vozidel podle registru silničních vozidel ČR.',
		column: 'vehicle_count',
		direction: 'DESC',
		minColumn: 'vehicle_count',
		minValue: 0,
		unit: 'count',
		contextColumn: 'stk_fail_pct',
		contextLabel: 'poruchovost STK',
		contextUnit: 'pct',
		valueLabel: 'vozidel v provozu'
	},
	{
		slug: 'nejcasteji-kradene-vozy',
		title: 'Nejčastěji kradené vozy v ČR',
		lede: 'Počet odcizených vozidel na 1 000 kusů daného modelu, které byly v provozu v letech 2021–2025. Uvádíme podíl, ne absolutní počet — ten by seřadil jen nejrozšířenější auta.',
		column: 'theft_per_1000',
		direction: 'DESC',
		// theft_per_1000 is already NULL below the numerator floor, so the guard
		// here is only the denominator. Both are needed: a rate over few cars is
		// as unpublishable as one over few thefts.
		minColumn: 'theft_fleet',
		minValue: 5000,
		unit: 'count',
		contextColumn: 'theft_count',
		contextLabel: 'odcizeno 2021–2025',
		contextUnit: 'count',
		valueLabel: 'na 1 000 vozů'
	},
	{
		slug: 'vozy-na-lpg',
		title: 'Vozy nejčastěji přestavěné na LPG nebo CNG',
		lede: 'Podíl vozidel daného modelu s evidovanou přestavbou na plyn.',
		column: 'pct_lpg',
		direction: 'DESC',
		minColumn: 'vehicle_count',
		minValue: 2000,
		unit: 'fraction',
		contextColumn: 'vehicle_count',
		contextLabel: 'vozidel',
		contextUnit: 'count',
		valueLabel: 'přestavěno na plyn'
	}
]

export type RankingRow = {
	brand: string
	model: string
	brandSlug: string
	modelSlug: string
	value: number
	context: number | null
}

/** One ranking's rows. Reads the precomputed table, so this is a 764-row sort. */
export async function getRanking(
	def: RankingDef,
	limit = 30
): Promise<RankingRow[]> {
	const p = getPool()
	if (!p) return []
	try {
		// Column names come from RANKINGS above, never from the request — the slug
		// is matched against that list first, so nothing user-supplied is
		// interpolated here.
		const { rows } = await p.query(
			`SELECT brand, model,
			        ${slugSql('brand')} AS brand_slug,
			        ${slugSql('model')} AS model_slug,
			        ${def.column} AS value,
			        ${def.contextColumn} AS context
			 FROM stats_model
			 WHERE ${def.column} IS NOT NULL AND ${def.minColumn} >= $1
			 ORDER BY ${def.column} ${def.direction}
			 LIMIT $2`,
			[def.minValue, limit]
		)
		return rows.map((r) => ({
			brand: String(r.brand),
			model: String(r.model),
			brandSlug: String(r.brand_slug),
			modelSlug: String(r.model_slug),
			value: Number(r.value),
			context: r.context === null ? null : Number(r.context)
		}))
	} catch (e: unknown) {
		const code = (e as { code?: string })?.code
		if (code === '42P01' || code === '42501') return []
		throw e
	}
}
