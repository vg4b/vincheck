/**
 * Czech field labels for the certificate PDF's technical-data section. Mirrors
 * the frontend dictionary in src/utils/vehicleApi.ts (kept in sync by hand — the
 * api/ and src/ projects compile separately, so they can't share the module).
 */

import { formatFuel } from './_fuelLabels'

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
	MotorMaxVykon: 'Max. výkon',
	Palivo: 'Palivo',
	MotorZdvihObjem: 'Zdvihový objem',
	VozidloKaroserieBarva: 'Barva',
	Rozmery: 'Celkové rozměry',
	RozmeryRozvor: 'Rozvor',
	HmotnostiProvozni: 'Provozní hmotnost',
	HmotnostiProvozniDo: 'Maximální provozní hmotnost',
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
	EmiseEHKOSNEHSES: 'Emisní limit',
	EmisniUroven: 'Stupeň plnění emisní úrovně',
	EmiseKSA: 'Emise KSA',
	EmiseCO2: 'Emise CO₂',
	SpecifickaCo2: 'Specifické CO2',
	SpotrebaMetodika: 'Spotřeba předpis',
	SpotrebaNa100Km: 'Spotřeba paliva',
	SpotrebaPriRychlosti: 'Spotřeba při rychlosti',
	SnizeniEmisiNedc: 'Snížení emisí – NEDC',
	SnizeniEmisiWltp: 'Snížení emisí – WLTP',
	VozidloKaroserieMist: 'Počet míst',
	Rozchod: 'Rozchod',
	HmotnostiPripPov: 'Hmotnosti přípustné povolené',
	HmotnostiPripPovN: 'Hmotnosti přípustné povolené nápravy',
	HmotnostiPripPovBrzdenePV: 'Hmotnosti přípustné povolené brzděné přívěs',
	HmotnostiPripPovNebrzdenePV: 'Hmotnosti přípustné povolené nebrzděné přívěs',
	HmotnostiPripPovJS: 'Hmotnosti přípustné povolené jízdní souprava',
	NapravyPocetDruh: 'Nápravy',
	NapravyPneuRafky: 'Kola a pneumatiky',
	HlukStojiciOtacky: 'Vnější hluk (stojící)',
	HlukJizda: 'Za jízdy',
	NejvyssiRychlost: 'Nejvyšší rychlost',
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
	RozmeryLoznaDelka: 'Ložná délka',
	RozmeryLoznaSirka: 'Ložná šířka',
	HmotnostiTestWltp: 'Hmotnosti vozidla při testu WLTP',
	HmotnostUzitecneZatizeniPrumer: 'Průměrná hodnota užitečného zatížení',
	HmotnostiZatizeniSZ: 'Hmotnosti zatížení SZ',
	HmotnostiZatizeniSZTyp: 'Zatížení SZ – typ',
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
	return s
		.split('|')
		.map((p) => p.trim())
		.filter(Boolean)
		.join(', ')
}

/** True when a value carries no real data. Besides empty/slash-only, older
 *  registry records store punctuation placeholders ("." for an unknown make,
 *  "-", ". / .") where newer ones leave the field empty — treat those as blank. */
function isBlank(value: unknown): boolean {
	return value == null || String(value).replace(/[.,;|\-/\s]/g, '') === ''
}

/**
 * Clean a registry `Typ`/`ObchodniOznaceni` value for display as a model name.
 * Mirrors cleanModelName() on the web: drop a leading brand prefix and take the
 * first non-empty "A / B" slash segment ("RENAULT 19 1.8 TSE" → "19 1.8 TSE").
 */
function cleanModel(brand: string, typ: string): string {
	let m = (typ ?? '').trim()
	const b = (brand ?? '').trim()
	if (b && m.toUpperCase().startsWith(b.toUpperCase())) {
		m = m.slice(b.length).trim()
	}
	const segments = m
		.split('/')
		.map((s) => s.trim())
		.filter(Boolean)
	return segments[0] ?? m
}

/**
 * Resolve a clean brand + model for the certificate header. Registry junk
 * placeholders ("." for make on pre-2000 records) are treated as absent; when
 * the make is missing but the type string leads with a plain alphabetic token
 * (e.g. "RENAULT 19 1.8 TSE"), promote that word to the brand so the certificate
 * shows "RENAULT / 19 1.8 TSE" instead of "." / ".".
 */
