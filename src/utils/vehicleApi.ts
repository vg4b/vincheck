import { VehicleData, VehicleDataArray, VehicleDataItem } from '../types'

// Serverless function endpoint
// Always use Vercel endpoint since GitHub Pages doesn't support serverless functions
const getProxyApiUrl = (): string => {
	// Use production Vercel URL (update this with your actual production domain)
	// For production: use your Vercel production domain
	// For development: use localhost or preview URL
	if (process.env.NODE_ENV === 'production') {
		// Update this to your actual Vercel production domain
		// You can find it in Vercel Dashboard → Settings → Domains
		return 'https://vincheck-six.vercel.app/api/vehicle'
	}
	
	// For development, try to use the same origin if possible
	if (typeof window !== 'undefined') {
		const origin = window.location.origin
		// If running on Vercel preview, use the current origin
		if (origin.includes('vercel.app') || origin.includes('vininfo.cz')) {
			return `${origin}/api/vehicle`
		}
	}
	
	// Fallback to production URL
	return 'https://vincheck-six.vercel.app/api/vehicle'
}

// Field name to label mapping (Czech labels)
const fieldLabels: Record<string, string> = {
	VIN: 'VIN',
	TovarniZnacka: 'Tovární značka',
	Typ: 'Typ',
	ObchodniOznaceni: 'Obchodní označení',
	DatumPrvniRegistrace: 'Datum první registrace',
	PravidelnaTechnickaProhlidkaDo: 'Pravidelná technická prohlídka do',
	VozidloDruh: 'Druh vozidla',
	VozidloDruh2: 'Druh vozidla 2',
	Kategorie: 'Kategorie',
	VozidloVyrobce: 'Výrobce vozidla',
	MotorVyrobce: 'Výrobce motoru',
	MotorTyp: 'Typ motoru',
	MotorMaxVykon: 'Maximální výkon motoru',
	Palivo: 'Palivo',
	MotorZdvihObjem: 'Objem motoru',
	VozidloKaroserieBarva: 'Barva karoserie',
	Rozmery: 'Rozměry',
	RozmeryRozvor: 'Rozvor',
	HmotnostiProvozni: 'Provozní hmotnost',
	CisloTp: 'Číslo TP',
	CisloOrv: 'Číslo ORV',
	StatusNazev: 'Status',
	PocetVlastniku: 'Počet vlastníků',
	PocetProvozovatelu: 'Počet provozovatelů',
	// Additional field labels
	DatumPrvniRegistraceVCr: 'Datum první registrace v ČR',
	CisloTypovehoSchvaleni: 'Číslo typového schválení',
	HomologaceEs: 'Homologace ES',
	Varianta: 'Varianta',
	Verze: 'Verze',
	VozidloElektricke: 'Vozidlo elektrické',
	VozidloHybridni: 'Vozidlo hybridní',
	EmiseEHKOSNEHSES: 'Emise EHK/OSNEHSES',
	EmisniUroven: 'Emisní úroveň',
	EmiseKSA: 'Emise KSA',
	EmiseCO2: 'Emise CO₂',
	SpotrebaMetodika: 'Spotřeba metodika',
	SpotrebaNa100Km: 'Spotřeba na 100 km',
	VozidloKaroserieMist: 'Počet míst v karoserii',
	Rozchod: 'Rozchod',
	HmotnostiPripPov: 'Hmotnosti přípustné povolené',
	HmotnostiPripPovN: 'Hmotnosti přípustné povolené nápravy',
	HmotnostiPripPovBrzdenePV: 'Hmotnosti přípustné povolené brzděné přívěs',
	HmotnostiPripPovNebrzdenePV: 'Hmotnosti přípustné povolené nebrzděné přívěs',
	HmotnostiPripPovJS: 'Hmotnosti přípustné povolené jízdní souprava',
	NapravyPocetDruh: 'Nápravy počet a druh',
	NapravyPneuRafky: 'Nápravy pneumatiky a ráfky',
	HlukStojiciOtacky: 'Hluk stojící (otáčky)',
	HlukJizda: 'Hluk jízda',
	NejvyssiRychlost: 'Nejvyšší rychlost',
	DalsiZaznamy: 'Další záznamy',
	OrvZadrzeno: 'ORV zadrženo',
	RzDruh: 'Druh registrační značky',
	RzZadrzena: 'Registrační značka zadržena',
	ZarazeniVozidla: 'Zařazení vozidla',
	VozidloAutonomniStupen: 'Autonomní stupeň vozidla'
}

// Brand logo mapping
export const brandLogos: Record<string, string> = {
	'ALFA-ROMEO': 'logos/alfa-romeo.svg',
	AUDI: 'logos/audi.svg',
	BMW: 'logos/bmw.svg',
	CHEVROLET: 'logos/chevrolet.svg',
	CITROEN: 'logos/citroen.svg',
	CUPRA: 'logos/cupra.svg',
	DACIA: 'logos/dacia.svg',
	FERRARI: 'logos/ferrari.svg',
	FIAT: 'logos/fiat.svg',
	FORD: 'logos/ford.svg',
	HONDA: 'logos/honda.svg',
	HYUNDAI: 'logos/hyundai.svg',
	KIA: 'logos/kia.svg',
	LANCIA: 'logos/lancia.svg',
	'LAND-ROVER': 'logos/land-rover.svg',
	MAZDA: 'logos/mazda.svg',
	'MERCEDES-BENZ': 'logos/mercedes-benz.svg',
	MITSUBISHI: 'logos/mitsubishi.svg',
	OPEN: 'logos/opel.svg',
	PEUGEOT: 'logos/peugeot.svg',
	PORSCHE: 'logos/porsche.svg',
	RENAULT: 'logos/renault.svg',
	SAAB: 'logos/saab.svg',
	SEAT: 'logos/seat.svg',
	SKODA: 'logos/skoda.svg',
	ŠKODA: 'logos/skoda.svg',
	TOYOTA: 'logos/toyota.svg',
	VOLKSWAGEN: 'logos/volkswagen.svg',
	VOLVO: 'logos/volvo.svg',
	VW: 'logos/volkswagen.svg'
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
	return brandLogos[brand] || 'logos/default_logo.svg'
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

	// Format ISO date strings to Czech format (d.m.yyyy)
	const formattedDate = formatDate(value)
	if (formattedDate) {
		return formattedDate
	}

	return value.replace(/\n/g, '<br>')
}

// Main function to fetch vehicle info
export async function fetchVehicleInfo(
	vin?: string,
	tp?: string,
	orv?: string
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
		throw new Error('At least one parameter (vin, tp, or orv) is required')
	}

	const response = await fetch(proxyUrl, {
		cache: 'no-cache',
		mode: 'cors',
		credentials: 'omit',
		headers: {
			'Content-Type': 'application/json'
		}
	})

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`)
	}

	const responseData: VehicleData | VehicleDataArray = await response.json()
	const data = transformApiResponse(responseData)

	if (!Array.isArray(data) || data.length === 0) {
		throw new Error('Invalid or empty response from API')
	}

	return data
}
