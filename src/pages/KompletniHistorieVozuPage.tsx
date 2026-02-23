import React, { useEffect } from 'react'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import { cebia } from '../config/affiliateCampaigns'

const KompletniHistorieVozuPage: React.FC = () => {
	useEffect(() => {
		document.title =
			'Kompletní historie vozu - Prověření vozidla před koupí | VIN Info.cz'

		// Update meta description
		const metaDescription = document.querySelector('meta[name="description"]')
		if (metaDescription) {
			metaDescription.setAttribute(
				'content',
				'Zjistěte kompletní historii vozidla před koupí. Prověřte nehodovost, servisní historii, počet majitelů, nezaplacené pokuty a další důležité informace o vozidle. Ochraňte se před koupí problematického vozidla.'
			)
		}
	}, [])

	return (
		<>
			<Navigation />
			<main className='container mt-5'>
				<header>
					<h1 className='mb-4'>
						Kompletní historie vozu - Prověření vozidla před koupí
					</h1>
				</header>

				<div className='alert alert-warning' role='alert'>
					<strong>Důležité:</strong> Před koupí ojetého vozidla je nezbytné
					prověřit jeho kompletní historii. Zjistěte všechny důležité informace
					o vozidle, abyste se vyhnuli nepříjemným překvapením.
				</div>

				<article>
					<section className='mt-4 mb-5'>
						<h2 className='mb-3'>Proč je důležité prověřit historii vozu?</h2>
						<p>
							Koupě ojetého vozidla může být riziková, pokud si předem
							neprověříte jeho historii. Kompletní prověření vozidla vám pomůže
							zjistit:
						</p>
						<ul>
							<li>
								<strong>Nehodovost vozidla</strong> - zda vozidlo nebylo
								zapojeno do dopravní nehody
							</li>
							<li>
								<strong>Počet předchozích majitelů</strong> - kolik lidí vozidlo
								vlastnilo
							</li>
							<li>
								<strong>Servisní historie</strong> - jak bylo vozidlo udržováno
								a servisováno
							</li>
							<li>
								<strong>Nezaplacené pokuty a daně</strong> - zda na vozidle
								nevisí nezaplacené závazky
							</li>
							<li>
								<strong>Zastavení vozidla</strong> - zda není vozidlo zastavené
								nebo v exekuci
							</li>
							<li>
								<strong>Kontrola najetých kilometrů</strong> - zda nebyl najetý
								počet kilometrů upravován
							</li>
							<li>
								<strong>Původ vozidla</strong> - odkud vozidlo pochází a zda
								nebylo ukradené
							</li>
						</ul>
					</section>

					<section className='mt-5 mb-5'>
						<h2 className='mb-3'>Co zahrnuje kompletní historie vozu?</h2>

						<h3 className='mt-4 mb-3'>1. Základní informace o vozidle</h3>
						<p>
							Základní údaje o vozidle zahrnují značku, model, rok výroby, typ
							motoru, objem motoru, výkon a další technické parametry. Tyto
							informace můžete zdarma zkontrolovat pomocí{' '}
							<a href='#/'>našeho nástroje pro kontrolu VIN kódu</a>.
						</p>

						<h3 className='mt-4 mb-3'>2. Historie nehod</h3>
						<p>
							Jedna z nejdůležitějších informací při koupi ojetého vozidla je
							historie nehod. Prověření nehodovosti vám pomůže zjistit:
						</p>
						<ul>
							<li>Zda bylo vozidlo zapojeno do dopravní nehody</li>
							<li>Rozsah poškození vozidla</li>
							<li>Typ nehody (čelní, boční, zadní náraz, atd.)</li>
							<li>Datum a místo nehody</li>
							<li>Zda bylo vozidlo po nehodě opraveno</li>
						</ul>
						<p className='mt-3'>
							<strong>Pozor:</strong> Vozidlo po nehodě může mít skryté vady,
							které se projeví až po delší době provozu. Vždy si nechte vozidlo
							prověřit odborníkem, pokud zjistíte, že bylo zapojeno do nehody.
						</p>

						<h3 className='mt-4 mb-3'>
							3. Počet majitelů a historie vlastnictví
						</h3>
						<p>
							Zjištění počtu předchozích majitelů je důležité pro posouzení
							hodnoty vozidla. Obecně platí, že vozidlo s menším počtem majitelů
							má vyšší hodnotu. Historie vlastnictví také může odhalit:
						</p>
						<ul>
							<li>Jak dlouho jednotliví majitelé vozidlo vlastnili</li>
							<li>Zda bylo vozidlo používané jako firemní nebo soukromé</li>
							<li>Zda bylo vozidlo pronajímáno</li>
							<li>Zda bylo vozidlo v leasingu</li>
						</ul>

						<h3 className='mt-4 mb-3'>4. Servisní historie a údržba</h3>
						<p>
							Servisní historie vám poskytne informace o tom, jak bylo vozidlo
							udržováno. Pravidelná údržba je klíčová pro dlouhou životnost
							vozidla. Z servisní historie zjistíte:
						</p>
						<ul>
							<li>Pravidelnost servisních prohlídek</li>
							<li>Výměny oleje a filtrů</li>
							<li>Opravy a výměny součástek</li>
							<li>Reklamace a záruční opravy</li>
							<li>Kontrola najetých kilometrů</li>
						</ul>

						<h3 className='mt-4 mb-3'>5. Nezaplacené pokuty a závazky</h3>
						<p>
							Před koupí vozidla je důležité zjistit, zda na něm nevisí
							nezaplacené pokuty, daně nebo jiné závazky. Tyto závazky se mohou
							převést na nového majitele, pokud nejsou před převodem vozidla
							uhrazeny.
						</p>

						<h3 className='mt-4 mb-3'>6. Zastavení vozidla a exekuce</h3>
						<p>
							Zastavení vozidla znamená, že vozidlo nemůže být převedeno na
							nového majitele, dokud není závazek uhrazen. Před koupí vozidla je
							nezbytné prověřit, zda není vozidlo zastavené nebo v exekuci.
						</p>

						<h3 className='mt-4 mb-3'>7. Kontrola najetých kilometrů</h3>
						<p>
							Upravování najetých kilometrů (tzv. "svinutí tachometru") je
							nelegální a může výrazně ovlivnit hodnotu vozidla. Kompletní
							historie vozu může odhalit nesrovnalosti v najetých kilometrech na
							základě servisních záznamů a kontrol STK.
						</p>
					</section>

					<section className='mt-5 mb-5'>
						<h2 className='mb-3'>Jak prověřit historii vozu?</h2>
						<p>
							Pro kompletní prověření historie vozidla můžete využít následující
							služby:
						</p>

						<div className='card mt-4 mb-4'>
							<div className='card-body'>
								<h3 className='card-title h5'>
									Zdarma: Základní kontrola VIN kódu
								</h3>
								<p className='card-text'>
									Pomocí našeho nástroje můžete zdarma zkontrolovat základní
									informace o vozidle z českého registru vozidel. Zjistíte
									technické údaje, datum první registrace, platnost STK a další
									základní informace.
								</p>
								<a href='#/' className='btn btn-primary'>
									Zkontrolovat VIN kód zdarma
								</a>
							</div>
						</div>

						<div className='card mt-4 mb-4'>
							<div className='card-body'>
								<h3 className='card-title h5'>
									Kompletní historie vozu - placená služba
								</h3>
								<p className='card-text'>
									Pro kompletní prověření historie vozidla včetně nehodovosti,
									počtu majitelů, servisní historie a dalších důležitých
									informací můžete využít specializované služby, jako je{' '}
									<a
										href={cebia.getTextLinkUrl()}
										target='_blank'
										rel='noopener noreferrer'
									>
										Cebia.cz
									</a>
									. Tyto služby poskytují podrobné informace o historii vozidla
									za poplatek.
								</p>
								<a
									href={cebia.getTextLinkUrl()}
									target='_blank'
									rel='noopener noreferrer'
									className='btn btn-outline-primary'
								>
									Zkontrolovat kompletní historii vozu 🔗
								</a>
							</div>
						</div>
					</section>

					<section className='mt-5 mb-5'>
						<h2 className='mb-3'>Kdy prověřit historii vozu?</h2>
						<p>
							Kompletní historii vozu byste měli prověřit vždy před koupí
							ojetého vozidla. Zejména v těchto případech:
						</p>
						<ul>
							<li>
								<strong>Před koupí ojetého vozidla</strong> - vždy prověřte
								historie vozidla před koupí
							</li>
							<li>
								<strong>Při podezření na nehodovost</strong> - pokud máte
								podezření, že vozidlo bylo zapojeno do nehody
							</li>
							<li>
								<strong>Při podezření na upravené kilometry</strong> - pokud se
								vám zdá, že najeté kilometry neodpovídají stavu vozidla
							</li>
							<li>
								<strong>Před převzetím vozidla</strong> - prověřte závazky a
								zastavení vozidla před převodem
							</li>
						</ul>
					</section>

					<section className='mt-5 mb-5'>
						<h2 className='mb-3'>Co dělat po prověření historie vozu?</h2>
						<p>Po prověření historie vozidla byste měli:</p>
						<ol>
							<li>
								<strong>Zhodnotit zjištěné informace</strong> - posuďte, zda
								zjištěné informace odpovídají vašim očekáváním
							</li>
							<li>
								<strong>Konzultovat s odborníkem</strong> - pokud zjistíte
								nějaké problémy, konzultujte je s odborníkem
							</li>
							<li>
								<strong>Vyjednat cenu</strong> - na základě zjištěných informací
								můžete vyjednat cenu vozidla
							</li>
							<li>
								<strong>Provést kontrolu vozidla</strong> - i po prověření
								historie si nechte vozidlo zkontrolovat odborníkem
							</li>
							<li>
								<strong>Uzavřít smlouvu</strong> - až po prověření všech
								informací uzavřete smlouvu o koupi vozidla
							</li>
						</ol>
					</section>

					<section className='mt-5 mb-5'>
						<h2 className='mb-3'>Závěr</h2>
						<p>
							Prověření kompletní historie vozu je nezbytným krokem před koupí
							ojetého vozidla. Pomůže vám vyhnout se nepříjemným překvapením a
							ochrání vás před koupí problematického vozidla. Využijte naše
							zdarma dostupné nástroje pro základní kontrolu VIN kódu a pro
							kompletní prověření historie vozidla využijte specializované
							služby.
						</p>
					</section>
				</article>
			</main>
			<Footer />
		</>
	)
}

export default KompletniHistorieVozuPage
