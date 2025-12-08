import React, { useEffect } from 'react'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'

const PrivacyPolicyPage: React.FC = () => {
	useEffect(() => {
		document.title = 'Ochrana osobních údajů a Cookies | VIN Info.cz'
		const metaDescription = document.querySelector('meta[name="description"]')
		if (metaDescription) {
			metaDescription.setAttribute(
				'content',
				'Informace o zpracování osobních údajů, používání souborů cookies a reklamních službách Google AdSense a Google Analytics na webu VIN Info.cz.'
			)
		}
	}, [])

	return (
		<>
			<Navigation />
			<main className='container mt-5'>
				<article className='mb-5'>
					<header>
						<h1 className='mb-4'>Ochrana osobních údajů a používání Cookies</h1>
					</header>

					<section className='mb-4'>
						<h2 className='h4'>1. Úvodní ustanovení</h2>
						<p>
							Provozovatelem webových stránek VIN Info.cz (dále jen
							"Provozovatel") je soukromá osoba. Tento dokument slouží k
							informování návštěvníků o způsobu, jakým jsou shromažďovány,
							používány a chráněny údaje při návštěvě těchto webových stránek.
						</p>
						<p>
							Respektujeme vaše soukromí a zavazujeme se chránit veškeré osobní
							údaje, které nám případně poskytnete, v souladu s Nařízením
							Evropského parlamentu a Rady (EU) 2016/679 (GDPR).
						</p>
					</section>

					<section className='mb-4'>
						<h2 className='h4'>2. Zpracovávané údaje</h2>
						<p>
							Při běžném používání našeho vyhledávacího nástroje (zadání VIN,
							TP, ORV) <strong>neukládáme</strong>
							žádné osobní údaje uživatele. Zadané kódy vozidel (VIN, číslo TP,
							číslo ORV) jsou použity výhradně pro jednorázový dotaz do databáze
							registru vozidel a nejsou spojovány s konkrétní osobou.
						</p>
					</section>

					<section className='mb-4'>
						<h2 className='h4'>3. Soubory Cookies</h2>
						<p>
							Tato webová stránka používá soubory cookies. Cookie je krátký
							textový soubor, který navštívená webová stránka odešle do
							prohlížeče. Umožňuje webu zaznamenat informace o vaší návštěvě,
							například preferovaný jazyk a další nastavení.
						</p>
						<p>Používáme následující typy cookies:</p>
						<ul>
							<li>
								<strong>Technické cookies:</strong> Jsou nezbytné pro správné
								fungování stránek.
							</li>
							<li>
								<strong>Analytické cookies (Google Analytics):</strong> Pomáhají
								nám analyzovat návštěvnost a chování uživatelů na webu.
							</li>
							<li>
								<strong>Reklamní cookies (Google AdSense):</strong> Slouží k
								zobrazování relevantních reklam.
							</li>
						</ul>
					</section>

					<section className='mb-4'>
						<h2 className='h4'>4. Google Analytics</h2>
						<p>
							Tento web využívá službu Google Analytics, poskytovanou
							společností Google, Inc. Služba Google Analytics používá soubory
							cookies, které jsou textovými soubory ukládanými do vašeho
							počítače umožňující analýzu způsobu užívání této stránky jejími
							uživateli.
						</p>
						<p>
							Informace vygenerované souborem cookie o užívání stránky (včetně
							vaší IP adresy) budou společností Google přeneseny a uloženy na
							serverech ve Spojených státech. Google bude užívat těchto
							informací pro účely vyhodnocování užívání stránky a vytváření
							zpráv o její aktivitě.
						</p>
					</section>

					<section className='mb-4'>
						<h2 className='h4'>5. Reklamní systém Google AdSense</h2>
						<p>
							Na těchto stránkách zobrazujeme reklamy poskytované společností
							Google prostřednictvím služby AdSense. Jako dodavatel třetí strany
							používá Google k zobrazování reklam na vašich stránkách soubory
							cookie.
						</p>
						<ul>
							<li>
								Díky souboru cookie <strong>DoubleClick</strong> může společnost
								Google a její partneři zobrazovat uživatelům reklamy na základě
								jejich návštěv na vašich stránkách a dalších stránkách na
								internetu.
							</li>
							<li>
								Uživatelé si mohou používání souboru cookie DoubleClick pro
								zájmově orientovanou reklamu odhlásit v{' '}
								<a
									href='https://adssettings.google.com'
									target='_blank'
									rel='noopener noreferrer'
								>
									Nastavení reklam
								</a>
								.
							</li>
						</ul>
						<p>
							Více informací o tom, jak Google využívá data, když používáte weby
							nebo aplikace partnerů, naleznete na stránce:{' '}
							<a
								href='https://policies.google.com/technologies/partner-sites?hl=cs'
								target='_blank'
								rel='noopener noreferrer'
							>
								Jak Google využívá data
							</a>
							.
						</p>
					</section>

					<section className='mb-4'>
						<h2 className='h4'>6. Správa cookies</h2>
						<p>
							Většina prohlížečů cookies automaticky akceptuje, pokud není
							prohlížeč nastaven jinak. Používání cookies můžete omezit nebo
							zablokovat v nastavení svého webového prohlížeče.
						</p>
						<ul>
							<li>
								<a
									href='https://support.google.com/chrome/answer/95647?hl=cs'
									target='_blank'
									rel='noopener noreferrer'
								>
									Nastavení pro Google Chrome
								</a>
							</li>
							<li>
								<a
									href='https://support.mozilla.org/cs/kb/povoleni-zakazani-cookies'
									target='_blank'
									rel='noopener noreferrer'
								>
									Nastavení pro Mozilla Firefox
								</a>
							</li>
							<li>
								<a
									href='https://support.microsoft.com/cs-cz/help/17442/windows-internet-explorer-delete-manage-cookies'
									target='_blank'
									rel='noopener noreferrer'
								>
									Nastavení pro Internet Explorer / Edge
								</a>
							</li>
						</ul>
					</section>

					<section className='mb-4'>
						<h2 className='h4'>7. Kontakt</h2>
						<p>
							V případě dotazů ohledně ochrany osobních údajů nás můžete
							kontaktovat na emailu: info@vininfo.cz (příklad).
						</p>
					</section>

					<footer className='text-muted mt-5 pt-3 border-top'>
						<small>
							Poslední aktualizace: {new Date().toLocaleDateString('cs-CZ')}
						</small>
					</footer>
				</article>
			</main>
			<Footer />
		</>
	)
}

export default PrivacyPolicyPage
