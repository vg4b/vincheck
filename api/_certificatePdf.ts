/**
 * Certificate PDF builder. Rendered on demand from the frozen snapshot stored on
 * the certificate row, so the document is deterministic and immutable across the
 * monthly registry refresh.
 *
 * Uses @react-pdf/renderer (pure JS — no headless Chrome, safe on Vercel
 * serverless). The package is ESM-only while this `api/` project compiles to
 * CommonJS, so it is pulled in via a dynamic `import()` at call time. JSX is
 * avoided (no tsx/jsx config needed); the tree is built with createElement (`e`).
 *
 * GDPR: individuals in the timeline are already anonymised upstream (ico/nazev
 * null). Only company owners are named. Never add buyer PII to the document.
 */
import path from 'node:path'
import { createElement as e, type ReactNode } from 'react'
import QRCode from 'qrcode'
import type { VehicleCacheResult } from './_vehicleCache'
import { buildTechnicalGroups } from './_vehicleFieldLabels'

/** Everything the PDF needs that isn't derivable from the snapshot itself. */
export interface CertificateMeta {
	code: string
	issuedAt: Date
	verifyUrl: string
	/** When set, overlays a diagonal watermark on every page (e.g. "UKÁZKA"). */
	watermark?: string
}

const BRAND = '#1f6feb'
const INK = '#1a1a2e'
const MUTED = '#6b7280'
const BORDER = '#d1d5db'

// Built-in Helvetica has no Czech glyphs ("Počet" → "Poet"), so embed a TTF that
// covers Latin-Extended. Bundled under api/_fonts (see vercel.json includeFiles).
const FONT_FAMILY = 'DejaVuSans'
let fontsRegistered = false

// Plain style objects — @react-pdf accepts them directly, so we avoid calling
// StyleSheet.create at module scope (the package is ESM-only, imported lazily).
const styles = {
	page: {
		paddingTop: 40,
		paddingBottom: 56,
		paddingHorizontal: 44,
		fontSize: 10,
		color: INK,
		fontFamily: FONT_FAMILY
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		borderBottomWidth: 2,
		borderBottomColor: BRAND,
		paddingBottom: 10,
		marginBottom: 16
	},
	logo: { width: 43, height: 26, marginBottom: 4 },
	brand: { fontSize: 16, fontWeight: 700, color: BRAND },
	docTitle: { fontSize: 13, fontWeight: 700, marginTop: 2 },
	docSubtitle: { fontSize: 9, color: MUTED, marginTop: 1 },
	metaRight: { alignItems: 'flex-end' },
	metaLabel: { fontSize: 8, color: MUTED },
	metaValue: { fontSize: 10, fontWeight: 700 },
	qr: { width: 84, height: 84, marginTop: 6 },
	sectionTitle: {
		fontSize: 11,
		fontWeight: 700,
		color: BRAND,
		marginTop: 14,
		marginBottom: 6
	},
	groupTitle: {
		fontSize: 9.5,
		fontWeight: 700,
		color: INK,
		marginTop: 8,
		marginBottom: 3
	},
	watermark: {
		position: 'absolute',
		top: '45%',
		left: 0,
		right: 0,
		textAlign: 'center',
		fontSize: 90,
		fontWeight: 700,
		color: '#1f6feb',
		opacity: 0.12,
		transform: 'rotate(-35deg)'
	},
	row: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: BORDER,
		paddingVertical: 3
	},
	cellLabel: { width: '40%', color: MUTED },
	cellValue: { width: '60%', fontWeight: 700 },
	tlRow: {
		flexDirection: 'row',
		paddingVertical: 3,
		borderBottomWidth: 1,
		borderBottomColor: BORDER
	},
	tlDate: { width: '34%', color: MUTED },
	tlMain: { width: '46%' },
	tlTag: { width: '20%', textAlign: 'right', color: MUTED },
	flag: {
		padding: 6,
		marginBottom: 4,
		borderRadius: 3,
		backgroundColor: '#fef2f2',
		color: '#b91c1c',
		fontWeight: 700
	},
	muted: { color: MUTED },
	footer: {
		position: 'absolute',
		bottom: 28,
		left: 44,
		right: 44,
		fontSize: 7.5,
		color: MUTED,
		borderTopWidth: 1,
		borderTopColor: BORDER,
		paddingTop: 6
	}
} as const

