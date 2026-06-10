import { Pool } from 'pg'

/**
 * Read-only lookup layer over the RSV vehicle-data cache (Scaleway Postgres).
 *
 * Produces the SAME `{ Status, Data }` envelope the live API
 * (api.dataovozidlech.cz/vehicletechnicaldata) returns, so it is a drop-in for
 * api/vehicle.js. Registry columns are mapped to the live API's PascalCase keys;
 * the handful of fields the API derives (STK due date, owner counts) are
 * composed from the companion tables.
 *
 * Connection via VEHICLE_CACHE_DATABASE_URL (separate DB from the app's
 * POSTGRES_URL). See docs/VEHICLE_DATA_CACHE.md.
 */

const CACHE_URL = process.env.VEHICLE_CACHE_DATABASE_URL

let pool: Pool | null = null

function getPool(): Pool | null {
	if (!CACHE_URL) {
		return null
	}
	if (!pool) {
		// Scaleway managed PG uses a self-signed cert, so we encrypt but don't
		// verify the CA (rejectUnauthorized:false) — acceptable for v1; harden
		// later by shipping Scaleway's CA bundle. We strip sslmode from the URL
		// first: newer pg-connection-string maps sslmode=require to verify-full,
		// which forces CA verification and would override the ssl option below
		// (-> "self-signed certificate" connection error).
		const url = new URL(CACHE_URL)
		const needsSsl = url.searchParams.has('sslmode')
		url.searchParams.delete('sslmode')
		pool = new Pool({
			connectionString: url.toString(),
			ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
			max: 3,
			idleTimeoutMillis: 10_000,
			connectionTimeoutMillis: 5_000
		})
		// Don't let a transient idle-client error crash the function.
		pool.on('error', (err) => {
			console.error('vehicle cache pool error:', err.message)
		})
	}
	return pool
}

export function isCacheConfigured(): boolean {
	return Boolean(CACHE_URL)
}

/** vehicle_registry column -> live API `Data` key. Columns absent here (ABS,
 *  airbag, brzdy_*, pcv, …) are intentionally omitted: the live API doesn't
 *  return them, so neither do we, keeping the two responses identical. */
