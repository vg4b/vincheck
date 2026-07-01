import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'

const PlatbaPage: React.FC = () => {
	useEffect(() => {
		document.title = 'Platba a doručení | VIN Info.cz'
		const metaDescription = document.querySelector('meta[name="description"]')
		if (metaDescription) {
			metaDescription.setAttribute(
				'content',
				'Informace o online platbách na VIN Info.cz — platba kartou a platebními tlačítky bank přes platební bránu Comgate a elektronické doručení produktu.'
			)
		}
	}, [])

	return (
		<>
			<Navigation />
			<main className='container mt-5'>
				<article className='mb-5'>
					<header>
						<h1 className='mb-4'>Platba a doručení</h1>
					</header>

					<section className='mb-5'>
						<h2 className='h4'>Platební brána</h2>
						<p>
							Online platby za placené produkty (certifikát historie vozidla)
							zpracovává platební brána{' '}
							<a
								href='https://www.comgate.eu/cs/platebni-brana'
								target='_blank'
								rel='noopener noreferrer'
							>
								Comgate
							</a>{' '}
							(Comgate, a.s.). Platba probíhá v zabezpečeném prostředí platební
							brány; údaje o vaší platební kartě se nikdy nedostanou k
							provozovateli obchodu.
						</p>
					</section>

					<section className='mb-5'>
						<h2 className='h4'>Platební metody</h2>

						<h3 className='h5 mt-3'>Platba kartou (VISA, Mastercard)</h3>
						<p>
							Po dokončení objednávky budete přesměrováni na platební bránu
							Comgate, kde zadáte údaje své platební karty VISA nebo Mastercard.
							Platba je ověřena technologií 3D Secure a proběhne okamžitě. Po
							jejím připsání vám ihned zpřístupníme produkt. Podrobnosti k
							platbám kartou najdete v{' '}
							<a
								href='https://help.comgate.cz/v1/docs/cs/platby-kartou'
								target='_blank'
								rel='noopener noreferrer'
							>
								nápovědě Comgate
							</a>
							.
						</p>

						<h3 className='h5 mt-3'>Platební tlačítka bank (bankovní převod)</h3>
						<p>
							Zaplatit můžete také okamžitým bankovním převodem přes platební
							tlačítko své banky. Po výběru banky budete přesměrováni do
							internetového bankovnictví s předvyplněnými platebními údaji; po
							potvrzení platby se vrátíte zpět do obchodu. Produkt vám
							zpřístupníme po připsání platby. Podrobnosti najdete v{' '}
							<a
								href='https://help.comgate.cz/docs/bankovni-prevody'
								target='_blank'
								rel='noopener noreferrer'
							>
								nápovědě Comgate
							</a>
							.
						</p>
					</section>

					<section className='mb-5'>
						<h2 className='h4'>Doručení</h2>
						<p>
							Produkt je digitální a doručuje se elektronicky — ihned po připsání
							platby jej zpřístupníme ke stažení a zašleme na zadaný e-mail.
							Nejde o fyzické zboží, žádná doprava se proto neúčtuje.
						</p>
					</section>

					<section className='mb-5'>
						<h2 className='h4'>Kontakt na poskytovatele platební brány</h2>
						<p>
							V případě reklamace nebo dotazů k platbám můžete kontaktovat
							provozovatele platební brány:
						</p>
						<ul className='list-unstyled'>
							<li>
								<strong>Comgate, a.s.</strong>
							</li>
							<li>Gočárova třída 1754/48b, Hradec Králové</li>
							<li>
								E-mail:{' '}
								<a href='mailto:podpora@comgate.cz'>podpora@comgate.cz</a>
							</li>
							<li>
								Tel.: <a href='tel:+420228224267'>+420 228 224 267</a>
							</li>
						</ul>
						<p className='text-muted-ink small mb-0'>
							Reklamace samotného produktu i dotazy k obchodu vyřizuje
							provozovatel — viz <Link to='/kontakt'>Kontakt</Link>.
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

export default PlatbaPage
