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

// Shown elsewhere on the certificate (identity / owners / STK) — skip in the
// technical table to avoid duplication.
const ALREADY_SHOWN = new Set<string>([
	'VIN',
	'TovarniZnacka',
	'ObchodniOznaceni',
	'Typ',
	'DatumPrvniRegistrace',
	'StatusNazev',
	'Status',
	'PocetVlastniku',
	'PocetProvozovatelu'
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

export interface TechnicalField {
	label: string
	value: string
}

/**
 * Build the labeled, non-blank technical fields from the registry response Data,
 * skipping the ones already shown elsewhere. Ordered by the label dictionary
 * (logical grouping), with any unmapped extras appended.
 */
export function buildTechnicalFields(
	data: Record<string, unknown>
): TechnicalField[] {
	const out: TechnicalField[] = []
	const seen = new Set<string>()
	const push = (key: string) => {
		if (seen.has(key) || ALREADY_SHOWN.has(key)) return
		const value = data[key]
		if (isBlank(value)) return
		seen.add(key)
		out.push({ label: formatFieldName(key), value: formatValue(value) })
	}
	for (const key of Object.keys(fieldLabels)) push(key)
	for (const key of Object.keys(data)) push(key)
	return out
}
