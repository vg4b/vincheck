import { VehicleData, VehicleDataArray, VehicleDataItem } from '../types'

export type VehicleLookupErrorKind = 'not_found' | 'server_error' | 'unknown'

const defaultLookupMessages: Record<VehicleLookupErrorKind, string> = {
	not_found: 'Vozidlo v českém registru silničních vozidel nebylo nalezeno.',
	server_error: 'Služba registru je dočasně nedostupná. Zkuste to prosím později.',
	unknown: 'Nepodařilo se načíst údaje o vozidle. Zkuste to znovu.'
}

export class VehicleLookupError extends Error {
	readonly kind: VehicleLookupErrorKind

	constructor(kind: VehicleLookupErrorKind, message?: string) {
		super(message ?? defaultLookupMessages[kind])
		this.name = 'VehicleLookupError'
		this.kind = kind
	}

	static isInstance(err: unknown): err is VehicleLookupError {
		return err instanceof VehicleLookupError
	}
}

// Serverless function endpoint
// Always use relative URL so it works on any Vercel deployment (production or preview)
const getProxyApiUrl = (): string => {
	// In browser, always use relative URL - works for production, preview, and localhost
	if (typeof window !== 'undefined') {
		return '/api/vehicle'
	}
	
	// Fallback for SSR or non-browser environments
	return 'https://vincheck-six.vercel.app/api/vehicle'
}

/**
 * České popisky polí z API vehicletechnicaldata (klíče v JSON odpovědi).
 * Sémanticky odpovídají polím ve schématu otevřených dat „výpis vozidel“
 * (lidské názvy sloupců), viz https://download.dataovozidlech.cz/schema/vypisvozidel
 * a docs/DATA_OVOZIDLECH_SCHEMA.md — klíče API vs. titles nejsou 1:1 textově shodné.
 */
