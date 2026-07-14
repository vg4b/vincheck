import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { isCertificateEnabled } from '../config/featureFlags'
import type { OwnerRelation, StkResult, VehicleHistory } from '../types'
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
			'Evidováno dvojí ovládání — vozidlo mohlo sloužit jako autoškola.'
		)
	if (eq.emergency)
		notes.push(
			'Evidován maják (modrý/červený) — vozidlo mohlo sloužit u složek IZS.'
		)
	if (eq.utility)
		notes.push(
			'Evidován oranžový maják — vozidlo mohlo sloužit jako služební/údržbové.'
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
					{flags.length > 0 && (
						<div className='d-flex flex-wrap gap-2 mb-3'>
							{flags.map((f) => (
								<span
									key={f.label}
									className={`badge rounded-pill ${f.severe ? 'text-bg-danger' : 'text-bg-warning'}`}
								>
									<Icon name='alert-triangle' size={12} /> {f.label}
								</span>
							))}
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

					{/* External legal/financing check. Temporarily hidden — flip to re-enable. */}
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

			{/* STK inspection history — its own card */}
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

			{/* Equipment & modifications — its own card. Usage signals live here
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
							zapsány do registru silničních vozidel — nejde o výbavu vozu z
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
						    none (~65% of rows) — that's a fact about the dataset, not about
						    the vehicle, so it doesn't belong in the buyer's copy. */}
						<div className='text-muted-ink' style={{ fontSize: '0.75rem' }}>
							Seznam nemusí být úplný — chybějící položka neznamená, že ji
							vozidlo nemá.
						</div>
					</div>
				</details>
			)}

			{/* Mileage / odometer — paid-certificate teaser. The structure (how many
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
						{/* The predicted current mileage is our one genuinely unique number —
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
									Odhad podle ověřené historie nájezdu — přesné číslo najdete v
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
