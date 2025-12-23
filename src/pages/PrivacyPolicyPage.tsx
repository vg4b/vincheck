import React, { useEffect } from 'react'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'

const PrivacyPolicyPage: React.FC = () => {
	useEffect(() => {
		document.title = 'Ochrana osobních údajů a Cookies | VIN Info.cz'
		const metaDescription = document.querySelector('meta[name="description"]')
		if (metaDescription) {
			metaDescription.setAttribute(
				'content',
				'Informace o zpracování osobních údajů, používání souborů cookies, identita správce, zpracovatelé a vaše práva na webu VIN Info.cz.'
			)
		}
	}, [])

	return (
		<>
			<Navigation />
			<main className='container mt-5'>
				<article className='mb-5'>
					<header>
						<h1 className='mb-4'>Zásady ochrany osobních údajů a Cookies</h1>
					</header>

					<section className='mb-5'>
						<h2 className='h4'>1. Totožnost a kontaktní údaje správce (Identita)</h2>
						<p>
							Správcem vašich osobních údajů je:
						</p>
						<ul className='list-unstyled'>
							<li><strong>Jméno / Firma:</strong> Bc. Václav Gabriel</li>
							<li><strong>IČO:</strong> 88350207</li>
							<li><strong>Sídlo:</strong> Krkoškova 1662/36, 613 00 Brno</li>
							<li><strong>Kontaktní e-mail:</strong> <a href="mailto:vininfo@fixweb.cz">vininfo@fixweb.cz</a></li>
						</ul>
						<p>
							(dále jen „<strong>Správce</strong>“).
						</p>
						<p>
							Jako správce určujeme účely a prostředky zpracování vašich osobních údajů a neseme za ně odpovědnost.
						</p>
					</section>

					<section className='mb-5'>
						<h2 className='h4'>2. Účely zpracování a právní důvody (Tituly)</h2>
						<p>Vaše osobní údaje zpracováváme na základě následujících právních titulů:</p>

						<h3 className='h5 mt-4'>A. Zajištění funkčnosti webu</h3>
						<p>
							Pro základní fungování stránek (zobrazení obsahu, bezpečnost, přenos dat) zpracováváme nezbytné technické údaje.
						</p>
						<ul>
							<li><strong>Právní důvod:</strong> Oprávněný zájem správce (zajištění provozu a bezpečnosti webu) nebo Plnění smlouvy (poskytnutí služby).</li>
						</ul>

						<h3 className='h5 mt-4'>B. Affiliate partneři a vyhodnocování provizí</h3>
						<p>
							Na webu využíváme affiliate odkazy. Pokud na ně kliknete a provedete nákup u partnera, můžeme obdržet provizi. Pro tento účel jsou předávána data jako ID transakce nebo IP adresa.
						</p>
						<ul>
							<li><strong>Právní důvod:</strong> Oprávněný zájem správce (vyhodnocení a získání odměny za zprostředkování).</li>
						</ul>

						<h3 className='h5 mt-4'>C. Analytika a Marketing</h3>
						<p>
							Pro sledování návštěvnosti a zobrazování relevantní reklamy využíváme nástroje třetích stran.
						</p>
						<ul>
							<li><strong>Právní důvod:</strong> <strong>Váš souhlas</strong>. Marketingové a analytické cookies a údaje zpracováváme pouze na základě vašeho uděleného souhlasu (např. prostřednictvím cookie lišty).</li>
						</ul>
					</section>

					<section className='mb-5'>
						<h2 className='h4'>3. Příjemci osobních údajů (Zpracovatelé)</h2>
						<p>
							Vaše údaje předáváme následujícím zpracovatelům a partnerům, kteří nám pomáhají provozovat web a poskytovat služby:
						</p>
						
						<h3 className='h5 mt-3'>Analytika a Reklama</h3>
						<ul>
							<li>
								<strong>Google Ireland Ltd.</strong> (Gordon House, Barrow Street, Dublin 4, Irsko)
								<br />
								<em>Služby:</em> Google Analytics, Google AdSense.
								<br />
								<em>Účel:</em> Analýza návštěvnosti, zobrazování reklamy, remarketing.
							</li>
						</ul>

						<h3 className='h5 mt-3'>Affiliate sítě a partneři</h3>
						<p>Za účelem sledování prokliků a vyhodnocování provizí (affiliate marketing) mohou být data (např. o prokliku) předávána:</p>
						<ul>
							<li>
								<strong>eHub.cz s.r.o.</strong> (poskytovatel affiliate sítě)
								<br />
								<em>Partner:</em> CEBIA, spol. s r.o. (prověřování historie vozidel)
							</li>
							<li>
								<strong>WEDOS Internet, a.s.</strong>
								<br />
								<em>Služby:</em> Srovnání a sjednání pojištění (povinné ručení, havarijní pojištění, cestovní pojištění).
							</li>
						</ul>
					</section>

					<section className='mb-5'>
						<h2 className='h4'>4. Soubory Cookies a jejich kategorizace</h2>
						<p>
							Tento web používá soubory cookies. Níže naleznete rozdělení cookies podle účelu a dobu jejich uložení.
						</p>

						<h3 className='h5 mt-3'>Technické (Nezbytné) cookies</h3>
						<p>Jsou nutné pro správné fungování webu a nelze je vypnout.</p>
						<div className="table-responsive">
							<table className="table table-bordered table-sm">
								<thead>
									<tr>
										<th>Název</th>
										<th>Poskytovatel</th>
										<th>Doba uložení</th>
										<th>Účel</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td>PHPSESSID / JSESSIONID</td>
										<td>Vlastní</td>
										<td>Relace (do zavření prohlížeče)</td>
										<td>Udržení relace uživatele.</td>
									</tr>
									<tr>
										<td>cookie_consent</td>
										<td>Vlastní (CMP)</td>
										<td>6-12 měsíců</td>
										<td>Uložení vašich preferencí ohledně souhlasu s cookies.</td>
									</tr>
								</tbody>
							</table>
						</div>

						<h3 className='h5 mt-3'>Analytické cookies</h3>
						<p>Používáme pouze s vaším souhlasem. Pomáhají nám vylepšovat web.</p>
						<div className="table-responsive">
							<table className="table table-bordered table-sm">
								<thead>
									<tr>
										<th>Název</th>
										<th>Poskytovatel</th>
										<th>Doba uložení</th>
										<th>Účel</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td>_ga</td>
										<td>Google Analytics</td>
										<td>2 roky</td>
										<td>Rozlišení uživatelů.</td>
									</tr>
									<tr>
										<td>_gid</td>
										<td>Google Analytics</td>
										<td>24 hodin</td>
										<td>Rozlišení uživatelů.</td>
									</tr>
									<tr>
										<td>_gat</td>
										<td>Google Analytics</td>
										<td>1 minuta</td>
										<td>Omezení četnosti požadavků.</td>
									</tr>
								</tbody>
							</table>
						</div>

						<h3 className='h5 mt-3'>Marketingové a Affiliate cookies</h3>
						<p>Používáme pouze s vaším souhlasem (pro reklamu) nebo na základě oprávněného zájmu (pro affiliate tracking, kde je to nezbytné pro přiřazení provize, avšak profilování podléhá souhlasu).</p>
						<div className="table-responsive">
							<table className="table table-bordered table-sm">
								<thead>
									<tr>
										<th>Název</th>
										<th>Poskytovatel</th>
										<th>Doba uložení</th>
										<th>Účel</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td>_gcl_au</td>
										<td>Google AdSense</td>
										<td>3 měsíce</td>
										<td>Měření konverzí a účinnosti reklamy.</td>
									</tr>
									<tr>
										<td>IDE / test_cookie</td>
										<td>DoubleClick (Google)</td>
										<td>1 rok / 15 min</td>
										<td>Zobrazování relevantních reklam v síti Google.</td>
									</tr>
									<tr>
										<td>ehub_tracking</td>
										<td>eHub</td>
										<td>30-90 dní</td>
										<td>Sledování prokliku pro přiznání provize partnerovi (Cebia).</td>
									</tr>
								</tbody>
							</table>
						</div>
					</section>

					<section className='mb-5'>
						<h2 className='h4'>5. Vaše práva</h2>
						<p>
							V souvislosti se zpracováním osobních údajů máte následující práva:
						</p>
						<ul>
							<li>Právo na přístup k vašim osobním údajům.</li>
							<li>Právo na opravu nepřesných údajů.</li>
							<li>Právo na výmaz („právo být zapomenut“), pokud pominul důvod zpracování nebo jste odvolali souhlas.</li>
							<li>Právo vznést námitku proti zpracování na základě oprávněného zájmu.</li>
							<li>Právo na přenositelnost údajů.</li>
							<li>Právo podat stížnost u dozorového úřadu (Úřad pro ochranu osobních údajů).</li>
						</ul>
						<p>
							Pro uplatnění těchto práv nás kontaktujte na e-mailu: <a href="mailto:vininfo@fixweb.cz">vininfo@fixweb.cz</a>.
						</p>
					</section>

					<footer className='text-muted mt-5 pt-3 border-top'>
						<small>
							Datum poslední aktualizace: {new Date().toLocaleDateString('cs-CZ')}
						</small>
					</footer>
				</article>
			</main>
			<Footer />
		</>
	)
}

export default PrivacyPolicyPage
