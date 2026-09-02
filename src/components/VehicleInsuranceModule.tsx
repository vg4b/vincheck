import type React from 'react'
import { useEffect, useState } from 'react'
import { type CsobProduct, csob } from '../config/affiliateCampaigns'
import { ApiError, requestJson } from '../utils/apiClient'
import { titleCase } from '../utils/carLabels'

/**
 * Vehicle-data insurance module.
 *
 * The point of this component is that it is OUR content, not an ad: the numbers
 * come from stats_model (the whole CZ registry), the verdict line is our own
 * editorial read, and ČSOB appears only as the destination of an official eHub
 * creative. Rules baked in deliberately:
 *
 *   - no ČSOB logo, no ČSOB-branded artwork of our own making
 *   - no prices and no price comparison — those are claims about someone else's
 *     product and the fastest route to "klamavá reklama", which the campaign
 *     bans outright with no approval path
 *   - the verdict says when insurance is NOT worth buying; a module that only
 *     ever recommends buying is an ad, and reads like one
 *
 * eHub approved publishing this content (2026-08-25), so it renders in public:
 * under the vehicle lookup result (VehicleDetailPage, M1 only) and on the
 * insurance page for a vehicle-carrying link.
 * See docs/plans/2026-08-25-001-module-rollout-and-import-content.md.
 */

type ModelStats = {
	brand: string
	model: string
	vehicleCount: number
	avgAgeYears: number | null
	avgOwners: number | null
	stkFailPct: number | null
	theftPer1000: number | null
	theftCount: number | null
}

const fmtInt = (n: number) => Math.round(n).toLocaleString('cs-CZ')
const fmtNum1 = (n: number) =>
	n.toLocaleString('cs-CZ', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	})

/**
 * The editorial line, chosen for the product the visitor is actually looking at.
 *
 * Why it depends on `product`: povinné ručení is compulsory, so there is nothing
 * to advise about buying it. Showing a verdict on whether COMPREHENSIVE cover
 * pays off — which is what every line here used to do — was incoherent on the
 * povinné ručení tab, where that decision is not on the table.
 *
 * Tone rule for the havarijní lines: describe the MECHANISM, never the car. An
 * earlier draft ended "a ta už bývá nízká", which reads as "your car is cheap"
 * to the person who owns one. Cars lose value with age; that is arithmetic, not
 * a verdict on the model, and the wording has to make that obvious.
 *
 * Comprehensive cover in CZ pays out at most the vehicle's market value at the
 * time of the loss, so that ceiling — not the premium, and not any notion of
 * what the car "earns" — is what decides whether the cover is worth buying.
 *
 * Nothing here claims what any insurer offers: that would be a statement about
 * someone else's product, which this module deliberately never makes.
 */
function verdictFor(stats: ModelStats, product: CsobProduct): string {
	const age = stats.avgAgeYears
	const theft = stats.theftPer1000

	if (product === 'povinne') {
		// True and genuinely useful: many owners assume the premium tracks the
		// car's value, and then overpay or expect a discount that never comes.
		return 'Povinné ručení musíte mít bez ohledu na stáří vozu. Jeho cena se obvykle odvíjí od výkonu motoru a vaší bezeškodní historie, ne od hodnoty vozidla.'
	}

	if (age != null && age >= 15) {
		return 'Havarijní pojištění plní do obvyklé ceny vozu, a ta s věkem klesá. U vozů tohoto stáří proto stojí za zvážení, jestli roční pojistné odpovídá částce, kterou by pojišťovna v případě totální škody vyplatila.'
	}
	if (age != null && age <= 6) {
		return 'U vozů tohoto stáří bývá havarijní pojištění nejužitečnější – obvyklá cena, do jejíž výše se plní, je zatím vysoko.'
	}
	if (theft != null && theft >= 1) {
		return 'Tento model patří mezi častěji odcizované. I když se plné havarijní pojištění nevyplatí, stojí za zvážení alespoň pojištění odcizení.'
	}
	return 'Havarijní pojištění plní do obvyklé ceny vozu. Jestli se u tohoto vozidla vyplatí, záleží hlavně na tom, kde se jeho cena dnes pohybuje.'
}

const Figure: React.FC<{ value: string; label: string }> = ({
	value,
	label
}) => (
	<div className='col-6 col-md-3'>
		<div className='fw-bold' style={{ fontSize: '1.35rem' }}>
			{value}
		</div>
		<div className='text-muted-ink' style={{ fontSize: '.8rem' }}>
			{label}
		</div>
	</div>
)

const VehicleInsuranceModule: React.FC<{
	brandSlug: string
	modelSlug: string
	product: CsobProduct
	placement: string
}> = ({ brandSlug, modelSlug, product, placement }) => {
	const [stats, setStats] = useState<ModelStats | null>(null)
	const [failed, setFailed] = useState(false)

	useEffect(() => {
		let cancelled = false
		setStats(null)
		setFailed(false)
		const params = new URLSearchParams({
			type: 'model',
			brand: brandSlug.toLowerCase(),
			model: modelSlug.toLowerCase()
		})
		requestJson<{ stats: ModelStats }>(`/api/stats?${params.toString()}`)
			.then((d) => {
				if (!cancelled) setStats(d.stats)
			})
			.catch((err: unknown) => {
				if (cancelled) return
				// A cohort below the publish floor is a normal miss, not an error.
				setFailed(!(err instanceof ApiError && err.status === 404))
			})
		return () => {
			cancelled = true
		}
	}, [brandSlug, modelSlug])

	// Render nothing rather than a half-empty card: without the numbers this is
	// just a bare ad, which is the thing we are trying not to build.
	if (!stats || failed) return null

	const name = `${titleCase(stats.brand)} ${titleCase(stats.model)}`

	return (
		<section
			className='rounded-3 p-4 mb-4'
			style={{ backgroundColor: 'var(--surface-soft, #f7f8fa)' }}
		>
			<h2 className='h5 mb-1'>{name}</h2>
			<p className='text-muted-ink mb-3' style={{ fontSize: '.85rem' }}>
				Z našich dat o všech vozech tohoto modelu v registru.
			</p>

			<div className='row g-3 mb-3'>
				<Figure value={fmtInt(stats.vehicleCount)} label='vozů v registru' />
				{stats.avgAgeYears != null && (
					<Figure
						value={`${fmtNum1(stats.avgAgeYears)} let`}
						label='průměrné stáří'
					/>
				)}
				{stats.stkFailPct != null && (
					<Figure
						value={`${fmtNum1(stats.stkFailPct)} %`}
						label='neprojde STK'
					/>
				)}
				{stats.theftPer1000 != null && (
					<Figure
						value={fmtNum1(stats.theftPer1000)}
						label='krádeží na 1 000 vozů'
					/>
				)}
			</div>

			<p className='mb-3'>{verdictFor(stats, product)}</p>

			{/* Affiliate link: `noopener` is the security win; `noreferrer` is
			    deliberately omitted because eHub validates clicks against the
			    referring domain and stripping Referer risks lost commissions. */}
			{/* eslint-disable-next-line react/jsx-no-target-blank */}
			<a
				href={csob.getProductUrl(product, placement)}
				target='_blank'
				rel='noopener sponsored'
				className='btn btn-primary'
			>
				Spočítat pojištění
			</a>
		</section>
	)
}

export default VehicleInsuranceModule
