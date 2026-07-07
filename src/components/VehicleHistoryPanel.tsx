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

					<div className='d-flex align-items-center gap-2 mb-1'>
						<Icon name='car' size={16} className='text-muted-ink' />
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
							<ul className='list-unstyled mb-0'>
								{timeline.map((c, i) => (
									<li
										key={`${c.subjectType}-${c.ico ?? 'x'}-${c.relation}-${c.from ?? i}`}
										className='d-flex gap-2 mb-1'
									>
										<span
											className='text-muted-ink text-nowrap'
											style={{ minWidth: '9rem' }}
										>
											{fmtDate(c.from)} – {c.current ? 'dosud' : fmtDate(c.to)}
										</span>
										<span>
											{c.subjectType === 'company' && c.ico ? (
												<>
													<Link to={`/firma/${c.ico}`}>
														{c.nazev ?? `IČO ${c.ico}`}
													</Link>
													<span className='text-muted-ink'> · IČO {c.ico}</span>
												</>
											) : c.subjectType === 'company' ? (
												(c.nazev ?? 'Firma')
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

							<ul className='list-unstyled mb-0 small'>
								{/* Oldest → newest, consistent with the owner timeline and
								    mileage list below. */}
								{[...inspections.history].reverse().map((h, i) => (
									<li
										key={`${h.date ?? 'd'}-${i}`}
										className='d-flex gap-2 align-items-center mb-1'
									>
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
										{h.nazevStk && (
											<span className='text-muted-ink text-truncate'>
												{h.nazevStk}
											</span>
										)}
									</li>
								))}
							</ul>
						</>
					) : (
						<div className='small text-muted-ink'>
							Bez záznamu STK v registru.
						</div>
					)}
				</div>
			</details>

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

						<ul className='list-unstyled mb-0 small'>
							{/* Oldest → newest, so a rollback shows as a visible dip. Each
							    reading cites its official STK/ISTP protocol number so buyers
							    can trace any anomaly back to a concrete inspection record. */}
							{mileage.readings.map((r) => (
								<li
									key={r.protocol ?? r.date}
									className='d-flex gap-2 align-items-center mb-1'
								>
									<span
										className='text-muted-ink text-nowrap'
										style={{ minWidth: '6.5rem' }}
									>
										{fmtDate(r.date)}
									</span>
									<span
										className='text-muted-ink'
										style={{ fontWeight: 600, letterSpacing: '0.1em' }}
									>
										•••••• km
									</span>
									<Icon name='lock' size={12} className='text-muted-ink' />
									{r.protocol && (
										<span
											className='text-muted-ink text-nowrap ms-auto'
											style={{ fontSize: '0.7rem' }}
										>
											{r.protocol}
										</span>
									)}
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
