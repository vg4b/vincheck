/**
 * Render the sample certificate PDF to a file for local inspection.
 *   pnpm tsx scripts/render-sample-cert.ts [out.pdf]
 * Uses the same buildSampleSnapshot() + renderCertificatePdf() as the
 * /api/certificate/sample endpoint, so it reflects the real layout/ordering.
 */
import { writeFileSync } from 'node:fs'
import { buildSampleSnapshot } from '../api/_certificate'
import { renderCertificatePdf } from '../api/_certificatePdf'

async function main() {
	const out = process.argv[2] ?? 'sample-certificate.pdf'
	// `--no-watermark` renders a clean page — used to generate the marketing
	// preview image (public/certificate-preview.png) for the Product JSON-LD.
	const clean = process.argv.includes('--no-watermark')
	const pdf = await renderCertificatePdf(buildSampleSnapshot(), {
		code: 'VI-SAMPLE-0001',
		issuedAt: new Date(),
		verifyUrl: 'https://www.vininfo.cz/overit/VI-SAMPLE-0001',
		...(clean ? {} : { watermark: 'UKÁZKA' })
	})
	writeFileSync(out, pdf)
	console.log(`Wrote ${pdf.length} bytes to ${out}${clean ? ' (no watermark)' : ''}`)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
