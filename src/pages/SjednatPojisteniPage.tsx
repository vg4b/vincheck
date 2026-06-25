import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import {
	epojisteni,
	type InsuranceKind,
	type InsurancePlacement
} from '../config/affiliateCampaigns'

/**
 * Pevná výška iframe (px) podle typu – rozměry creativy ePojištění
 * (POV 1000×2100, HAV 1000×2400) + rezerva. `scrolling="yes"` zajistí, že
 * formulář je dostupný celý i na užších / mobilních šířkách.
 *
 * Pozn.: ePojištění nabízí i `iframeResizer.js` pro auto-resize, jeho doplněk
 * ale po opuštění stránky stále volá `setInterval` nad odstraněným `#epIframe`
 * → opakovaná „Script error". Skript proto nenačítáme.
 */
const IFRAME_HEIGHT: Record<InsuranceKind, number> = {
	povinne: 2200,
	havarijni: 2500,
	cestovni: 1700
}

// Design width of each creative; cestovní is narrower (700px) so we cap it
// instead of stretching the form across the full container.
const IFRAME_MAX_WIDTH: Partial<Record<InsuranceKind, number>> = {
	cestovni: 700
}

const IFRAME_TITLE: Record<InsuranceKind, string> = {
	povinne: 'Srovnání povinného ručení',
	havarijni: 'Srovnání havarijního pojištění',
	cestovni: 'Srovnání cestovního pojištění'
}

const VALID_PLACEMENTS: InsurancePlacement[] = [
	'sjednat_page',
	'email_reminder',
	'vehicle_card',
	'vehicle_card_due',
	'client_zone_benefits',
	'povinne_page',
	'havarijni_page',
	'vehicle_info',
	'footer',
	'nav'
]

const REMINDER_COLUMNS: { emoji: string; label: string }[][] = [
	[
		{ emoji: '🔧', label: 'Termín STK' },
		{ emoji: '🛡️', label: 'Povinné ručení' },
		{ emoji: '🚗', label: 'Havarijní pojištění' }
	],
	[
		{ emoji: '🔩', label: 'Servisní prohlídky' },
		{ emoji: '🛞', label: 'Přezutí pneumatik' },
		{ emoji: '🛣️', label: 'Dálniční známka' }
	]
]

const ReminderLine: React.FC<{ emoji: string; label: string }> = ({
	emoji,
	label
}) => (
	<li className='d-flex align-items-start gap-2'>
		<span
			className='flex-shrink-0 d-inline-flex justify-content-center'
			style={{ width: '1.5rem', lineHeight: 1.25 }}
			aria-hidden
		>
			{emoji}
		</span>
		<span>{label}</span>
	</li>
)

const BENEFITS = [
	{
		icon: '⚖️',
		title: 'Porovnání nabídek',
		desc: 'Srovnáte ceny pojišťoven na jednom místě'
	},
	{
		icon: '🔄',
		title: 'Vyplatí se každý rok',
		desc: 'Bonus se při prodloužení smlouvy nepřepočítá – srovnáním ušetříte'
	},
	{
		icon: '💰',
		title: 'Výhodná cena',
		desc: 'Najdete pojištění odpovídající vašemu vozidlu'
	}
]

