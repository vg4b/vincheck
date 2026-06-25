/**
 * Parse the downloaded ISTP inspection files and (optionally) load odometer
 * readings into the Scaleway cache table `vehicle_inspection_odometer`.
 *
 * Pipeline: for each `prohlidky_<date>.xml.gz` (from download-odometer.ts), stream
 * through gunzip, split on `</Prohlidka>`, and extract per record:
 *   CisloProtokolu (PK) · Vin · Vysledek/Odometr (km) · DatumProhlidky (date) ·
 *   DruhProhlidky · VysledekCelkovy · Stanice/Cislo.
 * Rows are UPSERTed in batches on cislo_protokolu, so re-runs are idempotent and
 * daily deltas accumulate.
 *
 * PRODUCTION SAFETY: this only ever writes the NEW `vehicle_inspection_odometer`
 * table (created with --apply-schema or scripts/migrations/004_vehicle_odometer.sql).
 * It never touches the existing cache tables/indexes, so the live lookup path is
 * unaffected. The shared DB node can still feel write load — load off-peak,
 * consider scaling the node up (see the refresh-vehicle-cache skill), and use
 * --throttle to pace batches.
 *
 * Usage:
 *   # Local parse only — NO database, NO secrets. This is the safe local test:
 *   npx tsx scripts/ingest-odometer.ts --dry-run [--dir <xmlDir>] [--limit-files N]
 *
 *   # Load into Scaleway (pass the ADMIN url inline; never commit it):
 *   DATABASE_URL='postgres://admin:…@…:5432/rdb?sslmode=require' \
 *     npx tsx scripts/ingest-odometer.ts --apply-schema [--from YYYY-MM-DD] [--throttle 50]
 *
 * Flags: --dry-run, --dir, --from/--to (by filename date), --limit-files N,
 *        --batch N (default 1000), --throttle MS (pause between batches),
 *        --apply-schema (CREATE TABLE/index/grant before loading).
 *
 * See docs/plans/ODOMETER_READINGS.md.
 */

