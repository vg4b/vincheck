import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { isCertificateEnabled } from '../config/featureFlags'
import type {
	DefectSeverity,
	OwnerRelation,
	StkResult,
	VehicleDefect,
	VehicleHistory
} from '../types'
import Icon from './Icon'

// Temporary kill switch for the Cebia CheckLease link — set to true to restore.
const SHOW_CHECKLEASE_LINK = false

// Czech plural picker: 1 / 2–4 / 5+
function czPlural(n: number, one: string, few: string, many: string): string {
	if (n === 1) return one
	if (n >= 2 && n <= 4) return few
	return many
}

function fmtDate(s: string | null): string {
	if (!s) return '—'
	const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
	return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}` : s
}

function yearOf(s: string): string {
	return s.slice(0, 4)
}

// vehicle_inspections.typ: "P - Pravidelná", "E - Evidenční", … Label by the
// leading code so the evidence inspections read distinctly from regular STK.
function inspTypeLabel(typ: string | null): string | null {
	if (!typ) return null
	const code = typ.trim().charAt(0).toUpperCase()
	if (code === 'P') return 'pravidelná'
	if (code === 'E') return 'evidenční'
	const dash = typ.indexOf('-')
	const rest = dash >= 0 ? typ.slice(dash + 1).trim() : typ.trim()
	return rest ? rest.toLowerCase() : null
}

const STK_LABEL: Record<StkResult, string> = {
	pass: 'Způsobilé',
	defects: 'Způsobilé s vadami',
	unfit: 'Nezpůsobilé',
	unknown: 'Neuvedeno'
}

// Defect severity per vyhláška 211/2018 Sb.: A = lehká, B = vážná (must be
// fixed within 30 days), C = nebezpečná (vehicle is nezpůsobilé).
const DEFECT_SEVERITY_LABEL: Record<DefectSeverity, string> = {
	A: 'lehká',
	B: 'vážná',
	C: 'nebezpečná',
	unknown: '—'
}

const DEFECT_SEVERITY_COLOR: Record<DefectSeverity, string> = {
	A: '#b8860b',
	B: '#b8860b',
	C: 'var(--accent-red)',
	unknown: '#6c757d'
}

/** How many defects to list before collapsing the rest into a count. */
const MAX_SHOWN_DEFECTS = 6

/**
 * What we can say about one defect, in order of how much we know:
 * the official text, else the inspection area, else just the raw code.
 */
function defectLabel(d: VehicleDefect): string {
	if (d.text) return d.text
	if (d.group) return `závada – ${d.group}`
	return `závada ${d.code}`
}

const STK_COLOR: Record<StkResult, string> = {
	pass: 'var(--brand-600)',
	defects: '#b8860b',
	unfit: 'var(--accent-red)',
	unknown: '#6c757d'
}

const RELATION_LABEL: Record<OwnerRelation, string> = {
	owner: 'vlastník',
	operator: 'provozovatel',
	other: 'jiný vztah'
}

const RELATION_BADGE: Record<OwnerRelation, string> = {
	owner: 'text-bg-light',
	operator: 'text-bg-light',
	other: 'text-bg-light'
}

type Flag = { label: string; severe: boolean }

type FinancingBadge = { label: string; className: string }

/**
 * Registered purpose, as a badge. The registry states this plainly for every
 * vehicle, but it used to render as one more row in the technical table at the
 * same weight as the wheelbase — a taxi says more about a car's wear than any
 * spec on that list.
 *
 * Neutral styling, like the equipment-derived signals: it is recorded usage, not
 * a defect. And it is CURRENT state, so the wording is "registr eviduje", never
 * "bylo taxi" — a taxi deregistered before the sale reads as ordinary again.
 */
const USAGE_BADGE: Record<string, string> = {
	taxi: 'Registr: TAXI',
	emergency: 'Registr: vozidlo s právem přednosti v jízdě',
	rental: 'Registr: půjčovna',
	haulage: 'Registr: silniční doprava pro cizí potřeby',
	publicTransport: 'Registr: veřejná linková doprava'
}

/** Accusative, so the kinds slot into "…jsme našli X a Y." */
const FINANCING_KIND_ACC: Record<'leasing' | 'fleet' | 'rental', string> = {
	leasing: 'leasingovou nebo úvěrovou společnost',
	fleet: 'firemní vozový park (operativní leasing)',
	rental: 'autopůjčovnu'
}

/**
 * One sentence naming what we actually found, built from the kinds so it is never
 * vague ("leasingová, firemní nebo …" would describe the list, not this vehicle).
 */
function financingSummary(kinds: Array<'leasing' | 'fleet' | 'rental'> = []) {
	const parts = (['leasing', 'fleet', 'rental'] as const)
		.filter((k) => kinds.includes(k))
		.map((k) => FINANCING_KIND_ACC[k])
	if (parts.length === 0) return 'V historii vozidla je financující společnost.'
	const list =
		parts.length === 1
			? parts[0]
			: `${parts.slice(0, -1).join(', ')} a ${parts[parts.length - 1]}`
	return `V historii vozidla jsme našli ${list}.`
}

/**
 * Badges for the leasing/fleet/rental signal. The kind comes down with the free
 * teaser precisely so these never mislabel — an ex-rental is not "leasing".
 *
 * Only the CURRENT-ownership case is a warning. Past financing is history, not a
 * defect: it usually means the car was serviced on schedule. Ex-rental gets an
 * amber tone even in the past, because that history is what a buyer overpays for
 * without knowing.
 */
function financingBadges(h: VehicleHistory): FinancingBadge[] {
	const f = h.financing
	if (!f?.hasHistory) return []
	const kinds = f.kinds ?? []
	const badges: FinancingBadge[] = []
	// Only the CURRENT-ownership case gets colour. Everything else is history the
	// registry recorded, not a defect, and colouring it would editorialise.
	if (f.active) {
		badges.push({
			label: 'Aktivní leasing / financování',
			className: 'text-bg-warning'
		})
	} else if (kinds.includes('leasing')) {
		badges.push({
			label: 'Leasing v historii',
			className: 'text-bg-light border'
		})
	}
	if (kinds.includes('fleet')) {
		badges.push({
			label: 'Ex-firemní / operativní leasing',
			className: 'text-bg-light border'
		})
	}
	if (kinds.includes('rental')) {
		badges.push({
			label: 'Ex-vozidlo z půjčovny',
			className: 'text-bg-light border'
		})
	}
	return badges
}

function buildFlags(h: VehicleHistory): Flag[] {
	const flags: Flag[] = []
	if (h.flags.stolen)
		flags.push({ label: 'Evidováno jako odcizené', severe: true })
	if (h.flags.exported)
		flags.push({ label: 'Vyvezeno do zahraničí', severe: false })
	if (h.flags.deregistered && !h.flags.exported)
		flags.push({ label: 'Vyřazeno z provozu / zánik', severe: false })
	if (h.flags.insuranceLapsed)
		flags.push({ label: 'Zaniklé pojištění', severe: false })
	return flags
}

/**
 * Usage signals derived from the equipment records — how the vehicle was USED,
 * which nothing else in the registry reveals. Rendered inside the equipment
 * card, deliberately NOT alongside the stolen/deregistered warnings: an
 * ex-autoškola or ex-fleet car is notable history, not a defect, and a red/amber
 * alert-triangle badge would overstate it. Neutral tone, informational icon.
 *
 * The signal stands even when the equipment was later removed — taking the
 * beacon or the dual controls out before a sale doesn't undo the wear.
 */
function usageNotes(h: VehicleHistory): string[] {
	const eq = h.equipment?.flags
	if (!eq) return []
	const notes: string[] = []
	if (eq.drivingSchool)
		notes.push(
			'Evidováno dvojí ovládání – vozidlo mohlo sloužit jako autoškola.'
		)
	if (eq.emergency)
		notes.push(
			'Evidován maják (modrý/červený) – vozidlo mohlo sloužit u složek IZS.'
		)
	if (eq.utility)
		notes.push(
			'Evidován oranžový maják – vozidlo mohlo sloužit jako služební/údržbové.'
		)
	if (eq.heavyDuty)
		notes.push(
			'Evidována nástavba pro těžký provoz (ruka, pluh, nakladač apod.).'
		)
	return notes
}

/**
 * Public-registry "history-lite": one card for owners/flags/deregistration and a
 * separate card for the STK inspection history. Rendered only on a cache hit
 * (the `history` prop is otherwise absent). See docs/VEHICLE_HISTORY_PANEL.md.
 */
const VehicleHistoryPanel: FC<{
	history: VehicleHistory
	vinCode: string
	/** Opens the certificate checkout (from the blurred mileage teaser). When
	 *  absent, the teaser links to the certificate landing page instead. */
	onUnlock?: () => void
}> = ({ history, vinCode, onUnlock }) => {
	const { owners, inspections, deregistrations, imports, mileage } = history
	// Absent on certificate snapshots frozen before the equipment feature shipped.
	const equipment = history.equipment?.items ?? []
	const notes = usageNotes(history)
	const flags = buildFlags(history)
	// Absent on snapshots frozen before the financing check shipped, and on the
	// live-API fallback.
	const financing = history.financing
	const finBadges = financingBadges(history)
	const usageKind = history.usage?.kind
	const usageBadge = usageKind ? USAGE_BADGE[usageKind] : null
	const cleanVin = vinCode.replace(/[^a-zA-Z0-9]/g, '')
	// Mileage is a paid-certificate feature — shown only behind the cert flag and
	// only when we actually have readings. Free view = blurred values + unlock CTA.
	const showMileage = isCertificateEnabled() && mileage.count > 0
	// Full owner/operator timeline (oldest first). Individuals are anonymised at
	// the source — shown as "Soukromá osoba" with dates only, no personal info.
	const timeline = [...owners.timeline].sort((a, b) =>
		(a.from ?? '').localeCompare(b.from ?? '')
	)

	return (
		<>
			{/* Registry: owners, flags, deregistration */}
			<details className='spec-group mt-4' open>
				<summary className='spec-summary'>
					<Icon name='file-text' size={18} className='text-brand' />
					<span>Historie z registru</span>
					<Icon name='chevron-right' size={18} className='spec-chevron' />
				</summary>
				<div className='spec-body'>
					{(flags.length > 0 || finBadges.length > 0 || usageBadge) && (
						<div className='d-flex flex-wrap gap-2 mb-3'>
							{usageBadge && (
								<span className='badge rounded-pill text-bg-light border'>
									<Icon name='info' size={12} /> {usageBadge}
								</span>
							)}
							{flags.map((f) => (
								<span
									key={f.label}
									className={`badge rounded-pill ${f.severe ? 'text-bg-danger' : 'text-bg-warning'}`}
								>
									<Icon name='alert-triangle' size={12} /> {f.label}
								</span>
							))}
							{finBadges.map((b) => (
								<span
									key={b.label}
									className={`badge rounded-pill ${b.className}`}
								>
									<Icon name='file-text' size={12} /> {b.label}
								</span>
							))}
						</div>
					)}

					{/* Financing. State what the registry records and nothing more – never
					    a claim about debt (an úvěr never shows up here, and a stale
					    un-transferred lease looks identical to a live one) and never a
					    guess about who is selling the vehicle. What it means and what to
					    check before buying belongs on /leasingove-spolecnosti, not here.
					    Silence when nothing was found: absence is not proof, so we never
					    print "vozidlo není zatíženo". */}
					{/* Deliberately NOT an `.alert`: the badge above already flags this, and
					    the site's alert styling (icon + accent stripe) reads as a defect.
					    This is a registry fact – and one that is stale on a noticeable share
					    of vehicles – so it gets the same weight as the historic case. */}
					{financing?.active && (
						<div className='small mb-3 d-flex gap-2 align-items-start'>
							<Icon
								name='info'
								size={14}
								className='text-brand flex-shrink-0 mt-1'
							/>
							{/* No claim about the operator: on an operating lease the same
							    company is registered as owner AND operator, so "vlastník a
							    provozovatel nejsou tentýž subjekt" is false for those
							    vehicles. The timeline below shows the actual relations. */}
							<strong>
								Vozidlo je podle registru ve vlastnictví leasingové nebo
								finanční společnosti.
							</strong>
						</div>
					)}
					{financing?.hasHistory && !financing.active && (
						<div className='small mb-3 d-flex gap-2 align-items-start'>
							<Icon
								name='info'
								size={14}
								className='text-brand flex-shrink-0 mt-1'
							/>
							<strong>{financingSummary(financing.kinds)}</strong>
						</div>
					)}

					<div className='mb-1'>
						<strong>Majitelé a provozovatelé</strong>
					</div>
					<div className='small'>
						{owners.total}{' '}
						{czPlural(owners.total, 'vlastník', 'vlastníci', 'vlastníků')},{' '}
						{owners.operators}{' '}
						{czPlural(
							owners.operators,
							'provozovatel',
							'provozovatelé',
							'provozovatelů'
						)}
					</div>

					{timeline.length > 0 && (
						<div className='small mt-2'>
							<div className='fw-semibold mb-1'>
								Časová osa vlastníků a provozovatelů
							</div>
							<ul
								className='list-unstyled mb-0'
								style={{
									display: 'grid',
									gridTemplateColumns: 'max-content 1fr',
									columnGap: '0.5rem',
									rowGap: '0.25rem'
								}}
							>
								{timeline.map((c, i) => (
									<li
										key={`${c.subjectType}-${c.ico ?? 'x'}-${c.relation}-${c.from ?? i}`}
										style={{ display: 'contents' }}
									>
										<span className='text-muted-ink text-nowrap'>
											{fmtDate(c.from)} – {c.current ? 'dosud' : fmtDate(c.to)}
										</span>
										<span>
											{/* GDPR: entity names are never shown. A row with an IČO shows
											    the public identifier, linked to our company (fleet) page. */}
											{c.ico ? (
												<Link to={`/firma/${c.ico}`}>IČO {c.ico}</Link>
											) : c.subjectType === 'company' ? (
												<span className='text-muted-ink'>Firma</span>
											) : c.subjectType === 'private' ? (
												<span className='text-muted-ink'>Soukromá osoba</span>
											) : (
												<span className='text-muted-ink'>Neuvedeno</span>
											)}
											<span
												className={`badge border ms-1 ${RELATION_BADGE[c.relation]}`}
											>
												{RELATION_LABEL[c.relation]}
											</span>
										</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{imports.length > 0 && (
						<div className='small mt-3'>
							<Icon name='globe' size={14} className='text-muted-ink' />{' '}
							<strong>Dovezené vozidlo:</strong>{' '}
							{imports
								.map(
									(im) =>
										`${im.country ?? 'zahraničí'}${im.date ? ` (${fmtDate(im.date)})` : ''}`
								)
								.join('; ')}
							<div className='text-muted-ink'>
								Český registr neobsahuje historii ze země původu.
							</div>
						</div>
					)}

					{/* Counterpart to the import note, stated as TWO PROVABLE FACTS rather
					    than an inference:
					      1. first registration anywhere was in the CZ (dates match), and
					      2. the registry holds no import record.
					    We deliberately do NOT claim "historie je kompletní". A vehicle first
					    registered here, later exported and then re-imported WITHOUT the
					    re-import being recorded is undetectable in our data – the registry
					    keeps no export history (vehicle_deregistration has no export reason,
					    and `status` only reflects the CURRENT state). That case is ~0.1% of
					    the vehicles this note fires on. Saying what the registry records
					    stays true even then; asserting completeness would not.

					    And never invert this into "nebylo dovezeno": 13.3% of near-certain
					    imports carry no import row, so absence proves nothing. When
					    firstRegisteredInCz is false we stay silent. */}
					{imports.length === 0 && history.firstRegisteredInCz && (
						<div className='small mt-3'>
							<Icon name='check-circle' size={14} className='text-brand' />{' '}
							<strong>Vozidlo bylo poprvé registrováno v ČR.</strong>
							<div className='text-muted-ink'>
								Registr neeviduje dovoz ze zahraničí.
							</div>
						</div>
					)}

					{/* External legal/financing check. Temporarily hidden – flip to re-enable. */}
					{SHOW_CHECKLEASE_LINK && cleanVin.length === 17 && (
						<div className='small mt-3'>
							<a
								href={`https://cebia.com/CheckLease/frmHledej.aspx?vin=${cleanVin}`}
								target='_blank'
								rel='noopener noreferrer'
							>
								Financování, zápůjčky a právní vady vozidla ➜
							</a>
						</div>
					)}

					{deregistrations.length > 0 && (
						<div className='small mt-3'>
							<strong>Vyřazení z provozu:</strong>{' '}
							{deregistrations
								.map((d) => `${d.reason ?? 'neuvedeno'} (${fmtDate(d.from)})`)
								.join('; ')}
						</div>
					)}

					<div className='text-muted-ink mt-3' style={{ fontSize: '0.75rem' }}>
						Údaje z veřejného registru silničních vozidel
						{history.snapshot ? `, stav k ${fmtDate(history.snapshot)}` : ''}.
						{!showMileage && ' Tento výpis neobsahuje stav tachometru.'}
					</div>
				</div>
			</details>

			{/* STK inspection history – its own card */}
			<details id='stk-historie' className='spec-group mt-3' open>
				<summary className='spec-summary'>
					<Icon name='shield-check' size={18} className='text-brand' />
					<span>Historie STK</span>
					<Icon name='chevron-right' size={18} className='spec-chevron' />
				</summary>
				<div className='spec-body'>
					{inspections.total > 0 ? (
						<>
							<div className='small mb-2'>
								{inspections.total}{' '}
								{czPlural(
									inspections.total,
									'prohlídka',
									'prohlídky',
									'prohlídek'
								)}
								{inspections.failed > 0 && (
									<span style={{ color: STK_COLOR.unfit, fontWeight: 600 }}>
										{' · '}
										{inspections.failed}{' '}
										{czPlural(
											inspections.failed,
											'neúspěšná',
											'neúspěšné',
											'neúspěšných'
										)}
									</span>
								)}
								{' · kontrolováno na '}
								{inspections.distinctStations}{' '}
								{inspections.distinctStations === 1 ? 'stanici' : 'stanicích'}
							</div>

							<ul className='list-unstyled mb-0 small stk-list'>
								{/* Oldest → newest, consistent with the owner timeline and
								    mileage list below. */}
								{[...inspections.history].reverse().map((h, i) => (
									<li key={`${h.date ?? 'd'}-${i}`} className='stk-entry mb-2'>
										<div className='stk-entry-head d-flex gap-2 align-items-center flex-wrap'>
											<span
												className='text-muted-ink text-nowrap'
												style={{ minWidth: '6.5rem' }}
											>
												{fmtDate(h.date)}
											</span>
											{h.administrative ? (
												<span className='badge text-bg-light border text-nowrap'>
													nové vozidlo
												</span>
											) : (
												<>
													<span
														className='badge rounded-pill'
														style={{
															backgroundColor: STK_COLOR[h.result],
															color: '#fff'
														}}
													>
														{STK_LABEL[h.result]}
													</span>
													{inspTypeLabel(h.typ) && (
														<span className='badge text-bg-light border'>
															{inspTypeLabel(h.typ)}
														</span>
													)}
												</>
											)}
										</div>
										{h.nazevStk && (
											<div className='stk-station text-muted-ink'>
												{h.nazevStk}
											</div>
										)}
										{/* Administrative records carry no inspection, so no
										    defect line belongs on them. */}
										{!h.administrative &&
											(h.defects === null ? (
												// We hold the inspection but no defect record for it.
												// This is NOT the same as "no defects" and must never
												// be worded that way.
												<div className='stk-defects text-muted-ink'>
													závady neuvedeny
												</div>
											) : h.defects.length === 0 ? (
												<div className='stk-defects text-muted-ink'>
													bez závad
												</div>
											) : (
												<ul className='stk-defects text-muted-ink'>
													{h.defects
														.slice(0, MAX_SHOWN_DEFECTS)
														.map((d, di) => (
															<li
																key={`${d.code}-${di}`}
																className='stk-defect'
															>
																<span
																	className='stk-defect-sev'
																	style={{
																		color: DEFECT_SEVERITY_COLOR[d.severity]
																	}}
																>
																	{DEFECT_SEVERITY_LABEL[d.severity]}
																</span>
																<span className='stk-defect-text'>
																	{defectLabel(d)}
																</span>
															</li>
														))}
													{h.defects.length > MAX_SHOWN_DEFECTS && (
														<li className='stk-defect'>
															<span className='stk-defect-text'>
																{`a ${h.defects.length - MAX_SHOWN_DEFECTS} ${czPlural(
																	h.defects.length - MAX_SHOWN_DEFECTS,
																	'další závada',
																	'další závady',
																	'dalších závad'
																)}`}
															</span>
														</li>
													)}
												</ul>
											))}
									</li>
								))}
							</ul>
							<div
								className='text-muted-ink mt-2'
								style={{ fontSize: '0.8rem' }}
							>
								Záznamy STK a stavu tachometru jsou dostupné zhruba od roku
								2009; starší prohlídky nemusí být evidovány.
							</div>
						</>
					) : (
						<div className='small text-muted-ink'>
							Bez záznamu STK v registru.
						</div>
					)}
				</div>
			</details>

			{/* Equipment & modifications – its own card. Usage signals live here
			    rather than in the registry card's warning badges: they're notable
			    history, not defects. */}
			{equipment.length > 0 && (
				<details id='vybava' className='spec-group mt-3' open>
					<summary className='spec-summary'>
						<Icon name='car' size={18} className='text-brand' />
						<span>Doplňkové vybavení zapsané v registru</span>
						<Icon name='chevron-right' size={18} className='spec-chevron' />
					</summary>
					<div className='spec-body'>
						{/* What this section IS. Without this, a bare list reading
						    "Klimatizace, Katalyzátor" looks like a factory equipment spec and
						    a buyer could read a missing item as "the car doesn't have it".
						    It is doplňkové vybavení recorded in the RSV, with from/to dates. */}
						<div className='small text-muted-ink mb-3'>
							Vybavení a úpravy, které byly na vozidlo dodatečně namontovány a
							zapsány do registru silničních vozidel – nejde o výbavu vozu z
							výroby.
						</div>

						{notes.length > 0 && (
							<div className='small mb-3'>
								{notes.map((n) => (
									<div key={n} className='d-flex gap-2 align-items-start mb-1'>
										<Icon
											name='info'
											size={14}
											className='text-brand flex-shrink-0 mt-1'
										/>
										<span>{n}</span>
									</div>
								))}
							</div>
						)}

						<ul className='list-unstyled small mb-2'>
							{equipment.map((item) => {
								// Removed equipment stays listed — the usage history IS the point
								// (a beacon removed in 2022 still means years of emergency
								// service), so say so rather than hide it. Undated rows are
								// common: the registry simply holds no date for them.
								const period = item.removed
									? `${item.from ? `${fmtDate(item.from)} – ` : 'do '}${fmtDate(item.to)} · odstraněno`
									: item.from
										? `od ${fmtDate(item.from)}`
										: null
								return (
									<li key={item.type} className='d-flex flex-wrap gap-2 mb-1'>
										<span className='badge rounded-pill text-bg-light border'>
											{item.label}
										</span>
										{period && <span className='text-muted-ink'>{period}</span>}
									</li>
								)
							})}
						</ul>

						{/* Honesty: the registry's record can be incomplete, so a missing
						    item is NOT evidence the vehicle lacks it. Never phrase this as
						    "vozidlo nemá…". Dates are simply omitted when the registry holds
						    none (~65% of rows) – that's a fact about the dataset, not about
						    the vehicle, so it doesn't belong in the buyer's copy. */}
						<div className='text-muted-ink' style={{ fontSize: '0.75rem' }}>
							Seznam nemusí být úplný – chybějící položka neznamená, že ji
							vozidlo nemá.
						</div>
					</div>
				</details>
			)}

			{/* Mileage / odometer – paid-certificate teaser. The structure (how many
			    readings, the year range) and any rollback suspicion are shown to hook
			    the buyer; the exact km values stay blurred until they buy. */}
			{showMileage && (
				<details id='tachometr' className='spec-group mt-3' open>
					<summary className='spec-summary'>
						<Icon name='chart' size={18} className='text-brand' />
						<span>Stav tachometru (z STK a měření emisí)</span>
						<Icon name='chevron-right' size={18} className='spec-chevron' />
					</summary>
					<div className='spec-body'>
						{mileage.rollbackSuspected && (
							<div className='alert alert-danger small mb-3'>
								<strong>Podezření na stočení tachometru.</strong> Nalezli jsme
								pozdější záznam s nižším stavem než dřívější. Přesné hodnoty
								najdete v certifikátu.
							</div>
						)}
						{/* The predicted current mileage is our one genuinely unique number –
						    derived from the official STK/emissions readings, and nowhere else
						    on the market. It leads the panel: it is the single strongest
						    reason to buy, so it gets the size and contrast to match. */}
						{mileage.hasPrediction && (
							<div
								className='mb-3 p-3 rounded text-center'
								style={{
									background: 'var(--brand-50)',
									border: '1px solid rgba(0, 0, 0, 0.08)'
								}}
							>
								<div className='small text-muted-ink mb-1'>
									Předpokládaný současný stav tachometru
								</div>
								<div
									className='d-inline-flex align-items-center gap-2 text-brand'
									style={{
										fontSize: 'clamp(1.5rem, 5vw, 2rem)',
										fontWeight: 700,
										letterSpacing: '0.08em',
										lineHeight: 1.2
									}}
								>
									<span>•••••• km</span>
									<Icon name='lock' size={20} />
								</div>
								<div
									className='text-muted-ink mt-1'
									style={{ fontSize: '0.75rem' }}
								>
									Odhad podle ověřené historie nájezdu – přesné číslo najdete v
									certifikátu.
								</div>
							</div>
						)}

						<div className='small text-muted-ink mb-2'>
							{mileage.count}{' '}
							{czPlural(mileage.count, 'záznam', 'záznamy', 'záznamů')} stavu
							tachometru z prohlídek
							{mileage.count > 1 &&
								` (${yearOf(mileage.readings[0].date)}–${yearOf(
									mileage.readings[mileage.readings.length - 1].date
								)})`}
							.
						</div>

						<ul
							className='list-unstyled mb-0 small'
							style={{
								display: 'grid',
								gridTemplateColumns: 'max-content max-content 1fr',
								columnGap: '0.5rem',
								rowGap: '0.25rem',
								alignItems: 'center'
							}}
						>
							{/* Oldest → newest, so a rollback shows as a visible dip. Each
							    reading cites its official STK/ISTP protocol number so buyers
							    can trace any anomaly back to a concrete inspection record. */}
							{mileage.readings.map((r) => (
								<li key={r.protocol ?? r.date} style={{ display: 'contents' }}>
									<span className='text-muted-ink text-nowrap'>
										{fmtDate(r.date)}
									</span>
									<span className='text-muted-ink text-nowrap d-inline-flex align-items-center gap-1'>
										<span style={{ fontWeight: 600, letterSpacing: '0.1em' }}>
											•••••• km
										</span>
										<Icon name='lock' size={12} className='text-muted-ink' />
									</span>
									<span
										className='text-muted-ink text-truncate text-end'
										style={{ fontSize: '0.7rem', minWidth: 0 }}
									>
										{r.protocol ?? ''}
									</span>
								</li>
							))}
						</ul>

						<div className='mt-3'>
							{onUnlock ? (
								<button
									type='button'
									className='btn btn-sm btn-primary'
									onClick={onUnlock}
								>
									<Icon name='lock' size={14} /> Odemknout přesné hodnoty v
									certifikátu
								</button>
							) : (
								<Link
									to='/overeny-vypis-vozidla'
									className='btn btn-sm btn-primary'
								>
									<Icon name='lock' size={14} /> Odemknout přesné hodnoty v
									certifikátu
								</Link>
							)}
						</div>
					</div>
				</details>
			)}
		</>
	)
}

export default VehicleHistoryPanel
