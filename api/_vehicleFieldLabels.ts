/**
 * Czech field labels for the certificate PDF's technical-data section. Mirrors
 * the frontend dictionary in src/utils/vehicleApi.ts (kept in sync by hand — the
 * api/ and src/ projects compile separately, so they can't share the module).
 */

const fieldLabels: Record<string, string> = {
	VIN: 'VIN',
	TovarniZnacka: 'Tovární značka',
	Typ: 'Typ',
	ObchodniOznaceni: 'Obchodní označení',
	DatumPrvniRegistrace: 'Datum 1. registrace',
	PravidelnaTechnickaProhlidkaDo: 'Pravidelná technická prohlídka do',
	VozidloDruh: 'Druh vozidla',
	VozidloDruh2: 'Druh vozidla 2. ř.',
	Kategorie: 'Kategorie vozidla',
	VozidloVyrobce: 'Výrobce vozidla',
	MotorVyrobce: 'Výrobce motoru',
	MotorTyp: 'Typ motoru',
	MotorMaxVykon: 'Max. výkon [kW] / [min⁻¹]',
	Palivo: 'Palivo',
	MotorZdvihObjem: 'Zdvihový objem [cm³]',
	VozidloKaroserieBarva: 'Barva',
	Rozmery: 'Celková délka/šířka/výška [mm]',
	RozmeryRozvor: 'Rozvor [mm]',
	HmotnostiProvozni: 'Provozní hmotnost',
	CisloTp: 'Číslo TP',
	CisloOrv: 'Číslo ORV',
	StatusNazev: 'Status',
	Status: 'Status',
	PocetVlastniku: 'Počet vlastníků',
	PocetProvozovatelu: 'Počet provozovatelů',
	DatumPrvniRegistraceVCr: 'Datum 1. registrace v ČR',
	CisloTypovehoSchvaleni: 'ZTP',
	HomologaceEs: 'ES/EU',
	Varianta: 'Varianta',
	Verze: 'Verze',
	VozidloElektricke: 'Plně elektrické vozidlo',
	VozidloHybridni: 'Hybridní vozidlo',
	TridaHybridnihoVozidla: 'Třída hybridního vozidla',
	EmiseEHKOSNEHSES: 'Emisní limit [EHKOSN/EHSES]',
	EmisniUroven: 'Stupeň plnění emisní úrovně',
	EmiseKSA: 'Emise KSA',
	EmiseCO2: 'CO2 město /mimo město/kombinované [g.km-1]',
	SpecifickaCo2: 'Specifické CO2',
	SpotrebaMetodika: 'Spotřeba předpis',
	SpotrebaNa100Km: 'Spotřeba město /mimo město/kombinovaná [l.100km⁻¹]',
	SpotrebaPriRychlosti: 'Spotřeba při rychlosti [l.100 km⁻¹]',
	SnizeniEmisiNedc: 'Snížení emisí – NEDC',
	SnizeniEmisiWltp: 'Snížení emisí – WLTP',
	VozidloKaroserieMist: 'Počet míst celkem / k sezení / k stání',
	Rozchod: 'Rozchod [mm]',
	HmotnostiPripPov: 'Hmotnosti přípustné povolené',
	HmotnostiPripPovN: 'Hmotnosti přípustné povolené nápravy',
	HmotnostiPripPovBrzdenePV: 'Hmotnosti přípustné povolené brzděné přívěs',
	HmotnostiPripPovNebrzdenePV: 'Hmotnosti přípustné povolené nebrzděné přívěs',
	HmotnostiPripPovJS: 'Hmotnosti přípustné povolené jízdní souprava',
	NapravyPocetDruh: 'Počet náprav - z toho poháněných',
	NapravyPneuRafky:
		'Kola a pneumatiky na nápravě - rozměry/montáž [N.1; N.2; N.3; N.4]',
	HlukStojiciOtacky: 'Vnější hluk vozidla [dB(A)] - stojícího při ot. [min⁻¹]',
	HlukJizda: 'Za jízdy',
	NejvyssiRychlost: 'Nejvyšší rychlost [km.h⁻¹]',
	DalsiZaznamy: 'Další záznamy',
	OrvZadrzeno: 'ORV zadrženo',
	RzDruh: 'Druh RZ',
	RzZadrzena: 'Registrační značka zadržena',
	ZarazeniVozidla: 'Zařazení vozidla',
	VozidloAutonomniStupen: 'Stupeň autonomity vozidla',
	Pcv: 'PČV',
	RokVyroby: 'Rok výroby',
	CisloMotoru: 'Číslo motoru',
	UcelVozidla: 'Účel vozidla',
	AlternativniProvedeni: 'Alternativní provedení',
	InovativniTechnologie: 'Inovativní technologie',
	TypKod: 'Typ kód',
	BarvaDoplnkova: 'Barva doplňková',
	VyrobceKaroserie: 'Výrobce karoserie',
	DruhTyp: 'Druh (typ)',
	VyrobniCisloKaroserie: 'Výrobní číslo karoserie',
	DoplnkovyTextNaTp: 'Doplňkový text na TP',
	RmZaniku: 'RM zániku',
	VariantaRz: 'Varianta RZ',
	MotorCislo: 'Číslo motoru',
	VozidloHybridniTrida: 'Třída hybridního vozidla',
	EmiseCO2Specificke: 'Specifické CO₂',
	EmiseSnizeniNedc: 'Snížení emisí – NEDC',
	EmiseSnizeniWltp: 'Snížení emisí – WLTP',
	Spotreba: 'Spotřeba paliva (ostatní)',
	SpotrebaEl: 'Spotřeba elektřiny (mobil)',
	DojezdZR: 'Dojezd ZR [km]',
	KaroserieDruh: 'Druh karoserie',
	KaroserieVyrobniCislo: 'Výrobní číslo karoserie',
	VozidloKaroserieBarvaDoplnkova: 'Barva doplňková',
	VozidloKaroserieMistSezeniPozn: 'Poznámka k místům k sezení',
	VozidloKaroserieMistStaniPozn: 'Poznámka k místům ke stání',
	RozmeryDelkaDo: 'Max. délka [mm]',
	RozmeryVyskaDo: 'Max. výška [mm]',
	RozmeryLoznaDelka: 'Ložná délka [mm]',
	RozmeryLoznaSirka: 'Ložná šířka [mm]',
	HmotnostiTestWltp: 'Hmotnosti vozidla při testu WLTP',
	HmotnostUzitecneZatizeniPrumer: 'Průměrná hodnota užitečného zatížení',
	HmotnostiZatizeniSZ: 'Hmotnosti zatížení SZ',
	VozidloSpojZarizNazev: 'Spojovací zařízení – název',
	PomerVykonHmotnost: 'Poměr výkon/hmotnost [kW·kg⁻¹]',
	StupenDokonceni: 'Stupeň dokončení',
	FaktorOdchylkyDe: 'Faktor odchylky DE',
	FaktorVerifikaceVf: 'Faktor verifikace Vf',
	VozidloUcel: 'Účel vozidla',
	OrvKeSkartaci: 'ORV ke skartaci',
	OrvOdevzdano: 'ORV odevzdáno',
	RzVarianta: 'Varianta RZ',
	RzJkVydana: 'RZ JK vydána',
	RzKeSkartaci: 'RZ ke skartaci',
	RzOdevzdano: 'RZ odevzdána',
	PredRegistraciProhlidkaDne: 'Prohlídka před registrací – datum',
	PredSchvalenimProhlidkaDne: 'Prohlídka před schválením – datum',
	EvidencniProhlidkaDne: 'Evidenční prohlídka – datum',
	HistorickeVozidloProhlidkaDne: 'Prohlídka historického vozidla – datum'
}

