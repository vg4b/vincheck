import React, { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Icon from '../components/Icon'
import Navigation from '../components/Navigation'
import VehicleInsuranceModule from '../components/VehicleInsuranceModule'
import {
	type CsobProduct,
	csob,
	type InsuranceKind,
	type InsurancePlacement,
	promoLabel
} from '../config/affiliateCampaigns'

/**
 * This page used to embed the ePojištění comparison iframe. That is gone, and
 * not because it was ugly: the creative is designed at 1000 px and was embedded
 * at a fixed 2200 px height, so on a phone it was unusable — and unfixable,
 * because our CSS stops at the iframe boundary.
 *
 * With a single insurer the page can no longer promise a comparison, so the copy
 * changed with it. Anything implying "we compare offers for you" or claiming
 * ČSOB's prices are the best on the market had to go: those are claims about a
 * service we do not provide and a product that is not ours, i.e. "klamavá
 * reklama", which the eHub campaign bans outright with no approval path.
 * What survives ("bez telefonátů", "online během pár minut") describes how the
 * policy is arranged, not what it costs, and is true.
 *
 * See docs/plans/2026-08-24-001-csob-single-insurance-partner.md.
 */

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

/** Query value that reveals the not-yet-approved data module. See PREVIEW note. */
const PREVIEW_FLAG = 'csob'

const KIND_TO_PRODUCT: Record<InsuranceKind, CsobProduct> = {
	povinne: 'povinne',
	havarijni: 'havarijni',
	cestovni: 'cestovni'
}

/** Unknown or missing `typ` falls back to povinné ručení, the common case. */
function parseTyp(raw: string | null): InsuranceKind {
	if (raw === 'havarijni' || raw === 'cestovni') return raw
	return 'povinne'
}

const KIND_LABEL: Record<InsuranceKind, string> = {
	povinne: 'Povinné ručení',
	havarijni: 'Havarijní pojištění',
	cestovni: 'Cestovní pojištění'
}

const KIND_INTRO: Record<InsuranceKind, string> = {
	povinne:
		'Sjednáte online, bez telefonátů. Budete potřebovat SPZ nebo VIN a datum narození; vyřízení trvá pár minut.',
	havarijni:
		'Sjednáte online, bez telefonátů. Kromě údajů o vozidle budete potřebovat vědět, jak vůz obvykle parkujete.',
	cestovni:
		'Sjednáte online, bez telefonátů. Stačí termín cesty, cílová oblast a počet cestujících.'
}

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

// No price or "cheapest" claims here — see the file header.
const BENEFITS = [
	{
		icon: '💻',
		title: 'Celé online',
		desc: 'Smlouvu uzavřete z mobilu, bez papírů a bez telefonátů'
	},
	{
		icon: '🔄',
		title: 'Vyplatí se přepočítat',
		desc: 'Bonus za bezeškodní průběh se u stávající smlouvy sám nepřepočítá'
	},
	{
		icon: '📄',
		title: 'Zelená karta hned',
		desc: 'Doklady dostanete e-mailem obratem po sjednání'
	}
]

/** Czech date without the leading zeroes: 2026-08-31 → 31. 8. 2026 */
function fmtDate(iso: string): string {
	const [y, m, d] = iso.split('-')
	return `${Number(d)}. ${Number(m)}. ${y}`
}

const SjednatPojisteniPage: React.FC = () => {
	const [searchParams, setSearchParams] = useSearchParams()

	/**
	 * `typ` is derived from the URL rather than held in state, so the address bar
	 * always describes what is on screen. It used to be useState seeded from the
	 * param once: switching tabs then left a URL that named a different product
	 * than the page showed, so a shared or reloaded link lost the selection.
	 * That matters most for the ?nahled= preview links, which exist to be sent to
	 * someone else.
	 *
	 * `replace: true` on purpose — tab clicks should not stack history entries,
	 * so Back leaves the page instead of walking back through the tabs.
	 */
	const typ: InsuranceKind = parseTyp(searchParams.get('typ'))

	const selectTyp = (next: InsuranceKind) => {
		const params = new URLSearchParams(searchParams)
		params.set('typ', next)
		setSearchParams(params, { replace: true })
	}

	const srcParam = searchParams.get('src') as InsurancePlacement | null
	const placement: InsurancePlacement =
		srcParam && VALID_PLACEMENTS.includes(srcParam) ? srcParam : 'sjednat_page'

	/**
	 * PREVIEW GATE. eHub allows partner-made content only with prior consent, so
	 * the data module must not be PUBLISHED before ČSOB has seen it. It therefore
	 * renders only with ?nahled=csob, is linked from nowhere, is absent from the
	 * sitemap, and the page goes noindex while the flag is on — a preview Google
	 * had indexed would be public in every way that matters.
	 *
	 * Remove this gate (and the noindex branch) once consent arrives: F3 in the plan.
	 */
	const previewOn = searchParams.get('nahled') === PREVIEW_FLAG
	const previewBrand = searchParams.get('znacka')
	const previewModel = searchParams.get('model')
	/**
	 * Vehicle-only. Travel insurance has nothing to do with the car, so the
	 * module's numbers (STK failures, theft rate, fleet age) would be decoration
	 * next to a product they say nothing about.
	 */
	const showModule =
		previewOn && typ !== 'cestovni' && Boolean(previewBrand && previewModel)

	useEffect(() => {
		document.title = 'Sjednat pojištění vozidla | VIN Info.cz'
		const meta = document.querySelector('meta[name="description"]')
		if (meta) {
			meta.setAttribute(
				'content',
				'Povinné ručení, havarijní i cestovní pojištění sjednáte online během pár minut, bez telefonátů.'
			)
		}
	}, [])

	// Keep the preview out of the index for as long as the flag is on.
	useEffect(() => {
		if (!previewOn) return
		const el = document.createElement('meta')
		el.setAttribute('name', 'robots')
		el.setAttribute('content', 'noindex, nofollow')
		document.head.appendChild(el)
		return () => {
			document.head.removeChild(el)
		}
	}, [previewOn])

	const validCoupons = csob.getValidCoupons()
	// An unmatched coupon is not lost: it still shows in the "další akce" strip.
	const tabCoupon = csob.getCouponsFor(KIND_TO_PRODUCT[typ])[0]
	const otherCoupons = validCoupons.filter((c) => c.id !== tabCoupon?.id)

	return (
		<>
			<Navigation />
			<div className='container mt-5 mb-5' style={{ maxWidth: 900 }}>
				<h1 className='mb-3'>Sjednat pojištění vozidla</h1>
				<p className='text-muted mb-4'>
					Vyberte typ pojištění a sjednejte ho online.
					{typ !== 'cestovni' &&
						' Pojištění vozidla se obvykle sjednává na dobu neurčitou a bonus za bezeškodní průběh se u stávající smlouvy automaticky nepřepočítává, takže se vyplatí ho jednou za čas přepočítat.'}
				</p>

				{/* Přepínač typu pojištění. Ne `btn-group`: to je inline-flex a nezalamuje,
				    takže tři české popisky přetečou na mobilu. */}
				<div
					className='d-flex flex-wrap gap-2 mb-4'
					role='group'
					aria-label='Typ pojištění'
				>
					{(['povinne', 'havarijni', 'cestovni'] as InsuranceKind[]).map(
						(k) => (
							<React.Fragment key={k}>
								<input
									type='radio'
									className='btn-check'
									name='typ-pojisteni'
									id={`typ-${k}`}
									checked={typ === k}
									onChange={() => selectTyp(k)}
								/>
								{/* flex-grow-1 do 576px: tři české popisky se na telefon do řádku
								    nevejdou, takže se tak jako tak zalomí. Ať se roztáhnou přes
								    celou šířku a vypadá to jako záměr, ne jako rozsypaný řádek. */}
								<label
									className='btn btn-outline-primary rounded-pill px-4 flex-grow-1 flex-sm-grow-0'
									htmlFor={`typ-${k}`}
								>
									{KIND_LABEL[k]}
								</label>
							</React.Fragment>
						)
					)}
				</div>

				{/* Hlavní nabídka */}
				<div className='card shadow-sm border-0 mb-5'>
					<div className='card-body p-4'>
						<h2 className='h4 mb-2'>{KIND_LABEL[typ]}</h2>
						<p className='text-muted mb-3'>{KIND_INTRO[typ]}</p>

						{tabCoupon && (
							<div
								className='rounded-3 px-3 py-2 mb-3 d-inline-block'
								style={{ backgroundColor: 'rgba(90, 143, 62, 0.15)' }}
							>
								<div className='fw-semibold'>{promoLabel(tabCoupon.label)}</div>
								<div className='text-muted-ink small'>
									platí do {fmtDate(tabCoupon.validTo)}
								</div>
							</div>
						)}

						<div>
							{/* eslint-disable-next-line react/jsx-no-target-blank -- Referer must survive for eHub click attribution; `noopener` already covers the security risk */}
							<a
								href={
									tabCoupon
										? csob.getCouponUrl(tabCoupon.id)
										: csob.getProductUrl(KIND_TO_PRODUCT[typ], placement)
								}
								target='_blank'
								rel='noopener sponsored'
								className='btn btn-primary btn-lg'
							>
								Spočítat {KIND_LABEL[typ].toLowerCase()}
							</a>
						</div>

						<p
							className='text-muted-ink mt-3 mb-0 d-flex align-items-center gap-1'
							style={{ fontSize: '.8rem' }}
						>
							Pojištění sjednává ČSOB Pojišťovna.
							{/* Affiliate disclosure. Native `title` rather than a Bootstrap
							    tooltip, matching the existing pattern in ClientZonePage —
							    same wording, no JS to initialise, works on the first paint. */}
							<span
								className='d-inline-flex align-items-center'
								title='Partnerský odkaz'
								aria-label='Partnerský odkaz'
								role='img'
							>
								<Icon name='info' size={13} />
							</span>
						</p>
					</div>
				</div>

				{/* Kontext vozidla až POD nabídkou: stránka má jeden úkol, sjednat
				    pojištění, a ten patří nahoru. Modul je podklad k rozhodnutí, ne
				    nabídka sama. Zároveň tím přestanou dvě tlačítka se skoro stejným
				    významem stát hned pod sebou. */}
				{showModule && previewBrand && previewModel && (
					<VehicleInsuranceModule
						brandSlug={previewBrand}
						modelSlug={previewModel}
						product={KIND_TO_PRODUCT[typ]}
						placement={placement}
					/>
				)}

				{/* Ostatní akce hned pod nabídkou, ne až na konci stránky: obchodní obsah
				    drží pohromadě a naše vlastní sekce jdou pod něj. Nekonkuruje to hlavní
				    nabídce, protože `otherCoupons` z výpisu vyhazuje kupón aktuální
				    záložky — jsou to nabídky na JINÉ produkty. Držet vizuálně lehké
				    (prostý seznam odkazů), ať to hlavní CTA nepřebíjí. */}
				{otherCoupons.length > 0 && (
					<div className='mb-5'>
						<h2 className='h6 mb-3'>Další akce ČSOB Pojišťovny</h2>
						<ul className='list-unstyled d-flex flex-column gap-2 mb-0'>
							{otherCoupons.map((c) => (
								<li key={c.id}>
									{/* eslint-disable-next-line react/jsx-no-target-blank -- Referer must survive for eHub click attribution; `noopener` already covers the security risk */}
									<a
										href={csob.getCouponUrl(c.id)}
										target='_blank'
										rel='noopener sponsored'
									>
										{promoLabel(c.label)}
									</a>
									<span
										className='text-muted-ink ms-2'
										style={{ fontSize: '.8rem' }}
									>
										do {fmtDate(c.validTo)}
									</span>
								</li>
							))}
						</ul>
					</div>
				)}
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
			</div>
			<Footer />
		</>
	)
}

export default SjednatPojisteniPage
