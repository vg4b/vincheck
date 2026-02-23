import React, { useEffect } from 'react'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import { pojisteni, csob } from '../config/affiliateCampaigns'

const HavarijniPojisteniPage: React.FC = () => {
	useEffect(() => {
		document.title =
			'Havarijní pojištění (Kasko) - Kompletní průvodce | VIN Info.cz'

		// Update meta description
		const metaDescription = document.querySelector('meta[name="description"]')
		if (metaDescription) {
			metaDescription.setAttribute(
				'content',
				'Vše o havarijním pojištění vozidel v České republice. Co je kasko, co kryje, jaké jsou typy havarijního pojištění a kdy se vyplatí. Kompletní informace pro majitele vozidel.'
			)
		}
	}, [])

	return (
		<>
			<Navigation />
			<div className='container mt-5'>
				<h1 className='mb-4'>
					Havarijní pojištění (Kasko) - Kompletní průvodce
				</h1>

				<div className='alert alert-info' role='alert'>
					<strong>Důležité:</strong> Havarijní pojištění je dobrovolné pojištění
					vozidla, které chrání váš majetek před škodami způsobenými havárií,
					odcizením, vandalismem nebo živelními událostmi.
				</div>

				<p className='mt-3 mb-4'>
					<strong>Hledáte havarijní pojištění?</strong> Porovnejte nabídky od
					různých pojišťoven a najděte nejvýhodnější havarijní pojištění pro
					vaše vozidlo.{' '}
					<a
						href={pojisteni.getUrl()}
						target='_blank'
						rel='noopener noreferrer'
						className='fw-bold'
					>
						Srovnat a sjednat havarijní pojištění 🔗
					</a>
				</p>

				<article>
					<h2 className='mt-5 mb-3'>Co je havarijní pojištění?</h2>
					<p>
						Havarijní pojištění, často označované jako <strong>kasko</strong>,
						je dobrovolné pojištění vozidla, které kryje škody na vlastním
						vozidle způsobené různými riziky. Na rozdíl od povinného ručení,
						které je zákonem stanovené a chrání třetí osoby, havarijní pojištění
						chrání přímo majetek pojištěného - tedy jeho vozidlo.
					</p>
					<p>
						Toto pojištění není povinné, ale může být velmi užitečné, zejména
						pro majitele novějších nebo hodnotnějších vozidel. V případě nehody,
						odcizení nebo jiné pojistné události vám havarijní pojištění pomůže
						pokrýt náklady na opravu nebo náhradu vozidla.
					</p>

					<h2 className='mt-5 mb-3'>Co havarijní pojištění kryje?</h2>
					<p>
						Rozsah krytí závisí na konkrétní pojistné smlouvě, ale obecně
						havarijní pojištění může kryt následující rizika:
					</p>

					<h3 className='mt-4 mb-3'>1. Havárie a kolize</h3>
					<ul>
						<li>Škody způsobené dopravní nehodou</li>
						<li>Náraz do překážky (strom, sloup, zeď)</li>
						<li>Kolize s jiným vozidlem</li>
						<li>Škody způsobené vlastní chybou řidiče</li>
					</ul>

					<h3 className='mt-4 mb-3'>2. Odcizení vozidla</h3>
					<ul>
						<li>Kradení celého vozidla</li>
						<li>Kradení částí vozidla (kola, nárazníky, světla)</li>
						<li>Pokus o odcizení</li>
					</ul>

					<h3 className='mt-4 mb-3'>3. Vandalismus a úmyslné poškození</h3>
					<ul>
						<li>Poškrábání laku</li>
						<li>Rozbití oken</li>
						<li>Poškození karoserie</li>
						<li>Úmyslné poškození třetí osobou</li>
					</ul>

					<h3 className='mt-4 mb-3'>4. Živelní události</h3>
					<ul>
						<li>Povodně a záplavy</li>
						<li>Krupobití</li>
						<li>Vichřice a tornáda</li>
						<li>Padající stromy nebo větve</li>
						<li>Požár</li>
						<li>Blesk</li>
						<li>Zemětřesení</li>
					</ul>

					<h3 className='mt-4 mb-3'>5. Další rizika</h3>
					<ul>
						<li>Škody způsobené zvěří (srážka se zvěří)</li>
						<li>Pád předmětů na vozidlo</li>
						<li>Škody při přepravě vozidla</li>
					</ul>

					<h2 className='mt-5 mb-3'>Typy havarijního pojištění</h2>

					<h3 className='mt-4 mb-3'>1. Plné havarijní pojištění</h3>
					<p>
						Plné havarijní pojištění kryje nejširší spektrum rizik včetně
						havárií, odcizení, vandalismu a živelních událostí. Toto pojištění
						je nejdražší, ale poskytuje nejkomplexnější ochranu.
					</p>

					<h3 className='mt-4 mb-3'>2. Částečné havarijní pojištění</h3>
					<p>
						Částečné havarijní pojištění kryje pouze některá rizika, obvykle
						odcizení, vandalismus a živelní události, ale ne havárie způsobené
						vlastní chybou řidiče. Toto pojištění je levnější než plné kasko.
					</p>

					<h3 className='mt-4 mb-3'>3. Pojištění proti odcizení</h3>
					<p>
						Nejzákladnější forma havarijního pojištění, která kryje pouze riziko
						odcizení vozidla. Toto pojištění je nejlevnější variantou.
					</p>

					<h2 className='mt-5 mb-3'>Výluky z pojištění</h2>
					<p>Havarijní pojištění obvykle neplatí v následujících případech:</p>
					<ul>
						<li>Vozidlo řídila osoba bez řidičského oprávnění</li>
						<li>Řidič byl pod vlivem alkoholu nebo jiných návykových látek</li>
						<li>Škoda byla způsobena úmyslně pojištěným</li>
						<li>Vozidlo bylo použito k trestné činnosti</li>
						<li>
							Škoda vznikla při účasti na organizovaném motoristickém závodě
							nebo soutěži
						</li>
						<li>Vozidlo bylo provozováno v rozporu s technickými předpisy</li>
						<li>Opotřebení a stárnutí vozidla</li>
						<li>Mechanické závady způsobené nedostatečnou údržbou</li>
					</ul>

					<h2 className='mt-5 mb-3'>Pojistné plnění a spoluúčast</h2>
					<p>Při pojistné události se pojistné plnění vyplácí buď:</p>
					<ul>
						<li>
							<strong>Opravou vozidla</strong> - pojišťovna zaplatí opravu u
							autorizovaného servisu
						</li>
						<li>
							<strong>Finančním plněním</strong> - pojišťovna vyplatí peněžní
							částku odpovídající škodě
						</li>
						<li>
							<strong>Náhradou vozidla</strong> - v případě totální škody nebo
							odcizení
						</li>
					</ul>
					<p>
						Většina pojistných smluv obsahuje
						<strong> spoluúčast</strong> (franchise), což je částka, kterou
						pojištěný hradí z každé pojistné události. Spoluúčast může být:
					</p>
					<ul>
						<li>
							<strong>Pevná</strong> - například 5 000 Kč z každé události
						</li>
						<li>
							<strong>Procentuální</strong> - například 5% z výše škody
						</li>
						<li>
							<strong>Kombinovaná</strong> - kombinace pevné a procentuální
							spoluúčasti
						</li>
					</ul>
					<p>
						Čím vyšší spoluúčast, tím nižší pojistné, ale také vyšší vlastní
						podíl na škodě.
					</p>

					<h2 className='mt-5 mb-3'>Hodnota vozidla a pojistná částka</h2>
					<p>
						Při sjednání havarijního pojištění je důležité správně stanovit
						pojistnou částku, která by měla odpovídat skutečné hodnotě vozidla.
						Existují dva základní způsoby:
					</p>
					<ul>
						<li>
							<strong>Pojištění na skutečnou hodnotu</strong> - pojistná částka
							odpovídá aktuální tržní hodnotě vozidla v době pojistné události.
							Hodnota se každý rok snižuje podle opotřebení.
						</li>
						<li>
							<strong>Pojištění na dohodnutou hodnotu</strong> - pojistná částka
							je dohodnuta při sjednání pojištění a zůstává po celou dobu trvání
							smlouvy stejná. Tento způsob je vhodný pro starší nebo speciální
							vozidla.
						</li>
					</ul>

					<h2 className='mt-5 mb-3'>Doplňková připojištění</h2>
					<p>K havarijnímu pojištění můžete připojištění další služby:</p>
					<ul>
						<li>
							<strong>Asistenční služby</strong> - odtah vozidla, náhradní
							vozidlo, ubytování při poruše na cestě
						</li>
						<li>
							<strong>Pojištění skel</strong> - krytí škod na čelním skle a
							dalších sklech vozidla
						</li>
						<li>
							<strong>Pojištění zavazadel</strong> - krytí škod na zavazadlech
							přepravovaných ve vozidle
						</li>
						<li>
							<strong>Pojištění pneumatik a kol</strong> - krytí škod na
							pneumatikách a kolech
						</li>
						<li>
							<strong>Pojištění řidiče</strong> - úrazové pojištění řidiče při
							nehodě
						</li>
					</ul>

					<h2 className='mt-5 mb-3'>Kdy se havarijní pojištění vyplatí?</h2>
					<p>
						Havarijní pojištění se obvykle vyplatí v následujících případech:
					</p>
					<ul>
						<li>Máte nové nebo novější vozidlo (do 5 let)</li>
						<li>Hodnota vozidla je vyšší než 200 000 Kč</li>
						<li>
							Vozidlo je financováno úvěrem nebo leasingem (často je pojištění
							povinné)
						</li>
						<li>Často jezdíte dlouhé vzdálenosti</li>
						<li>Parkujete vozidlo na veřejných místech</li>
						<li>Chcete mít jistotu v případě nehody nebo odcizení</li>
					</ul>
					<p>Naopak havarijní pojištění se nemusí vyplatit pro:</p>
					<ul>
						<li>Starší vozidla s nízkou hodnotou</li>
						<li>Vozidla používaná pouze občasně</li>
						<li>
							Majitele, kteří mají dostatek finančních prostředků na opravu nebo
							náhradu vozidla
						</li>
					</ul>

					<h2 className='mt-5 mb-3'>Jak sjednat havarijní pojištění?</h2>
					<p>Při sjednání havarijního pojištění je důležité:</p>
					<ul>
						<li>
							<strong>Porovnat nabídky</strong> od různých pojišťoven
						</li>
						<li>
							<strong>Pečlivě prostudovat pojistné podmínky</strong> - zejména
							výluky a rozsah krytí
						</li>
						<li>
							<strong>Správně stanovit pojistnou částku</strong> - odpovídající
							skutečné hodnotě vozidla
						</li>
						<li>
							<strong>Zvolit vhodnou spoluúčast</strong> - vyvážit výši
							pojistného a vlastní podíl na škodě
						</li>
						<li>
							<strong>Zkontrolovat doplňková připojištění</strong> - zda jsou
							potřebná a za rozumnou cenu
						</li>
						<li>
							<strong>Zohlednit slevy</strong> - za bezškodní průběh,
							garážování, bezpečnostní prvky
						</li>
					</ul>

					<h2 className='mt-5 mb-3'>Slevy a bonusy</h2>
					<p>Pojišťovny obvykle poskytují slevy za:</p>
					<ul>
						<li>
							<strong>Bezškodní průběh</strong> - každý rok bez pojistné
							události zvyšuje slevu
						</li>
						<li>
							<strong>Garzážování vozidla</strong> - parkování v garáži snižuje
							riziko odcizení a vandalismu
						</li>
						<li>
							<strong>Bezpečnostní prvky</strong> - imobilizér, alarm, GPS
							lokalizátor
						</li>
						<li>
							<strong>Kombinace pojištění</strong> - sjednání více pojištění u
							jedné pojišťovny
						</li>
						<li>
							<strong>Online sjednání</strong> - sleva za uzavření smlouvy přes
							internet
						</li>
					</ul>

					<h2 className='mt-5 mb-3'>
						Rozdíl mezi povinným ručením a havarijním pojištěním
					</h2>
					<div className='table-responsive'>
						<table className='table table-bordered'>
							<thead>
								<tr>
									<th>Aspekt</th>
									<th>Povinné ručení</th>
									<th>Havarijní pojištění</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td>
										<strong>Povinnost</strong>
									</td>
									<td>Zákonem povinné</td>
									<td>Dobrovolné</td>
								</tr>
								<tr>
									<td>
										<strong>Co chrání</strong>
									</td>
									<td>Třetí osoby (zdraví, život, majetek)</td>
									<td>Vlastní vozidlo pojištěného</td>
								</tr>
								<tr>
									<td>
										<strong>Krytí škod</strong>
									</td>
									<td>Škody způsobené provozem vozidla</td>
									<td>Havárie, odcizení, vandalismus, živelní události</td>
								</tr>
								<tr>
									<td>
										<strong>Cena</strong>
									</td>
									<td>Obvykle nižší</td>
									<td>Obvykle vyšší</td>
								</tr>
								<tr>
									<td>
										<strong>Limity</strong>
									</td>
									<td>Zákonem stanovené minimální limity</td>
									<td>Podle dohodnuté pojistné částky</td>
								</tr>
							</tbody>
						</table>
					</div>

					<h2 className='mt-5 mb-3'>Závěr</h2>
					<p>
						Havarijní pojištění je důležitou ochranou pro majitele vozidel,
						zejména těch novějších nebo hodnotnějších. I když není povinné, může
						vám ušetřit značné finanční prostředky v případě nehody, odcizení
						nebo jiné pojistné události. Při výběru pojištění je důležité
						pečlivě porovnat nabídky různých pojišťoven a vybrat si pojištění,
						které nejlépe odpovídá vašim potřebám a možnostem.
					</p>
				</article>

				<div
					className='card mt-5 mb-5'
					style={{ backgroundColor: '#f8f9fa', border: '2px solid #c6dbad' }}
				>
					<div className='card-body text-center'>
						<h3 className='card-title mb-3'>
							Sjednejte si havarijní pojištění ještě dnes
						</h3>
						<p className='card-text mb-4'>
							Porovnejte nabídky od různých pojišťoven a najděte nejvýhodnější
							havarijní pojištění pro vaše vozidlo.
						</p>
						<a
							href={pojisteni.getUrl()}
							className='btn btn-primary btn-lg'
							target='_blank'
							rel='noopener noreferrer'
						>
							Srovnat a sjednat havarijní pojištění 🔗
						</a>
						{csob.getValidCoupons().some((c) =>
							['sleva_20_auto', 'ccs_karta_1000'].includes(c.id)
						) && (
							<div className='mt-4 pt-4 border-top'>
								<p className='text-muted small mb-2'>
									{csob.shortLabel} – {csob.tagline}
								</p>
								<div className='d-flex flex-wrap gap-2 justify-content-center'>
									{csob
										.getValidCoupons()
										.filter((c) => ['sleva_20_auto', 'ccs_karta_1000'].includes(c.id))
										.map(({ id, shortLabel }) => (
											<a
												key={id}
												href={csob.getCouponUrl(id)}
												target='_blank'
												rel='noopener noreferrer'
												className='btn btn-outline-success btn-sm'
											>
												{shortLabel}
											</a>
										))}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
			<Footer />
		</>
	)
}

export default HavarijniPojisteniPage
