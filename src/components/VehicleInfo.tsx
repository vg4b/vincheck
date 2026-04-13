import React, { useMemo } from 'react'
import type { VehicleDataArray } from '../types'
import { groupVehicleFieldsByCategory } from '../utils/vehicleFieldCategories'
import { getDataValue, getLogoSrc } from '../utils/vehicleApi'
import { Link } from 'react-router-dom'
import { cebia } from '../config/affiliateCampaigns'

interface VehicleInfoProps {
	data: VehicleDataArray
	vinCode: string
	saveAction?: {
		label: string
		disabled?: boolean
		onClick: () => void
	}
	saveMessage?: string
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

const VehicleInfo: React.FC<VehicleInfoProps> = ({
	data,
	vinCode,
	saveAction,
	saveMessage,
	promoSection,
	onCebiaExternalNavigate,
}) => {
	const brand = getDataValue(data, 'TovarniZnacka', 'Neznámá značka')
	const brandLogoSrc = getLogoSrc(brand)
	const model = getDataValue(data, 'Typ', 'Neznámý model')
	const obchodniOznaceni = getDataValue(data, 'ObchodniOznaceni', '')
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
	const color = isExpired ? 'red' : 'green'

	const filteredData = useMemo(
		() =>
			data.filter(
				(item) =>
					!VEHICLE_INFO_SUMMARY_FIELDS.has(item.name) &&
					item.value !== '' &&
					item.value != null
			),
		[data]
	)

	const groupedData = useMemo(
		() => groupVehicleFieldsByCategory(filteredData),
		[filteredData]
	)

	const detailSectionBlocks = useMemo(() => {
		let dataRowsShown = 0
		let promoInserted = false

		const buildPromoRow = () => (
			<tr key='cebia-inline-promo' className='table-warning'>
				<th className='align-middle'>Historie a původ vozidla</th>
				<td className='text-end'>
					<a
						href={cebia.getDirectUrl(vinCode, 'vehicle_info_table')}
						target='_blank'
						rel='noopener noreferrer'
						className='btn btn-primary btn-sm fw-bold'
						onClick={() => {
							if (!onCebiaExternalNavigate) return
							window.setTimeout(onCebiaExternalNavigate, 0)
						}}
					>
						Prověřit historii na Cebia.cz ➜
					</a>
				</td>
			</tr>
		)

		const sections = groupedData.map((group) => {
			const bodyRows: React.ReactNode[] = []
			for (const item of group.items) {
				dataRowsShown += 1
				bodyRows.push(
					<tr key={item.name}>
						<th scope='row' className='w-50'>
							{item.label}
						</th>
						<td
							dangerouslySetInnerHTML={{
								__html: formatValueHtml(String(item.value))
							}}
						/>
					</tr>
				)
				if (dataRowsShown === 10 && !promoInserted) {
					bodyRows.push(buildPromoRow())
					promoInserted = true
				}
			}

			const headingId = `vehicle-info-group-${group.categoryId}`

			return (
				<section
					key={group.categoryId}
					className='vehicle-info-detail-group mb-4'
					aria-labelledby={headingId}
				>
					<div className='rounded-3 border shadow-sm overflow-hidden bg-body'>
						<h3
							id={headingId}
							className='h6 mb-0 fw-semibold px-3 py-2 text-body border-bottom bg-primary-subtle'
						>
							{group.label}
						</h3>
						<div className='table-responsive'>
							<table className='table table-striped table-hover table-sm mb-0 align-middle'>
								<tbody>{bodyRows}</tbody>
							</table>
						</div>
					</div>
				</section>
			)
		})

		const trailingPromo =
			!promoInserted && filteredData.length > 0 ? (
				<div className='table-responsive mb-4' key='cebia-promo-trailing'>
					<div className='rounded-3 border border-warning overflow-hidden shadow-sm'>
						<table className='table table-sm table-warning mb-0'>
							<tbody>{buildPromoRow()}</tbody>
						</table>
					</div>
				</div>
			) : null

		return (
			<>
				{sections}
				{trailingPromo}
			</>
		)
	}, [groupedData, filteredData.length, vinCode, onCebiaExternalNavigate])

	const cleanVin = vinCode.replace(/[^a-zA-Z0-9]/g, '')
	const historyUrl =
		cleanVin.length === 17
			? cebia.getTextLinkUrlWithVin(cleanVin, 'vehicle_info_history')
			: cebia.getTextLinkUrl('vehicle_info_history')

	return (
		<div className='mt-4 mb-5'>
			<div className='row mt-5 mb-5 align-items-center'>
				{/* Brand logo column */}
				<div className='col-md-3 text-center'>
					<img
						src={brandLogoSrc}
						alt={`${brand} Logo`}
						loading='lazy'
						decoding='async'
						className='img-fluid logo-img brand-logo'
						style={{ maxWidth: '200px', height: 'auto',  }}
						onError={(e) => {
							// Fallback if logo not found
							e.currentTarget.style.display = 'none'
						}}
					/>
				</div>

				{/* Vehicle info column */}
				<div className='col-md-4'>
					<div className='vehicle-info'>
						<div>
							<strong>Značka:</strong> {brand}
						</div>
						<div>
							<strong>Model:</strong> {model}
						</div>
						<div>
							<strong>Obchodní označení:</strong> {obchodniOznaceni}
						</div>
						<div>
							<strong>Datum první registrace:</strong> {firstRegistration}
						</div>
						<div>
							<strong>VIN:</strong> {vinCode}
						</div>
						<div>
						<strong>STK do:</strong>{' '}
						<span style={{ color }}>{techInspection}</span>
					</div>
					</div>
				</div>

				{/* Technical inspection column */}
				<div className='col-md-4'>
					{/* <div>
						<strong>Pravidelná technická prohlídka do:</strong>{' '}
						<span style={{ color }}>{techInspection}</span>
					</div> */}

					{/* Insurance buttons */}
					<div className='mt-3 d-flex flex-column gap-2'>
						{saveAction && (
							<button
								type='button'
								className='btn btn-primary'
								onClick={saveAction.onClick}
								disabled={saveAction.disabled}
							>
								{saveAction.label}
							</button>
						)}
						{saveMessage && (
							<div className='alert alert-info mb-0' role='alert'>
								{saveMessage}
							</div>
						)}
						<Link
							to={`/sjednat-pojisteni?vin=${encodeURIComponent(vinCode)}`}
							className='btn btn-outline-primary'
							role='button'
						>
							Sjednat pojištění
						</Link>
						<a
							href='/kompletni-historie-vozu'
							className='btn btn-outline-primary'
							role='button'
						>
							Kompletní historie vozu
						</a>
					</div>
				</div>
			</div>

			{/* Promo section (if provided) */}
			{promoSection}

			{/* Detailní údaje po sekcích (karta + vlastní pruhovaná tabulka) */}
			{filteredData.length > 0 && (
				<div className='mt-4'>
					{detailSectionBlocks}
					<div className='text-center mt-4'>
						<a
							href={historyUrl}
							target='_blank'
							rel='noopener noreferrer'
							className='btn btn-outline-primary'
							onClick={() => {
							if (!onCebiaExternalNavigate) return
							window.setTimeout(onCebiaExternalNavigate, 0)
						}}
						>
							Načíst historii vozidla (nová stránka)
						</a>
					</div>
				</div>
			)}

			{/* Banner (max šířka na desktopu – původně 100 % kontejneru působilo přerostle) */}
			<div className='mt-5 mb-5'>
				<div
					className='mx-auto px-1'
					style={{ maxWidth: 'min(100%, 640px)' }}
				>
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