export function resolveBrandModel(data: Record<string, unknown>): {
	brand: string
	model: string
} {
	const clean = (key: string): string => {
		const v = data[key]
		return v == null || isBlank(v) ? '' : String(v).trim()
	}
	let brand = clean('TovarniZnacka')
	const oznaceni = clean('ObchodniOznaceni')
	const typ = clean('Typ')
	if (!brand) {
		const firstWord = (oznaceni || typ).split(/\s+/)[0] ?? ''
		if (/^[A-Za-zÀ-ž-]{2,}$/.test(firstWord)) brand = firstWord.toUpperCase()
	}
	let model = cleanModel(brand, oznaceni) || cleanModel(brand, typ)
	// Old records sometimes glue a VIN fragment onto the type string
	// ("19 1.8 TSE VF1B53B05") — drop trailing tokens that are a VIN prefix.
	const vin = clean('VIN').toUpperCase()
	if (vin) {
		const words = model.split(/\s+/)
		while (
			words.length > 1 &&
			words[words.length - 1].length >= 4 &&
			vin.startsWith(words[words.length - 1].toUpperCase())
		) {
			words.pop()
		}
		model = words.join(' ')
	}
	return { brand: brand || '—', model: model || '—' }
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
	'CisloTp',
	'CisloOrv',
	'DatumPrvniRegistraceVCr',
	'StatusNazev',
	'Status',
	'Pcv',
	'ZarazeniVozidla',
	'RzDruh',
	'RzZadrzena',
	'VariantaRz',
	'RzVarianta',
	'RzJkVydana',
	'RzKeSkartaci',
	'RzOdevzdano',
	'OrvZadrzeno',
	'OrvKeSkartaci',
	'OrvOdevzdano',
	'RmZaniku',
	'PocetVlastniku',
	'PocetProvozovatelu',
	'PredRegistraciProhlidkaDne',
	'PredSchvalenimProhlidkaDne',
	'EvidencniProhlidkaDne',
	'HistorickeVozidloProhlidkaDne'
])
const DRUH_TYP = new Set<string>([
	'VozidloDruh',
	'VozidloDruh2',
	'Kategorie',
	'CisloTypovehoSchvaleni',
	'HomologaceEs',
	'Varianta',
	'Verze',
	'TypKod',
	'UcelVozidla',
	'VozidloUcel',
	'VozidloAutonomniStupen'
])
const OZNACENI = new Set<string>([
	'ObchodniOznaceni',
	'VozidloVyrobce',
	'RokVyroby'
])
const MOTOR_SPOTREBA = new Set<string>([
	'MotorVyrobce',
	'MotorTyp',
	'MotorMaxVykon',
	'MotorZdvihObjem',
	'Palivo',
	'CisloMotoru',
	'MotorCislo',
	'VozidloElektricke',
	'VozidloHybridni',
	'TridaHybridnihoVozidla',
	'VozidloHybridniTrida',
	'SpotrebaMetodika',
	'SpotrebaNa100Km',
	'SpotrebaPriRychlosti',
	'SpotrebaElMobilWhKmZ',
	'Spotreba',
	'SpotrebaEl',
	'DojezdZrKm',
	'DojezdZR',
	'PomerVykonHmotnost'
])
const EMISE = new Set<string>([
	'EmiseEHKOSNEHSES',
	'EmisniUroven',
	'EmiseKSA',
	'EmiseCO2',
	'SpecifickaCo2',
	'EmiseCO2Specificke',
	'SnizeniEmisiNedc',
	'SnizeniEmisiWltp',
	'EmiseSnizeniNedc',
	'EmiseSnizeniWltp'
])
const KAROSERIE = new Set<string>([
	'VozidloKaroserieBarva',
	'BarvaDoplnkova',
	'VozidloKaroserieBarvaDoplnkova',
	'VozidloKaroserieMist',
	'VozidloKaroserieMistSezeniPozn',
	'VozidloKaroserieMistStaniPozn',
	'VyrobceKaroserie',
	'DruhTyp',
	'KaroserieDruh',
	'VyrobniCisloKaroserie',
	'KaroserieVyrobniCislo',
	'DoplnkovyTextNaTp',
	'AlternativniProvedeni'
])
const ROZMERY_HMOTNOSTI = new Set<string>([
	'Rozmery',
	'RozmeryRozvor',
	'Rozchod',
	'RozmeryDelkaDo',
	'RozmeryVyskaDo',
	'RozmeryLoznaDelka',
	'RozmeryLoznaSirka',
	'HmotnostiProvozni',
	'HmotnostiPripPov',
	'HmotnostiPripPovN',
	'HmotnostiPripPovBrzdenePV',
	'HmotnostiPripPovNebrzdenePV',
	'HmotnostiPripPovJS',
	'HmotnostiVozidlaPriTestuWltp',
	'HmotnostiTestWltp',
	'HmotnostiProvozniDo',
	'HmotnostiZatizeniSz',
	'HmotnostiZatizeniSzTyp',
	'HmotnostiZatizeniSZ',
	'PrumernaHodnotaUzitecnehoZatizeni',
	'HmotnostUzitecneZatizeniPrumer',
	'ObjemCisterny',
	'ZatizeniStrechy',
	'DelkaDo',
	'LoznaDelka',
	'LoznaSirka',
	'VyskaDo'
])
const NAPRAVY = new Set<string>([
	'NapravyPocetDruh',
	'NapravyPneuRafky',
	'VozidloSpojZarizNazev'
])
const HLUK_RYCHLOST = new Set<string>([
	'HlukStojiciOtacky',
	'HlukJizda',
	'NejvyssiRychlost',
	'NejvyssiRychlostOmezeni'
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

// --- Composite-field formatting (mirrors src/utils/vehicleFieldFormat.ts) ------
// Many registry fields pack several sub-values into one string with a `|`/`/`
// separator hierarchy and frequently-empty parts. We parse each into labelled
// segments (Variant 2), dropping empty/placeholder-zero parts POSITIONALLY — the
// label is paired with a fixed index, so dropping a middle part never re-indexes
// the survivors. Falls back to the raw value for shapes that don't match.
// See docs/plans/2026-07-10-001-improve-technical-data-display.md.

export interface FieldSegment {
	/** e.g. "1. náprava", "město", "přípustná" — omitted for unlabelled parts. */
	label?: string
	value: string
}
export interface FormattedComposite {
	segments: FieldSegment[]
	/** Field-level unit appended once after the last segment (e.g. "kg", "g/km"). */
	unit?: string
	/** Render each segment on its own line (long per-axle tyre specs). */
	multiline?: boolean
}

/** 'keep' = 0 is a real value; 'empty' = 0 means "not recorded"; 'electric' =
 *  0 is real only for a BEV (CO₂, zdvihový objem), otherwise a placeholder. */
type ZeroPolicy = 'keep' | 'empty' | 'electric'
type CompositeSpec =
	| {
			kind: 'split'
			sep: string
			parts: { label?: string; unit?: string }[]
			zero: ZeroPolicy
			unit?: string
			/** Render an empty part as "0" instead of dropping it — only where a
			 *  missing count genuinely means zero (e.g. míst k stání). */
			fillZero?: boolean
			/** Strip a leading "- " artifact from each part (e.g. "2/ - 1 PŘEDNÍ"). */
			stripDash?: boolean
	  }
	| {
			kind: 'axles'
			groupSep: string
			zero: ZeroPolicy
			unit?: string
			/** Collapse whitespace around inner `/` (weights "960/ 960" → "960/960").
			 *  Off for tyre specs where the value legitimately contains " / ". */
			tightSlash?: boolean
			/** Render each axle on its own line (long per-axle tyre specs). */
			multiline?: boolean
	  }

const COMPOSITE_FIELDS: Record<string, CompositeSpec> = {
	VozidloKaroserieMist: {
		kind: 'split',
		sep: '/',
		zero: 'keep',
		fillZero: true,
		parts: [{ label: 'celkem' }, { label: 'k sezení' }, { label: 'k stání' }]
	},
	Rozmery: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'mm',
		parts: [{ label: 'délka' }, { label: 'šířka' }, { label: 'výška' }]
	},
	RozmeryRozvor: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'mm',
		parts: [{}]
	},
	HmotnostiProvozni: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'kg',
		parts: [{}]
	},
	MotorZdvihObjem: {
		kind: 'split',
		sep: '/',
		zero: 'electric',
		unit: 'cm³',
		parts: [{}]
	},
	NejvyssiRychlost: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'km/h',
		parts: [{}]
	},
	Rozchod: { kind: 'axles', groupSep: '/', zero: 'empty', unit: 'mm' },
	HmotnostiPripPov: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'kg',
		parts: [{ label: 'přípustná' }, { label: 'povolená' }]
	},
	HmotnostiPripPovBrzdenePV: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'kg',
		parts: [{ label: 'přípustná' }, { label: 'povolená' }]
	},
	HmotnostiPripPovNebrzdenePV: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'kg',
		parts: [{ label: 'přípustná' }, { label: 'povolená' }]
	},
	HmotnostiPripPovJS: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'kg',
		parts: [{ label: 'přípustná' }, { label: 'povolená' }]
	},
	HmotnostiPripPovN: {
		kind: 'axles',
		groupSep: '|',
		zero: 'empty',
		unit: 'kg',
		tightSlash: true
	},
	NapravyPneuRafky: {
		kind: 'axles',
		groupSep: '|',
		zero: 'empty',
		multiline: true
	},
	HmotnostiProvozniDo: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'kg',
		parts: [{}]
	},
	RozmeryLoznaDelka: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'mm',
		parts: [{}]
	},
	RozmeryLoznaSirka: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'mm',
		parts: [{}]
	},
	MotorMaxVykon: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		parts: [{ unit: 'kW' }, { label: 'při', unit: 'min⁻¹' }]
	},
	NapravyPocetDruh: {
		// "2/ - 1 PŘEDNÍ" → počet náprav 2 · poháněná 1 PŘEDNÍ (drop the "- " artifact)
		kind: 'split',
		sep: '/',
		zero: 'keep',
		stripDash: true,
		parts: [{ label: 'počet' }, { label: 'poháněná' }]
	},
	HlukJizda: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		parts: [{ unit: 'dB(A)' }]
	},
	SpotrebaNa100Km: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		unit: 'l/100 km',
		parts: [
			{ label: 'město' },
			{ label: 'mimo město' },
			{ label: 'kombinovaná' }
		]
	},
	SpotrebaPriRychlosti: {
		// Same quantity in two units (g/km and l/100 km) — units, not labels.
		kind: 'split',
		sep: '/',
		zero: 'empty',
		parts: [{ unit: 'g/km' }, { unit: 'l/100 km' }]
	},
	EmiseCO2: {
		kind: 'split',
		sep: '/',
		zero: 'electric',
		unit: 'g/km',
		parts: [
			{ label: 'město' },
			{ label: 'mimo město' },
			{ label: 'kombinovaná' }
		]
	},
	EmiseEHKOSNEHSES: {
		// The ES/EU part itself contains "/" (e.g. "566/2011F"), so the two
		// homologation fields are separated by " / " (spaces), not a bare "/".
		kind: 'split',
		sep: ' / ',
		zero: 'keep',
		parts: [{ label: 'EHK-OSN' }, { label: 'ES/EU' }]
	},
	HlukStojiciOtacky: {
		kind: 'split',
		sep: '/',
		zero: 'empty',
		parts: [
			{ label: 'hluk', unit: 'dB(A)' },
			{ label: 'otáčky', unit: 'min⁻¹' }
		]
	}
}

