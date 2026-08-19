import React, { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import {
	FINANCING_COMPANIES,
	FINANCING_KIND_HEADING,
	type FinancingKind
} from '../data/financingCompanies'

const PAGE_TITLE =
	'Seznam sledovaných leasingových společností a autopůjčoven | VIN Info.cz'
const PAGE_DESCRIPTION =
	'Veřejný seznam IČO leasingových, úvěrových a firemních společností a autopůjčoven, které porovnáváme s historií vlastníků vozidla v registru silničních vozidel ČR.'

const KIND_ORDER: FinancingKind[] = ['leasing', 'fleet', 'rental']

/** yyyy-mm-dd → d. m. yyyy */
function fmtDate(iso: string): string {
	const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
	return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}` : iso
}

const KIND_NOTE: Record<FinancingKind, string> = {
	leasing:
		'Financování, kde je společnost zapsána jako vlastník vozidla a řidič jako provozovatel – typicky finanční leasing nebo úvěr se zajištěním.',
	fleet:
		'Operativní leasing a správa vozových parků. Společnost bývá zapsána jako vlastník i provozovatel; jde zpravidla o firemní vozidlo.',
	rental:
		'Autopůjčovny a sdílení vozidel. Započítáváme je pouze tam, kde byla společnost zapsána jako vlastník vozidla.'
}

const FinancingCompaniesPage: React.FC = () => {
	useEffect(() => {
		document.title = PAGE_TITLE
		const metaDescription = document.querySelector('meta[name="description"]')
		if (metaDescription) {
			metaDescription.setAttribute('content', PAGE_DESCRIPTION)
		}
	}, [])

	// Group by kind, alphabetical within each group (the source order is by fleet
	// size, which means nothing to a reader looking up one company).
	const groups = useMemo(
		() =>
			KIND_ORDER.map((kind) => ({
				kind,
				companies: Object.entries(FINANCING_COMPANIES)
					.filter(([, c]) => c.kind === kind)
					.map(([ico, c]) => ({ ico, name: c.name, since: c.since }))
					.sort((a, b) => a.name.localeCompare(b.name, 'cs'))
			})),
		[]
	)

	const total = Object.keys(FINANCING_COMPANIES).length

	return (
		<>
			<Navigation />
			<main className='container mt-5' style={{ maxWidth: 900 }}>
				<header>
					<h1 className='mb-3'>
						Seznam sledovaných leasingových společností a autopůjčoven
					</h1>
					<p className='lead'>
						Tento seznam porovnáváme s historií vlastníků a provozovatelů
						vozidla v registru silničních vozidel ČR. Když se v historii vozidla
						objeví některé z uvedených IČO, upozorníme na to v{' '}
						<Link to='/overeny-vypis-vozidla'>
							certifikátu historie vozidla
						</Link>
						.
					</p>
				</header>

				{/* A plain bordered box, not `.alert`: the site's alert styling paints a
				    masked icon via ::before, and there is no mask for the light variant,
				    so it renders as a solid square. This is explanatory copy anyway. */}
				<div className='p-3 border rounded small'>
					<p className='mb-2'>
						<strong>Jak seznam používáme.</strong> Porovnáváme výhradně{' '}
						<strong>IČO</strong>, nikoli názvy – díky tomu nemůže dojít k záměně
						s autobazarem, dovozcem nebo firmou s podobným jménem. Název
						společnosti uvádíme podle aktuálního zápisu k danému IČO. Pokud
						společnost dříve podnikala v jiném oboru, počítáme jen záznamy od
						data, kdy začala působit v současném oboru – viz sloupec „Záznamy
						sledujeme od“.
					</p>
					<p className='mb-0'>
						<strong>Co seznam neznamená.</strong> Není to přehled zástav ani
						úvěrů. Úvěr ani zástavní právo se do registru vozidel nezapisují, a
						seznam nemusí být úplný – pokud v historii vozidla žádnou z těchto
						společností nenajdeme, neznamená to, že vozidlo není zatížené.
					</p>
				</div>

				<p className='text-muted-ink small'>
					Celkem sledujeme {total} společností. Zaniklé společnosti (v
					likvidaci) v seznamu zůstávají – stále se objevují v historii starších
					vozidel.
				</p>

				{/* The certificate itself states only what the registry records. The
				    interpretation – what an active or historic record means, and what to
				    check before buying – lives here, so the document stays factual. */}
				<section className='mt-5'>
					<h2 className='h5'>Co znamená záznam v historii vozidla</h2>

					<h3 className='h6 mt-4'>
						Společnost je vlastníkem i dnes (aktivní leasing)
					</h3>
					<p>
						Vozidlo je stále zapsané na leasingovou nebo finanční společnost.
						Provozovatelem bývá uživatel vozidla, u operativního leasingu je ale
						často zapsaná jako vlastník i provozovatel táž společnost. Než dojde
						k prodeji, obvykle se leasing doplácí a vlastnictví se převádí – do
						té doby vozidlo prodávajícímu nepatří.
					</p>
					<p className='mb-2'>Na co se před koupí zeptat:</p>
					<ul>
						<li>
							vyčíslení zůstatku a potvrzení o doplacení od leasingové či
							finanční společnosti,
						</li>
						<li>kdy a jak proběhne převod vlastnictví,</li>
						<li>
							u koho je velký technický průkaz (osvědčení o registraci vozidla
							část II).
						</li>
					</ul>
					<p className='text-muted-ink small'>
						Registr nemusí být vždy aktuální – část záznamů o vlastnictví je
						starší než deset let, takže zápis nemusí odpovídat skutečnému stavu
						financování.
					</p>

					<h3 className='h6 mt-4'>
						Společnost je v historii, ale už nevlastní
					</h3>
					<p>
						Vozidlo bylo v minulosti financované nebo šlo o firemní vůz. Samo o
						sobě to není závada – u firemních vozidel a vozidel z operativního
						leasingu bývá naopak pravidelný servis. U vozidel z autopůjčoven a
						sdílení naopak počítejte s vyšším nájezdem a větším počtem řidičů.
					</p>

					<h3 className='h6 mt-4'>V historii jsme nic nenašli</h3>
					<p>
						Znamená to pouze to, že jsme mezi vlastníky a provozovateli
						nenarazili na žádnou ze sledovaných společností.{' '}
						<strong>
							Není to potvrzení, že vozidlo není zatížené úvěrem ani zástavou
						</strong>{' '}
						– úvěr ani zástavní právo se do registru silničních vozidel
						nezapisují a zástavy je potřeba ověřit v Rejstříku zástav Notářské
						komory ČR.
					</p>
				</section>

				{groups.map((group) => (
					<section key={group.kind} className='mt-5'>
						<h2 className='h5'>{FINANCING_KIND_HEADING[group.kind]}</h2>
						<p className='text-muted-ink small'>{KIND_NOTE[group.kind]}</p>
						<div className='table-responsive'>
							<table className='table table-striped table-sm align-middle mb-0'>
								<thead>
									<tr>
										<th scope='col' style={{ width: '8rem' }}>
											IČO
										</th>
										<th scope='col'>Název společnosti</th>
										<th scope='col' style={{ width: '11rem' }}>
											Záznamy sledujeme od
										</th>
									</tr>
								</thead>
								<tbody>
									{group.companies.map((c) => (
										<tr key={c.ico}>
											<th scope='row' className='fw-normal'>
												{/* Our own fleet page for the IČO – every company here has
												    one, and it is the natural next click. */}
												<Link to={`/firma/${c.ico}`}>{c.ico}</Link>
											</th>
											<td>{c.name}</td>
											{/* Where the IČO used to trade as something else, older
											    ownership belongs to that earlier business and is not
											    counted. Shown so the omission is visible, not silent. */}
											<td className='text-muted-ink'>
												{c.since ? fmtDate(c.since) : 'od vzniku'}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				))}

				<section className='mt-5 mb-5'>
					<h2 className='h5'>Chybí v seznamu nějaká společnost?</h2>
					<p>
						Seznam průběžně doplňujeme podle dat z registru silničních vozidel.
						Pokud víte o společnosti, která tu chybí, dejte nám prosím vědět na{' '}
						<Link to='/kontakt'>kontaktní stránce</Link>.
					</p>
				</section>
			</main>
			<Footer />
		</>
	)
}

export default FinancingCompaniesPage
