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

export type VehicleCacheResult = {
	response: { Status: number; Data: Record<string, unknown> }
	snapshot: string | null
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

	const [inspections, owners, meta] = await Promise.all([
		p.query(
			`SELECT
        max(platnost_do) FILTER (WHERE typ LIKE 'P%') AS pravidelna,
        max(platnost_do) FILTER (WHERE typ LIKE 'E%') AS evidencni
       FROM vehicle_inspections WHERE pcv = $1 AND aktualni = 'True'`,
			[pcv]
		),
		p.query(
			`SELECT
        count(*) FILTER (WHERE vztah_k_vozidlu IN ('1','3','4')) AS vlastniku,
        count(*) FILTER (WHERE vztah_k_vozidlu = '2') AS provozovatelu
       FROM vehicle_owners WHERE pcv = $1`,
			[pcv]
		),
		p.query(
			`SELECT source_snapshot::text AS snapshot FROM cache_meta WHERE dataset = 'vypis_vozidel'`
		)
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

	return {
		response: { Status: 1, Data: data },
		snapshot
	}
}

/** Cache is "fresh" if the registry snapshot is within `maxAgeDays` (the source
 *  publishes monthly, so ~35 days covers a normal cycle). */
export function isCacheFresh(
	snapshot: string | null,
	maxAgeDays = 35
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