// Lowercase to match the web (VehicleHistoryPanel RELATION_LABEL).
const RELATION_LABEL: Record<string, string> = {
	owner: 'vlastník',
	operator: 'provozovatel',
	other: 'jiný vztah'
}

// Matches StkResult in src/types: pass | defects | unfit | unknown.
const STK_LABEL: Record<string, string> = {
	pass: 'Způsobilé',
	defects: 'Způsobilé s vadami',
	unfit: 'Nezpůsobilé',
	unknown: 'Neuvedeno'
}

function fmtDate(s: string | null): string {
	if (!s) return '—'
	const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
	return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}` : s
}

function dataValue(
	data: Record<string, unknown>,
	key: string,
	fallback = '—'
): string {
	const v = data[key]
	if (v == null || v === '') return fallback
	return String(v)
}

/** Render the certificate to a PDF buffer. */
export async function renderCertificatePdf(
	snapshot: VehicleCacheResult,
	meta: CertificateMeta
): Promise<Buffer> {
	// ESM-only package — dynamic import keeps this CommonJS module compiling.
	const { Document, Page, View, Text, Image, Font, renderToBuffer } =
		await import('@react-pdf/renderer')

	// Embed a Czech-capable TTF once per process (built-in Helvetica drops
	// diacritics). Files bundled via vercel.json includeFiles.
	if (!fontsRegistered) {
		const dir = path.join(process.cwd(), 'api', '_fonts')
		Font.register({
			family: FONT_FAMILY,
			fonts: [
				{ src: path.join(dir, 'DejaVuSans.ttf'), fontWeight: 400 },
				{ src: path.join(dir, 'DejaVuSans-Bold.ttf'), fontWeight: 700 }
			]
		})
		fontsRegistered = true
	}

	const data = snapshot.response.Data ?? {}
	const history = snapshot.history
	const vin = dataValue(data, 'VIN')
	const brand = dataValue(data, 'TovarniZnacka')
	const model = dataValue(data, 'ObchodniOznaceni', dataValue(data, 'Typ'))
	const snapshotDate = history.snapshot

	const qrDataUrl = await QRCode.toDataURL(meta.verifyUrl, { margin: 0 })

	const row = (label: string, value: string) =>
		e(View, { style: styles.row, key: label }, [
			e(Text, { style: styles.cellLabel, key: 'l' }, label),
			e(Text, { style: styles.cellValue, key: 'v' }, value)
		])

	const children: ReactNode[] = []

	// Header: brand + doc title on the left, code/date/QR on the right.
	children.push(
		e(View, { style: styles.header, key: 'header' }, [
			e(View, { key: 'left' }, [
				e(Image, {
					src: path.join(process.cwd(), 'api', '_fonts', 'vininfo-logo.png'),
					style: styles.logo,
					key: 'logo'
				}),
				e(Text, { style: styles.brand, key: 'b' }, 'VINInfo.cz'),
				e(
					Text,
					{ style: styles.docTitle, key: 't' },
					'Certifikát historie vozidla'
				),
				e(
					Text,
					{ style: styles.docSubtitle, key: 'ts' },
					'Zpracováno z dat registru silničních vozidel ČR'
				)
			]),
			e(View, { style: styles.metaRight, key: 'right' }, [
				e(Text, { style: styles.metaLabel, key: 'cl' }, 'Číslo certifikátu'),
				e(Text, { style: styles.metaValue, key: 'cv' }, meta.code),
				e(Text, { style: styles.metaLabel, key: 'dl' }, 'Vystaveno'),
				e(
					Text,
					{ style: styles.metaValue, key: 'dv' },
					meta.issuedAt.toLocaleDateString('cs-CZ')
				),
				e(Image, { src: qrDataUrl, style: styles.qr, key: 'qr' })
			])
		])
	)

	// Notable flags — wording matches the web (VehicleHistoryPanel buildFlags).
	const flagNodes: ReactNode[] = []
	if (history.flags.stolen)
		flagNodes.push(
			e(Text, { style: styles.flag, key: 'stolen' }, 'Evidováno jako odcizené')
		)
	if (history.flags.exported)
		flagNodes.push(
			e(Text, { style: styles.flag, key: 'exported' }, 'Vyvezeno do zahraničí')
		)
	if (history.flags.deregistered && !history.flags.exported)
		flagNodes.push(
			e(
				Text,
				{ style: styles.flag, key: 'dereg' },
				'Vyřazeno z provozu / zánik'
			)
		)
	if (history.flags.insuranceLapsed)
		flagNodes.push(
			e(Text, { style: styles.flag, key: 'ins' }, 'Zaniklé pojištění')
		)
	if (flagNodes.length > 0) {
		children.push(
			e(View, { key: 'flags', style: { marginBottom: 6 } }, flagNodes)
		)
	}

	// Vehicle identity.
	children.push(
		e(Text, { style: styles.sectionTitle, key: 'id-t' }, 'Identifikace vozidla')
	)
	children.push(
		e(View, { key: 'id' }, [
			row('VIN', vin),
			row('Značka', brand),
			row('Model / obchodní označení', model),
			row(
				'První registrace',
				fmtDate(dataValue(data, 'DatumPrvniRegistrace', ''))
			),
			row('Stav vozidla', history.flags.statusLabel ?? '—')
		])
	)

	// Owners / operators summary + timeline.
	children.push(
		e(
			Text,
			{ style: styles.sectionTitle, key: 'own-t' },
			'Majitelé a provozovatelé'
		)
	)
	children.push(
		e(View, { key: 'own' }, [
			row('Počet vlastníků', String(history.owners.total)),
			row('Počet provozovatelů', String(history.owners.operators))
		])
	)
	if (history.owners.timeline.length > 0) {
		children.push(
			e(
				Text,
				{ style: styles.groupTitle, key: 'tl-t' },
				'Časová osa vlastníků a provozovatelů'
			)
		)
	}
	if (history.owners.timeline.length > 0) {
		children.push(
			e(
				View,
				{ key: 'tl', style: { marginTop: 4 } },
				history.owners.timeline.map((t, i) =>
					e(View, { style: styles.tlRow, key: `tl-${i}` }, [
						e(
							Text,
							{ style: styles.tlDate, key: 'd' },
							`${fmtDate(t.from)} – ${t.current ? 'dosud' : fmtDate(t.to)}`
						),
						e(
							Text,
							{ style: styles.tlMain, key: 'm' },
							t.subjectType === 'company'
								? t.ico
									? `${t.nazev ?? `IČO ${t.ico}`} · IČO ${t.ico}`
									: (t.nazev ?? 'Firma')
								: t.subjectType === 'private'
									? 'Soukromá osoba'
									: 'Neuvedeno'
						),
						e(
							Text,
							{ style: styles.tlTag, key: 't' },
							RELATION_LABEL[t.relation] ?? t.relation
						)
					])
				)
			)
		)
	}

	// STK inspection history.
	children.push(
		e(Text, { style: styles.sectionTitle, key: 'stk-t' }, 'Historie STK')
	)
	if (history.inspections.total > 0) {
		children.push(
			e(View, { key: 'stk-s' }, [
				row('Počet prohlídek', String(history.inspections.total)),
				row('Neúspěšných', String(history.inspections.failed)),
				row(
					'Kontrolováno na stanicích',
					String(history.inspections.distinctStations)
				)
			])
		)
		children.push(
			e(
				View,
				{ key: 'stk-h', style: { marginTop: 4 } },
				history.inspections.history.map((h, i) =>
					e(View, { style: styles.tlRow, key: `stk-${i}` }, [
						e(Text, { style: styles.tlDate, key: 'd' }, fmtDate(h.date)),
						e(
							Text,
							{ style: styles.tlMain, key: 'm' },
							h.administrative
								? 'nové vozidlo'
								: (STK_LABEL[h.result] ?? h.result)
						),
						e(Text, { style: styles.tlTag, key: 's' }, h.nazevStk ?? '')
					])
				)
			)
		)
	} else {
		children.push(
			e(Text, { style: styles.muted, key: 'stk-none' }, 'Žádné záznamy o STK.')
		)
	}

	// Imports — labelled as on the web ("Dovezené vozidlo").
	if (history.imports.length > 0) {
		children.push(
			e(Text, { style: styles.sectionTitle, key: 'imp-t' }, 'Dovezené vozidlo')
		)
		children.push(
			e(
				View,
				{ key: 'imp' },
				history.imports.map((im) =>
					row(
						im.country ?? 'zahraničí',
						im.date ? fmtDate(im.date) : 'datum neuvedeno'
					)
				)
			)
		)
		children.push(
			e(
				Text,
				{ style: styles.muted, key: 'imp-note' },
				'Český registr neobsahuje historii ze země původu.'
			)
		)
	}

	// Deregistrations — shown on the web ("Vyřazení z provozu").
	if (history.deregistrations.length > 0) {
		children.push(
			e(Text, { style: styles.sectionTitle, key: 'dereg-t' }, 'Vyřazení z provozu')
		)
		children.push(
			e(
				View,
				{ key: 'dereg' },
				history.deregistrations.map((d) =>
					row(d.reason ?? 'neuvedeno', d.from ? fmtDate(d.from) : '—')
				)
			)
		)
	}

	// Technical data — grouped into the same labeled sections as the detail page.
	const techGroups = buildTechnicalGroups(data)
	if (techGroups.length > 0) {
		children.push(
			e(Text, { style: styles.sectionTitle, key: 'tech-t' }, 'Technické údaje')
		)
		for (const group of techGroups) {
			children.push(
				e(
					View,
					{ key: `techg-${group.label}`, wrap: false },
					[
						e(
							Text,
							{ style: styles.groupTitle, key: 'gt' },
							group.label
						),
						...group.fields.map((f, i) =>
							e(View, { style: styles.row, key: `f-${i}` }, [
								e(Text, { style: styles.cellLabel, key: 'l' }, f.label),
								e(Text, { style: styles.cellValue, key: 'v' }, f.value)
							])
						)
					]
				)
			)
		}
	}

	// Footer disclaimer — must not imply state authority.
	const footer = e(
		Text,
		{ style: styles.footer, fixed: true, key: 'footer' },
		`Údaje pocházejí z veřejného registru silničních vozidel ČR (otevřená data)${
			snapshotDate ? `, stav k ${fmtDate(snapshotDate)}` : ''
		}. Tento přehled zpracoval VINInfo.cz z veřejných dat registru a není úředním dokumentem. Neobsahuje stav tachometru, záznamy o nehodách ani zástavy/leasing. Pravost ověříte na ${meta.verifyUrl}`
	)

	// Diagonal watermark on every page (sample/preview PDFs only).
	const watermark = meta.watermark
		? e(
				Text,
				{ style: styles.watermark, fixed: true, key: 'watermark' },
				meta.watermark
			)
		: null

	const doc = e(
		Document,
		{ title: `Certifikát ${meta.code}` },
		e(
			Page,
			{ size: 'A4', style: styles.page },
			[...children, footer, watermark].filter(Boolean)
		)
	)

	return renderToBuffer(doc)
}