import { createReadStream, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { createGunzip } from 'node:zlib'
import { Pool, type PoolClient } from 'pg'

const ENV_KEY = 'DATABASE_URL'

interface Args {
	dryRun: boolean
	dir?: string
	from?: string
	to?: string
	limitFiles?: number
	batch: number
	throttle: number
	applySchema: boolean
}

interface Record {
	cisloProtokolu: string
	vin: string
	odometerKm: number | null
	inspectionDate: string | null
	druh: string | null
	resultCode: string | null
	stationKod: string | null
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function parseArgs(argv: string[]): Args {
	const a: Args = {
		dryRun: false,
		batch: 1000,
		throttle: 0,
		applySchema: false
	}
	for (let i = 0; i < argv.length; i++) {
		const v = argv[i]
		if (v === '--dry-run') a.dryRun = true
		else if (v === '--apply-schema') a.applySchema = true
		else if (v === '--dir') a.dir = argv[++i]
		else if (v === '--from') a.from = argv[++i]
		else if (v === '--to') a.to = argv[++i]
		else if (v === '--limit-files') a.limitFiles = Number(argv[++i])
		else if (v === '--batch') a.batch = Number(argv[++i])
		else if (v === '--throttle') a.throttle = Number(argv[++i])
	}
	return a
}

function defaultDir(): string {
	const csvDir =
		process.env.CSV_DIR ?? join(homedir(), 'Desktop', 'datova kostka')
	return join(csvDir, 'odometer-xml')
}

// --- .env loader (no dotenv dep; mirrors scripts/test-cache-lookup.ts) ---
function loadEnvFromFile(): void {
	let text: string
	try {
		text = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
	} catch {
		return
	}
	for (const line of text.split('\n')) {
		const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/)
		if (!m) continue
		const key = m[1]
		let val = m[2].trim()
		if (
			(val.startsWith('"') && val.endsWith('"')) ||
			(val.startsWith("'") && val.endsWith("'"))
		) {
			val = val.slice(1, -1)
		}
		if (!(key in process.env)) process.env[key] = val
	}
}

// --- field extraction (the XML is flat + very regular; regex is enough) ---
const first = (block: string, tag: string): string | null => {
	const m = block.match(new RegExp(`<${tag}\\s*>([^<]*)<`))
	return m ? m[1].trim() : null
}

function toRecord(block: string): Record | null {
	const cisloProtokolu = first(block, 'CisloProtokolu')
	const vin = first(block, 'Vin')
	if (!cisloProtokolu || !vin) return null // both are mandatory keys

	const odoRaw = first(block, 'Odometr')
	const odometerKm = odoRaw && /^\d+$/.test(odoRaw) ? Number(odoRaw) : null
	// First DatumProhlidky is the protocol's own date (EmisniCast repeats it as a
	// timestamp later); keep just the calendar day.
	const datum = first(block, 'DatumProhlidky')
	const inspectionDate = datum ? datum.slice(0, 10) : null

	return {
		cisloProtokolu,
		vin,
		odometerKm,
		inspectionDate,
		druh: first(block, 'DruhProhlidky'),
		resultCode: first(block, 'VysledekCelkovy'),
		stationKod: first(block, 'Cislo') // first <Cislo> is Stanice/Cislo
	}
}

/** Stream a gz file, invoking onRecord per <Prohlidka> block. */
function parseFile(
	path: string,
	onRecord: (r: Record) => void,
	onSkip: () => void
): Promise<void> {
	return new Promise((resolvePromise, reject) => {
		const gunzip = createGunzip()
		let buffer = ''
		const END = '</Prohlidka>'
		const flush = () => {
			for (;;) {
				const s = buffer.indexOf('<Prohlidka>')
				const e = buffer.indexOf(END)
				if (s === -1 || e === -1 || e < s) break
				const block = buffer.slice(s, e + END.length)
				buffer = buffer.slice(e + END.length)
				const rec = toRecord(block)
				if (rec) onRecord(rec)
				else onSkip()
			}
		}
		gunzip.on('data', (chunk: Buffer) => {
			buffer += chunk.toString('utf8')
			flush()
		})
		gunzip.on('end', () => {
			flush()
			resolvePromise()
		})
		gunzip.on('error', reject)
		createReadStream(path).on('error', reject).pipe(gunzip)
	})
}

function listFiles(args: Args): string[] {
	const dir = args.dir ?? defaultDir()
	return readdirSync(dir)
		.filter((f) => f.endsWith('.xml.gz'))
		.filter((f) => {
			const m = f.match(/(\d{4}-\d{2}-\d{2})/)
			if (!m) return true
			if (args.from && m[1] < args.from) return false
			if (args.to && m[1] > args.to) return false
			return true
		})
		.sort()
		.slice(0, args.limitFiles ?? undefined)
		.map((f) => join(dir, f))
}

const COLS = [
	'cislo_protokolu',
	'vin',
	'odometer_km',
	'inspection_date',
	'druh',
	'result_code',
	'station_kod'
]

async function upsertBatch(
	client: PoolClient,
	rows: Record[]
): Promise<void> {
	// Dedup within the batch — ON CONFLICT can't hit the same key twice in one stmt.
	const byKey = new Map<string, Record>()
	for (const r of rows) byKey.set(r.cisloProtokolu, r)
	const batch = [...byKey.values()]

	const values: unknown[] = []
	const tuples = batch.map((r, i) => {
		const b = i * COLS.length
		values.push(
			r.cisloProtokolu,
			r.vin,
			r.odometerKm,
			r.inspectionDate,
			r.druh,
			r.resultCode,
			r.stationKod
		)
		return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`
	})

	await client.query(
		`INSERT INTO vehicle_inspection_odometer (${COLS.join(',')})
		 VALUES ${tuples.join(',')}
		 ON CONFLICT (cislo_protokolu) DO UPDATE SET
		   vin = EXCLUDED.vin,
		   odometer_km = EXCLUDED.odometer_km,
		   inspection_date = EXCLUDED.inspection_date,
		   druh = EXCLUDED.druh,
		   result_code = EXCLUDED.result_code,
		   station_kod = EXCLUDED.station_kod`,
		values
	)
}

const SCHEMA_SQL = readFileSafe(
	resolve(process.cwd(), 'scripts/migrations/004_vehicle_odometer.sql')
)
function readFileSafe(p: string): string {
	try {
		return readFileSync(p, 'utf8')
	} catch {
		return ''
	}
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2))
	const files = listFiles(args)

	// Running totals (bounded memory — no global distinct-VIN set).
	let records = 0
	let withOdo = 0
	let skipped = 0
	let odoMin = Number.POSITIVE_INFINITY
	let odoMax = 0
	let dateMin: string | null = null
	let dateMax: string | null = null
	const samples: Record[] = []

	console.log(`${args.dryRun ? 'DRY-RUN (no DB)' : 'LOAD'} · ${files.length} files`)

	let pool: Pool | null = null
	let client: PoolClient | null = null
	if (!args.dryRun) {
		loadEnvFromFile()
		const raw = process.env[ENV_KEY]
		if (!raw) {
			console.error(
				`${ENV_KEY} is not set. Pass the Scaleway ADMIN url inline, e.g.\n` +
					`  DATABASE_URL='postgres://admin:…@…:5432/rdb?sslmode=require' npx tsx scripts/ingest-odometer.ts --apply-schema`
			)
			process.exit(1)
		}
		const url = new URL(raw)
		const needsSsl = url.searchParams.has('sslmode')
		url.searchParams.delete('sslmode')
		pool = new Pool({
			connectionString: url.toString(),
			ssl: needsSsl ? { rejectUnauthorized: false } : undefined
		})
		// Without a listener, a mid-load connection drop (e.g. the node restarting
		// for a scale change → 57P01) surfaces as an unhandled 'error' event that
		// crashes the process. Log it instead; the rejected query() then propagates
		// to main().catch for a clean exit. Re-run with --from <last date> to resume.
		pool.on('error', (e) => console.error('pg pool error:', e.message))
		client = await pool.connect()
		client.on('error', (e) => console.error('pg client error:', e.message))
		if (args.applySchema) {
			if (!SCHEMA_SQL) throw new Error('migration 004 SQL not found')
			console.log('applying schema (CREATE TABLE/index/grant)…')
			await client.query(SCHEMA_SQL)
		}
	}

	let pending: Record[] = []
	const onRecord = (r: Record) => {
		records++
		if (r.odometerKm !== null) {
			withOdo++
			if (r.odometerKm < odoMin) odoMin = r.odometerKm
			if (r.odometerKm > odoMax) odoMax = r.odometerKm
		}
		if (r.inspectionDate) {
			if (!dateMin || r.inspectionDate < dateMin) dateMin = r.inspectionDate
			if (!dateMax || r.inspectionDate > dateMax) dateMax = r.inspectionDate
		}
		if (samples.length < 5) samples.push(r)
		if (!args.dryRun) pending.push(r)
	}
	const onSkip = () => {
		skipped++
	}

	let fileNo = 0
	for (const f of files) {
		fileNo++
		await parseFile(f, onRecord, onSkip)
		if (client) {
			while (pending.length >= args.batch) {
				await upsertBatch(client, pending.splice(0, args.batch))
				if (args.throttle) await delay(args.throttle)
			}
		}
		if (fileNo % 200 === 0 || fileNo === files.length) {
			console.log(`  ${fileNo}/${files.length} files · ${records} records`)
		}
	}
	if (client && pending.length) {
		await upsertBatch(client, pending)
	}

	if (client) client.release()
	if (pool) await pool.end()

	console.log('\n=== summary ===')
	console.log(`files:           ${files.length}`)
	console.log(`records parsed:  ${records}`)
	console.log(
		`with odometer:   ${withOdo} (${records ? ((100 * withOdo) / records).toFixed(1) : 0}%)`
	)
	console.log(`skipped (no key):${skipped}`)
	if (withOdo) console.log(`odometer range:  ${odoMin} – ${odoMax} km`)
	console.log(`date range:      ${dateMin} → ${dateMax}`)
	console.log('sample records:')
	for (const s of samples) console.log('  ', JSON.stringify(s))
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
