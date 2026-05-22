/**
 * Local smoke test for the vehicle-cache lookup (api/_vehicleCache.ts).
 *
 * Confirms the app can reach the Scaleway cache over SSL as the configured user
 * and that lookupVehicleFromCache reproduces the live-API { Status, Data } shape.
 * Run it against the sample data BEFORE the full ingest — it's the cheap check
 * that credentials + SSL + the query path all work end to end.
 *
 * Usage:
 *   npx tsx scripts/test-cache-lookup.ts [VIN]
 *
 * Reads VEHICLE_CACHE_DATABASE_URL from the environment, falling back to .env.
 * With no VIN it auto-discovers a VIN present in the cache (expect a HIT) and
 * also probes WVWZZZ1KZDP015799 — a MISS against a partial sample, a HIT once
 * the full snapshot is ingested.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Pool } from 'pg'

const ENV_KEY = 'VEHICLE_CACHE_DATABASE_URL'
const CANONICAL_VIN = 'WVWZZZ1KZDP015799'

// The project has no dotenv dependency, so load .env by hand. An inline env var
// wins over the file; the first occurrence of a key in .env wins over later
// duplicates (which is why describeUrl() below prints which one resolved).
function loadEnvFromFile(): void {
	let text: string
	try {
		text = readFileSync(resolve(__dirname, '..', '.env'), 'utf8')
	} catch {
		return // no .env — rely on inline env
	}
	for (const line of text.split('\n')) {
		const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
		if (!match) continue
		const [, key, rawVal] = match
		if (process.env[key] !== undefined) continue // don't override inline env
		let val = rawVal
		if (
			(val.startsWith("'") && val.endsWith("'")) ||
			(val.startsWith('"') && val.endsWith('"'))
		) {
			val = val.slice(1, -1)
		}
		process.env[key] = val
	}
}

// Show user@host:port/db (never the password) so you can confirm the connection
// resolved to vincheck_api (read-only) and not vincheck_admin.
function describeUrl(url: string): string {
	try {
		const u = new URL(url)
		return `${u.username}@${u.hostname}:${u.port}${u.pathname}`
	} catch {
		return '(unparseable URL)'
	}
}

async function discoverVin(rawUrl: string): Promise<string | null> {
	// Mirror api/_vehicleCache.ts: strip sslmode so our ssl option (encrypt, but
	// don't verify Scaleway's self-signed cert) isn't overridden by the
	// verify-full semantics newer pg-connection-string gives sslmode=require.
	const url = new URL(rawUrl)
	const needsSsl = url.searchParams.has('sslmode')
	url.searchParams.delete('sslmode')
	const pool = new Pool({
		connectionString: url.toString(),
		ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
		max: 1,
		connectionTimeoutMillis: 5000
	})
	try {
		const res = await pool.query(
			'SELECT vin FROM vehicle_registry WHERE vin IS NOT NULL ORDER BY pcv LIMIT 1'
		)
		return (res.rows[0]?.vin as string | undefined) ?? null
	} finally {
		await pool.end()
	}
}

type LookupFn = typeof import('../api/_vehicleCache').lookupVehicleFromCache

async function probe(
	lookup: LookupFn,
	label: string,
	vin: string
): Promise<void> {
	const result = await lookup({ vin })
	if (!result) {
		console.log(`\n[${label}] ${vin} -> MISS (not in cache)`)
		return
	}
	const d = result.response.Data
	console.log(`\n[${label}] ${vin} -> HIT  (snapshot ${result.snapshot})`)
	console.log(`  Status:                         ${result.response.Status}`)
	console.log(`  Data fields:                    ${Object.keys(d).length}`)
	console.log(`  TovarniZnacka:                  ${d.TovarniZnacka ?? '-'}`)
	console.log(`  ObchodniOznaceni:               ${d.ObchodniOznaceni ?? '-'}`)
	console.log(`  RokVyroby:                      ${d.RokVyroby ?? '-'}`)
	console.log(`  PocetVlastniku:                 ${d.PocetVlastniku}`)
	console.log(`  PocetProvozovatelu:             ${d.PocetProvozovatelu}`)
	console.log(
		`  PravidelnaTechnickaProhlidkaDo: ${d.PravidelnaTechnickaProhlidkaDo ?? '-'}`
	)

	const h = result.history
	const flags = Object.entries(h.flags)
		.filter(([, v]) => v === true)
		.map(([k]) => k)
	console.log('  --- history ---')
	console.log(
		`  owners: ${h.owners.total} | operators: ${h.owners.operators} | companies: ${h.owners.companies} (ever=${h.owners.everCompanyOwned}, current=${h.owners.currentlyCompany})`
	)
	const co = h.owners.companyOwners[0]
	if (co) {
		console.log(
			`    ex-fleet e.g.: ${co.nazev ?? '?'} (ICO ${co.ico ?? '?'}) ${co.from ?? '?'}..${co.to ?? 'now'} [${co.relation}]`
		)
	}
	console.log(
		`  STK: total ${h.inspections.total} | failed ${h.inspections.failed} | stations ${h.inspections.distinctStations} | latest=${h.inspections.latest?.result ?? '-'}`
	)
	console.log(
		`  flags: ${flags.length ? flags.join(', ') : '(none)'} | status=${h.flags.statusLabel ?? '-'}`
	)
	if (h.deregistrations.length) {
		console.log(
			`  dereg: ${h.deregistrations.map((x) => `${x.reason ?? '?'} (${x.from ?? '?'})`).join('; ')}`
		)
	}
}

async function main(): Promise<void> {
	loadEnvFromFile()
	const url = process.env[ENV_KEY]
	if (!url) {
		console.error(`${ENV_KEY} is not set (env or .env). Nothing to test.`)
		process.exit(1)
	}
	console.log(`Cache connection: ${describeUrl(url)}`)

	// Import AFTER env is loaded: the module reads the URL at import time.
	const { isCacheConfigured, lookupVehicleFromCache } = await import(
		'../api/_vehicleCache'
	)
	if (!isCacheConfigured()) {
		console.error(
			'isCacheConfigured() is false — env not visible to the module.'
		)
		process.exit(1)
	}

	const argVin = process.argv[2]
	if (argVin) {
		await probe(lookupVehicleFromCache, 'arg', argVin)
		return
	}

	const discovered = await discoverVin(url)
	if (discovered) {
		await probe(lookupVehicleFromCache, 'sample (expect HIT)', discovered)
	} else {
		console.log('\nNo VIN found in vehicle_registry — is the cache loaded?')
	}
	await probe(lookupVehicleFromCache, 'canonical', CANONICAL_VIN)
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(
			'\nLookup test failed:',
			err instanceof Error ? err.message : err
		)
		process.exit(1)
	})