/** A raw sub-part carrying no data: only punctuation/whitespace. */
function isEmptySubpart(v: string): boolean {
	return v.replace(/[.,;|/\s-]/g, '') === ''
}
/** "0", "0.0", "0 0" — a zero placeholder (before unit). */
function isZeroLike(v: string): boolean {
	return /^0+([.,]0+)?$/.test(v.replace(/\s/g, ''))
}

/**
 * Parse a composite registry field into labelled segments. Returns:
 *  - `null`  → not a composite field (caller uses default formatting)
 *  - `'hide'`→ every part empty after policy (caller drops the field)
 *  - segments→ labelled parts ready to render on either surface.
 */
export function formatCompositeField(
	key: string,
	raw: string,
	opts: { electric: boolean }
): FormattedComposite | 'hide' | null {
	const spec = COMPOSITE_FIELDS[key]
	if (!spec) return null
	const dropZero =
		spec.zero === 'empty' || (spec.zero === 'electric' && !opts.electric)
	const isEmpty = (v: string): boolean =>
		isEmptySubpart(v) || (dropZero && isZeroLike(v.trim()))

	const segments: FieldSegment[] = []
	if (spec.kind === 'split') {
		const raws = String(raw).split(spec.sep)
		let hasReal = false
		spec.parts.forEach((p, i) => {
			let v = (raws[i] ?? '').trim()
			if (spec.stripDash) v = v.replace(/^[-–]\s*/, '').trim()
			if (isEmpty(v)) {
				if (!spec.fillZero) return
				v = '0'
			} else {
				hasReal = true
			}
			segments.push({ label: p.label, value: p.unit ? `${v} ${p.unit}` : v })
		})
		// fillZero fabricates "0" for empty parts; if EVERY part was empty the
		// whole field is meaningless (e.g. seats " /  / ") — drop it entirely so
		// the PDF matches the web, which already hides the blank raw value.
		if (spec.fillZero && !hasReal) return 'hide'
	} else {
		String(raw)
			.split(spec.groupSep)
			.forEach((g, i) => {
				let v = g.trim()
				if (isEmpty(v)) return
				if (spec.tightSlash) v = v.replace(/\s*\/\s*/g, '/')
				segments.push({ label: `${i + 1}. náprava`, value: v })
			})
	}
	if (segments.length === 0) return 'hide'
	return {
		segments,
		unit: spec.unit,
		multiline: spec.kind === 'axles' ? spec.multiline : undefined
	}
}

