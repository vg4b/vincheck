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
import { createElement as e, type ReactNode } from 'react'
import QRCode from 'qrcode'
import type { VehicleCacheResult } from './_vehicleCache'

/** Everything the PDF needs that isn't derivable from the snapshot itself. */
export interface CertificateMeta {
	code: string
	issuedAt: Date
	verifyUrl: string
}

const BRAND = '#1f6feb'
const INK = '#1a1a2e'
const MUTED = '#6b7280'
const BORDER = '#d1d5db'

// Plain style objects — @react-pdf accepts them directly, so we avoid calling
// StyleSheet.create at module scope (the package is ESM-only, imported lazily).
const styles = {
	page: {
		paddingTop: 40,
		paddingBottom: 56,
		paddingHorizontal: 44,
		fontSize: 10,
		color: INK,
		fontFamily: 'Helvetica'
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
	brand: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: BRAND },
	docTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 2 },
	docSubtitle: { fontSize: 9, color: MUTED, marginTop: 1 },
	metaRight: { alignItems: 'flex-end' },
	metaLabel: { fontSize: 8, color: MUTED },
	metaValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
	qr: { width: 84, height: 84, marginTop: 6 },
	sectionTitle: {
		fontSize: 11,
		fontFamily: 'Helvetica-Bold',
		color: BRAND,
		marginTop: 14,
		marginBottom: 6
	},
	row: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: BORDER,
		paddingVertical: 3
	},
	cellLabel: { width: '40%', color: MUTED },
	cellValue: { width: '60%', fontFamily: 'Helvetica-Bold' },
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
		fontFamily: 'Helvetica-Bold'
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

const RELATION_LABEL: Record<string, string> = {
	owner: 'Vlastník',
	operator: 'Provozovatel',
	other: 'Jiný vztah'
}

const STK_LABEL: Record<string, string> = {
	fit: 'Způsobilé',
	unfit: 'Nezpůsobilé',
	conditional: 'Částečně způsobilé',
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
	const { Document, Page, View, Text, Image, renderToBuffer } = await import(
		'@react-pdf/renderer'
	)

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
				e(Text, { style: styles.brand, key: 'b' }, 'VIN Info.cz'),
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

	// Notable flags (stolen / exported / deregistered) — surface first.
	const flagNodes: ReactNode[] = []
	if (history.flags.stolen)
		flagNodes.push(
			e(
				Text,
				{ style: styles.flag, key: 'stolen' },
				'Vozidlo je evidováno jako odcizené'
			)
		)
	if (history.flags.exported)
		flagNodes.push(
			e(
				Text,
				{ style: styles.flag, key: 'exported' },
				'Vozidlo bylo vyvezeno do zahraničí'
			)
		)
	if (history.flags.deregistered && !history.flags.exported)
		flagNodes.push(
			e(
				Text,
				{ style: styles.flag, key: 'dereg' },
				'Vozidlo je vyřazeno z provozu / zánik'
			)
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
			'Vlastníci a provozovatelé'
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
							t.nazev ??
								(t.subjectType === 'company' ? 'Firma' : 'Soukromá osoba')
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

	// Imports.
	if (history.imports.length > 0) {
		children.push(
			e(Text, { style: styles.sectionTitle, key: 'imp-t' }, 'Dovoz vozidla')
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
	}

	// Footer disclaimer — must not imply state authority.
	const footer = e(
		Text,
		{ style: styles.footer, fixed: true, key: 'footer' },
		`Údaje pocházejí z veřejného registru silničních vozidel ČR (otevřená data)${
			snapshotDate ? `, stav k ${fmtDate(snapshotDate)}` : ''
		}. Tento přehled zpracoval VIN Info.cz z veřejných dat registru a není úředním dokumentem. Neobsahuje stav tachometru, záznamy o nehodách ani zástavy/leasing. Pravost ověříte na ${meta.verifyUrl}`
	)

	const doc = e(
		Document,
		{ title: `Certifikát ${meta.code}` },
		e(Page, { size: 'A4', style: styles.page }, [...children, footer])
	)

	return renderToBuffer(doc)
}
