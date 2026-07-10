import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { cebia } from '../config/affiliateCampaigns'
import { isCertificateEnabled } from '../config/featureFlags'
import { trackEvent } from '../utils/trackEvent'
import type { VehicleDataArray, VehicleHistory } from '../types'
import { formatFuel, fuelBaseLabel } from '../utils/fuelLabels'
import {
	cleanModelName,
	getDataValue,
	getLogoSrc,
	hasBrandLogo,
	resolveVehicleTitle
} from '../utils/vehicleApi'
import {
	groupVehicleFieldsByCategory,
	type VehicleFieldCategoryId
} from '../utils/vehicleFieldCategories'
import CertificateCheckoutModal from './CertificateCheckoutModal'
import Icon, { type IconName } from './Icon'
import ProductComparison from './ProductComparison'
import VehicleShareBar from './VehicleShareBar'
import VehicleHistoryPanel from './VehicleHistoryPanel'

// Display price of our own certificate (final price; we are a neplátce, no VAT).
// Must match the backend CERTIFICATE_PRICE_CZK env (api/_certificate.ts).
const CERTIFICATE_PRICE_CZK = 99

const CATEGORY_ICONS: Record<VehicleFieldCategoryId, IconName> = {
	doklady_evidence: 'file-text',
	druh_typ_homologace: 'shield',
	oznaceni_vyroba: 'info',
	motor_palivo_spotreba: 'chart',
	emise: 'alert-triangle',
	karoserie: 'car',
	rozmery_hmotnosti: 'chart',
	napravy_pneu: 'car',
	hluk_rychlost: 'bell',
	ostatni: 'info'
}

// Categories most readers care about stay open; the long tail collapses.
const DEFAULT_OPEN_CATEGORIES = new Set<VehicleFieldCategoryId>([
	'doklady_evidence',
	'motor_palivo_spotreba',
	'karoserie'
])

interface VehicleInfoProps {
	data: VehicleDataArray
	vinCode: string
	saveAction?: {
		label: string
		disabled?: boolean
		onClick: () => void
	}
	saveMessage?: string
	/** Public-registry history-lite; present only on a cache hit. */
	history?: VehicleHistory | null
	promoSection?: React.ReactNode
	/**
	 * Po kliknutí na Cebia odkaz v novém tabu (např. modal na detailu VIN).
	 * Volá se odloženě (`setTimeout(0)`), aby měl výchozí otevření tabu přednost před překryvem.
	 */
	onCebiaExternalNavigate?: () => void
}

const VEHICLE_INFO_SUMMARY_FIELDS = new Set<string>([
	'TovarniZnacka',
	'Typ',
	'DatumPrvniRegistrace',
	'VIN',
	'PravidelnaTechnickaProhlidkaDo'
])

/** Copy-to-clipboard VIN pill. */
const VinPill: React.FC<{ vin: string }> = ({ vin }) => {
	const [copied, setCopied] = useState(false)

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(vin)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 1500)
		} catch {
			// Clipboard unavailable (insecure context) — leave the VIN visible to copy by hand.
		}
	}

	return (
		<span className='vin-pill'>
			<span className='num'>{vin}</span>
			<button
				type='button'
				className='vin-copy-btn'
				onClick={handleCopy}
				aria-label={copied ? 'Zkopírováno' : 'Kopírovat VIN'}
				title={copied ? 'Zkopírováno' : 'Kopírovat VIN'}
			>
				<Icon name={copied ? 'check' : 'copy'} size={15} />
			</button>
		</span>
	)
}

