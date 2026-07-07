/**
 * Render a REAL certificate PDF for a given VIN, straight from the Scaleway
 * vehicle cache — for local inspection of the actual deliverable (no purchase).
 *
 *   pnpm tsx scripts/render-vin-cert.ts <VIN> [out.pdf]
 *
 * Uses the same lookupVehicleFromCache() + renderCertificatePdf() as production,
 * so the layout, ordering, flags and mileage/rollback section match a bought
 * certificate. Reads VEHICLE_CACHE_DATABASE_URL from the environment or .env.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The project has no dotenv dependency, so load .env by hand (mirrors
// scripts/test-cache-lookup.ts). Inline env wins over the file.
function loadEnvFromFile(): void {
	let text: string
	try {
		text = readFileSync(resolve(__dirname, '..', '.env'), 'utf8')
	} catch {
		return
	}
	for (const line of text.split('\n')) {
		const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
		if (!match) continue
		const [, key, rawVal] = match
		if (process.env[key] !== undefined) continue
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

async function main(): Promise<void> {
	const vin = (process.argv[2] ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
	if (!vin) {
		console.error('Usage: pnpm tsx scripts/render-vin-cert.ts <VIN> [out.pdf]')
		process.exit(1)
	}
	const out = process.argv[3] ?? `certificate-${vin}.pdf`

	loadEnvFromFile()

	// Import AFTER env load: _vehicleCache reads the URL at import time.
	const { lookupVehicleFromCache } = await import('../api/_vehicleCache')
	const { renderCertificatePdf } = await import('../api/_certificatePdf')

	const snapshot = await lookupVehicleFromCache({ vin })
	if (!snapshot) {
		console.error(`No cache hit for ${vin} — cannot render a certificate.`)
		process.exit(1)
	}

	const code = `VI-TEST-${vin.slice(-4)}`
	const pdf = await renderCertificatePdf(snapshot, {
		code,
		issuedAt: new Date(),
		verifyUrl: `https://www.vininfo.cz/overit/${code}`
	})
	writeFileSync(out, pdf)
	console.log(`Wrote ${pdf.length} bytes to ${out}  (code ${code})`)
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err instanceof Error ? err.message : err)
		process.exit(1)
	})