const SjednatPojisteniPage: React.FC = () => {
	const [searchParams] = useSearchParams()

	const typParam = searchParams.get('typ')
	const initialTyp: InsuranceKind =
		typParam === 'havarijni'
			? 'havarijni'
			: typParam === 'cestovni'
				? 'cestovni'
				: 'povinne'
	const srcParam = searchParams.get('src') as InsurancePlacement | null
	const placement: InsurancePlacement =
		srcParam && VALID_PLACEMENTS.includes(srcParam) ? srcParam : 'sjednat_page'

	const [typ, setTyp] = useState<InsuranceKind>(initialTyp)

	useEffect(() => {
		document.title = 'Sjednat pojištění vozidla | VIN Info.cz'
		const meta = document.querySelector('meta[name="description"]')
		if (meta) {
			meta.setAttribute(
				'content',
				'Porovnejte si povinné ručení a havarijní pojištění vozidla. Srovnání nabídek pojišťoven online během pár minut.'
			)
		}
	}, [])

	const iframeUrl = epojisteni.getIframeUrl(typ, placement)

	return (
		<>
			<Navigation />
			<div className='container mt-5 mb-5'>
				<h1 className='mb-3'>Sjednat pojištění vozidla</h1>
				<p className='text-muted mb-4'>
					Vyberte typ pojištění a porovnejte si nabídky pojišťoven přímo zde
					online a zdarma – ušetříte čas i peníze.
					{typ !== 'cestovni' &&
						' Pojištění vozidla se obvykle sjednává na dobu neurčitou a bonus za bezeškodní průběh se automaticky nepřepočítává, takže novým srovnáním každý rok často ušetříte.'}
				</p>

				{/* Přepínač typu pojištění */}
				<div className='btn-group mb-4' role='group' aria-label='Typ pojištění'>
					<input
						type='radio'
						className='btn-check'
						name='typ-pojisteni'
						id='typ-povinne'
						checked={typ === 'povinne'}
						onChange={() => setTyp('povinne')}
					/>
					<label className='btn btn-outline-primary px-4' htmlFor='typ-povinne'>
						Povinné ručení
					</label>

					<input
						type='radio'
						className='btn-check'
						name='typ-pojisteni'
						id='typ-havarijni'
						checked={typ === 'havarijni'}
						onChange={() => setTyp('havarijni')}
					/>
					<label
						className='btn btn-outline-primary px-4'
						htmlFor='typ-havarijni'
					>
						Havarijní pojištění
					</label>

					<input
						type='radio'
						className='btn-check'
						name='typ-pojisteni'
						id='typ-cestovni'
						checked={typ === 'cestovni'}
						onChange={() => setTyp('cestovni')}
					/>
					<label
						className='btn btn-outline-primary px-4'
						htmlFor='typ-cestovni'
					>
						Cestovní pojištění
					</label>
				</div>

				{/* Srovnávač – embedovaný iframe ePojištění (POV / HAV / cestovní) */}
				<div
					className='rounded overflow-hidden border mb-5 mx-auto'
					style={{
						borderColor: 'var(--ink-300)',
						maxWidth: IFRAME_MAX_WIDTH[typ]
					}}
				>
					<iframe
						key={typ}
						src={iframeUrl}
						title={IFRAME_TITLE[typ]}
						scrolling='yes'
						style={{
							display: 'block',
							width: '100%',
							height: IFRAME_HEIGHT[typ],
							border: 0
						}}
					/>
				</div>

				<div className='row g-4'>
					{/* Co získáte */}
					<div className='col-lg-6'>
						<div className='card shadow-sm h-100 border-0'>
							<div className='card-body p-4'>
								<h2 className='h5 card-title mb-4'>Co získáte</h2>
								{BENEFITS.map((b, i) => (
									<div
										key={b.title}
										className={`d-flex align-items-start gap-3 ${
											i < BENEFITS.length - 1
												? 'mb-4 pb-3 border-bottom border-light'
												: ''
										}`}
									>
										<div
											className='rounded-circle d-flex align-items-center justify-content-center flex-shrink-0'
											style={{
												width: 48,
												height: 48,
												backgroundColor: 'rgba(90, 143, 62, 0.15)',
												fontSize: '1.5rem'
											}}
										>
											{b.icon}
										</div>
										<div>
											<div className='fw-semibold'>{b.title}</div>
											<div className='text-muted small'>{b.desc}</div>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>

					{/* Upozornění na termíny */}
					<div className='col-lg-6'>
						<div className='card shadow-sm h-100 border-0'>
							<div className='card-body p-4'>
								<h2 className='h5 card-title mb-2'>
									Nechte se upozornit na důležité termíny
								</h2>
								<p className='small text-muted mb-3'>
									V Moje VINInfo si uložíte vozidlo a nastavíte upozornění –
									nikdy nezmeškáte:
								</p>
								<div className='row small g-3 align-items-start'>
									{REMINDER_COLUMNS.map((column, colIdx) => (
										<div key={colIdx} className='col-sm-6'>
											<ul className='list-unstyled mb-0 d-flex flex-column gap-2'>
												{column.map((item) => (
													<ReminderLine
														key={item.label}
														emoji={item.emoji}
														label={item.label}
													/>
												))}
											</ul>
										</div>
									))}
								</div>
								<p className='small text-muted mb-3 mt-3'>
									📧 Pošleme vám email v termínu, který si zvolíte • ✨ 100 %
									zdarma
								</p>
								<p className='small mb-0'>
									<Link to='/klientska-zona'>Přejít do Moje VINInfo</Link>
									{' · '}
									<Link to='/registrace'>Vytvořit účet zdarma</Link>
								</p>
							</div>
						</div>
					</div>
				</div>
				{/* Seznam spolupracujících pojišťoven – podmínka kampaně ePojištění */}
				<div className='mt-5'>
					<h2 className='h6'>Srovnání zajišťuje ePojištění</h2>
					<p className='small text-muted mb-2'>
						ePojištění je největší český srovnávač pojištění vozidel. Porovnává
						nabídky těchto pojišťoven:
					</p>
					<ul className='list-inline small text-muted mb-0'>
						{epojisteni.partnerInsurers.map((name) => (
							<li key={name} className='list-inline-item me-3'>
								{name}
							</li>
						))}
					</ul>
				</div>
			</div>
			<Footer />
		</>
	)
}

export default SjednatPojisteniPage