// Mirrors VEHICLE_INFO_SUMMARY_FIELDS on the web — these show in the header, so
// the web's technical table excludes exactly these (and nothing else).
const SUMMARY_FIELDS = new Set<string>([
	'TovarniZnacka',
	'Typ',
	'DatumPrvniRegistrace',
	'VIN',
	'PravidelnaTechnickaProhlidkaDo'
])

function formatFieldName(key: string): string {
	if (fieldLabels[key]) return fieldLabels[key]
	return key
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, (s) => s.toUpperCase())
		.trim()
}

function formatValue(value: unknown): string {
	const s = String(value)
	if (s.toLowerCase() === 'true') return 'Ano'
	if (s.toLowerCase() === 'false') return 'Ne'
	const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
	if (m) return `${Number(m[3])}. ${Number(m[2])}. ${m[1]}`
	return s.split('|').map((p) => p.trim()).filter(Boolean).join(', ')
}

/** True when a value carries no real data (empty or only slash separators). */
function isBlank(value: unknown): boolean {
	return value == null || String(value).replace(/[/\s]/g, '') === ''
}

// --- Category grouping (mirrors src/utils/vehicleFieldCategories.ts) so the PDF
// technical section matches the on-site detail page section-for-section. -------

const CATEGORY_ORDER = [
	'doklady_evidence',
	'druh_typ_homologace',
	'oznaceni_vyroba',
	'motor_palivo_spotreba',
	'emise',
	'karoserie',
	'rozmery_hmotnosti',
	'napravy_pneu',
	'hluk_rychlost',
	'ostatni'
] as const
type CategoryId = (typeof CATEGORY_ORDER)[number]