// Vehicle category (J) — https://cs.wikipedia.org/wiki/Kategorie_vozidel
const CATEGORY_LABELS_MAP: Record<string, string> = {
	M1: 'osobní automobil',
	M2: 'autobus (do 5 t)',
	M3: 'autobus (nad 5 t)',
	N1: 'nákladní (do 3,5 t)',
	N2: 'nákladní (3,5–12 t)',
	N3: 'nákladní (nad 12 t)',
	O1: 'přípojné (do 0,75 t)',
	O2: 'přípojné (0,75–3,5 t)',
	O3: 'přípojné (3,5–10 t)',
	O4: 'přípojné (nad 10 t)',
	T: 'traktor',
	C: 'pásový traktor',
	R: 'přípojné zemědělské',
	S: 'tažené stroje'
}

// Registration-plate type by "Varianta RZ" code range.
const RZ_VARIANT_RANGES: [number, number, string][] = [
	[101, 119, 'běžná (silniční)'],
	[131, 138, 'manipulační'],
	[151, 158, 'zemědělská / pracovní'],
	[161, 178, 'vývozní (převozní)'],
	[201, 219, 'diplomatická'],
	[221, 239, 'diplomatická (omezená)'],
	[241, 259, 'ambasáda – služební personál'],
	[261, 278, 'honorární konzul'],
	[351, 357, 'zkušební'],
	[401, 419, 'historické vozidlo'],
	[501, 519, 'sportovní vozidlo'],
	[581, 599, 'sportovní vozidlo'],
	[602, 602, 'nosič jízdních kol'],
	[701, 719, 'na přání'],
	[801, 819, 'elektromobil']
]

