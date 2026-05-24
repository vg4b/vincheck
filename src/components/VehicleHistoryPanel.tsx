import type { FC } from 'react'
import { Link } from 'react-router-dom'
import type { StkResult, VehicleHistory } from '../types'
import Icon from './Icon'

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
const VehicleHistoryPanel: FC<{ history: VehicleHistory }> = ({ history }) => {
	const { owners, inspections, deregistrations } = history
	const flags = buildFlags(history)
	// Company owners as a chronological timeline (oldest first). Private owners
	// are already excluded server-side (companyOwners = legal entities only).
	const companyTimeline = [...owners.companyOwners].sort((a, b) =>
		(a.from ?? '').localeCompare(b.from ?? '')
	)

	return (
		<>
			{/* Registry: owners, flags, deregistration */}
			<section className='card border-0 shadow-sm mt-4'>
				<div className='card-body'>
					<div className='d-flex align-items-center gap-2 mb-3'>
						<Icon name='file-text' size={18} className='text-muted-ink' />
						<h3 className='h6 mb-0'>Historie z registru</h3>
					</div>

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

					{companyTimeline.length > 0 && (
						<div className='small mt-2'>
							<div className='fw-semibold mb-1'>
								Firemní / podnikatelské subjekty v historii
							</div>
							<ul className='list-unstyled mb-0'>
								{companyTimeline.map((c, i) => (
									<li
										key={`${c.ico ?? c.nazev ?? 'x'}-${c.from ?? i}`}
										className='d-flex gap-2 mb-1'
									>
										<span
											className='text-muted-ink text-nowrap'
											style={{ minWidth: '9rem' }}
										>
											{fmtDate(c.from)} – {c.current ? 'dosud' : fmtDate(c.to)}
										</span>
										<span>
											{c.ico ? (
												<Link to={`/firma/${c.ico}`}>
													{c.nazev ?? `IČO ${c.ico}`}
												</Link>
											) : (
												(c.nazev ?? 'Neuvedeno')
											)}
											{c.ico && (
												<span className='text-muted-ink'> · IČO {c.ico}</span>
											)}
											{c.relation === 'operator' && (
												<span className='badge text-bg-light border ms-1'>
													provozovatel
												</span>
											)}
										</span>
									</li>
								))}
							</ul>
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
						Neobsahuje stav tachometru.
					</div>
				</div>
			</section>

			{/* STK inspection history — its own card */}
			<section className='card border-0 shadow-sm mt-3'>
				<div className='card-body'>
					<div className='d-flex align-items-center gap-2 mb-3'>
						<Icon name='shield-check' size={18} className='text-muted-ink' />
						<h3 className='h6 mb-0'>Historie STK</h3>
					</div>

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
								{inspections.history.map((h, i) => (
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
										<span
											className='badge rounded-pill'
											style={{
												backgroundColor: STK_COLOR[h.result],
												color: '#fff'
											}}
										>
											{STK_LABEL[h.result]}
										</span>
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
			</section>
		</>
	)
}

export default VehicleHistoryPanel
