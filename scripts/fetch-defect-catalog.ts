/**
 * Refresh the vendored STK defect catalog (api/_defectCatalog.json).
 *
 * The ISTP inspection feed reports defects as bare codes ("4.1.1.2.1") plus a
 * severity letter. The Czech text for each code lives in příloha č. 1 to
 * vyhláška č. 211/2018 Sb., which the ministry publishes as a PDF only — it is
 * not in data.gov.cz and the ISTP XSD leaves `Kod` untyped. The community STK
 * Portál project has transcribed it and serves it as JSON, which is what this
 * script snapshots.
 *
 * Run BY HAND, not in CI: the underlying legal text changes only when the
 * vyhláška is amended, and a silent upstream change should show up as a
 * reviewable diff rather than as a surprise in production.
 *
 * Read-only w.r.t. the database — this only writes one file.
 *
 * Usage:
 *   npx tsx scripts/fetch-defect-catalog.ts [--out <file>] [--dry-run]
 *
 *   --out <file>   destination (default: api/_defectCatalog.json)
 *   --dry-run      fetch and report, write nothing
 *
 * See docs/plans/2026-08-17-001-feat-stk-defect-codes-plan.md (U8).
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const API = 'https://stk.opendatalab.cz/api/defects'
const PAGE = 200
/** Guard against a truncated upstream silently shrinking the snapshot. */
const MIN_EXPECTED = 1000
const USER_AGENT = 'vininfo-defect-catalog (+https://vininfo.cz)'

interface Entry {
	code: string
	description: string
	type: string
}

function parseArgs(argv: string[]): { out: string; dryRun: boolean } {
	let out = 'api/_defectCatalog.json'
	let dryRun = false
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--out') out = argv[++i]
		else if (argv[i] === '--dry-run') dryRun = true
	}
	return { out, dryRun }
}

async function fetchPage(offset: number): Promise<Entry[]> {
	const res = await fetch(`${API}?limit=${PAGE}&offset=${offset}`, {
		headers: { Accept: 'application/json', 'User-Agent': USER_AGENT }
	})
	if (!res.ok) throw new Error(`${API} offset=${offset} → HTTP ${res.status}`)
	const body: unknown = await res.json()
	if (!Array.isArray(body))
		throw new Error(`offset=${offset}: not a JSON array`)
	return body as Entry[]
}

/** Keep only well-formed rows — a blank code would poison the lookup map. */
function isUsable(e: Entry): boolean {
	return Boolean(e?.code?.trim() && e?.description?.trim() && e?.type?.trim())
}

async function main(): Promise<void> {
	const { out, dryRun } = parseArgs(process.argv.slice(2))

	const seen = new Map<string, Entry>()
	for (let offset = 0; ; offset += PAGE) {
		const page = await fetchPage(offset)
		for (const e of page) {
			if (!isUsable(e)) continue
			// Last write wins; the upstream has no duplicates today, but a dupe
			// must not produce two rows for one code.
			seen.set(e.code.trim(), {
				code: e.code.trim(),
				description: e.description.trim(),
				type: e.type.trim().toUpperCase()
			})
		}
		if (page.length < PAGE) break
		if (offset > 20000) throw new Error('pagination did not terminate')
	}

	const entries = [...seen.values()].sort((a, b) =>
		a.code.localeCompare(b.code, 'cs')
	)

	if (entries.length < MIN_EXPECTED) {
		throw new Error(
			`only ${entries.length} entries (expected ≥ ${MIN_EXPECTED}) — refusing to write a truncated snapshot`
		)
	}

	const bySeverity = entries.reduce<Record<string, number>>((acc, e) => {
		acc[e.type] = (acc[e.type] ?? 0) + 1
		return acc
	}, {})
	console.log(`entries:  ${entries.length}`)
	console.log(`severity: ${JSON.stringify(bySeverity)}`)

	if (dryRun) {
		console.log('--dry-run: nothing written')
		return
	}

	// Sorted keys + trailing newline so re-running against an unchanged upstream
	// produces a byte-identical file and an empty git diff.
	const path = resolve(process.cwd(), out)
	writeFileSync(path, `${JSON.stringify(entries, null, '\t')}\n`, 'utf8')
	console.log(`written:  ${path}`)
}

main().catch((e) => {
	console.error(e instanceof Error ? e.message : e)
	process.exit(1)
})
