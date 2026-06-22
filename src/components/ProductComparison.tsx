import React from 'react'
import Icon from './Icon'

interface ProductComparisonProps {
	priceCzk: number
	/** CTA for our certificate (button on the detail page, link on the landing). */
	certificateCta: React.ReactNode
	/** CTA for the Cebia affiliate. */
	cebiaCta: React.ReactNode
}

/**
 * Two distinct products side by side — they do different jobs, so the user
 * self-selects by need: our certificate = proof of what's IN the registry;
 * Cebia = reveals what the registry CAN'T (mileage/accidents/liens/foreign
 * history). Shared by the vehicle detail page and the certificate landing page so
 * the messaging stays identical. The certificate card carries a subtle
 * "Nejoblíbenější" tag — our owned product, repeat customers — without breaking
 * the equal-weight layout.
 */
const ProductComparison: React.FC<ProductComparisonProps> = ({
	priceCzk,
	certificateCta,
	cebiaCta
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
				<li>
					<Icon name='check' size={15} /> Dovoz a stav vozidla
				</li>
				<li>
					<Icon name='check' size={15} /> Ověřitelné PDF s QR kódem
				</li>
			</ul>
			<p className='product-when'>
				Vyberte, když chcete srozumitelný přehled historie vozidla zpracovaný z
				dat registru ČR — ideální při prodeji nebo pro vlastní evidenci.
			</p>
			{certificateCta}
		</div>

		{/* Affiliate — the data the registry can't provide. */}
		<div className='product-card'>
			<div className='product-card-head'>
				<h3 className='h6 mb-1'>Kompletní prověření</h3>
				<span className='product-price'>od ~500 Kč · náš partner</span>
			</div>
			<ul className='product-features'>
				<li>
					<Icon name='check' size={15} /> Stav tachometru (odhalí stočení)
				</li>
				<li>
					<Icon name='check' size={15} /> Záznamy o nehodách
				</li>
				<li>
					<Icon name='check' size={15} /> Zástavy a leasing
				</li>
				<li>
					<Icon name='check' size={15} /> Historie ze zahraničí
				</li>
			</ul>
			<p className='product-when'>
				Vyberte, když kupujete ojetinu nebo dovoz a chcete vyloučit stočený
				tachometr či zamlčenou nehodu — data, která registr nemá.
			</p>
			{cebiaCta}
		</div>
	</div>
)

export default ProductComparison