const CATEGORY_LABELS: Record<CategoryId, string> = {
	doklady_evidence: 'Doklady a evidence',
	druh_typ_homologace: 'Druh, kategorie a homologace',
	oznaceni_vyroba: 'Obchodní označení a výroba',
	motor_palivo_spotreba: 'Motor, palivo a spotřeba',
	emise: 'Emise a CO₂',
	karoserie: 'Karoserie a barvy',
	rozmery_hmotnosti: 'Rozměry a hmotnosti',
	napravy_pneu: 'Nápravy, kola a pneumatiky',
	hluk_rychlost: 'Hluk a rychlost',
	ostatni: 'Ostatní údaje'
}

const DOKLADY = new Set<string>([
	'CisloTp', 'CisloOrv', 'DatumPrvniRegistraceVCr', 'StatusNazev', 'Status',
	'Pcv', 'ZarazeniVozidla', 'RzDruh', 'RzZadrzena', 'VariantaRz', 'RzVarianta',
	'RzJkVydana', 'RzKeSkartaci', 'RzOdevzdano', 'OrvZadrzeno', 'OrvKeSkartaci',
	'OrvOdevzdano', 'RmZaniku', 'PocetVlastniku', 'PocetProvozovatelu',
	'PredRegistraciProhlidkaDne', 'PredSchvalenimProhlidkaDne',
	'EvidencniProhlidkaDne', 'HistorickeVozidloProhlidkaDne'
])
const DRUH_TYP = new Set<string>([
	'VozidloDruh', 'VozidloDruh2', 'Kategorie', 'CisloTypovehoSchvaleni',
	'HomologaceEs', 'Varianta', 'Verze', 'TypKod', 'UcelVozidla', 'VozidloUcel',
	'VozidloAutonomniStupen'
])
const OZNACENI = new Set<string>(['ObchodniOznaceni', 'VozidloVyrobce', 'RokVyroby'])
const MOTOR_SPOTREBA = new Set<string>([
	'MotorVyrobce', 'MotorTyp', 'MotorMaxVykon', 'MotorZdvihObjem', 'Palivo',
	'CisloMotoru', 'MotorCislo', 'VozidloElektricke', 'VozidloHybridni',
	'TridaHybridnihoVozidla', 'VozidloHybridniTrida', 'SpotrebaMetodika',
	'SpotrebaNa100Km', 'SpotrebaPriRychlosti', 'SpotrebaElMobilWhKmZ', 'Spotreba',
	'SpotrebaEl', 'DojezdZrKm', 'DojezdZR', 'PomerVykonHmotnost'
])
const EMISE = new Set<string>([
	'EmiseEHKOSNEHSES', 'EmisniUroven', 'EmiseKSA', 'EmiseCO2', 'SpecifickaCo2',
	'EmiseCO2Specificke', 'SnizeniEmisiNedc', 'SnizeniEmisiWltp', 'EmiseSnizeniNedc',
	'EmiseSnizeniWltp'
])
const KAROSERIE = new Set<string>([
	'VozidloKaroserieBarva', 'BarvaDoplnkova', 'VozidloKaroserieBarvaDoplnkova',
	'VozidloKaroserieMist', 'VozidloKaroserieMistSezeniPozn',
	'VozidloKaroserieMistStaniPozn', 'VyrobceKaroserie', 'DruhTyp', 'KaroserieDruh',
	'VyrobniCisloKaroserie', 'KaroserieVyrobniCislo', 'DoplnkovyTextNaTp',
	'AlternativniProvedeni'
])
const ROZMERY_HMOTNOSTI = new Set<string>([
	'Rozmery', 'RozmeryRozvor', 'Rozchod', 'RozmeryDelkaDo', 'RozmeryVyskaDo',
	'RozmeryLoznaDelka', 'RozmeryLoznaSirka', 'HmotnostiProvozni', 'HmotnostiPripPov',
	'HmotnostiPripPovN', 'HmotnostiPripPovBrzdenePV', 'HmotnostiPripPovNebrzdenePV',
	'HmotnostiPripPovJS', 'HmotnostiVozidlaPriTestuWltp', 'HmotnostiTestWltp',
	'HmotnostiProvozniDo', 'HmotnostiZatizeniSz', 'HmotnostiZatizeniSzTyp',
	'HmotnostiZatizeniSZ', 'PrumernaHodnotaUzitecnehoZatizeni',
	'HmotnostUzitecneZatizeniPrumer', 'ObjemCisterny', 'ZatizeniStrechy', 'DelkaDo',
	'LoznaDelka', 'LoznaSirka', 'VyskaDo'
])
const NAPRAVY = new Set<string>([
	'NapravyPocetDruh', 'NapravyPneuRafky', 'VozidloSpojZarizNazev'
])
const HLUK_RYCHLOST = new Set<string>([
	'HlukStojiciOtacky', 'HlukJizda', 'NejvyssiRychlost', 'NejvyssiRychlostOmezeni'
])

