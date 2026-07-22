import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import { applyNoindex } from '../utils/seo'

const KontaktPage: React.FC = () => {
	useEffect(() => {
		// Reachable on the site, but kept out of search — the page carries the
		// operator's phone, e-mail and registered address.
		const restoreRobots = applyNoindex()
		document.title = 'Kontakt | VIN Info.cz'
		const metaDescription = document.querySelector('meta[name="description"]')
		if (metaDescription) {
			metaDescription.setAttribute(
				'content',
				'Kontaktní údaje provozovatele služby VIN Info.cz — telefon, e-mail, sídlo a IČO.'
			)
		}
		return restoreRobots
	}, [])

	return (
		<>
			<Navigation />
			<main className='container mt-5'>
				<article className='mb-5'>
					<header>
						<h1 className='mb-4'>Kontakt</h1>
					</header>

					<section className='mb-5'>
						<h2 className='h4'>Provozovatel</h2>
						<ul className='list-unstyled'>
							<li>
								<strong>Jméno:</strong> Bc. Václav Gabriel
							</li>
							<li>
								<strong>Sídlo:</strong> Krkoškova 1662/37, 613 00 Brno
							</li>
							<li>
								<strong>IČO:</strong> 88350207
							</li>
							<li>
								Fyzická osoba zapsaná v živnostenském rejstříku. Neplátce DPH.
							</li>
						</ul>
					</section>

					<section className='mb-5'>
						<h2 className='h4'>Kontaktní údaje</h2>
						<ul className='list-unstyled'>
							<li>
								<strong>Telefon:</strong>{' '}
								<a href='tel:+420705903615'>+420 705 903 615</a>
							</li>
							<li>
								<strong>E-mail:</strong>{' '}
								<a href='mailto:vininfo@mail.vininfo.cz'>
									vininfo@mail.vininfo.cz
								</a>
							</li>
						</ul>
					</section>

					<section className='mb-5'>
						<h2 className='h4'>Platby</h2>
						<p>
							Platby kartou a bankovním převodem za placené produkty zpracovává
							platební brána Comgate (ComGate Payments, a.s., IČO 27924505),
							poskytovatel platebních služeb provozovatele.
						</p>
					</section>

					<div className='mt-5 mb-4'>
						<Link to='/' className='btn btn-outline-primary'>
							Zpět na hlavní stránku
						</Link>
					</div>
				</article>
			</main>
			<Footer />
		</>
	)
}

export default KontaktPage
