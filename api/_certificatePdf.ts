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
 * GDPR: entity names are never shown in the timeline — companies and
 * self-employed individuals (OSVČ) alike are reduced to their public IČO
 * (linked to the official registers); private individuals show as "Soukromá
 * osoba". Names are dropped upstream (nazev null). Never add buyer PII either.
 */
import path from 'node:path'
import QRCode from 'qrcode'
import { createElement as e, type ReactNode } from 'react'
import type { VehicleCacheResult } from './_vehicleCache'
import { buildTechnicalGroups, resolveBrandModel } from './_vehicleFieldLabels'

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
		paddingBottom: 72,
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
	// Labelled composite parts: muted normal-weight label/unit/separator runs
	// nested inside the bold value cell.
	segLabel: { color: MUTED, fontWeight: 400 },
	segMuted: { color: MUTED, fontWeight: 400 },
	// Multi-line composite value cell (one axle per line).
	cellValueCol: { width: '60%' },
	segLineValue: { fontWeight: 700, marginBottom: 1 },
	tlRow: {
		flexDirection: 'row',
		paddingVertical: 3,
		borderBottomWidth: 1,
		borderBottomColor: BORDER
	},
	tlDate: { width: '34%', color: MUTED },
	tlMain: { width: '46%' },
	tlLink: { width: '46%', color: BRAND, textDecoration: 'none' },
	tlTag: { width: '20%', textAlign: 'right', color: MUTED },
	tlRowZebra: { backgroundColor: '#f8fafc' },
	flag: {
		padding: 6,
		marginBottom: 4,
		borderRadius: 3,
		backgroundColor: '#fef2f2',
		color: '#b91c1c',
		fontWeight: 700
	},
	muted: { color: MUTED },
	// Explanatory note under a table/list — needs breathing room above and below.
	note: {
		fontSize: 8.5,
		color: MUTED,
		marginTop: 7,
		marginBottom: 2,
		lineHeight: 1.4
	},
	// Prediction callout — visually separated from the confirmed readings.
	predictionBox: {
		marginTop: 12,
		marginBottom: 4,
		padding: 10,
		borderRadius: 5,
		backgroundColor: '#eff5ff',
		borderLeftWidth: 3,
		borderLeftColor: BRAND
	},
	predictionLabel: { fontSize: 8.5, color: MUTED, marginBottom: 3 },
	predictionValue: { fontSize: 14, fontWeight: 700, color: INK },
	predictionNote: { fontSize: 8, color: MUTED, marginTop: 5, lineHeight: 1.4 },
	// Long free-text registry dump (e.g. "Další záznamy") — a raw appendix string,
	// not a headline value. Stacked full-width in small regular weight so it reads
	// as fine print instead of a wall of bold data.
	appendixRow: {
		borderBottomWidth: 1,
		borderBottomColor: BORDER,
		paddingVertical: 4
	},
	appendixLabel: { color: MUTED, marginBottom: 2 },
	appendixValue: {
		fontSize: 8,
		color: '#4b5563',
		lineHeight: 1.35,
		marginBottom: 1.5
	},
	// Compact "at a glance" status band under the header — quick-read chips.
	glance: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginBottom: 10,
		gap: 5
	},
	chip: {
		fontSize: 8,
		paddingVertical: 3,
		paddingHorizontal: 7,
		borderRadius: 10,
		backgroundColor: '#eef2f7',
		color: '#374151'
	},
	chipGood: { backgroundColor: '#ecfdf3', color: '#067647' },
	chipWarn: { backgroundColor: '#fef2f2', color: '#b91c1c' },
	// Full-bleed shaded bar pinned to the bottom edge — the disclaimer reads as
	// chrome, distinct from content, and carries the page number on its right.
	footer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: '#f1f4f8',
		paddingVertical: 8,
		paddingHorizontal: 30,
		flexDirection: 'row',
		alignItems: 'flex-end'
	},
	footerText: {
		flexGrow: 1,
		flexShrink: 1,
		paddingRight: 12,
		fontSize: 7.5,
		color: MUTED,
		lineHeight: 1.4
	},
	footerPage: { flexShrink: 0, fontSize: 7.5, color: MUTED }
} as const