const fieldLabels: Record<string, string> = {
	VIN: 'VIN',
	TovarniZnacka: 'Tovární značka',
	Typ: 'Typ',
	ObchodniOznaceni: 'Obchodní označení',
	DatumPrvniRegistrace: 'Datum 1. registrace',
	// Není ve schématu vypisvozidel; provozní údaj z rozšířeného výstupu API
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
	// Additional field labels
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
	// Další pole často shodná se schématem vypisvozidel (klíče podle API)
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
	// Alias / aktuální názvy klíčů z API (vehicletechnicaldata)
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

// Brand logo mapping
export const brandLogos: Record<string, string> = {
	'ALFA-ROMEO': '/logos/alfa-romeo.svg',
	AUDI: '/logos/audi.svg',
	BMW: '/logos/bmw.svg',
	CHEVROLET: '/logos/chevrolet.svg',
	CITROEN: '/logos/citroen.svg',
	CUPRA: '/logos/cupra.svg',
	DACIA: '/logos/dacia.svg',
	FERRARI: '/logos/ferrari.svg',
	FIAT: '/logos/fiat.svg',
	FORD: '/logos/ford.svg',
	HONDA: '/logos/honda.svg',
	HYUNDAI: '/logos/hyundai.svg',
	KIA: '/logos/kia.svg',
	LANCIA: '/logos/lancia.svg',
	'LAND-ROVER': '/logos/land-rover.svg',
	MAZDA: '/logos/mazda.svg',
	'MERCEDES-BENZ': '/logos/mercedes-benz.svg',
	MITSUBISHI: '/logos/mitsubishi.svg',
	OPEN: '/logos/opel.svg',
	PEUGEOT: '/logos/peugeot.svg',
	PORSCHE: '/logos/porsche.svg',
	RENAULT: '/logos/renault.svg',
	SAAB: '/logos/saab.svg',
	SEAT: '/logos/seat.svg',
	SKODA: '/logos/skoda.svg',
	ŠKODA: '/logos/skoda.svg',
	TOYOTA: '/logos/toyota.svg',
	VOLKSWAGEN: '/logos/volkswagen.svg',
	VOLVO: '/logos/volvo.svg',
	VW: '/logos/volkswagen.svg'
}

// Helper function to format field names to human-readable labels
function formatFieldName(fieldName: string): string {
	// If we have a mapping, use it
	if (fieldLabels[fieldName]) {
		return fieldLabels[fieldName]
	}

	// Otherwise, try to format the field name
	// Convert camelCase/PascalCase to readable text
	return fieldName
		.replace(/([A-Z])/g, ' $1') // Add space before capital letters
		.replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
		.trim()
}

// Helper function to transform API response to expected format
export function transformApiResponse(
	apiResponse: VehicleData | VehicleDataArray
): VehicleDataArray {
	// Check if it's already in the expected array format
	if (Array.isArray(apiResponse)) {
		return apiResponse
	}

	// Transform from {Status, Data: {...}} format to array format
	if (apiResponse.Status && apiResponse.Data) {
		const dataArray: VehicleDataItem[] = []
		const data = apiResponse.Data

		// Convert object to array
		for (const [key, value] of Object.entries(data)) {
			// Include all values except null, undefined, and empty strings
			// Note: boolean false should be included
			if (value !== null && value !== undefined && value !== '') {
				dataArray.push({
					name: key,
					value: value,
					label: formatFieldName(key)
				})
			}
		}

		return dataArray
	}

	// If format is unknown, return empty array
	return []
}

// Helper function to get data value by name
export function getDataValue(
	data: VehicleDataArray,
	name: string,
	defaultValue: string = ''
): string {
	const item = data.find((item) => item.name === name)
	return item?.value?.toString() || defaultValue
}

// Optimized logo source getter
export function getLogoSrc(brand: string): string {
	return brandLogos[brand] || '/logos/default_logo.svg'
}

// Helper function to format ISO date string to Czech format (d.m.yyyy)
function formatDate(dateString: string): string | null {
	// Try to parse ISO date format (e.g., "2026-01-02T00:00:00" or "2026-01-02")
	const isoDateRegex = /^(\d{4})-(\d{2})-(\d{2})(T.*)?$/
	const match = dateString.match(isoDateRegex)

	if (match) {
		const year = match[1]
		const month = parseInt(match[2], 10)
		const day = parseInt(match[3], 10)
		return `${day}. ${month}. ${year}`
	}

	return null
}

// Sanitize and format string value for display
export function formatValue(value: string | number | boolean): string {
	// Convert boolean values to Czech
	if (typeof value === 'boolean') {
		return value ? 'Ano' : 'Ne'
	}

	if (typeof value !== 'string') {
		value = String(value)
	}

	// Convert string "true"/"false" to Czech
	if (value.toLowerCase() === 'true') {
		return 'Ano'
	}
	if (value.toLowerCase() === 'false') {
		return 'Ne'
	}
	// API někdy vrací ANO/NE (technický výpis)
	const upper = value.toUpperCase()
	if (upper === 'ANO') return 'Ano'
	if (upper === 'NE') return 'Ne'

	// Format ISO date strings to Czech format (d.m.yyyy)
	const formattedDate = formatDate(value)
	if (formattedDate) {
		return formattedDate
	}

	return value.replace(/\n/g, '<br>')
}

export type FetchVehicleInfoOptions = {
	signal?: AbortSignal
}

// Main function to fetch vehicle info
export async function fetchVehicleInfo(
	vin?: string,
	tp?: string,
	orv?: string,
	options?: FetchVehicleInfoOptions
): Promise<VehicleDataArray> {
	// Get the API URL at runtime
	const apiUrl = getProxyApiUrl()
	// Build proxy URL with query parameters
	let proxyUrl = `${apiUrl}?`
	if (vin) {
		proxyUrl += `vin=${encodeURIComponent(vin)}`
	} else if (tp) {
		proxyUrl += `tp=${encodeURIComponent(tp)}`
	} else if (orv) {
		proxyUrl += `orv=${encodeURIComponent(orv)}`
	} else {
		throw new VehicleLookupError('unknown', 'Je nutné zadat VIN, TP nebo ORV.')
	}

	let response: Response
	try {
		response = await fetch(proxyUrl, {
			cache: 'no-cache',
			mode: 'cors',
			credentials: 'omit',
			signal: options?.signal,
			headers: {
				'Content-Type': 'application/json'
			}
		})
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') {
			throw err
		}
		throw new VehicleLookupError('unknown')
	}

	if (!response.ok) {
		if (response.status === 404) {
			throw new VehicleLookupError('not_found')
		}
		if (response.status >= 500) {
			throw new VehicleLookupError('server_error')
		}
		// 400 = often špatný formát dotazu; 4xx jinak
		if (response.status === 400) {
			throw new VehicleLookupError('not_found')
		}
		throw new VehicleLookupError('unknown')
	}

	let responseData: VehicleData | VehicleDataArray
	try {
		responseData = await response.json()
	} catch {
		throw new VehicleLookupError('unknown')
	}

	const data = transformApiResponse(responseData)

	if (!Array.isArray(data) || data.length === 0) {
		throw new VehicleLookupError('not_found')
	}

	return data
}