/**
 * Map a coded scalar value ("M1", "101") to "code – human label". Returns null
 * for keys/values without a mapping (caller keeps the raw value).
 */
export function mapCodeValue(key: string, raw: string): string | null {
	const v = raw.trim()
	if (key === 'Palivo') {
		return formatFuel(v)
	}
	if (key === 'Kategorie') {
		const label =
			CATEGORY_LABELS_MAP[v.toUpperCase()] ??
			(/^L\d/i.test(v) ? 'motocykl / moped' : null)
		return label ? `${v} – ${label}` : null
	}
	if (key === 'VariantaRz' || key === 'RzVarianta') {
		const n = Number.parseInt(v, 10)
		if (Number.isNaN(n)) return null
		const hit = RZ_VARIANT_RANGES.find(([lo, hi]) => n >= lo && n <= hi)
		return hit ? `${v} – ${hit[2]}` : null
	}
	return null
}

export interface TechnicalField {
	label: string
	value: string
	/** Present for composite fields — labelled parts (Variant 2). */
	segments?: FieldSegment[]
	unit?: string
	multiline?: boolean
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
	const electric =
		String(data['VozidloElektricke'] ?? '').toUpperCase() === 'ANO'
	for (const [key, value] of Object.entries(data)) {
		if (SUMMARY_FIELDS.has(key)) continue
		const composite = formatCompositeField(key, String(value ?? ''), {
			electric
		})
		if (composite === 'hide') continue
		if (composite) {
			buckets.get(categoryOf(key))?.push({
				label: formatFieldName(key),
				value: formatValue(value),
				segments: composite.segments,
				unit: composite.unit,
				multiline: composite.multiline
			})
			continue
		}
		if (isBlank(value)) continue
		buckets.get(categoryOf(key))?.push({
			label: formatFieldName(key),
			value: mapCodeValue(key, String(value)) ?? formatValue(value)
		})
	}
	return CATEGORY_ORDER.filter((id) => (buckets.get(id)?.length ?? 0) > 0).map(
		(id) => ({ label: CATEGORY_LABELS[id], fields: buckets.get(id) ?? [] })
	)
}
