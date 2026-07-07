import React from 'react'
import Icon from './Icon'

interface ProductComparisonProps {
	priceCzk: number
	/** CTA for our certificate (button on the detail page, link on the landing). */
	certificateCta: React.ReactNode
	/** CTA for the Cebia affiliate. */
	cebiaCta: React.ReactNode
	/**
	 * Whether the looked-up vehicle has odometer readings. Pass `false` on the
	 * detail page when this specific vehicle has none, so we don't advertise
	 * mileage the certificate won't contain. Omit (undefined) on the generic
	 * landing page, where the feature is described in general terms.
	 */
	mileageAvailable?: boolean
}

/**
 * Two distinct products side by side — they do different jobs, so the user
 * self-selects by need: our certificate = the registry record plus the official
 * STK mileage history (rollback detection); the partner = what neither registry
 * nor STK shows (accidents, liens/leasing, foreign history, cross-source
 * odometer). Shared by the vehicle detail page and the certificate landing page so
 * the messaging stays identical. The certificate card carries a subtle
 * "Nejoblíbenější" tag — our owned product, repeat customers — without breaking
 * the equal-weight layout.
 */
const ProductComparison: React.FC<ProductComparisonProps> = ({
	priceCzk,
	certificateCta,
	cebiaCta,
	mileageAvailable
}) => (
	<div className='product-choice'>
		{/* Our product — official registry data. */}
		<div className='product-card product-card--featured'>
			<span className='product-badge'>Nejoblíbenější</span>
			<div className='product-card-head'>
				<h3 className='h6 mb-1'>Certifikát historie vozidla</h3>
				<span className='product-price'>{priceCzk} Kč · ihned · PDF</span>
			</div>
			<ul className='product-features'>
				<li>
					<Icon name='check' size={15} /> Vlastníci a provozovatelé
				</li>
				<li>
					<Icon name='check' size={15} /> Historie STK
				</li>
				{mileageAvailable !== false && (
					<li>
						<Icon name='check' size={15} /> Historie stavu tachometru (může
						odhalit stočení)
					</li>
				)}
				<li>
					<Icon name='check' size={15} /> Dovoz a stav vozidla
				</li>
				<li>
					<Icon name='check' size={15} /> Přehledné PDF s QR ověřením ke sdílení
				</li>
			</ul>
			<p className='product-when'>
				Přehledný a ověřitelný PDF výpis s nejdůležitějšími údaji o vozidle z
				registru a STK ČR — ideální podklad při prodeji i koupi nebo pro vlastní
				evidenci.
			</p>
			<div className='mt-auto d-flex flex-column'>
				<a
					className='small text-center mb-2'
					href='/api/certificate/sample'
					target='_blank'
					rel='noopener noreferrer'
				>
					Prohlédnout ukázku certifikátu (PDF) ↗
				</a>
				{certificateCta}
			</div>
		</div>

		{/* Affiliate — the data the registry can't provide. */}
		<div className='product-card'>
			<div className='product-card-head'>
				<h3 className='h6 mb-1'>Kompletní prověření</h3>
				<span className='product-price'>od ~500 Kč · náš partner</span>
			</div>
			<ul className='product-features'>
				<li>
					<Icon name='check' size={15} />{' '}
					<strong>Vše z našeho certifikátu, plus:</strong>
				</li>
				<li>
					<Icon name='check' size={15} /> Záznamy o nehodách a poškození
				</li>
				<li>
					<Icon name='check' size={15} /> Zástavy a leasing
				</li>
				<li>
					<Icon name='check' size={15} /> Tachometr z více zdrojů (i ze zahraničí)
				</li>
				<li>
					<Icon name='check' size={15} /> Historie ze zahraničí
				</li>
			</ul>
			<p className='product-when'>
				Vyberte, když kupujete ojetinu nebo dovoz a chcete prověřit nehody,
				zástavy a původ ze zahraničí — data, která registr nemá.
			</p>
			{cebiaCta}
		</div>
	</div>
)

export default ProductComparison
