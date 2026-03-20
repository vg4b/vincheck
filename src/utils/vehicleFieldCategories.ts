import type { VehicleDataItem } from '../types'

/** Pořadí sekcí ve výpisu (shodné s logikou TP / výpisu vozidla). */
export type VehicleFieldCategoryId =
	| 'doklady_evidence'
	| 'druh_typ_homologace'
	| 'oznaceni_vyroba'
	| 'motor_palivo_spotreba'
	| 'emise'
	| 'karoserie'
	| 'rozmery_hmotnosti'
	| 'napravy_pneu'
	| 'hluk_rychlost'
	| 'ostatni'

export const VEHICLE_FIELD_CATEGORY_ORDER: VehicleFieldCategoryId[] = [
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
]

export const VEHICLE_FIELD_CATEGORY_LABELS: Record<VehicleFieldCategoryId, string> =
	{
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

const OZNACENI = new Set<string>(['ObchodniOznaceni', 'VozidloVyrobce', 'RokVyroby'])

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

export function getVehicleFieldCategory(fieldName: string): VehicleFieldCategoryId {
	if (DOKLADY.has(fieldName)) return 'doklady_evidence'
	if (DRUH_TYP.has(fieldName)) return 'druh_typ_homologace'
	if (OZNACENI.has(fieldName)) return 'oznaceni_vyroba'
	if (MOTOR_SPOTREBA.has(fieldName)) return 'motor_palivo_spotreba'
	if (EMISE.has(fieldName)) return 'emise'
	if (KAROSERIE.has(fieldName)) return 'karoserie'
	if (ROZMERY_HMOTNOSTI.has(fieldName)) return 'rozmery_hmotnosti'
	if (NAPRAVY.has(fieldName)) return 'napravy_pneu'
	if (HLUK_RYCHLOST.has(fieldName)) return 'hluk_rychlost'

	if (fieldName.startsWith('Orv')) return 'doklady_evidence'
	if (fieldName.startsWith('Rz')) return 'doklady_evidence'
	if (fieldName.startsWith('Karoserie')) return 'karoserie'
	if (fieldName.startsWith('VozidloKaroserie')) return 'karoserie'
	if (fieldName.startsWith('Rozmery')) return 'rozmery_hmotnosti'
	if (fieldName.startsWith('Pred') && fieldName.includes('Prohlidka'))
		return 'doklady_evidence'
	if (
		fieldName === 'EvidencniProhlidkaDne' ||
		fieldName === 'HistorickeVozidloProhlidkaDne'
	)
		return 'doklady_evidence'

	if (fieldName.startsWith('Hmotnosti')) return 'rozmery_hmotnosti'
	if (fieldName.startsWith('Emise') || fieldName.startsWith('Emisni'))
		return 'emise'
	if (
		fieldName.startsWith('Motor') ||
		fieldName.startsWith('Spotreba') ||
		fieldName === 'Palivo' ||
		fieldName === 'DojezdZR' ||
		fieldName === 'DojezdZrKm'
	)
		return 'motor_palivo_spotreba'

	return 'ostatni'
}

/** Pořadí řádků v sekci Doklady a evidence (ostaní pole v této sekci až za ním). */
const DOKLADY_ROW_ORDER: string[] = [
	'CisloTp',
	'CisloOrv',
	'DatumPrvniRegistraceVCr',
	'ZarazeniVozidla',
	'StatusNazev',
	'Status',
	'Pcv',
	'RzDruh',
	'RzZadrzena',
	'RzVarianta',
	'VariantaRz',
	'RzJkVydana',
	'RzKeSkartaci',
	'RzOdevzdano',
	'OrvZadrzeno',
	'OrvKeSkartaci',
	'OrvOdevzdano',
	'PocetVlastniku',
	'PocetProvozovatelu',
	'PredRegistraciProhlidkaDne',
	'PredSchvalenimProhlidkaDne',
	'EvidencniProhlidkaDne',
	'HistorickeVozidloProhlidkaDne',
	'RmZaniku'
]

function sortDokladyItems(items: VehicleDataItem[]): VehicleDataItem[] {
	const rank = (name: string) => {
		const i = DOKLADY_ROW_ORDER.indexOf(name)
		return i === -1 ? DOKLADY_ROW_ORDER.length : i
	}
	return [...items].sort(
		(a, b) => rank(a.name) - rank(b.name) || a.label.localeCompare(b.label, 'cs')
	)
}

export type GroupedVehicleFields = {
	categoryId: VehicleFieldCategoryId
	label: string
	items: VehicleDataItem[]
}[]

/** Seskupí položky podle kategorie a zachová pořadí kategorií. */
export function groupVehicleFieldsByCategory(
	items: VehicleDataItem[]
): GroupedVehicleFields {
	const buckets = new Map<VehicleFieldCategoryId, VehicleDataItem[]>()
	for (const id of VEHICLE_FIELD_CATEGORY_ORDER) {
		buckets.set(id, [])
	}
	for (const item of items) {
		const cat = getVehicleFieldCategory(item.name)
		buckets.get(cat)!.push(item)
	}
	return VEHICLE_FIELD_CATEGORY_ORDER.filter(
		(id) => (buckets.get(id)?.length ?? 0) > 0
	).map((categoryId) => {
		const raw = buckets.get(categoryId)!
		const items =
			categoryId === 'doklady_evidence' ? sortDokladyItems(raw) : raw
		return {
			categoryId,
			label: VEHICLE_FIELD_CATEGORY_LABELS[categoryId],
			items
		}
	})
}
