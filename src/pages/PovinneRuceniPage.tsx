import React, { useEffect } from 'react'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'

const PovinneRuceniPage: React.FC = () => {
	useEffect(() => {
		document.title = 'Povinné ručení - Vše co potřebujete vědět | VIN Info.cz'

		// Update meta description
		const metaDescription = document.querySelector('meta[name="description"]')
		if (metaDescription) {
			metaDescription.setAttribute(
				'content',
				'Kompletní průvodce povinným ručením v České republice. Co je povinné ručení, kdo ho musí mít, jaké jsou limity pojistného plnění a další důležité informace podle zákona č. 30/2024 Sb.'
			)
		}
	}, [])

	return (
		<>
			<Navigation />
			<div className='container mt-5'>
				<h1 className='mb-4'>Povinné ručení - Kompletní průvodce</h1>

				<div className='alert alert-info' role='alert'>
					<strong>Důležité:</strong> Povinné ručení je zákonem stanovené
					pojištění odpovědnosti z provozu vozidla podle zákona č. 30/2024 Sb.,
					které musí mít každý provozovatel vozidla v České republice.
				</div>

				<p className='mt-3 mb-4'>
					<strong>Hledáte povinné ručení?</strong> Porovnejte nabídky od různých
					pojišťoven a najděte nejvýhodnější povinné ručení pro vaše vozidlo.{' '}
					<a
						href='https://online.pojisteni.cz/?ap=AWYPy1'
						target='_blank'
						rel='noopener noreferrer'
						className='fw-bold'
					>
						Srovnat a sjednat povinné ručení 🔗
					</a>
				</p>

				<article>
					<h2 className='mt-5 mb-3'>Co je povinné ručení?</h2>
					<p>
						Povinné ručení, oficiálně nazývané
						<strong>
							{' '}
							pojištění odpovědnosti za újmu vzniklou provozem vozidla
						</strong>
						, je zákonem stanovené pojištění, které musí mít každý provozovatel
						motorového vozidla v České republice. Toto pojištění je upraveno
						zákonem č. 30/2024 Sb. o pojištění odpovědnosti z provozu vozidla,
						který nabyl účinnosti 1. dubna 2024.
					</p>
					<p>
						Hlavním účelem povinného ručení je zajistit, aby v případě dopravní
						nehody nebo jiné události spojené s provozem vozidla byly pokryty
						škody na zdraví, životě a majetku třetích osob. Na rozdíl od
						havarijního pojištění, které chrání vlastní vozidlo, povinné ručení
						chrání ostatní účastníky silničního provozu a další osoby, které by
						mohly utrpět újmu.
					</p>

					<h2 className='mt-5 mb-3'>Kdo musí mít povinné ručení?</h2>
					<p>
						Podle zákona č. 30/2024 Sb. musí povinné ručení uzavřít každý
						provozovatel vozidla. Vozidlem se pro účely tohoto zákona rozumí:
					</p>
					<ul>
						<li>
							<strong>Motorové vozidlo</strong> určené k pohybu po zemi (s
							výjimkou kolejového vozidla), poháněné výhradně mechanickým
							pohonem, které splňuje alespoň jednu z těchto podmínek:
							<ul>
								<li>
									Maximální konstrukční rychlost je vyšší než 25 km/h, nebo
								</li>
								<li>
									Provozní hmotnost je vyšší než 25 kg a maximální konstrukční
									rychlost vyšší než 14 km/h
								</li>
							</ul>
						</li>
						<li>
							<strong>Přípojné vozidlo</strong> určené k užití s vozidlem podle
							výše uvedené definice
						</li>
						<li>
							<strong>Moped</strong> kategorie podle předpisů Evropské unie
							splňující výše uvedené podmínky (s výjimkou mopedu vybaveného
							pomocným pohonem, jehož hlavním účelem je pomoc při šlapání)
						</li>
					</ul>
					<p>
						<strong>Výjimka:</strong> Za vozidlo se nepovažuje vozík pro
						invalidy užívaný výlučně osobou s tělesným postižením.
					</p>

					<h2 className='mt-5 mb-3'>Co zahrnuje povinné ručení?</h2>
					<p>
						Povinné ručení kryje odpovědnost za újmu vzniklou provozem vozidla.
						Provozem vozidla se rozumí jakékoli použití vozidla odpovídající
						jeho obvyklému účelu, včetně:
					</p>
					<ul>
						<li>Jízdy po pozemních komunikacích</li>
						<li>Pohybu vozidla na pozemcích přístupných veřejnosti</li>
						<li>Parkování a stání vozidla</li>
						<li>Nakládání a vykládání vozidla</li>
					</ul>
					<p>Pojištění kryje škody na:</p>
					<ul>
						<li>
							<strong>Zdraví a životě</strong> - úrazy, smrt, trvalé následky
						</li>
						<li>
							<strong>Majetku</strong> - poškození vozidel, nemovitostí, dalšího
							majetku
						</li>
						<li>
							<strong>Nemajetkové újmy</strong> - bolest, ztížení společenského
							uplatnění
						</li>
					</ul>

					<h2 className='mt-5 mb-3'>Limity pojistného plnění</h2>
					<p>
						Zákon stanovuje minimální limity pojistného plnění, které musí každá
						pojistná smlouva obsahovat:
					</p>
					<ul>
						<li>
							<strong>Za škodu na zdraví nebo usmrcení:</strong> minimálně 5 000
							000 EUR na jednu událost
						</li>
						<li>
							<strong>Za škodu na majetku:</strong> minimálně 1 000 000 EUR na
							jednu událost
						</li>
					</ul>
					<p>
						Tyto limity jsou stanoveny v souladu s evropskou směrnicí
						2009/103/ES a zajišťují dostatečnou ochranu poškozených osob i v
						případě závažných dopravních nehod.
					</p>

					<h2 className='mt-5 mb-3'>Česká kancelář pojistitelů</h2>
					<p>
						Zákon č. 30/2024 Sb. upravuje také činnost České kanceláře
						pojistitelů (Kancelář), která plní několik důležitých funkcí:
					</p>
					<ul>
						<li>
							Zajišťuje plnění z povinného ručení v případech, kdy pojišťovna
							není známa nebo není schopna plnit
						</li>
						<li>
							Spravuje fondy pro krytí škod způsobených nepojištěnými nebo
							neznámými vozidly
						</li>
						<li>Poskytuje informace o pojištění vozidel</li>
						<li>
							Spolupracuje s obdobnými institucemi v jiných členských státech EU
						</li>
					</ul>

					<h2 className='mt-5 mb-3'>Kdy pojištění neplatí?</h2>
					<p>Pojištění neplatí v následujících případech:</p>
					<ul>
						<li>Škoda byla způsobena úmyslně</li>
						<li>
							Vozidlo řídila osoba bez řidičského oprávnění nebo s odnětým
							oprávněním
						</li>
						<li>Řidič byl pod vlivem alkoholu nebo jiných návykových látek</li>
						<li>Vozidlo bylo použito k trestné činnosti</li>
						<li>
							Škoda vznikla při účasti na organizovaném motoristickém závodě
							nebo soutěži (pro tyto případy existuje samostatné pojištění
							motorsportu)
						</li>
					</ul>

					<h2 className='mt-5 mb-3'>Jak sjednat povinné ručení?</h2>
					<p>
						Povinné ručení můžete sjednat u kterékoliv pojišťovny, která má
						oprávnění k provozování pojišťovací činnosti v České republice. Při
						výběru pojišťovny je vhodné porovnat:
					</p>
					<ul>
						<li>Výši pojistného (cenu pojištění)</li>
						<li>Rozsah pojistného krytí</li>
						<li>Kvalitu služeb a rychlost vyřizování pojistných událostí</li>
						<li>Dostupnost asistenčních služeb</li>
						<li>Možnosti sjednání online</li>
					</ul>
					<p>
						Pojistné se obvykle platí ročně, ale některé pojišťovny umožňují i
						měsíční nebo čtvrtletní platby.
					</p>

					<h2 className='mt-5 mb-3'>Kontrola povinného ručení</h2>
					<p>Povinnost mít uzavřené povinné ručení kontrolují:</p>
					<ul>
						<li>
							<strong>Policie České republiky</strong> při silničních kontrolách
						</li>
						<li>
							<strong>Celní úřady</strong> při přechodu hranic
						</li>
						<li>
							<strong>Technická kontrola vozidel (STK)</strong> při technické
							prohlídce
						</li>
					</ul>
					<p>
						Provozování vozidla bez platného povinného ručení je přestupkem, za
						který hrozí pokuta až 25 000 Kč a zákaz řízení motorových vozidel až
						na 1 rok.
					</p>

					<h2 className='mt-5 mb-3'>Závěr</h2>
					<p>
						Povinné ručení je nezbytnou součástí provozování motorového vozidla
						v České republice. Chrání nejen vás jako řidiče, ale především
						ostatní účastníky silničního provozu před následky případných nehod.
						Při výběru pojištění je důležité pečlivě prostudovat pojistné
						podmínky a vybrat si pojišťovnu, která vám poskytne kvalitní služby
						za rozumnou cenu.
					</p>
				</article>

				<div
					className='card mt-5 mb-5'
					style={{ backgroundColor: '#f8f9fa', border: '2px solid #c6dbad' }}
				>
					<div className='card-body text-center'>
						<h3 className='card-title mb-3'>
							Sjednejte si povinné ručení ještě dnes
						</h3>
						<p className='card-text mb-4'>
							Porovnejte nabídky od různých pojišťoven a najděte nejvýhodnější
							povinné ručení pro vaše vozidlo.
						</p>
						<a
							href='https://online.pojisteni.cz/?ap=AWYPy1'
							className='btn btn-primary btn-lg'
							target='_blank'
							rel='noopener noreferrer'
						>
							Srovnat a sjednat povinné ručení 🔗
						</a>
					</div>
				</div>
			</div>
			<Footer />
		</>
	)
}

export default PovinneRuceniPage
