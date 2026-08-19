/**
 * Curated IČO → leasing / fleet / rental company.
 *
 * Runtime matching is BY IČO ONLY. The registry's `nazev` is deliberately never
 * read (GDPR — an OSVČ's name is personal data, so api/_vehicleCache.ts drops it
 * from every owner row); the name shown to buyers is OUR vetted string from this
 * table. An allowlist also means dealers and importers can never be mislabelled
 * as financing: a new car first registered to Porsche Inter Auto, or a trade-in
 * parked at AURES, simply does not match.
 *
 * Derived from the live cache — regenerate with the query in
 * docs/plans/2026-08-06-001-feat-leasing-check.md and diff against this file.
 *
 * NEVER delete an entry. Many are "v likvidaci"; historic ownership rows still
 * point at dissolved companies, and dropping one silently loses a vehicle's
 * financing history.
 */
export type FinancingKind = 'leasing' | 'fleet' | 'rental'

export type FinancingCompany = {
	name: string
	kind: FinancingKind
	/**
	 * ISO date the IČO started doing THIS business, set only where the company
	 * register shows the entity previously traded as something else. Ownership
	 * that began before it is ignored — it belongs to the earlier business.
	 *
	 * Without this, a permanent identifier makes a false claim about the past:
	 * IČO 25131401 has owned a Škoda 105 since 1999, but it was AUTOSALON LOUDA
	 * (a dealership) until 2013-10-03 and only trades as CAR4WAY — carsharing —
	 * after that date. Labelling the 1999 record "ex-vozidlo z půjčovny" would
	 * be wrong.
	 *
	 * Only set it for a genuine change of BUSINESS. A cosmetic rename inside the
	 * same trade (ALD Automotive → Ayvens, LeasePlan → Drivalia) must not get one,
	 * or we lose true positives. Source: ARES VR extract, `obchodniJmeno` history —
	 * see the refresh-vehicle-cache skill.
	 */
	since?: string
}