function categoryOf(key: string): CategoryId {
	if (DOKLADY.has(key)) return 'doklady_evidence'
	if (DRUH_TYP.has(key)) return 'druh_typ_homologace'
	if (OZNACENI.has(key)) return 'oznaceni_vyroba'
	if (MOTOR_SPOTREBA.has(key)) return 'motor_palivo_spotreba'
	if (EMISE.has(key)) return 'emise'
	if (KAROSERIE.has(key)) return 'karoserie'
	if (ROZMERY_HMOTNOSTI.has(key)) return 'rozmery_hmotnosti'
	if (NAPRAVY.has(key)) return 'napravy_pneu'
	if (HLUK_RYCHLOST.has(key)) return 'hluk_rychlost'
	if (key.startsWith('Orv') || key.startsWith('Rz')) return 'doklady_evidence'
	if (key.startsWith('Karoserie') || key.startsWith('VozidloKaroserie'))
		return 'karoserie'
	if (key.startsWith('Rozmery') || key.startsWith('Hmotnosti'))
		return 'rozmery_hmotnosti'
	if (key.startsWith('Pred') && key.includes('Prohlidka'))
		return 'doklady_evidence'
	if (key.startsWith('Emise') || key.startsWith('Emisni')) return 'emise'
	if (
		key.startsWith('Motor') ||
		key.startsWith('Spotreba') ||
		key === 'Palivo' ||
		key === 'DojezdZR' ||
		key === 'DojezdZrKm'
	)
		return 'motor_palivo_spotreba'
	return 'ostatni'
}

export interface TechnicalField {
	label: string
	value: string
}
export interface TechnicalGroup {
	label: string
	fields: TechnicalField[]
}

/**
 * Group the registry Data into the same labeled sections shown on the detail
 * page, in the same order, excluding the header summary fields and blanks.
 */
export function buildTechnicalGroups(
	data: Record<string, unknown>
): TechnicalGroup[] {
	const buckets = new Map<CategoryId, TechnicalField[]>()
	for (const id of CATEGORY_ORDER) buckets.set(id, [])
	for (const [key, value] of Object.entries(data)) {
		if (SUMMARY_FIELDS.has(key) || isBlank(value)) continue
		buckets.get(categoryOf(key))?.push({
			label: formatFieldName(key),
			value: formatValue(value)
		})
	}
	return CATEGORY_ORDER.filter((id) => (buckets.get(id)?.length ?? 0) > 0).map(
		(id) => ({ label: CATEGORY_LABELS[id], fields: buckets.get(id) ?? [] })
	)
}
