/**
 * Download the ISTP inspection XML files listed in the crawler manifest.
 *
 * Consumes the manifest from scripts/crawl-odometer-catalog.ts and fetches each
 * day's gzip file (`dcat:downloadURL` serves a `.xml.gz`). Files are kept gzip on
 * disk — ~5 MB/day vs ~50 MB uncompressed, so ~18 years ≈ 32 GB instead of
 * ~340 GB; the parser/ingest gunzips on read. Resumable: an already-present,
 * non-empty, valid-gzip file is skipped, so re-runs only fetch what's missing —
 * which is also how the daily cron works (crawl, then download just the new day).
 *
 * Read-only w.r.t. the database — this only writes files to disk.
 *
 * Usage:
 *   npx tsx scripts/download-odometer.ts [--manifest <file>] [--dir <dir>]
 *       [--concurrency N] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--limit N]
 *       [--force]
 *
 *   --manifest <file>  manifest JSON (default: $MANIFEST_OUT / $CSV_DIR/odometer-manifest.json)
 *   --dir <dir>        output dir (default: <manifest dir>/odometer-xml)
 *   --concurrency N    parallel downloads (default 5)
 *   --from / --to      inclusive date range filter (for the daily/incremental run)
 *   --limit N          stop after N files (smoke test)
 *   --force            re-download even if the file already exists
 *
 * See docs/plans/ODOMETER_READINGS.md.
 */

import {
	createWriteStream,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync
} from 'node:fs'
import { open } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const MAX_RETRIES = 4
const USER_AGENT = 'vininfo-odometer-downloader (+https://vininfo.cz)'

interface ManifestEntry {
	date: string
	downloadUrl: string
	datasetIri: string
}

interface Args {
	manifest?: string
	dir?: string
	concurrency: number
	from?: string
	to?: string
	limit?: number
	force: boolean
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function parseArgs(argv: string[]): Args {
	const a: Args = { concurrency: 5, force: false }
	for (let i = 0; i < argv.length; i++) {
		const v = argv[i]
		if (v === '--manifest') a.manifest = argv[++i]
		else if (v === '--dir') a.dir = argv[++i]
		else if (v === '--concurrency') a.concurrency = Number(argv[++i])
		else if (v === '--from') a.from = argv[++i]
		else if (v === '--to') a.to = argv[++i]
		else if (v === '--limit') a.limit = Number(argv[++i])
		else if (v === '--force') a.force = true
	}
	return a
}

function defaultManifest(): string {
	if (process.env.MANIFEST_OUT) return process.env.MANIFEST_OUT
	const csvDir =
		process.env.CSV_DIR ?? join(homedir(), 'Desktop', 'datova kostka')
	return join(csvDir, 'odometer-manifest.json')
}

/** First two bytes are the gzip magic (0x1f 0x8b) — guards against an HTML/JSON
 *  error page being saved as if it were data. */
async function isGzip(path: string): Promise<boolean> {
	const fh = await open(path, 'r')
	try {
		const buf = Buffer.alloc(2)
		const { bytesRead } = await fh.read(buf, 0, 2, 0)
		return bytesRead === 2 && buf[0] === 0x1f && buf[1] === 0x8b
	} finally {
		await fh.close()
	}
}

async function downloadOne(entry: ManifestEntry, dest: string): Promise<void> {
	const tmp = `${dest}.part`
	let lastErr: unknown
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			const res = await fetch(entry.downloadUrl, {
				headers: { 'User-Agent': USER_AGENT }
			})
			if (!res.ok || !res.body) {
				throw new Error(`HTTP ${res.status}`)
			}
			await pipeline(
				Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
				createWriteStream(tmp)
			)
			if (!(await isGzip(tmp))) {
				throw new Error('downloaded file is not gzip (likely an error page)')
			}
			renameSync(tmp, dest)
			return
		} catch (err) {
			lastErr = err
			rmSync(tmp, { force: true })
			if (attempt < MAX_RETRIES) await delay(2 ** attempt * 500)
		}
	}
	throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

/** Deterministic, collision-safe filename per manifest entry. */
function targetName(entry: ManifestEntry, usedDates: Map<string, number>): string {
	const seen = usedDates.get(entry.date) ?? 0
	usedDates.set(entry.date, seen + 1)
	const suffix = seen === 0 ? '' : `__${entry.datasetIri.slice(-8)}`
	return `prohlidky_${entry.date}${suffix}.xml.gz`
}

async function runPool<T>(
	items: T[],
	n: number,
	worker: (item: T, i: number) => Promise<void>
): Promise<void> {
	let idx = 0
	const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
		while (idx < items.length) {
			const i = idx++
			await worker(items[i], i)
		}
	})
	await Promise.all(runners)
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2))
	const manifestPath = args.manifest ?? defaultManifest()
	const outDir = args.dir ?? join(dirname(manifestPath), 'odometer-xml')

	const manifest = JSON.parse(
		readFileSync(manifestPath, 'utf8')
	) as ManifestEntry[]

	let work = manifest
		.filter((e) => (args.from ? e.date >= args.from : true))
		.filter((e) => (args.to ? e.date <= args.to : true))
		.sort((a, b) => a.date.localeCompare(b.date))
	if (args.limit) work = work.slice(0, args.limit)

	mkdirSync(outDir, { recursive: true })

	console.log(`manifest:    ${manifestPath} (${manifest.length} entries)`)
	console.log(`output dir:  ${outDir}`)
	console.log(`to fetch:    ${work.length}  (concurrency ${args.concurrency})`)

	// Pre-assign filenames (collision-safe) up front so the parallel workers don't
	// race on the shared usedDates map.
	const usedDates = new Map<string, number>()
	const jobs = work.map((entry) => ({
		entry,
		dest: join(outDir, targetName(entry, usedDates))
	}))

	let downloaded = 0
	let skipped = 0
	const failures: { date: string; error: string }[] = []
	let done = 0

	await runPool(jobs, args.concurrency, async ({ entry, dest }) => {
		if (
			!args.force &&
			existsSync(dest) &&
			statSync(dest).size > 0 &&
			(await isGzip(dest).catch(() => false))
		) {
			skipped++
		} else {
			try {
				await downloadOne(entry, dest)
				downloaded++
			} catch (err) {
				failures.push({ date: entry.date, error: String(err) })
			}
		}
		done++
		if (done % 100 === 0 || done === jobs.length) {
			console.log(
				`  ${done}/${jobs.length}  (↓${downloaded} skip${skipped} fail${failures.length})`
			)
		}
	})

	console.log('\n=== summary ===')
	console.log(`downloaded: ${downloaded}`)
	console.log(`skipped:    ${skipped}`)
	console.log(`failed:     ${failures.length}`)
	for (const f of failures.slice(0, 10)) {
		console.log(`  ${f.date}: ${f.error}`)
	}
	if (failures.length) process.exit(1)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