const VehicleInfo: React.FC<VehicleInfoProps> = ({
	data,
	vinCode,
	saveAction,
	saveMessage,
	history,
	promoSection,
	onCebiaExternalNavigate
}) => {
	// Junk-tolerant make/model (registry stores "." for an unknown make on old
	// records; resolveVehicleTitle promotes the real make from the type string and
	// strips a trailing VIN fragment). Shared with the certificate + page title.
	const { brand, model } = resolveVehicleTitle(data)
	const showLogo = hasBrandLogo(brand)
	const brandLogoSrc = getLogoSrc(brand)
	// Secondary type code for the subtitle ("Typ: 1K"); hidden when it merely
	// repeats the model (incl. the raw type string that still carries a VIN tail).
	const typCode = cleanModelName(brand, getDataValue(data, 'Typ', ''))
	const rokVyroby = getDataValue(data, 'RokVyroby', '')
	const palivo = getDataValue(data, 'Palivo', '')
	const statusLabel =
		getDataValue(data, 'StatusNazev', '') || getDataValue(data, 'Status', '')

	const firstRegistrationRaw = getDataValue(
		data,
		'DatumPrvniRegistrace',
		'Neznámé datum'
	)
	const firstRegistration = formatValue(firstRegistrationRaw)

	const techInspectionRaw = getDataValue(
		data,
		'PravidelnaTechnickaProhlidkaDo',
		'Neznámé datum'
	)
	const techInspection = formatValue(techInspectionRaw)

	// Parse and check tech inspection date
	const currentDate = new Date()
	let techInspectionDate: Date | null = null
	if (techInspectionRaw && techInspectionRaw !== 'Neznámé datum') {
		// Try to parse ISO date format first
		const isoDateRegex = /^(\d{4})-(\d{2})-(\d{2})(T.*)?$/
		const isoMatch = techInspectionRaw.match(isoDateRegex)
		if (isoMatch) {
			const year = isoMatch[1]
			const month = isoMatch[2]
			const day = isoMatch[3]
			techInspectionDate = new Date(`${year}-${month}-${day}`)
		} else {
			// Fall back to Czech format (d.m.yyyy)
			const [day, month, year] = techInspectionRaw.split('.')
			if (day && month && year) {
				techInspectionDate = new Date(`${year}-${month}-${day}`)
			}
		}
	}

	const isExpired =
		techInspectionDate && techInspectionDate.getTime() < currentDate.getTime()
	const stkColor = isExpired ? 'var(--accent-red)' : 'var(--brand-600)'

	// Owner / operator counts prefer the richer history-lite, fall back to the
	// derived registry fields when there's no cache hit.
	const ownersTotal =
		history?.owners.total ??
		toNullableNumber(getDataValue(data, 'PocetVlastniku', ''))
	const operatorsTotal =
		history?.owners.operators ??
		toNullableNumber(getDataValue(data, 'PocetProvozovatelu', ''))

	// Severe / notable registry flags surfaced as a top banner (was buried mid-page).
	const heroFlags = useMemo(() => buildHeroFlags(history), [history])
	const fuelLabel = fuelBaseLabel(palivo)
	// Labelled subtitle bits so cryptic codes are legible ("Typ V" not bare "V").
	// The type code is shown only when it isn't already the title.
	const subtitleParts = [
		model === typCode || !typCode || typCode.startsWith(model) ? '' : `Typ: ${typCode}`,
		rokVyroby ? `Rok: ${rokVyroby}` : '',
		fuelLabel ? `Palivo: ${fuelLabel}` : ''
	].filter(Boolean)

	const filteredData = useMemo(
		() =>
			data.filter(
				(item) =>
					!VEHICLE_INFO_SUMMARY_FIELDS.has(item.name) &&
					item.value != null &&
					!isBlankValue(item.value)
			),
		[data]
	)

	const groupedData = useMemo(
		() => groupVehicleFieldsByCategory(filteredData),
		[filteredData]
	)

	// Which spec groups are expanded. Seeded from the default-open set; each
	// <details> is controlled so a single button can expand/collapse them all.
	const [openGroups, setOpenGroups] = useState<Set<VehicleFieldCategoryId>>(
		() => new Set(DEFAULT_OPEN_CATEGORIES)
	)
	const [showCertModal, setShowCertModal] = useState(false)
	const allExpanded =
		groupedData.length > 0 &&
		groupedData.every((g) => openGroups.has(g.categoryId))

	const toggleAllGroups = () => {
		setOpenGroups(
			allExpanded ? new Set() : new Set(groupedData.map((g) => g.categoryId))
		)
	}

	const setGroupOpen = (id: VehicleFieldCategoryId, open: boolean) => {
		setOpenGroups((prev) => {
			if (prev.has(id) === open) return prev
			const next = new Set(prev)
			if (open) next.add(id)
			else next.delete(id)
			return next
		})
	}

	const cleanVin = vinCode.replace(/[^a-zA-Z0-9]/g, '')
	// The two-product comparison replaces the standalone "full history" entry
	// points (it presents both our certificate and the partner option).
	const showProductComparison = cleanVin.length === 17 && isCertificateEnabled()
	// The single most persuasive trigger on the page — a later STK reading lower
	// than an earlier one. Surfaced up top (not just buried in the mileage panel)
	// and pointed straight at our certificate, whose data answers it.
	const rollbackSuspected =
		isCertificateEnabled() &&
		Boolean(history?.mileage?.rollbackSuspected) &&
		(history?.mileage?.count ?? 0) > 0
	const historyUrl =
		cleanVin.length === 17
			? cebia.getTextLinkUrlWithVin(cleanVin, 'vehicle_info_history')
			: cebia.getTextLinkUrl('vehicle_info_history')

	// Open our certificate checkout, tagging which placement drove it so the funnel
	// shows the highest-converting entry points.
	const openCertModal = (placement: string) => {
		trackEvent('cert_cta_click', { placement })
		setShowCertModal(true)
	}

	const handleCebiaClick = () => {
		trackEvent('partner_click', { src: cebiaSource })
		if (!onCebiaExternalNavigate) return
		window.setTimeout(onCebiaExternalNavigate, 0)
	}

	// One impression per detail view when the certificate is actually offered, so
	// the CTA clicks below have a denominator to convert against.
	useEffect(() => {
		if (showProductComparison) {
			trackEvent('comparison_view', {
				placement: rollbackSuspected ? 'rollback' : 'standard'
			})
		}
		// Fire once per looked-up vehicle.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cleanVin])

	// Imported vehicle: the CZ registry holds no foreign history, so the paid
	// Cebia report is worth most here — target the upsell accordingly. Distinct
	// `data1` per placement so the callout banner and the in-table row track
	// separately (the table row keeps the historical `vehicle_info_table`).
	const importInfo = history?.imports?.[0] ?? null
	const isImported = Boolean(importInfo)
	const cebiaSource = isImported ? 'vehicle_info_import' : 'vehicle_info_cta'

	// The free timeline answers everything the public registry holds, but never
	// mileage, accidents, liens or foreign history — exactly the paid report's
	// value. Name the strongest unanswered question this vehicle invites so the
	// callout reads as the answer to a doubt the page just raised.
	const cebiaPitch = buildCebiaPitch({
		isImported,
		importCountry: importInfo?.country,
		ownersTotal,
		failedStk: history?.inspections.failed ?? 0
	})

	return (
		<div className='mt-4 mb-5'>
			{/* Notable registry flags — promoted above the fold. */}
			{heroFlags.length > 0 && (
				<div className='d-flex flex-column gap-2 mb-4'>
					{heroFlags.map((f) => (
						<div
							key={f.label}
							className={`alert ${f.severe ? 'alert-danger' : 'alert-warning'} mb-0`}
							role='alert'
						>
							{f.label}
						</div>
					))}
				</div>
			)}

			{/* Strongest buyer trigger, promoted above the fold and aimed at our own
			    certificate — its STK mileage history is exactly what answers it. */}
			{rollbackSuspected && (
				<div
					className='alert alert-danger alert--icon-center d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4'
					role='alert'
				>
					<span>
						<strong>Podezření na stočení tachometru.</strong> V historii STK je
						pozdější záznam s nižším stavem než dřívější.
					</span>
					<button
						type='button'
						className='btn btn-danger text-nowrap'
						onClick={() => openCertModal('rollback_hero')}
					>
						Ověřit stav tachometru — {CERTIFICATE_PRICE_CZK} Kč ➜
					</button>
				</div>
			)}

			{/* Hero header */}
			<div className='card-soft mb-4'>
				<div
					className={`vehicle-hero${showLogo ? '' : ' vehicle-hero--no-logo'}`}
				>
					{showLogo && (
						<div className='text-center text-md-start'>
							<img
								src={brandLogoSrc}
								alt={`${brand} logo`}
								loading='lazy'
								decoding='async'
								className='vehicle-hero-logo'
								onError={(e) => {
									e.currentTarget.style.display = 'none'
								}}
							/>
						</div>
					)}

					<div>
						<h1 className='vehicle-hero-title'>
							{brand} {model}
						</h1>
						{subtitleParts.length > 0 && (
							<div className='vehicle-hero-subtitle mt-1'>
								{subtitleParts.join(' · ')}
							</div>
						)}
						<div className='d-flex flex-wrap align-items-center gap-2 mt-2'>
							<span className='text-muted-ink small'>VIN</span>
							<VinPill vin={vinCode} />
						</div>
						<div className='text-muted-ink small mt-2'>
							První registrace: {firstRegistration}
						</div>
					</div>

					<div className='d-flex flex-column gap-2 vehicle-hero-actions'>
						{showProductComparison && (
							<button
								type='button'
								className='btn btn-primary'
								onClick={() => openCertModal('hero')}
							>
								Certifikát vozidla ({CERTIFICATE_PRICE_CZK} Kč)
							</button>
						)}
						{saveAction && (
							<button
								type='button'
								className={`btn ${showProductComparison ? 'btn-outline-primary' : 'btn-primary'}`}
								onClick={saveAction.onClick}
								disabled={saveAction.disabled}
							>
								{saveAction.label}
							</button>
						)}
						<Link
							to='/sjednat-pojisteni?typ=povinne&src=vehicle_info'
							className='btn btn-outline-primary'
							role='button'
						>
							Sjednat pojištění
						</Link>
						{!showProductComparison && (
							<a
								href='/kompletni-historie-vozu'
								className='btn btn-outline-primary'
								role='button'
							>
								Kompletní historie vozu
							</a>
						)}
					</div>
				</div>

				{saveMessage && (
					<div className='alert alert-info mb-0 mt-3' role='alert'>
						{saveMessage}
					</div>
				)}

				{/* At-a-glance stat tiles */}
				<div className='vehicle-stats mt-4'>
					<div className='stat-tile'>
						<span className='stat-tile-label'>Platnost STK</span>
						<span className='stat-tile-value' style={{ color: stkColor }}>
							{history && history.inspections.total > 0 ? (
								<a href='#stk-historie'>{techInspection}</a>
							) : (
								techInspection
							)}
						</span>
					</div>
					<div className='stat-tile'>
						<span className='stat-tile-label'>Majitelé</span>
						<span className='stat-tile-value'>{ownersTotal ?? '—'}</span>
					</div>
					<div className='stat-tile'>
						<span className='stat-tile-label'>Provozovatelé</span>
						<span className='stat-tile-value'>{operatorsTotal ?? '—'}</span>
					</div>
					<div className='stat-tile'>
						<span className='stat-tile-label'>Stav vozidla</span>
						<span className='stat-tile-value stat-tile-value--status'>
							{statusLabel || '—'}
						</span>
					</div>

					{/* Stav tachometru. With the certificate enabled we have the full
					    mileage history (from STK/emission inspections) — point to that
					    section. Otherwise fall back to the partner CTA. */}
					<div className='stat-tile stat-tile--gap'>
						<span className='stat-tile-label'>
							<Icon name='search' size={13} />
							Stav tachometru
						</span>
						<span className='stat-tile-value' style={{ fontSize: '1rem' }}>
							{isCertificateEnabled() &&
							(history?.mileage?.count ?? 0) > 0 ? (
								<a href='#tachometr'>Zobrazit historii nájezdu ➜</a>
							) : (
								<a
									href={cebia.getDirectUrl(
										vinCode,
										'vehicle_info_odometer_gap'
									)}
									target='_blank'
									rel='noopener noreferrer'
									onClick={handleCebiaClick}
								>
									Prověřit historii nájezdu ➜
								</a>
							)}
						</span>
					</div>
				</div>
			</div>

			{/* Public share — create a short /s/<token> link + social buttons. */}
			<VehicleShareBar
				vin={cleanVin.length === 17 ? cleanVin : undefined}
				tp={getDataValue(data, 'CisloTp', '') || undefined}
				orv={getDataValue(data, 'CisloOrv', '') || undefined}
			/>

			{/* Two distinct products, side by side — they do different jobs, so the
			    user self-selects by need rather than choosing between buttons:
			    our certificate = the registry record + official STK mileage history
			    (99 Kč, instant); Cebia = what neither registry nor STK shows
			    (accidents, liens, foreign history). Both cards only when there's a full
			    17-char VIN to sell a certificate against; otherwise Cebia-only CTA. */}
			{showProductComparison ? (
				<div className='my-4'>
					<ProductComparison
						priceCzk={CERTIFICATE_PRICE_CZK}
						mileageAvailable={(history?.mileage?.count ?? 0) > 0}
						hasPrediction={history?.mileage?.hasPrediction ?? false}
						certificateCta={
							<button
								type='button'
								className='btn btn-primary mt-auto'
								onClick={() => openCertModal('comparison')}
							>
								Získat certifikát ({CERTIFICATE_PRICE_CZK} Kč) ➜
							</button>
						}
						cebiaCta={
							<a
								href={cebia.getDirectUrl(vinCode, cebiaSource)}
								target='_blank'
								rel='noopener noreferrer'
								className='btn btn-outline-primary mt-auto'
								onClick={handleCebiaClick}
							>
								Prověřit u partnera ➜
							</a>
						}
					/>
				</div>
			) : (
				<div className='brand-callout my-4 d-flex flex-wrap align-items-center justify-content-between gap-3'>
					<span>
						<strong>{cebiaPitch.title}</strong>
						<span className='d-block small'>{cebiaPitch.body}</span>
					</span>
					<a
						href={cebia.getDirectUrl(vinCode, cebiaSource)}
						target='_blank'
						rel='noopener noreferrer'
						className='btn btn-primary text-nowrap'
						onClick={handleCebiaClick}
					>
						Prověřit historii ➜
					</a>
				</div>
			)}

			{showCertModal && (
				<CertificateCheckoutModal
					vin={cleanVin}
					priceCzk={CERTIFICATE_PRICE_CZK}
					onClose={() => setShowCertModal(false)}
				/>
			)}

			{history && (
				<VehicleHistoryPanel
					history={history}
					vinCode={vinCode}
					onUnlock={
						cleanVin.length === 17
							? () => openCertModal('mileage_panel')
							: undefined
					}
				/>
			)}

			{/* Promo section (if provided) */}
			{promoSection}

			{/* Technical specs — grouped, with the long tail collapsed by default. */}
			{filteredData.length > 0 && (
				<div className='mt-4'>
					<div className='d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3'>
						<h2 className='h5 mb-0'>Technické údaje</h2>
						<button
							type='button'
							className='btn btn-sm btn-outline-primary'
							onClick={toggleAllGroups}
							aria-expanded={allExpanded}
						>
							{allExpanded ? 'Sbalit vše' : 'Rozbalit vše'}
						</button>
					</div>
					{groupedData.map((group) => {
						const headingId = `vehicle-info-group-${group.categoryId}`
						return (
							<details
								key={group.categoryId}
								className='spec-group'
								open={openGroups.has(group.categoryId)}
								onToggle={(e) =>
									setGroupOpen(group.categoryId, e.currentTarget.open)
								}
							>
								<summary className='spec-summary' aria-labelledby={headingId}>
									<Icon
										name={CATEGORY_ICONS[group.categoryId] ?? 'info'}
										size={18}
										className='text-brand'
									/>
									<span id={headingId}>{group.label}</span>
									<span className='spec-count'>{group.items.length}</span>
									<Icon
										name='chevron-right'
										size={18}
										className='spec-chevron'
									/>
								</summary>
								<div className='table-responsive'>
									<table className='table table-striped table-hover table-sm mb-0 align-middle'>
										<tbody>
											{group.items.map((item) => (
												<tr key={item.name}>
													<th scope='row' className='w-50'>
														{item.label}
													</th>
													{item.name === 'Palivo' ? (
														<td>{formatFuel(String(item.value))}</td>
													) : (
														<td
															dangerouslySetInnerHTML={{
																__html: formatValueHtml(String(item.value))
															}}
														/>
													)}
												</tr>
											))}
											{/* Affiliate row anchored to the engine/fuel table. */}
											{group.categoryId === 'motor_palivo_spotreba' && (
												<tr style={{ backgroundColor: 'var(--brand-50)' }}>
													<th
														className='align-middle'
														style={{ color: 'var(--brand-700)' }}
													>
														Historie a původ vozidla
													</th>
													<td className='text-end'>
														<a
															href={cebia.getDirectUrl(
																vinCode,
																'vehicle_info_table'
															)}
															target='_blank'
															rel='noopener noreferrer'
															onClick={handleCebiaClick}
														>
															Prověřit historii u partnera ➜
														</a>
													</td>
												</tr>
											)}
										</tbody>
									</table>
								</div>
							</details>
						)
					})}

					<div className='text-center mt-4'>
						<a
							href={historyUrl}
							target='_blank'
							rel='noopener noreferrer'
							className='btn btn-outline-primary'
							onClick={handleCebiaClick}
						>
							Načíst historii vozidla (nová stránka)
						</a>
					</div>
				</div>
			)}

			{/* Banner (max šířka na desktopu – původně 100 % kontejneru působilo přerostle) */}
			<div className='mt-5 mb-5'>
				<div className='mx-auto px-1' style={{ maxWidth: 'min(100%, 640px)' }}>
					<a
						href={cebia.getGraphicBannerUrl('vehicle_info_banner')}
						target='_top'
						rel='noopener noreferrer'
						className='d-block'
					>
						<img
							src={cebia.getGraphicBannerImage()}
							alt='Advertisement'
							className='img-fluid w-100 d-block rounded-2'
						/>
					</a>
				</div>
				<img
					style={{
						border: 0,
						width: '1px',
						height: '1px',
						opacity: 0,
						position: 'absolute',
						left: '-9999px'
					}}
					src={cebia.getImpressionPixelUrl()}
					width='1'
					height='1'
					alt=''
				/>
			</div>
		</div>
	)
}

/** From this many owners on, frequent turnover is worth flagging as a doubt. */
const MANY_OWNERS_THRESHOLD = 4

type CebiaPitch = { title: string; body: string }

/**
 * Tailor the upsell to the strongest unanswered question the free data raises.
 * Priority: imported (no foreign history) → failed STK (condition doubt) →
 * many owners (turnover) → generic. Each names what the public registry can't
 * show, so the paid report reads as the answer rather than an ad.
 */
function buildCebiaPitch(args: {
	isImported: boolean
	importCountry?: string | null
	ownersTotal: number | null
	failedStk: number
}): CebiaPitch {
	const { isImported, importCountry, ownersTotal, failedStk } = args
	if (isImported) {
		return {
			title: `Dovezené vozidlo${importCountry ? ` z ${importCountry}` : ''} — prověřte zahraniční historii`,
			body: 'Český registr nezná historii ze země původu. Stav tachometru, záznamy o nehodách a původ z ciziny prověříte v externí zprávě.'
		}
	}
	if (failedStk > 0) {
		return {
			title: 'V historii je neúspěšná STK — prověřte stav vozu',
			body: 'Neúspěšná technická prohlídka může signalizovat vážnější závadu nebo následky nehody. Kompletní historii nájezdu i záznamy o nehodách najdete jen v externí zprávě.'
		}
	}
	if (ownersTotal != null && ownersTotal >= MANY_OWNERS_THRESHOLD) {
		const word = ownersTotal >= 5 ? 'majitelů' : 'majitele'
		return {
			title: `Vozidlo vystřídalo ${ownersTotal} ${word} — kolik reálně najelo?`,
			body: 'Častá obměna majitelů zvyšuje riziko stočeného tachometru i zamlčené nehody. Stav tachometru a záznamy o nehodách najdete v externí zprávě.'
		}
	}
	return {
		title: 'Historie a původ vozidla',
		body: 'Stav tachometru, záznamy o nehodách, zástavy a další prověříte v externí zprávě.'
	}
}

type HeroFlag = { label: string; severe: boolean }

function buildHeroFlags(history?: VehicleHistory | null): HeroFlag[] {
	if (!history) return []
	const flags: HeroFlag[] = []
	if (history.flags.stolen)
		flags.push({ label: 'Vozidlo je evidováno jako odcizené', severe: true })
	if (history.flags.exported)
		flags.push({ label: 'Vozidlo bylo vyvezeno do zahraničí', severe: false })
	if (history.flags.deregistered && !history.flags.exported)
		flags.push({
			label: 'Vozidlo je vyřazeno z provozu / zánik',
			severe: false
		})
	return flags
}

function toNullableNumber(value: string): number | null {
	if (!value) return null
	const n = Number(value)
	return Number.isFinite(n) ? n : null
}

/**
 * True when a value carries no real data — empty, or only the slash separators
 * (and whitespace) of an unfilled combined field, e.g. "Spotřeba … / /". A row
 * with at least one slash-free character (e.g. "5.2 / /") is kept.
 */
function isBlankValue(value: unknown): boolean {
	return String(value).replace(/[/\s]/g, '') === ''
}

function formatValue(value: string): string {
	if (!value) return '-'
	if (value.toLowerCase() === 'false') {
		return 'Ne'
	}
	if (value.toLowerCase() === 'true') {
		return 'Ano'
	}
	const ul = value.toUpperCase()
	if (ul === 'NE') return 'Ne'
	if (ul === 'ANO') return 'Ano'
	// Try to format date if it looks like ISO date
	if (value.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
		const date = new Date(value)
		return date.toLocaleDateString('cs-CZ')
	}
	return value
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
}

function formatValueHtml(value: string): string {
	const formatted = formatValue(value)
	return escapeHtml(formatted)
		.split('|')
		.map((part) => part.trim())
		.filter(Boolean)
		.join('<br />')
}

export default VehicleInfo