export const FINANCING_COMPANIES: Record<string, FinancingCompany> = {
	// --- Finance lease / auto credit: the lessor is registered as the OWNER,
	// the driver as the provozovatel. This is the kind that blocks a sale. ---
	'45805369': { name: 'ŠkoFIN s.r.o.', kind: 'leasing' },
	'63998980': { name: 'ČSOB Leasing, a.s.', kind: 'leasing' },
	'15886492': { name: 'UniCredit Leasing CZ, a.s.', kind: 'leasing' },
	'60112743': { name: 'MONETA Auto, s.r.o.', kind: 'leasing' },
	'27089444': { name: 'Leasing České spořitelny, a.s.', kind: 'leasing' },
	'26764652': { name: 'ESSOX s.r.o.', kind: 'leasing' },
	'63997240': {
		name: 'Mercedes-Benz Financial Services Česká republika s.r.o.',
		kind: 'leasing'
	},
	'60751606': { name: 'MONETA Leasing, s.r.o.', kind: 'leasing' },
	'25139886': { name: 'Credium, a.s., v likvidaci', kind: 'leasing' },
	'65413261': {
		name: 'Toyota Financial Services Czech s.r.o.',
		kind: 'leasing'
	},
	'25103768': { name: 'CASPER Consumer Finance a.s.', kind: 'leasing' },
	'25722328': { name: 'RCI Financial Services, s.r.o.', kind: 'leasing' },
	'61467863': { name: 'Raiffeisen - Leasing, s.r.o.', kind: 'leasing' },
	'25615564': { name: 'FCE Credit, s.r.o., v likvidaci', kind: 'leasing' },
	'26978636': { name: 'Home Credit a.s.', kind: 'leasing' },
	'61061344': {
		name: 'SG Equipment Finance Czech Republic s.r.o.',
		kind: 'leasing'
	},
	'25205552': { name: 'UNILEASING a.s.', kind: 'leasing' },
	'62912691': {
		name: 'SPEED LEASE a.s.',
		kind: 'leasing',
		since: '2003-08-13' /* dříve Charouz Rent Car s.r.o. – půjčovna */
	},
	'26737442': { name: 'PSA FINANCE ČESKÁ REPUBLIKA, s.r.o.', kind: 'leasing' },
	'6208991': { name: 'SAFE Lease s.r.o.', kind: 'leasing' },
	'49241150': {
		name: 'GE Money Multiservis, s.r.o. v likvidaci',
		kind: 'leasing'
	},
	'63999579': { name: 'DINESIA a.s., v likvidaci', kind: 'leasing' },
	'25657496': {
		name: 'TRATON Financial Services Czech Republic s.r.o.',
		kind: 'leasing'
	},
	'16325460': { name: 'Erste Leasing, a.s.', kind: 'leasing' },
	'48909238': { name: 'D.S. Leasing, a.s.', kind: 'leasing' },
	'27179907': { name: 'COFIDIS a.s.', kind: 'leasing' },
	'27116867': {
		name: 'VFS Financial Services Czech Republic s.r.o.',
		kind: 'leasing'
	},
	'25634208': { name: 'GMAC, s.r.o., v likvidaci', kind: 'leasing' },
	'47285214': { name: 'Autoleasing Litoměřice spol. s r.o.', kind: 'leasing' },
	'27091325': { name: 'Oberbank Leasing spol. s r.o.', kind: 'leasing' },
	'65006658': { name: 'IMPULS-Leasing-AUSTRIA s.r.o.', kind: 'leasing' },
	'60851252': { name: 'AGRO LEASING J.Hradec s.r.o.', kind: 'leasing' },
	'2315980': { name: 'PACCAR Financial CZ s.r.o.', kind: 'leasing' },
	// Found by the 2026-08 refresh; the entity only started registering vehicles
	// on 2026-03-25. Owner on all 362 rows and operator on none — the finance-lease
	// signature — and the captive-finance sibling of Mercedes-Benz Financial
	// Services and TRATON, both already listed. (ARES lists no 77110/64910 for it
	// yet, which is why the owner/operator split decides here, not the NACE code.)
	'21538735': {
		name: 'Daimler Truck Financial Services Česká republika s.r.o.',
		kind: 'leasing'
	},
	'8112312': {
		name: 'BMW Financial Services Czech Republic s.r.o.',
		kind: 'leasing'
	},
	'25723758': { name: 'Deutsche Leasing ČR, spol. s r.o.', kind: 'leasing' },
	'27677150': {
		name: 'Leasekredit, a.s.',
		kind: 'leasing',
		since: '2022-07-25' /* dříve Pro Resale, a.s. */
	},
	'61057738': { name: 'VLTAVÍN leas, a.s.', kind: 'leasing' },
	'44468105': {
		name: 'Východočeská leasingová, spol. s r.o.',
		kind: 'leasing'
	},
	'26424207': { name: 'Santander Consumer Leasing s.r.o.', kind: 'leasing' },
	'61250015': { name: 'ŠkoLEASE s.r.o.', kind: 'leasing' },
	'28123778': { name: 'CZECH LEASE s.r.o.', kind: 'leasing' },
	'27423425': { name: 'CZECH FINANCE, a.s.', kind: 'leasing' },
	'60196971': { name: 'Servis Leasing a.s.', kind: 'leasing' },
	'25682971': { name: 'FC Leasing, k.s.', kind: 'leasing' },
	'25131991': { name: 'MB Leasing a.s. v likvidaci', kind: 'leasing' },
	'25159909': { name: 'ESSOX LEASING a.s.', kind: 'leasing' },
	'25138936': {
		name: 'Caterpillar Financial Services ČR, s.r.o.',
		kind: 'leasing'
	},
	'44964927': {
		name: 'J-T Leasing, s.r.o.',
		kind: 'leasing',
		since: '2002-10-17' /* dříve Strážnická pila / RIMOS, s.r.o. */
	},
	'7033893': { name: 'Pro LeaseKredit, s.r.o.', kind: 'leasing' },
	'25379658': {
		name: 'RT TORAX Leasing, s.r.o.',
		kind: 'leasing',
		since: '2017-03-14' /* dříve Business Car Assistance s.r.o. */
	},
	'26425556': { name: 'BAWAG Leasing & Fleet s.r.o.', kind: 'leasing' },
	'28345401': { name: 'CAR LEASING s.r.o.', kind: 'leasing' },
	'49240111': { name: 'Invest car leasing a.s. v likvidaci', kind: 'leasing' },
	'27184366': {
		name: 'Car Trade Finance s.r.o.',
		kind: 'leasing',
		since: '2013-12-17' /* dříve KAPITAL SYSTEM s.r.o. */
	},
	'14501210': { name: 'Oberbank Bohemia Leasing s.r.o.', kind: 'leasing' },
	'25644688': { name: 'NOVA-AUTO Leasing, a.s.', kind: 'leasing' },
	'24687332': { name: 'NOVA leasing, a.s. "v likvidaci"', kind: 'leasing' },
	'5929504': { name: 'LeaseMobile s.r.o.', kind: 'leasing' },
	'26231158': { name: 'FlexiLease, s.r.o.', kind: 'leasing' },
	'25191241': { name: 'NL-Leasing s.r.o.', kind: 'leasing' },
	'3621952': { name: 'Focus Lease a.s.', kind: 'leasing' },
	'9184716': { name: 'elva lease s.r.o.', kind: 'leasing' },
	'27949745': { name: 'AutoFinance Consumer s.r.o.', kind: 'leasing' },
	'2225191': { name: 'Ecoflex Leasing s.r.o. v likvidaci', kind: 'leasing' },
	'24820938': { name: 'Evropská leasingová s.r.o.', kind: 'leasing' },
	'25440004': {
		name: 'LEASETREND s.r.o.',
		kind: 'leasing',
		since: '2007-11-28' /* dříve AUTOCENTRUM Liberec, spol. s r.o. */
	},
	'25411781': { name: 'FEDERAL CARS LEASING s.r.o.', kind: 'leasing' },
	'47115432': { name: 'SOGELEASE ČR, a.s.', kind: 'leasing' },
	'25073117': { name: 'CitiLeasing, s.r.o. v likvidaci', kind: 'leasing' },
	'60192372': { name: 'IPB Leasing, a.s.', kind: 'leasing' },
	// Sister entity to IPB Leasing, found by the structure sweep: owner on 2 137
	// rows vs operator on 281 — the financing signature — and NACE 64910
	// (finanční leasing) in the business register.
	'25522248': { name: 'IPB Invest, a.s.', kind: 'leasing' },
	'25117629': { name: 'ING Lease (C.R.), s.r.o.', kind: 'leasing' },
	'27719197': {
		name: 'ADIV Lease s.r.o.',
		kind: 'leasing',
		since: '2013-07-18' /* dříve STAVIVA Praha TEAM s.r.o. */
	},
	'3600238': { name: 'EUROPEAN LEASE a.s.', kind: 'leasing' },
	'62029100': {
		name: 'Global Lease, s.r.o.',
		kind: 'leasing',
		since: '2007-02-27' /* dříve L O B Trutnov, spol. s r.o. */
	},
	'41324536': { name: 'TLC - leasing s.r.o.', kind: 'leasing' },
	'24219380': { name: 'ONB LEASING s.r.o.', kind: 'leasing' },
	'10669914': { name: 'IN LEASE s.r.o.', kind: 'leasing' },
	'49815806': { name: 'MB Leasing ,s.r.o.', kind: 'leasing' },
	'27375307': { name: 'CSI Leasing Services, s.r.o.', kind: 'leasing' },
	'63995859': { name: 'ALIMEX LEASING,s.r.o. v likvidaci', kind: 'leasing' },
	'8280355': { name: '1CAR lease, s.r.o.', kind: 'leasing' },
	'29060494': {
		name: 'TOP LEASE CZ s.r.o.',
		kind: 'leasing',
		since: '2025-02-07' /* dříve TOP CLASS CARS CZ s.r.o. */
	},
	'49241061': { name: 'RELEAS a.s.', kind: 'leasing' },
	'1731041': { name: 'LeaseRent s.r.o.', kind: 'leasing' },
	'869767': { name: 'AL-LEAS, spol. s r.o., v likvidaci', kind: 'leasing' },
	'49712152': { name: 'DLB LEASING ,s.r.o. v likvidaci', kind: 'leasing' },
	'62908308': { name: 'RSJ Leas Praha, spol. s r.o.', kind: 'leasing' },
	'25330098': { name: 'Q-LEASING, s.r.o.', kind: 'leasing' },
	'45315515': { name: 'InterLeasing a.s. v likvidaci', kind: 'leasing' },
	'45794766': { name: 'A.K.Leasing, spol. s r.o.', kind: 'leasing' },
	'62362887': {
		name: 'TROPPAU INVEST LEASING, spol. s r. o.',
		kind: 'leasing'
	},
	'65006402': { name: 'DELTA leasing Co., a.s. v likvidaci', kind: 'leasing' },
	'43004334': { name: 'GRAUMANN Vario leasing, s.r.o.', kind: 'leasing' },
	'27516580': {
		name: 'LEASECAR CZECH s.r.o.',
		kind: 'leasing',
		since: '2011-05-30' /* dříve TL-MOTORSPORT s.r.o. */
	},
	'24159972': {
		name: 'TIR CENTRUM financial services s.r.o.',
		kind: 'leasing'
	},
	'62417541': { name: 'Český Leasing, spol. s r.o.', kind: 'leasing' },
	'418153': { name: 'TECHNOLOGY leasing, a.s. v likvidaci', kind: 'leasing' },
	'15061175': {
		name: 'IB-LEAS, akciová společnost, Hradec Králové "v likvidaci"',
		kind: 'leasing'
	},
	'48537411': {
		name: 'Lomax leasing s.r.o.',
		kind: 'leasing',
		since: '2019-01-04' /* dříve LOMAX PRAHA, spol. s r.o. */
	},
	'48535206': { name: 'STAMAR LEASING s.r.o.', kind: 'leasing' },
	'28518314': { name: 'STARLEASING s.r.o.', kind: 'leasing' },
	'40524396': { name: 'HLS M.A.R.K. Leasing, spol. s r.o.', kind: 'leasing' },
	'16367791': { name: 'DAPOT - leas, spol. s r. o.', kind: 'leasing' },
	'18238530': { name: 'UNILEASING spol. s r.o.', kind: 'leasing' },
	'29250609': {
		name: 'Lease & Go s.r.o.',
		kind: 'leasing',
		since: '2017-05-22' /* dříve M & N Business Learning / LINEPOS INVEST */
	},
	'46963910': { name: 'HANÁ Leasing, a.s. v likvidaci', kind: 'leasing' },
	'1001427670': { name: 'CZECH FINANCE A.S.', kind: 'leasing' },
	'25303538': {
		name: 'AUSTROFIN Leasing spol. s r.o. "v likvidaci"',
		kind: 'leasing'
	},
	'42193575': {
		name: 'B + B, Leasing company, spol. s r.o. ( německy B + B Leasing company GmbH anglicky B + B Leasing company Ltd )',
		kind: 'leasing'
	},
	'46356371': { name: 'SID leasing,a.s.', kind: 'leasing' },

	// --- Operating lease / fleet management: the lessor is typically owner AND
	// operator. Ex-firemní vůz — notable history, not a defect. ---
	'63671069': { name: 'Drivalia Lease Czech Republic s.r.o.', kind: 'fleet' },
	'61063916': { name: 'Ayvens s.r.o.', kind: 'fleet' },
	'26726998': {
		name: 'ARVAL CZ s.r.o.',
		kind: 'fleet',
		since: '2003-04-02' /* dříve Alph-Art, s.r.o. */
	},
	'25071025': { name: 'BUSINESS LEASE  s.r.o.', kind: 'fleet' },
	'62582836': { name: 'UniCredit Fleet Management, s.r.o.', kind: 'fleet' },
	'7567707': { name: 'EF Mobility s.r.o.', kind: 'fleet' },
	'3558461': { name: 'EURO FLEET SERVIS s.r.o.', kind: 'fleet' },
	'49240641': { name: 'ŠkoFIN Fleet Services a.s.', kind: 'fleet' },
	'25322508': {
		name: 'HAVEX Mobility s.r.o.',
		kind: 'fleet',
		since: '2021-09-13' /* dříve GROW / CAR CLUB s.r.o. */
	},
	'28198921': {
		name: 'AUTOBOND MOBILITY s.r.o.',
		kind: 'fleet',
		since: '2020-06-19' /* dříve Marina Nac company s.r.o. */
	},
	'8928088': { name: 'MHC Mobility, odštěpný závod', kind: 'fleet' },
	'24753068': { name: 'FORTIS FLEET s.r.o.', kind: 'fleet' },
	'8805555': { name: 'Mobility Fleet Solutions, s.r.o.', kind: 'fleet' },
	'7584466': { name: 'D - Mobility Czech Republic s.r.o.', kind: 'fleet' },
	'5502713': { name: 'QAPITO Mobility s.r.o.', kind: 'fleet' },
	'4141628': { name: 'Carprolease s.r.o.', kind: 'fleet' },
	'3647307': { name: 'Fleetia Czech s.r.o.', kind: 'fleet' },
	'2085593': { name: 'ERSTE FLEET s.r.o.', kind: 'fleet' },
	'26190851': {
		name: 'CAR FLEET SERVICES s.r.o.',
		kind: 'fleet',
		since: '2017-03-09' /* dříve V.A.K. Agency, spol. s r.o. */
	},
	'6382282': { name: 'Fleet One s.r.o.', kind: 'fleet' },
	'19487363': { name: 'MA Mobility a.s.', kind: 'fleet' },
	'9137394': { name: 'OverLine Fleet s.r.o.', kind: 'fleet' },
	// Car subscription (Direct group). Registered as OPERATOR on ~1.6k vehicles
	// and owner on only ~400 — the name carries no leasing/fleet keyword, which is
	// exactly why the audit query below looks at the owner/operator split too.
	'14404630': { name: 'Birne by Direct s.r.o.', kind: 'fleet' },
	// Found by the same structure sweep; confirmed by NACE 77110 in the business
	// register (pronájem a leasing automobilů). ~4.5k vehicles held currently.
	'25231022': { name: 'JPPE s.r.o.', kind: 'fleet' },

	// --- Rent-a-car / carsharing. Coverage is deliberately partial: past the
	// top operators the registry holds hundreds of 20-80 vehicle autopůjčovny,
	// so copy must say "evidováno u autopůjčovny", never "nebylo z půjčovny".
	// SIXT and Europcar are absent on purpose — neither registers vehicles in
	// CZ under its own name (they franchise); Hertz does. ---
	'25131401': {
		name: 'CAR4WAY a.s.',
		kind: 'rental',
		since:
			'2013-10-03' /* dříve AUTOSALON LOUDA automobilová a.s. – autosalon */
	},
	'45770603': {
		name: 'Avis Autovermietung GmbH - organizační složka',
		kind: 'rental'
	},
	'27963829': { name: 'TOP RENT CAR s.r.o.', kind: 'rental' },
	'29255210': { name: 'SCAN RENT s.r.o.', kind: 'rental' },
	'27232352': { name: 'JÍŠA rent - car s.r.o.', kind: 'rental' },
	'3416313': { name: 'Rent@less s.r.o.', kind: 'rental' },
	'25005901': { name: 'AUTORENT s.r.o.', kind: 'rental' },
	'407615': { name: 'Hertz Autopůjčovna s.r.o.', kind: 'rental' },
	'10953302': { name: 'AUTO KP PLUS RENT s.r.o.', kind: 'rental' },
	'4242998': { name: 'Bizz Car Rental s.r.o.', kind: 'rental' },
	'3572871': { name: 'DH Rentcar s.r.o.', kind: 'rental' },
	'24160504': { name: 'GS RENTAL CAR s.r.o.', kind: 'rental' },
	'27500853': {
		name: 'Rentstyl, s.r.o.',
		kind: 'rental',
		since: '2015-06-09' /* dříve Autostyl CZ Broumov, s.r.o. */
	},
	'24153711': {
		name: 'European Car Rent Praha s.r.o. v likvidaci',
		kind: 'rental'
	},
	'2772833': { name: 'Vans Renting s.r.o.', kind: 'rental' },
	'2860945': { name: 'GENERAL LEASE & RENTAL s.r.o.', kind: 'rental' },
	'5146411': { name: 'Green Motion Rent CZ, s.r.o.', kind: 'rental' },
	'6658881': { name: 'FEMAT Rent s.r.o.', kind: 'rental' },
	'26497255': { name: 'ECORENTAL SOLUTIONS, a.s.', kind: 'rental' },
	'27975860': { name: 'Europa Rent a Car s.r.o.', kind: 'rental' },
	'4316886': { name: 'H-rent s.r.o.', kind: 'rental' },
	'48534684': { name: 'A-RENT CAR,spol. s r.o.', kind: 'rental' },
	'4838483': { name: 'RentLess CZ s.r.o.', kind: 'rental' },
	'26451379': { name: 'ZemanCar, rent a car s.r.o.', kind: 'rental' },
	'5953677': { name: 'RENTCAR Bohemia s.r.o.', kind: 'rental' },
	'60722436': {
		name: 'SPEED RENT, s.r.o.',
		kind: 'rental',
		since: '2008-04-14' /* dříve MULTICREDIT, s.r.o. */
	},
	'17146127': { name: 'IGORentcar s.r.o.', kind: 'rental' },
	'29147743': {
		name: 'FHRent Car s.r.o.',
		kind: 'rental',
		since: '2015-11-12' /* dříve JETHRO TULL s.r.o. */
	},
	'4530951': { name: 'Pegas Rental Services s.r.o.', kind: 'rental' },
	'563463': {
		name: 'UNION RENT A CAR,spol. s r.o. v likvidaci',
		kind: 'rental'
	},
	'563510': { name: 'Czech Auto Rent, spol. s r.o.', kind: 'rental' },
	'4543297': { name: 'SKODRA RENT & TRADE s.r.o.', kind: 'rental' },
	'24144967': { name: 'RENT plus s.r.o.', kind: 'rental' },
	'24728233': { name: 'Interlease & Rent s.r.o. v likvidaci', kind: 'rental' },
	'28613015': {
		name: 'MFC Rent, s.r.o.',
		kind: 'rental',
		since: '2016-12-15' /* dříve MACHOCARS, s.r.o. */
	},
	'26808251': { name: 'GRENT - Žváček s.r.o.', kind: 'rental' },
	'27367169': {
		name: '1 1 Nejlepší autopůjčka s.r.o. v likvidaci',
		kind: 'rental'
	},
	'29365392': { name: 'TATRA LEASE & RENT s.r.o. v likvidaci', kind: 'rental' },
	'6097405': { name: 'MB-Rent-PT s.r.o.', kind: 'rental' },
	'19916370': { name: 'VGR Rent s.r.o.', kind: 'rental' },
	'26696266': { name: 'ASTON RENT s.r.o.', kind: 'rental' },
	'3689557': { name: 'Charterline Fuhrpark rent a car s.r.o.', kind: 'rental' },
	'27622436': {
		name: 'Blue Rent, a.s.',
		kind: 'rental',
		since: '2007-08-08' /* dříve ARKENDALE a.s. */
	},
	'2531968': { name: 'Půjčovna MARENT s. r. o.', kind: 'rental' },
	'29161568': { name: 'invelt - rent s.r.o.', kind: 'rental' },
	'27190161': {
		name: 'VIVA Rent s.r.o.',
		kind: 'rental',
		since: '2010-12-29' /* dříve VIVA Auto s.r.o. */
	},
	'7049455': { name: 're.volt carsharing s.r.o.', kind: 'rental' },
	'3655661': { name: 'CarTec Rent s.r.o.', kind: 'rental' },
	'24837598': { name: 'TOP RENT CZ s.r.o.', kind: 'rental' },
	'17238145': { name: 'VIARENT Česká republika s.r.o.', kind: 'rental' },
	'8035954': { name: 'LG rent s.r.o.', kind: 'rental' },
	'7973004': { name: 'PANDA AUTORENT s.r.o.', kind: 'rental' },
	'48536920': {
		name: 'MINODA-PŮJČOVNA s.r.o.',
		kind: 'rental',
		since: '1996-04-29' /* dříve AGRIMONIA s.r.o. */
	},
	'3394531': { name: 'TEDESCO RENT CAR s.r.o.', kind: 'rental' },
	'3631443': { name: 'V-Rentcar s.r.o.', kind: 'rental' },
	'25277324': {
		name: 'AUTOPŮJČOVNA OLFIN a.s.',
		kind: 'rental',
		since: '2016-03-05' /* dříve HRADUBICKÁ / OLFIN Car Hradubická – prodejce */
	},
	'7672802': { name: 'GreenGo Car Czech s.r.o.', kind: 'rental' },
	'25110799': { name: 'CZECH RENT A CAR s.r.o.', kind: 'rental' },
	'3362906': { name: 'Půjčovna dodávek RENT s.r.o.', kind: 'rental' },
	'24255505': { name: 'Autopůjčovna dodávek s.r.o.', kind: 'rental' },
	'24838951': { name: 'EUROPŮJČOVNA s.r.o.', kind: 'rental' },
	'3038866': { name: 'autopůjčovna-cb s.r.o.', kind: 'rental' },
	'63075067': { name: 'Dvořák, rent a car, s.r.o.', kind: 'rental' },
	'4936949': { name: 'Půjčovna karavanů s.r.o.', kind: 'rental' },
	'18629148': { name: 'Rentex Autopůjčovna s.r.o.', kind: 'rental' },
	'47681217': { name: 'CONTACT - Rent-a-car, spol. s r. o.', kind: 'rental' },
	'15270041': { name: 'NOSTA-HERTZ spol. s r.o.', kind: 'rental' },
	'5185157': { name: 'Prague Car Sharing s.r.o.', kind: 'rental' },
	'554421': { name: 'HERTZ spol. s r.o. v likvidaci', kind: 'rental' },
	'7867778': { name: 'Hertz Rent CZ s.r.o.', kind: 'rental' }
}

/** Section headings for the public list page and the certificate. */
export const FINANCING_KIND_HEADING: Record<FinancingKind, string> = {
	leasing: 'Leasingové a úvěrové společnosti',
	fleet: 'Operativní leasing a správa firemních vozových parků',
	rental: 'Autopůjčovny a sdílení vozidel'
}
