import React from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'

const TermsPage: React.FC = () => {
	return (
		<>
			<Navigation />
			<main className='container mt-5'>
				<h1>Obchodní podmínky</h1>
				<p className='text-muted'>
					Platné od 1. 1. 2026
				</p>

				<section className='mt-4'>
					<h2 className='h4'>1. Úvodní ustanovení</h2>
					<p>
						Tyto obchodní podmínky (dále jen „podmínky") upravují práva a povinnosti
						uživatelů služby VINInfo (dále jen „služba") provozované fyzickou osobou
						Bc. Václav Gabriel, IČO 88350207 (dále jen „provozovatel").
					</p>
					<p>
						Používáním služby uživatel souhlasí s těmito podmínkami a zavazuje se
						je dodržovat.
					</p>
				</section>

				<section className='mt-4'>
					<h2 className='h4'>2. Popis služby</h2>
					<p>
						Služba VINInfo umožňuje uživatelům:
					</p>
					<ul>
						<li>Vyhledávat informace o vozidlech podle VIN, čísla technického průkazu nebo registrační značky</li>
						<li>Ukládat vozidla do osobní sekce „Moje VINInfo"</li>
						<li>Nastavovat upozornění na důležité termíny související s provozem vozidel (STK, pojištění, servis apod.)</li>
						<li>Přijímat emailová upozornění na blížící se termíny</li>
					</ul>
				</section>

				<section className='mt-4'>
					<h2 className='h4'>3. Registrace a uživatelský účet</h2>
					<p>
						Pro využití některých funkcí služby je nutná registrace. Uživatel je
						povinen uvést pravdivé údaje a chránit své přihlašovací údaje před
						zneužitím.
					</p>
					<p>
						Provozovatel si vyhrazuje právo zrušit účet uživatele, který porušuje
						tyto podmínky nebo zneužívá službu.
					</p>
				</section>

				<section className='mt-4'>
					<h2 className='h4'>4. Ochrana osobních údajů</h2>
					<p>
						Provozovatel zpracovává osobní údaje uživatelů v souladu s nařízením
						GDPR (General Data Protection Regulation) a zákonem č. 110/2019 Sb.,
						o zpracování osobních údajů.
					</p>
					<p>
						Zpracovávané údaje zahrnují:
					</p>
					<ul>
						<li>Emailová adresa (pro účely registrace a zasílání upozornění)</li>
						<li>Údaje o uložených vozidlech (VIN, registrační značka)</li>
						<li>Nastavení upozornění a preferencí</li>
					</ul>
					<p>
						Podrobné informace o zpracování osobních údajů naleznete v{' '}
						<Link to='/ochrana-osobnich-udaju'>Zásadách ochrany osobních údajů</Link>.
					</p>
				</section>

				<section className='mt-4'>
					<h2 className='h4'>5. Emailová komunikace</h2>
					<p>
						Uživatel může v nastavení účtu spravovat své preference pro příjem emailů:
					</p>
					<ul>
						<li>
							<strong>Notifikační emaily</strong> – upozornění na blížící se termíny
							STK, pojištění, servisu apod. Tyto emaily jsou součástí služby a lze
							je kdykoliv vypnout v nastavení účtu.
						</li>
						<li>
							<strong>Marketingové emaily</strong> – informace o novinkách, akcích
							a partnerských nabídkách. Zasílání lze kdykoliv odmítnout při
							registraci nebo v nastavení účtu.
						</li>
					</ul>
					<p>
						Každý email obsahuje odkaz pro odhlášení z odběru.
					</p>
				</section>

				<section className='mt-4'>
					<h2 className='h4'>6. Odpovědnost</h2>
					<p>
						Informace poskytované službou jsou pouze orientační. Provozovatel
						nenese odpovědnost za případné škody vzniklé v důsledku spoléhání
						se na tyto informace.
					</p>
					<p>
						Emailová upozornění jsou poskytována jako doplňková funkce bez
						záruky doručení v konkrétním čase nebo vůbec (např. z důvodu
						technických výpadků, omezení poskytovatelů emailu, zařazení do spamu
						nebo chybného nastavení schránky uživatele).
					</p>
					<p>
						Provozovatel nenese odpovědnost za škody způsobené nedoručením nebo
						opožděným doručením emailových upozornění. Uživatel je povinen sledovat
						své zákonné a smluvní termíny samostatně.
					</p>
					<p>
						Uživatel je povinen ověřit si důležité informace u příslušných úřadů
						nebo institucí.
					</p>
				</section>

				<section className='mt-4'>
					<h2 className='h4'>7. Změny podmínek</h2>
					<p>
						Provozovatel si vyhrazuje právo tyto podmínky kdykoliv změnit.
						O změnách bude uživatel informován emailem nebo oznámením ve službě.
					</p>
					<p>
						Pokračováním v používání služby po změně podmínek uživatel vyjadřuje
						souhlas s novým zněním.
					</p>
				</section>

				<section className='mt-4'>
					<h2 className='h4'>8. Kontakt</h2>
					<p>
						V případě dotazů nebo připomínek nás kontaktujte na emailu:{' '}
						<a href='mailto:vininfo@fixweb.cz'>vininfo@fixweb.cz</a>
					</p>
				</section>

				<div className='mt-5 mb-4'>
					<Link to='/' className='btn btn-outline-primary'>
						Zpět na hlavní stránku
					</Link>
				</div>
			</main>
			<Footer />
		</>
	)
}

export default TermsPage