const COLUMN_TO_API_KEY: Record<string, string> = {
	datum_prvni_registrace: 'DatumPrvniRegistrace',
	datum_prvni_registrace_v_cr: 'DatumPrvniRegistraceVCr',
	ztp: 'CisloTypovehoSchvaleni',
	es_eu: 'HomologaceEs',
	druh_vozidla: 'VozidloDruh',
	druh_vozidla_2r: 'VozidloDruh2',
	kategorie_vozidla: 'Kategorie',
	tovarni_znacka: 'TovarniZnacka',
	typ: 'Typ',
	varianta: 'Varianta',
	verze: 'Verze',
	vin: 'VIN',
	obchodni_oznaceni: 'ObchodniOznaceni',
	vyrobce_vozidla: 'VozidloVyrobce',
	vyrobce_motoru: 'MotorVyrobce',
	typ_motoru: 'MotorTyp',
	max_vykon: 'MotorMaxVykon',
	palivo: 'Palivo',
	zdvihovy_objem: 'MotorZdvihObjem',
	plne_elektricke_vozidlo: 'VozidloElektricke',
	hybridni_vozidlo: 'VozidloHybridni',
	trida_hybridniho_vozidla: 'VozidloHybridniTrida',
	emisni_limit: 'EmiseEHKOSNEHSES',
	stupen_plneni_emisni_urovne: 'EmisniUroven',
	korigovany_soucinitel_absorbce: 'EmiseKSA',
	co2_mesto_mimo_kombi: 'EmiseCO2',
	specificke_co2: 'EmiseCO2Specificke',
	snizeni_emisi_nedc: 'EmiseSnizeniNedc',
	snizeni_emisi_wltp: 'EmiseSnizeniWltp',
	spotreba_predpis: 'SpotrebaMetodika',
	spotreba_mesto_mimo_kombi: 'SpotrebaNa100Km',
	spotreba_pri_rychlosti: 'SpotrebaPriRychlosti',
	spotreba_el_mobil: 'SpotrebaEl',
	dojezd_zr: 'DojezdZR',
	vyrobce_karoserie: 'VyrobceKaroserie',
	karoserie_druh_typ: 'KaroserieDruh',
	vyrobni_cislo_karoserie: 'KaroserieVyrobniCislo',
	barva: 'VozidloKaroserieBarva',
	barva_doplnkova: 'VozidloKaroserieBarvaDoplnkova',
	pocet_mist: 'VozidloKaroserieMist',
	celkova_delka_sirka_vyska: 'Rozmery',
	rozvor: 'RozmeryRozvor',
	rozchod: 'Rozchod',
	provozni_hmotnost: 'HmotnostiProvozni',
	max_hmotnost_kg: 'HmotnostiPripPov',
	max_hmotnost_na_napravu: 'HmotnostiPripPovN',
	max_hmotnost_pripoj_brzdene: 'HmotnostiPripPovBrzdenePV',
	max_hmotnost_pripoj_nebrzdene: 'HmotnostiPripPovNebrzdenePV',
	max_hmotnost_jizdni_soupravy: 'HmotnostiPripPovJS',
	hmotnosti_wltp: 'HmotnostiTestWltp',
	prumer_uzitecne_zatizeni: 'HmotnostUzitecneZatizeniPrumer',
	spojovaci_zarizeni_druh: 'VozidloSpojZarizNazev',
	pocet_naprav_pohanene: 'NapravyPocetDruh',
	kola_pneumatiky: 'NapravyPneuRafky',
	vnejsi_hluk_stojici: 'HlukStojiciOtacky',
	hluk_za_jizdy: 'HlukJizda',
	nejvyssi_rychlost: 'NejvyssiRychlost',
	pomer_vykon_hmotnost: 'PomerVykonHmotnost',
	inovativni_technologie: 'InovativniTechnologie',
	stupen_dokonceni: 'StupenDokonceni',
	faktor_odchylky_de: 'FaktorOdchylkyDe',
	faktor_verifikace_vf: 'FaktorVerifikaceVf',
	ucel_vozidla: 'VozidloUcel',
	dalsi_zaznamy: 'DalsiZaznamy',
	alternativni_provedeni: 'AlternativniProvedeni',
	cislo_tp: 'CisloTp',
	cislo_orv: 'CisloOrv',
	druh_rz: 'RzDruh',
	zarazeni_vozidla: 'ZarazeniVozidla',
	status: 'StatusNazev',
	doplnkovy_text_tp: 'DoplnkovyTextNaTp',
	hmotnosti_provozni_do: 'HmotnostiProvozniDo',
	hmotnosti_zatizeni_sz: 'HmotnostiZatizeniSZ',
	hmotnosti_zatizeni_sz_typ: 'HmotnostiZatizeniSZTyp',
	cislo_motoru: 'MotorCislo',
	rok_vyroby: 'RokVyroby',
	delka_do: 'RozmeryDelkaDo',
	lozna_delka: 'RozmeryLoznaDelka',
	lozna_sirka: 'RozmeryLoznaSirka',
	vyska_do: 'RozmeryVyskaDo',
	typ_kod: 'TypKod',
	rm_zaniku: 'RmZaniku',
	stupen_autonomity_vozidla: 'VozidloAutonomniStupen',
	varianta_rz: 'RzVarianta'
}

// CSV stores these as 'true'/'false'; the live API returns 'ANO'/'NE'.
const ANO_NE_COLUMNS = new Set(['plne_elektricke_vozidlo', 'hybridni_vozidlo'])

// Registry date columns stored as 'YYYY-MM-DD'; the live API suffixes 'T00:00:00'.
const DATE_COLUMNS = new Set([
	'datum_prvni_registrace',
	'datum_prvni_registrace_v_cr'
])

