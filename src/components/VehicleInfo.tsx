import React from 'react'
import { VehicleDataArray } from '../types'
import { getDataValue, getLogoSrc } from '../utils/vehicleApi'
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
}

const VehicleInfo: React.FC<VehicleInfoProps> = ({
	data,
	vinCode,
	saveAction,
	saveMessage,
	promoSection
}) => {
	const excludedFields = new Set([
		'TovarniZnacka',
		'Typ',
		'DatumPrvniRegistrace',
		'VIN',
		'PravidelnaTechnickaProhlidkaDo'
	])

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

	const filteredData = data.filter(
		(item) =>
			!excludedFields.has(item.name) && item.value !== '' && item.value != null
	)

	// Split data for inserting Cebia link at specific position (e.g. 10th item)
	// If list is shorter than 10, insert at the end
	const insertIndex = Math.min(10, filteredData.length)
	const firstHalf = filteredData.slice(0, insertIndex)
	const secondHalf = filteredData.slice(insertIndex)

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
						<a
							href='/povinne-ruceni'
							className='btn btn-outline-primary'
							role='button'
						>
							Povinné ručení
						</a>
						<a
							href='/havarijni-pojisteni'
							className='btn btn-outline-primary'
							role='button'
						>
							Havarijní pojištění
						</a>
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

			{/* Detailed data table */}
			{filteredData.length > 0 && (
				<div className='table-responsive mt-4'>
					<table className='table table-striped table-hover'>
						<tbody>
							{/* First part of data */}
							{firstHalf.map((item) => (
								<tr key={item.name}>
									<th>{item.label}</th>
									<td
										dangerouslySetInnerHTML={{
											__html: formatValue(String(item.value))
										}}
									/>
								</tr>
							))}

							{/* Cebia Check Row (Inserted at index ~10) */}
							<tr className='table-warning'>
								<th className='align-middle'>Historie a původ vozidla</th>
								<td className='text-end'>
									<a
										href={cebia.getDirectUrl(vinCode)}
										target='_blank'
										rel='noopener noreferrer'
										className='btn btn-primary btn-sm fw-bold'
									>
										Prověřit historii na Cebia.cz ➜
									</a>
								</td>
							</tr>

							{/* Second part of data */}
							{secondHalf.map((item) => (
								<tr key={item.name}>
									<th>{item.label}</th>
									<td
										dangerouslySetInnerHTML={{
											__html: formatValue(String(item.value))
										}}
									/>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Banner */}
			<div className='mt-3 mb-3'>
				<a
					href={cebia.getGraphicBannerUrl()}
					target='_top'
					rel='noopener noreferrer'
					style={{ display: 'block', width: '100%' }}
				>
					<img
						src={cebia.getGraphicBannerImage()}
						alt='Advertisement'
						className='img-fluid'
						style={{ width: '100%', height: 'auto', display: 'block' }}
					/>
				</a>
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
	// Try to format date if it looks like ISO date
	if (value.match(/^\d{4}-\d{2}-\d{2}(T.*)?$/)) {
		const date = new Date(value)
		return date.toLocaleDateString('cs-CZ')
	}
	return value
}

export default VehicleInfo