// Lowercase to match the web (VehicleHistoryPanel RELATION_LABEL).
const RELATION_LABEL: Record<string, string> = {
	owner: 'vlastník',
	operator: 'provozovatel',
	other: 'jiný vztah'
}

// Official public-registers search (justice ministry) for a given IČO. We never
// show the entity's name on the certificate (GDPR — OSVČ names are personal
// data); the reader can look it up here from the public identifier instead.
function registryUrl(ico: string): string {
	return `https://verejnerejstriky.msp.gov.cz/vysledky?resultsType=search&hledanyText=${encodeURIComponent(
		ico
	)}&rejstriky=VR`
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

// Thousands grouping with a plain space (avoids locale/NBSP rendering quirks in
// the PDF): 166845 → "166 845".
function fmtKm(n: number): string {
	return Math.round(n)
		.toString()
		.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// Czech plural picker: 1 / 2–4 / 5+ (mirrors czPlural on the web).
function czPlural(n: number, one: string, few: string, many: string): string {
	if (n === 1) return one
	if (n >= 2 && n <= 4) return few
	return many
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
	const { Document, Page, View, Text, Link, Image, Font, renderToBuffer } =
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
	// Junk-tolerant make/model — registry placeholders ("." on old records) are
	// resolved to a real brand from the type string. See resolveBrandModel.
	const { brand, model } = resolveBrandModel(data)
	const snapshotDate = history.snapshot

	const qrDataUrl = await QRCode.toDataURL(meta.verifyUrl, { margin: 0 })

	// `key` defaults to the label, but callers rendering repeated labels in a loop
	// (e.g. two deregistrations both "Na žádost vlastníka") must pass a unique key.
	// `wrap: false` keeps a label/value pair intact across a page break.
	const row = (label: string, value: string, key: string = label) =>
		e(View, { style: styles.row, key, wrap: false }, [
			e(Text, { style: styles.cellLabel, key: 'l' }, label),
			e(Text, { style: styles.cellValue, key: 'v' }, value)
		])

	// Section / group headings reserve space ahead so they never orphan at the
	// very bottom of a page with their content pushed to the next one.
	const secTitle = (text: string, key: string) =>
		e(Text, { style: styles.sectionTitle, key, minPresenceAhead: 72 }, text)
	const grpTitle = (text: string, key: string) =>
		e(Text, { style: styles.groupTitle, key, minPresenceAhead: 48 }, text)

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
	// NOTE: usage signals from the equipment records (ex-autoškola, ex-IZS) are
	// deliberately NOT in this list — it's the stolen/deregistered warning block,
	// and they are notable history, not defects. They render as informational
	// notes in the "Výbava a úpravy" section instead, matching the web.
	if (flagNodes.length > 0) {
		children.push(
			e(View, { key: 'flags', style: { marginBottom: 6 } }, flagNodes)
		)
	}

	// "At a glance" chips — the buyer's first questions answered in one strip:
	// status, owner count, STK outcome, rollback verdict. Colour cues (green =
	// clean, red = attention) without repeating the prominent red flags above.
	const chips: ReactNode[] = []
	const chip = (text: string, tone: 'neutral' | 'good' | 'warn', key: string) =>
		e(
			Text,
			{
				key,
				style:
					tone === 'good'
						? [styles.chip, styles.chipGood]
						: tone === 'warn'
							? [styles.chip, styles.chipWarn]
							: styles.chip
			},
			text
		)
	if (history.flags.statusLabel)
		chips.push(chip(history.flags.statusLabel, 'neutral', 'g-status'))
	chips.push(
		chip(
			`${history.owners.total} ${czPlural(history.owners.total, 'vlastník', 'vlastníci', 'vlastníků')}`,
			'neutral',
			'g-own'
		)
	)
	if (history.owners.operators > 0)
		chips.push(
			chip(
				`${history.owners.operators} ${czPlural(history.owners.operators, 'provozovatel', 'provozovatelé', 'provozovatelů')}`,
				'neutral',
				'g-oper'
			)
		)
	if (history.inspections.total > 0)
		chips.push(
			chip(
				history.inspections.failed > 0
					? `STK: ${history.inspections.failed}× neúspěšná`
					: `STK: ${history.inspections.total}× bez závady`,
				history.inspections.failed > 0 ? 'warn' : 'good',
				'g-stk'
			)
		)
	if (history.mileage.readings.length > 0)
		chips.push(
			chip(
				history.mileage.rollbackSuspected
					? 'Podezření na stočení'
					: 'Tachometr bez podezření',
				history.mileage.rollbackSuspected ? 'warn' : 'good',
				'g-tacho'
			)
		)
	if (history.imports.length > 0)
		chips.push(chip('Dovoz', 'neutral', 'g-import'))
	children.push(e(View, { key: 'glance', style: styles.glance }, chips))

	// Vehicle identity.
	children.push(secTitle('Identifikace vozidla', 'id-t'))
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
	children.push(secTitle('Majitelé a provozovatelé', 'own-t'))
	children.push(
		e(View, { key: 'own' }, [
			row('Počet vlastníků', String(history.owners.total)),
			row('Počet provozovatelů', String(history.owners.operators))
		])
	)
	if (history.owners.timeline.length > 0) {
		children.push(grpTitle('Časová osa vlastníků a provozovatelů', 'tl-t'))
	}
	if (history.owners.timeline.length > 0) {
		children.push(
			e(
				View,
				{ key: 'tl', style: { marginTop: 4 } },
				history.owners.timeline.map((t, i) =>
					e(
						View,
						{
							style: i % 2 ? [styles.tlRow, styles.tlRowZebra] : styles.tlRow,
							key: `tl-${i}`,
							wrap: false
						},
						[
							e(
								Text,
								{ style: styles.tlDate, key: 'd' },
								`${fmtDate(t.from)} – ${t.current ? 'dosud' : fmtDate(t.to)}`
							),
							// Entity names are never shown (GDPR); a row with an IČO shows the
							// public identifier, linked to the official public registers.
							t.ico
								? e(
										Link,
										{ style: styles.tlLink, key: 'm', src: registryUrl(t.ico) },
										`IČO ${t.ico}`
									)
								: e(
										Text,
										{ style: styles.tlMain, key: 'm' },
										t.subjectType === 'company'
											? 'Firma'
											: t.subjectType === 'private'
												? 'Soukromá osoba'
												: 'Neuvedeno'
									),
							e(
								Text,
								{ style: styles.tlTag, key: 't' },
								RELATION_LABEL[t.relation] ?? t.relation
							)
						]
					)
				)
			)
		)
	}

	// STK inspection history.
	children.push(secTitle('Historie STK', 'stk-t'))
	if (history.inspections.total > 0) {
		// Next STK due date — shown as the "Platnost STK" tile on the web, but kept
		// out of the technical tables (SUMMARY_FIELDS), so surface it here.
		const stkValidUntil = dataValue(data, 'PravidelnaTechnickaProhlidkaDo', '')
		children.push(
			e(View, { key: 'stk-s' }, [
				row('Počet prohlídek', String(history.inspections.total)),
				row('Neúspěšných', String(history.inspections.failed)),
				row(
					'Kontrolováno na stanicích',
					String(history.inspections.distinctStations)
				),
				...(stkValidUntil
					? [row('Platnost STK do', fmtDate(stkValidUntil))]
					: [])
			])
		)
		children.push(
			e(
				View,
				{ key: 'stk-h', style: { marginTop: 4 } },
				// Oldest → newest, consistent with the owner timeline and mileage list.
				[...history.inspections.history].reverse().map((h, i) =>
					e(
						View,
						{
							style: i % 2 ? [styles.tlRow, styles.tlRowZebra] : styles.tlRow,
							key: `stk-${i}`,
							wrap: false
						},
						[
							e(Text, { style: styles.tlDate, key: 'd' }, fmtDate(h.date)),
							e(
								Text,
								{ style: styles.tlMain, key: 'm' },
								h.administrative
									? 'nové vozidlo'
									: (STK_LABEL[h.result] ?? h.result)
							),
							e(Text, { style: styles.tlTag, key: 's' }, h.nazevStk ?? '')
						]
					)
				)
			)
		)
	} else {
		children.push(
			e(Text, { style: styles.muted, key: 'stk-none' }, 'Žádné záznamy o STK.')
		)
	}

	// Mileage / odometer history — the certificate's headline value, shown in full
	// (the free web view only teases it, blurred). From STK/emission inspections.
	if (history.mileage.readings.length > 0) {
		const m = history.mileage
		children.push(secTitle('Historie stavu tachometru', 'mil-t'))
		if (m.rollbackSuspected) {
			children.push(
				e(
					Text,
					{ style: styles.flag, key: 'mil-rb' },
					'Podezření na stočení tachometru: pozdější záznam má nižší stav tachometru než dřívější.'
				)
			)
		}
		// Confirmed readings only — the prediction lives in its own callout below.
		children.push(
			e(View, { key: 'mil-s' }, [
				row(
					'Poslední známý stav',
					m.latestKm != null ? `${fmtKm(m.latestKm)} km` : '—'
				),
				...(m.avgKmPerYear != null
					? [row('Průměrný roční nájezd', `~${fmtKm(m.avgKmPerYear)} km`)]
					: []),
				row('Počet záznamů', String(m.readings.length))
			])
		)
		children.push(
			e(
				View,
				{ key: 'mil-h', style: { marginTop: 6 } },
				// Oldest → newest, so a rollback shows as a visible dip.
				m.readings.map((r, i) =>
					e(
						View,
						{
							style: i % 2 ? [styles.tlRow, styles.tlRowZebra] : styles.tlRow,
							key: `mil-${i}`,
							wrap: false
						},
						[
							e(Text, { style: styles.tlDate, key: 'd' }, fmtDate(r.date)),
							e(Text, { style: styles.tlMain, key: 'm' }, `${fmtKm(r.km)} km`),
							e(Text, { style: styles.tlTag, key: 'p' }, r.protocol ?? '')
						]
					)
				)
			)
		)
		children.push(
			e(
				Text,
				{ style: styles.note, key: 'mil-note' },
				m.avgKmPerYear != null
					? 'Stav tachometru ze záznamů technických a emisních prohlídek (STK/ME). Průměrný roční nájezd je vypočten z rozsahu záznamů v registru ČR.'
					: 'Stav tachometru ze záznamů technických a emisních prohlídek (STK/ME).'
			)
		)

		// Prediction — a separate, clearly-labelled estimate. Never mixed with the
		// verified readings above.
		if (m.prediction) {
			children.push(
				e(View, { key: 'mil-pred', style: styles.predictionBox, wrap: false }, [
					e(
						Text,
						{ style: styles.predictionLabel, key: 'l' },
						'Předpokládaný současný stav tachometru (odhad)'
					),
					e(
						Text,
						{ style: styles.predictionValue, key: 'v' },
						`${fmtKm(m.prediction.lowKm)} – ${fmtKm(m.prediction.highKm)} km`
					),
					e(
						Text,
						{ style: styles.predictionNote, key: 'n' },
						`Odhad z tempa ~${fmtKm(m.prediction.perYearKm)} km/rok (${m.prediction.fromYear}–${m.prediction.toYear}). Jde o odhad, ne ověřený údaj — skutečný nájezd se může lišit, vozidlo nemusí jezdit rovnoměrně.`
					)
				])
			)
		}
	}

	// Imports — labelled as on the web ("Dovezené vozidlo").
	if (history.imports.length > 0) {
		children.push(secTitle('Dovezené vozidlo', 'imp-t'))
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
				{ style: styles.note, key: 'imp-note' },
				'Český registr neobsahuje historii ze země původu.'
			)
		)
	}

	// Counterpart to the import section — two provable facts, not an inference:
	// the first registration was in the CZ, and the registry holds no import
	// record. We do NOT claim the history is complete: a car first registered
	// here, later exported and re-imported without that being recorded is
	// undetectable (the registry keeps no export history). Never assert "nebylo
	// dovezeno" either. Wording matches the web (VehicleHistoryPanel).
	if (history.imports.length === 0 && history.firstRegisteredInCz) {
		children.push(secTitle('Původ vozidla', 'orig-t'))
		children.push(
			e(
				View,
				{ key: 'orig' },
				row('První registrace', 'Česká republika', 'orig-r')
			)
		)
		children.push(
			e(
				Text,
				{ style: styles.note, key: 'orig-note' },
				'Vozidlo bylo poprvé registrováno v ČR. Registr neeviduje dovoz ze zahraničí.'
			)
		)
	}

	// Equipment / modifications — mirrors the web. Optional: snapshots frozen
	// before this feature shipped carry no `equipment` key.
	const equipment = history.equipment?.items ?? []
	if (equipment.length > 0) {
		children.push(secTitle('Doplňkové vybavení zapsané v registru', 'eq-t'))

		// What this section IS — without it a bare "Klimatizace, Katalyzátor" list
		// reads like a factory equipment spec. Wording matches the web.
		children.push(
			e(
				Text,
				{ style: styles.note, key: 'eq-intro' },
				'Vybavení a úpravy, které byly na vozidlo dodatečně namontovány a zapsány do registru silničních vozidel — nejde o výbavu vozu z výroby.'
			)
		)

		// Usage signals as informational notes — wording matches the web
		// (VehicleHistoryPanel usageNotes). Not in the red flag block above: an
		// ex-autoškola or ex-fleet car is notable history, not a defect.
		const eqFlags = history.equipment?.flags
		const notes: string[] = []
		if (eqFlags?.drivingSchool)
			notes.push(
				'Evidováno dvojí ovládání — vozidlo mohlo sloužit jako autoškola.'
			)
		if (eqFlags?.emergency)
			notes.push(
				'Evidován maják (modrý/červený) — vozidlo mohlo sloužit u složek IZS.'
			)
		if (eqFlags?.utility)
			notes.push(
				'Evidován oranžový maják — vozidlo mohlo sloužit jako služební/údržbové.'
			)
		if (eqFlags?.heavyDuty)
			notes.push(
				'Evidována nástavba pro těžký provoz (ruka, pluh, nakladač apod.).'
			)
		for (const [i, n] of notes.entries()) {
			children.push(e(Text, { style: styles.note, key: `eq-n-${i}` }, n))
		}

		children.push(
			e(
				View,
				{ key: 'eq' },
				// Removed equipment stays listed and is labelled as such — the usage
				// history is the point, not the hardware currently bolted on.
				equipment.map((item) =>
					row(
						item.label,
						item.removed
							? `${item.from ? `${fmtDate(item.from)} – ` : 'do '}${fmtDate(item.to)} · odstraněno`
							: item.from
								? `od ${fmtDate(item.from)}`
								: '—',
						item.type
					)
				)
			)
		)
		children.push(
			e(
				Text,
				{ style: styles.note, key: 'eq-note' },
				// Honesty: absence of an item is NOT evidence the vehicle lacks it.
				// (Dates are omitted where the registry holds none — a fact about the
				// dataset, not about this vehicle, so it stays out of the buyer's copy.)
				'Seznam nemusí být úplný — chybějící položka neznamená, že ji vozidlo nemá.'
			)
		)
	}

	// Deregistrations — shown on the web ("Vyřazení z provozu").
	if (history.deregistrations.length > 0) {
		children.push(secTitle('Vyřazení z provozu', 'dereg-t'))
		children.push(
			e(
				View,
				{ key: 'dereg' },
				// Oldest → newest, consistent with the STK and mileage lists (the DB
				// returns deregistrations newest-first).
				[...history.deregistrations]
					.sort((a, b) => (a.from ?? '').localeCompare(b.from ?? ''))
					.map((d, i) =>
						row(
							d.reason ?? 'neuvedeno',
							d.from ? fmtDate(d.from) : '—',
							`dereg-${i}`
						)
					)
			)
		)
	}

	// Technical data — grouped into the same labeled sections as the detail page.
	const techGroups = buildTechnicalGroups(data)
	// Render a composite field's labelled parts as nested runs in the value cell:
	// "celkem 5 · k sezení 5" (labels muted, values bold), unit once at the end.
	const segRuns = (f: (typeof techGroups)[number]['fields'][number]) => {
		const runs: ReactNode[] = []
		f.segments!.forEach((s, j) => {
			if (j > 0)
				runs.push(e(Text, { style: styles.segMuted, key: `s-${j}` }, ' · '))
			if (s.label)
				runs.push(
					e(Text, { style: styles.segLabel, key: `l-${j}` }, `${s.label} `)
				)
			runs.push(s.value)
		})
		if (f.unit)
			runs.push(e(Text, { style: styles.segMuted, key: 'u' }, ` ${f.unit}`))
		return runs
	}
	if (techGroups.length > 0) {
		const renderTechGroup = (group: (typeof techGroups)[number]) =>
			e(View, { key: `techg-${group.label}`, wrap: false }, [
				grpTitle(group.label, 'gt'),
				...group.fields.map((f, i) =>
					// Composite fields render as labelled parts; a long free-text dump
					// reads as fine print; everything else is a two-column label/value.
					f.segments
						? f.multiline
							? e(View, { style: styles.row, key: `f-${i}` }, [
									e(Text, { style: styles.cellLabel, key: 'l' }, f.label),
									e(
										View,
										{ style: styles.cellValueCol, key: 'v' },
										f.segments.map((s, j) =>
											e(
												Text,
												{ style: styles.segLineValue, key: `m-${j}` },
												s.label
													? [
															e(
																Text,
																{ style: styles.segLabel, key: 'l' },
																`${s.label} `
															),
															s.value
														]
													: [s.value]
											)
										)
									)
								])
							: e(View, { style: styles.row, key: `f-${i}` }, [
									e(Text, { style: styles.cellLabel, key: 'l' }, f.label),
									e(Text, { style: styles.cellValue, key: 'v' }, segRuns(f))
								])
						: f.value.length > 80
							? e(View, { style: styles.appendixRow, key: `f-${i}` }, [
									e(Text, { style: styles.appendixLabel, key: 'l' }, f.label),
									// One entry per line (matches the web). formatValue joins the
									// registry's pipe-delimited parts with ", "; split them back so
									// the raw dump reads as a list instead of a run-on sentence.
									...f.value
										.split(', ')
										.map((seg, j) =>
											e(
												Text,
												{ style: styles.appendixValue, key: `v-${j}` },
												seg
											)
										)
								])
							: e(View, { style: styles.row, key: `f-${i}` }, [
									e(Text, { style: styles.cellLabel, key: 'l' }, f.label),
									e(Text, { style: styles.cellValue, key: 'v' }, f.value)
								])
				)
			])
		// Bind the section title to its first group so it never orphans at
		// a page break (blank gap while its content flows to the next page).
		children.push(
			e(View, { key: 'tech-head', wrap: false }, [
				secTitle('Technické údaje', 'tech-t'),
				renderTechGroup(techGroups[0])
			])
		)
		for (const group of techGroups.slice(1)) {
			children.push(renderTechGroup(group))
		}
	}

	// Footer disclaimer — must not imply state authority. The "neobsahuje" list
	// drops "stav tachometru" when this certificate actually includes it (from the
	// STK/emission inspection data), so the footer never contradicts the content.
	const excludes =
		history.mileage.readings.length > 0
			? 'záznamy o nehodách ani zástavy/leasing'
			: 'stav tachometru, záznamy o nehodách ani zástavy/leasing'
	// Full-bleed footer bar on every page: disclaimer on the left, page number on
	// the right, both baseline-aligned to the bottom of the bar.
	const footer = e(View, { style: styles.footer, fixed: true, key: 'footer' }, [
		e(
			Text,
			{ style: styles.footerText, key: 'text' },
			`Údaje pocházejí z veřejného registru silničních vozidel ČR (otevřená data)${
				snapshotDate ? `, stav k ${fmtDate(snapshotDate)}` : ''
			}. Záznamy STK a stavu tachometru jsou dostupné zhruba od roku 2009; starší prohlídky nemusí být evidovány. Tento přehled zpracoval VINInfo.cz z veřejných dat registru a není úředním dokumentem. Neobsahuje ${excludes}. Pravost ověříte na ${meta.verifyUrl}`
		),
		e(Text, {
			style: styles.footerPage,
			key: 'page',
			render: ({
				pageNumber,
				totalPages
			}: {
				pageNumber: number
				totalPages: number
			}) => `${pageNumber} / ${totalPages}`
		})
	])

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