function withMidnight(dateStr: string): string {
	return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T00:00:00` : dateStr
}

function transformRegistryValue(column: string, raw: unknown): unknown {
	if (raw === null || raw === undefined) {
		return raw
	}
	const value = String(raw)
	if (ANO_NE_COLUMNS.has(column)) {
		const lowered = value.toLowerCase()
		if (lowered === 'true') return 'ANO'
		if (lowered === 'false') return 'NE'
		return value
	}
	if (DATE_COLUMNS.has(column) && value !== '') {
		return withMidnight(value)
	}
	return value
}

function nullIfEmpty(v: unknown): string | null {
	if (v === null || v === undefined) return null
	const s = String(v).trim()
	return s === '' ? null : s
}

// Some date columns carry sentinel placeholders (1900-01-01 / 1901-01-01) for
// "unknown". Treat anything before 1950 as not a real date.
function plausibleDate(s: string | null): string | null {
	if (!s) return null
	const m = s.match(/^(\d{4})-/)
	return m && Number(m[1]) >= 1950 ? s : null
}

type StkResult = 'pass' | 'defects' | 'unfit' | 'unknown'

// vehicle_inspections.stav: A = passed, B = defects, C = unfit, else unknown.
function stavToResult(stav: unknown): StkResult {
	switch (nullIfEmpty(stav)?.toUpperCase()) {
		case 'A':
			return 'pass'
		case 'B':
			return 'defects'
		case 'C':
			return 'unfit'
		default:
			return 'unknown'
	}
}

type OwnerRelation = 'owner' | 'operator' | 'other'

// vehicle_owners.vztah_k_vozidlu: 1 owner, 2 operator, 3 co-owner, 4 acquirer.
function ownerRelation(vztah: unknown): OwnerRelation {
	const v = nullIfEmpty(vztah)
	if (v === '2') return 'operator'
	if (v === '1' || v === '3' || v === '4') return 'owner'
	return 'other'
}

type SubjectType = 'company' | 'private' | 'unknown'

// vehicle_owners.typ_subjektu: 1 individual (ROB), 2 legal entity (ROS), 3 unidentified.
function subjectType(typ: unknown): SubjectType {
	const v = nullIfEmpty(typ)
	if (v === '2') return 'company'
	if (v === '1') return 'private'
	return 'unknown'
}

/** Public-registry "history-lite" composed from the companion tables. Present
 *  only on a cache hit (a live-API fallback can't produce it). See
 *  docs/VEHICLE_HISTORY_PANEL.md. */
export type VehicleHistory = {
	owners: {
		total: number
		operators: number
		companies: number
		everCompanyOwned: boolean
		currentlyCompany: boolean
		companyOwners: Array<{
			ico: string | null
			nazev: string | null
			from: string | null
			to: string | null
			current: boolean
			relation: OwnerRelation
		}>
		/** Full owner/operator timeline (oldest first). Individuals are
		 *  anonymised — only dates, relation and the `private` subject type;
		 *  ico/nazev stay null. Legal entities expose ico/nazev. */
		timeline: Array<{
			subjectType: SubjectType
			ico: string | null
			nazev: string | null
			from: string | null
			to: string | null
			current: boolean
			relation: OwnerRelation
		}>
	}
	inspections: {
		total: number
		failed: number
		distinctStations: number
		latest: {
			result: StkResult
			platnostDo: string | null
			nazevStk: string | null
		} | null
		history: Array<{
			date: string | null
			result: StkResult
			nazevStk: string | null
			typ: string | null
			/** Synthetic administrative record (kod_stk '9999', e.g. a new
			 *  vehicle's initial validity) — not a real inspection. */
			administrative: boolean
		}>
	}
	flags: {
		stolen: boolean
		exported: boolean
		deregistered: boolean
		insuranceLapsed: boolean
		statusLabel: string | null
	}
	deregistrations: Array<{
		from: string | null
		to: string | null
		reason: string | null
	}>
	/** Import records (from vehicle_imports). Non-empty = vehicle was imported;
	 *  the CZ registry holds no foreign history for it. */
	imports: Array<{
		country: string | null
		date: string | null
	}>
	snapshot: string | null
}

export type VehicleCacheResult = {
	response: { Status: number; Data: Record<string, unknown> }
	snapshot: string | null
	history: VehicleHistory
}

type LookupParams = { vin?: string; tp?: string; orv?: string }

const LOOKUP_COLUMNS: Record<keyof LookupParams, string> = {
	vin: 'vin',
	tp: 'cislo_tp',
	orv: 'cislo_orv'
}

/**
 * Look a vehicle up in the cache by VIN / Číslo TP / Číslo ORV.
 * Returns null if the cache isn't configured or the vehicle isn't present.
 */
export async function lookupVehicleFromCache(
	params: LookupParams
): Promise<VehicleCacheResult | null> {
	const p = getPool()
	if (!p) {
		return null
	}

	let column: string | undefined
	let value: string | undefined
	if (params.vin) {
		column = LOOKUP_COLUMNS.vin
		value = params.vin
	} else if (params.tp) {
		column = LOOKUP_COLUMNS.tp
		value = params.tp
	} else if (params.orv) {
		column = LOOKUP_COLUMNS.orv
		value = params.orv
	}
	if (!column || !value) {
		return null
	}

	// `column` comes from a fixed allowlist above, never user input.
	const registry = await p.query(
		`SELECT * FROM vehicle_registry WHERE ${column} = $1 LIMIT 1`,
		[value]
	)
	if (registry.rowCount === 0) {
		return null
	}
	const row = registry.rows[0] as Record<string, unknown>
	const pcv = row.pcv

	const [inspections, owners, meta, ownerRows, inspRecent, dereg, imports] =
		await Promise.all([
			p.query(
				// kod_stk '9999' is the registry sentinel for synthetic administrative
				// records ("Administrativní omezení - nové vozidlo": a new vehicle's
				// initial STK validity, not a real inspection). Keep it in the due-date
				// max() filters (it's the valid STK source for a brand-new car) but
				// exclude it from the inspection counts/stations so we don't present it
				// as a real pravidelná kontrola.
				`SELECT
        max(platnost_do) FILTER (WHERE typ LIKE 'P%' AND aktualni = 'True') AS pravidelna,
        max(platnost_do) FILTER (WHERE typ LIKE 'E%' AND aktualni = 'True') AS evidencni,
        count(*) FILTER (WHERE coalesce(kod_stk,'') <> '9999') AS total,
        count(*) FILTER (WHERE stav IN ('B','C') AND coalesce(kod_stk,'') <> '9999') AS failed,
        count(DISTINCT kod_stk) FILTER (WHERE coalesce(kod_stk,'') <> '9999') AS stations
       FROM vehicle_inspections WHERE pcv = $1`,
				[pcv]
			),
			p.query(
				`SELECT
        count(*) FILTER (WHERE vztah_k_vozidlu IN ('1','3','4')) AS vlastniku,
        count(*) FILTER (WHERE vztah_k_vozidlu = '2') AS provozovatelu,
        count(DISTINCT nazev) FILTER (WHERE typ_subjektu = '2') AS companies,
        bool_or(typ_subjektu = '2') AS ever_company,
        bool_or(typ_subjektu = '2' AND aktualni = 'True') AS current_company
       FROM vehicle_owners WHERE pcv = $1`,
				[pcv]
			),
			p.query(
				`SELECT source_snapshot::text AS snapshot FROM cache_meta WHERE dataset = 'vypis_vozidel'`
			),
			p.query(
				// Full owner/operator timeline (all subject types), oldest first.
				// Individuals are anonymised at the source (ico/nazev null); we map
				// the subject type so the UI can label them without exposing PII.
				`SELECT ico, nazev, datum_od, datum_do, aktualni, vztah_k_vozidlu, typ_subjektu
       FROM vehicle_owners
       WHERE pcv = $1
       ORDER BY datum_od ASC NULLS FIRST, datum_do ASC NULLS LAST
       LIMIT 100`,
				[pcv]
			),
			p.query(
				// Full STK inspection history (newest first). Includes the synthetic
				// administrative records (kod_stk '9999' = "nové vozidlo") — useful
				// context, flagged via kod_stk so the UI marks them as administrative
				// rather than a real pravidelná inspection. Capped high enough to cover
				// any real vehicle.
				`SELECT platnost_od, platnost_do, stav, nazev_stk, typ, kod_stk
       FROM vehicle_inspections
       WHERE pcv = $1
       ORDER BY platnost_od DESC NULLS LAST
       LIMIT 100`,
				[pcv]
			),
			p.query(
				`SELECT datum_od, datum_do, duvod
       FROM vehicle_deregistration
       WHERE pcv = $1
       ORDER BY datum_od DESC NULLS LAST`,
				[pcv]
			),
			p
				.query(
					`SELECT stat, datum_dovozu
       FROM vehicle_imports
       WHERE pcv = $1
       ORDER BY datum_dovozu DESC NULLS LAST`,
					[pcv]
				)
				// Imports are an optional enrichment — never let them break the core
				// lookup. Tolerate a not-yet-migrated table (42P01 = undefined_table,
				// safe to deploy before the table exists) and a missing grant (42501),
				// degrading to "no imports".
				.catch((e: { code?: string }) => {
					if (e?.code === '42P01' || e?.code === '42501') {
						if (e.code === '42501') {
							console.warn(
								'vehicle_imports: permission denied for vincheck_api'
							)
						}
						return { rows: [] as Array<Record<string, unknown>> }
					}
					throw e
				})
		])

	const data: Record<string, unknown> = {}
	for (const [col, apiKey] of Object.entries(COLUMN_TO_API_KEY)) {
		if (col in row) {
			data[apiKey] = transformRegistryValue(col, row[col])
		}
	}

	// Derived fields the live API returns but the registry table doesn't store.
	const insp = inspections.rows[0] ?? {}
	if (insp.pravidelna) {
		data.PravidelnaTechnickaProhlidkaDo = withMidnight(String(insp.pravidelna))
	}
	if (insp.evidencni) {
		data.EvidencniProhlidkaDne = withMidnight(String(insp.evidencni))
	}
	const own = owners.rows[0] ?? {}
	data.PocetVlastniku = Number(own.vlastniku ?? 0)
	data.PocetProvozovatelu = Number(own.provozovatelu ?? 0)

	const snapshot = (meta.rows[0]?.snapshot as string | undefined) ?? null

	// --- history-lite (see docs/VEHICLE_HISTORY_PANEL.md) ---
	const status = nullIfEmpty(row.status)
	const deregRows = dereg.rows as Array<Record<string, unknown>>
	const deregReasons = deregRows.map((r) => nullIfEmpty(r.duvod))
	const recentRows = inspRecent.rows as Array<Record<string, unknown>>
	const latestRow = recentRows[0]
	const distinctStations = Number(insp.stations ?? 0)

	// Full owner/operator timeline. Individuals (subjectType 'private') and
	// unidentified rows carry no ico/nazev — null them defensively so no PII can
	// leak even if the source ever populated them.
	const timeline = (ownerRows.rows as Array<Record<string, unknown>>).map(
		(r) => {
			const subject = subjectType(r.typ_subjektu)
			const isCompany = subject === 'company'
			return {
				subjectType: subject,
				ico: isCompany ? nullIfEmpty(r.ico) : null,
				nazev: isCompany ? nullIfEmpty(r.nazev) : null,
				from: nullIfEmpty(r.datum_od),
				to: nullIfEmpty(r.datum_do),
				current: nullIfEmpty(r.aktualni)?.toLowerCase() === 'true',
				relation: ownerRelation(r.vztah_k_vozidlu)
			}
		}
	)

	// Dedupe import records by country — duplicates exist in the source. Query is
	// ordered datum_dovozu DESC NULLS LAST, so the first row per country carries
	// the most recent (real) date.
	const importsList: Array<{ country: string | null; date: string | null }> = []
	const seenCountries = new Set<string>()
	for (const r of imports.rows as Array<Record<string, unknown>>) {
		const country = nullIfEmpty(r.stat)
		const key = country ?? '∅'
		if (seenCountries.has(key)) continue
		seenCountries.add(key)
		importsList.push({
			country,
			date: plausibleDate(nullIfEmpty(r.datum_dovozu))
		})
	}

	const history: VehicleHistory = {
		owners: {
			total: Number(own.vlastniku ?? 0),
			operators: Number(own.provozovatelu ?? 0),
			companies: Number(own.companies ?? 0),
			everCompanyOwned: own.ever_company === true,
			currentlyCompany: own.current_company === true,
			companyOwners: timeline.filter((t) => t.subjectType === 'company'),
			timeline
		},
		inspections: {
			total: Number(insp.total ?? 0),
			failed: Number(insp.failed ?? 0),
			distinctStations,
			latest: latestRow
				? {
						result: stavToResult(latestRow.stav),
						platnostDo: nullIfEmpty(latestRow.platnost_do),
						nazevStk: nullIfEmpty(latestRow.nazev_stk)
					}
				: null,
			history: recentRows.map((r) => ({
				date: nullIfEmpty(r.platnost_od),
				result: stavToResult(r.stav),
				nazevStk: nullIfEmpty(r.nazev_stk),
				typ: nullIfEmpty(r.typ),
				administrative: nullIfEmpty(r.kod_stk) === '9999'
			}))
		},
		flags: {
			stolen: deregReasons.includes('Odcizeno'),
			exported: status === 'VÝVOZ',
			deregistered:
				status === 'ZÁNIK' ||
				status === 'VYŘAZENO Z PROVOZU' ||
				deregRows.length > 0,
			insuranceLapsed: deregReasons.includes('Zánik pojištění'),
			statusLabel: status
		},
		deregistrations: deregRows.map((r) => ({
			from: nullIfEmpty(r.datum_od),
			to: nullIfEmpty(r.datum_do),
			reason: nullIfEmpty(r.duvod)
		})),
		imports: importsList,
		snapshot
	}

	return {
		response: { Status: 1, Data: data },
		snapshot,
		history
	}
}

/** Cache is "fresh" if the registry snapshot is within `maxAgeDays`. The source
 *  publishes monthly on the 12th of the following month, so a snapshot dated
 *  early in a month is ~40 days old just before the next one lands — 45 covers
 *  the whole cycle plus a few days to run the ingest, so the composed History
 *  keeps showing instead of falling back to the live API (which has none). */
export function isCacheFresh(
	snapshot: string | null,
	maxAgeDays = 45
): boolean {
	if (!snapshot) {
		return false
	}
	const snap = new Date(`${snapshot}T00:00:00Z`).getTime()
	if (Number.isNaN(snap)) {
		return false
	}
	const ageDays = (Date.now() - snap) / 86_400_000
	return ageDays <= maxAgeDays
}

export type FleetVehicle = {
	vin: string | null
	znacka: string | null
	model: string | null
	oznaceni: string | null
	rok: string | null
	prvniRegistrace: string | null
	status: string | null
	current: boolean
}

export type FleetResult = {
	ico: string
	nazev: string | null
	count: number // capped at FLEET_COUNT_CAP
	countCapped: boolean // true => real total exceeds `count` (show "count+")
	vehicles: FleetVehicle[]
	snapshot: string | null
}

// Big leasing fleets reach hundreds of thousands of vehicles, so never scan the
// whole set: return a bounded sample and a capped count. Needs vehicle_owners_ico_idx.
const FLEET_PAGE_SIZE = 60
const FLEET_COUNT_CAP = 1000

/**
 * Reverse lookup: vehicles where a legal entity (IČO) is/was owner or operator.
 * Returns null if the cache isn't configured or the IČO has no vehicles.
 * Cache-only — the live API has no reverse-by-IČO capability.
 */
export async function lookupVehiclesByIco(
	ico: string
): Promise<FleetResult | null> {
	const p = getPool()
	if (!p) {
		return null
	}

	const [meta, info, ids] = await Promise.all([
		p.query(
			`SELECT source_snapshot::text AS snapshot FROM cache_meta WHERE dataset = 'vlastnik_provozovatel'`
		),
		p.query(
			`SELECT
        (SELECT nazev FROM vehicle_owners WHERE ico = $1 AND nazev IS NOT NULL LIMIT 1) AS nazev,
        (SELECT count(*) FROM (
           SELECT DISTINCT pcv FROM vehicle_owners WHERE ico = $1 LIMIT ${FLEET_COUNT_CAP + 1}
         ) s) AS cnt`,
			[ico]
		),
		p.query(
			`SELECT DISTINCT pcv FROM vehicle_owners WHERE ico = $1 LIMIT ${FLEET_PAGE_SIZE}`,
			[ico]
		)
	])

	const cnt = Number(info.rows[0]?.cnt ?? 0)
	if (cnt === 0) {
		return null
	}

	const pcvs = (ids.rows as Array<{ pcv: unknown }>).map((r) => r.pcv)
	const vehiclesRes = pcvs.length
		? await p.query(
				`SELECT r.vin, r.tovarni_znacka, r.typ, r.obchodni_oznaceni,
                r.rok_vyroby, r.datum_prvni_registrace, r.status,
                (SELECT bool_or(o.aktualni = 'True') FROM vehicle_owners o
                  WHERE o.pcv = r.pcv AND o.ico = $2) AS current
         FROM vehicle_registry r WHERE r.pcv = ANY($1::bigint[])`,
				[pcvs, ico]
			)
		: { rows: [] as Array<Record<string, unknown>> }

	const vehicles: FleetVehicle[] = (
		vehiclesRes.rows as Array<Record<string, unknown>>
	).map((r) => ({
		vin: nullIfEmpty(r.vin),
		znacka: nullIfEmpty(r.tovarni_znacka),
		model: nullIfEmpty(r.typ),
		oznaceni: nullIfEmpty(r.obchodni_oznaceni),
		rok: nullIfEmpty(r.rok_vyroby),
		prvniRegistrace: nullIfEmpty(r.datum_prvni_registrace),
		status: nullIfEmpty(r.status),
		current: r.current === true
	}))

	return {
		ico,
		nazev: nullIfEmpty(info.rows[0]?.nazev),
		count: Math.min(cnt, FLEET_COUNT_CAP),
		countCapped: cnt > FLEET_COUNT_CAP,
		vehicles,
		snapshot: (meta.rows[0]?.snapshot as string | undefined) ?? null
	}
}
