/**
 * Crawl the ISTP "Prohlídky vozidel STK a SME" dataset series on data.gov.cz and
 * emit a manifest of the daily XML files to ingest (odometer/mileage history).
 *
 * The series is a DCAT dataset series: the parent (SERIES_IRI) links to ~6442
 * per-day member datasets via dcat:seriesMember; each member points back with
 * dcat:inSeries and carries exactly one dcat:distribution → dcat:downloadURL (the
 * day's XML) plus a dct:temporal period (the covered day). We enumerate them via
 * the public SPARQL endpoint and write { date, downloadUrl, datasetIri } rows.
 *
 * This is a read-only catalogue crawl — it does NOT download the XML or touch any
 * database. The downloader/parser/upsert ingest is a separate later step that
 * consumes this manifest. See docs/plans/ODOMETER_READINGS.md.
 *
 * Usage:
 *   npx tsx scripts/crawl-odometer-catalog.ts [--out <file>] [--limit N]
 *
 *   --out <file>   manifest output path (JSON). Default: $MANIFEST_OUT, else
 *                  "$CSV_DIR/odometer-manifest.json", else
 *                  "$HOME/Desktop/datova kostka/odometer-manifest.json".
 *   --limit N      stop after N members (smoke test).
 *
 * Env overrides: SPARQL_ENDPOINT, SERIES_IRI.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const SPARQL_ENDPOINT =
	process.env.SPARQL_ENDPOINT ?? 'https://data.gov.cz/sparql'
const SERIES_IRI =
	process.env.SERIES_IRI ??
	'https://data.gov.cz/zdroj/datové-sady/66003008/9c95ebdba1dc7a2fbcfc5b6c07d25705'

const PAGE_SIZE = 2000
const MAX_RETRIES = 4
const USER_AGENT = 'vininfo-odometer-crawler (+https://vininfo.cz)'

interface ManifestEntry {
	/** Covered day, ISO YYYY-MM-DD. */
	date: string
	/** dcat:downloadURL — the day's XML (ISTP api/data/<uuid>). */
	downloadUrl: string
	/** The member dataset IRI on data.gov.cz (for traceability/debugging). */
	datasetIri: string
}

type SparqlValue = { type: string; value: string; datatype?: string }
type SparqlBinding = Record<string, SparqlValue | undefined>
interface SparqlResponse {
	results: { bindings: SparqlBinding[] }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function sparql(query: string): Promise<SparqlBinding[]> {
	const body = new URLSearchParams({ query }).toString()
	let lastErr: unknown
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			const res = await fetch(SPARQL_ENDPOINT, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/sparql-results+json',
					'User-Agent': USER_AGENT
				},
				body
			})
			if (!res.ok) {
				throw new Error(`SPARQL HTTP ${res.status}: ${await res.text()}`)
			}
			const json = (await res.json()) as SparqlResponse
			return json.results.bindings
		} catch (err) {
			lastErr = err
			if (attempt < MAX_RETRIES) {
				const backoff = 2 ** attempt * 500
				console.warn(
					`  SPARQL attempt ${attempt} failed (${String(err)}); retrying in ${backoff}ms`
				)
				await delay(backoff)
			}
		}
	}
	throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

/** A page of members, ordered deterministically so OFFSET paging is stable. */
function pageQuery(limit: number, offset: number): string {
	return `
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dct: <http://purl.org/dc/terms/>
SELECT ?child ?dl ?start ?end ?title WHERE {
  ?child dcat:inSeries <${SERIES_IRI}> .
  ?child dcat:distribution ?dist .
  ?dist dcat:downloadURL ?dl .
  OPTIONAL { ?child dct:temporal ?t . ?t dcat:startDate ?start . ?t dcat:endDate ?end }
  OPTIONAL { ?child dct:title ?title . FILTER(lang(?title) = "cs") }
}
ORDER BY ?start ?child
LIMIT ${limit} OFFSET ${offset}`
}

/** Fallback: pull the day out of a Czech title "... za DD-MM-YYYY". */
function dateFromTitle(title: string | undefined): string | null {
	if (!title) return null
	const m = title.match(/(\d{2})-(\d{2})-(\d{4})/)
	return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

function parseArgs(argv: string[]): { out?: string; limit?: number } {
	const args: { out?: string; limit?: number } = {}
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--out') args.out = argv[++i]
		else if (argv[i] === '--limit') args.limit = Number(argv[++i])
	}
	return args
}

function defaultOut(): string {
	if (process.env.MANIFEST_OUT) return process.env.MANIFEST_OUT
	const csvDir =
		process.env.CSV_DIR ?? join(homedir(), 'Desktop', 'datova kostka')
	return join(csvDir, 'odometer-manifest.json')
}

async function main(): Promise<void> {
	const { out, limit } = parseArgs(process.argv.slice(2))
	const outPath = out ?? defaultOut()

	console.log(`Crawling series: ${SERIES_IRI}`)
	console.log(`SPARQL endpoint: ${SPARQL_ENDPOINT}`)

	const entries: ManifestEntry[] = []
	const seenDates = new Map<string, number>()
	let multiDay = 0
	let missingDate = 0
	let offset = 0

	for (;;) {
		const want = limit ? Math.min(PAGE_SIZE, limit - entries.length) : PAGE_SIZE
		if (want <= 0) break
		const rows = await sparql(pageQuery(want, offset))
		if (rows.length === 0) break

		for (const r of rows) {
			const downloadUrl = r.dl?.value
			const datasetIri = r.child?.value
			if (!downloadUrl || !datasetIri) continue

			const start = r.start?.value
			const end = r.end?.value
			const date = start ?? dateFromTitle(r.title?.value)
			if (!date) {
				missingDate++
				console.warn(`  no date for ${datasetIri} — skipped`)
				continue
			}
			if (start && end && start !== end) multiDay++

			entries.push({ date, downloadUrl, datasetIri })
			seenDates.set(date, (seenDates.get(date) ?? 0) + 1)
		}

		offset += rows.length
		console.log(`  fetched ${entries.length} members…`)
		if (rows.length < want) break
	}

	entries.sort((a, b) =>
		a.date === b.date
			? a.datasetIri.localeCompare(b.datasetIri)
			: a.date.localeCompare(b.date)
	)

	mkdirSync(dirname(outPath), { recursive: true })
	writeFileSync(outPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8')

	const dupDates = [...seenDates.entries()].filter(([, n]) => n > 1)
	console.log('\n=== summary ===')
	console.log(`members:        ${entries.length}`)
	console.log(`distinct days:  ${seenDates.size}`)
	if (entries.length > 0) {
		console.log(`date range:     ${entries[0].date} → ${entries[entries.length - 1].date}`)
	}
	if (dupDates.length) console.log(`days with >1 file: ${dupDates.length}`)
	if (multiDay) console.log(`multi-day files:   ${multiDay} (start != end)`)
	if (missingDate) console.log(`skipped (no date): ${missingDate}`)
	console.log(`manifest written: ${outPath}`)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
