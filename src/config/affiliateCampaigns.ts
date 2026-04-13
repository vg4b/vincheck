/**
 * Central configuration for all affiliate campaigns.
 * Single source of truth for affiliate links, campaign IDs, and banner assets.
 */

/** eHub affiliate network (Cebia, etc.) */
const EHUB_AID = '9a3cbf23'

/** Campaign definitions */
export const campaigns = {
	/** Dealora.cz – slevové kódy (shared FixWeb property) */
	dealora: {
		baseUrl: 'https://www.dealora.cz/',
		label: 'Slevové kódy na Dealora.cz',
		shortLabel: 'Dealora.cz',
		tagline: 'Slevové kódy a kupony do oblíbených obchodů',
	},

	/** Cebia.cz - Vehicle history check (eHub network) */
	cebia: {
		/** Direct landing URL (append ?vin=XXX for pre-filled check) */
		baseUrl: 'https://cz.cebia.com',
		/** eHub text/CTA link (used in Benefits, error fallbacks, KompletniHistorieVozu) */
		textBannerId: '67e04d9d',
		/** eHub graphic banner (used in VehicleInfo component) */
		graphicBannerId: '452865f0',
		/** Graphic banner image URL */
		graphicBannerImage: 'https://doc.ehub.cz/b/6e6f52ca/452865f0.png',
		/** Impression tracking pixel URL */
		impressionPixel: 'https://ehub.cz/system/scripts/imp.php',
		label: 'Prověřit historii na Cebia.cz',
		shortLabel: 'Cebia.cz',
	},

} as const

/**
 * CSOB Pojišťovna – eHub program with coupon-based offers.
 * Advantages: no phone calls, low prices.
 */
const CSOB_EHUB_BID = 'f5e0f8fb'

export const csobCoupons = {
	ccs_karta_1000: {
		label: 'CCS karta v hodnotě 1 000 Kč k pojištění NAŠE AUTO',
		shortLabel: 'CCS karta 1 000 Kč',
		destUrl: 'https://www.csobpoj.cz/specialni-nabidka-autopojisteni-s-darkem',
		validFrom: '2026-01-01',
		validTo: '2026-03-31',
		sortOrder: 0,
	},
	ekniha_cestovni: {
		label: 'Dárek k cestovnímu pojištění - e-kniha zdarma',
		shortLabel: 'E-kniha zdarma',
		destUrl: 'https://www.csobpoj.cz/pojisteni/cestovni-pojisteni/',
		validFrom: '2026-01-21',
		validTo: '2026-04-06',
		sortOrder: 1,
	},
	sleva_10_odpovednost: {
		label: 'Sleva 10 % na pojištění odpovědnosti při online sjednání',
		shortLabel: '10 % odpovědnost',
		destUrl: 'https://www.csobpoj.cz/pojisteni/pojisteni-odpovednosti',
		validFrom: '2026-02-01',
		validTo: '2026-02-28',
		sortOrder: 2,
	},
	sleva_20_auto: {
		label: 'Sleva 20 % na autopojištění při online sjednání',
		shortLabel: '20 % autopojištění',
		destUrl: 'https://www.csobpoj.cz/pojisteni/pojisteni-vozidel',
		validFrom: '2026-02-01',
		validTo: '2026-02-28',
		sortOrder: 3,
	},
	sleva_10_majetek: {
		label: 'Sleva 10 % na pojištění majetku při online sjednání',
		shortLabel: '10 % majetek',
		destUrl: 'https://www.csobpoj.cz/pojisteni/pojisteni-majetku',
		validFrom: '2026-02-01',
		validTo: '2026-02-28',
		sortOrder: 4,
	},
	sleva_20_cestovni: {
		label: 'Sleva 20 % na cestovní pojištění při online sjednání',
		shortLabel: '20 % cestovní',
		destUrl: 'https://www.csobpoj.cz/pojisteni/cestovni-pojisteni',
		validFrom: '2026-02-01',
		validTo: '2026-02-28',
		sortOrder: 5,
	},
} as const

export type CsobCouponId = keyof typeof csobCoupons

/** Typ kalkulačky vozidel na kalkulacka.csobpoj.cz */
export type CsobVehicleKalkulackaKind = 'povinne_ruceni' | 'havarijni' | 'komplexni'

/**
 * Dealora.cz – odkazy na slevové kódy
 */
export const dealora = {
	getUrl: (): string => campaigns.dealora.baseUrl,
	label: campaigns.dealora.label,
	shortLabel: campaigns.dealora.shortLabel,
	tagline: campaigns.dealora.tagline,
} as const

/** Build eHub click URL for a given banner ID */
function buildEhubClickUrl(bannerId: string, data1?: string): string {
	const base = `https://ehub.cz/system/scripts/click.php?a_aid=${EHUB_AID}&a_bid=${bannerId}`
	return data1 ? `${base}&data1=${encodeURIComponent(data1)}` : base
}

/** Build eHub click URL with desturl (for CSOB coupon links) */
function buildEhubClickUrlWithDest(bannerId: string, destUrl: string, data1?: string): string {
	const base = `https://ehub.cz/system/scripts/click.php?a_aid=${EHUB_AID}&a_bid=${bannerId}&desturl=${encodeURIComponent(destUrl)}`
	return data1 ? `${base}&data1=${encodeURIComponent(data1)}` : base
}

/** Build eHub impression pixel URL for a given banner ID */
function buildEhubImpressionUrl(bannerId: string): string {
	return `https://ehub.cz/system/scripts/imp.php?a_aid=${EHUB_AID}&a_bid=${bannerId}`
}

/**
 * Cebia.cz affiliate links and helpers
 * @param data1 - Optional identifier for tracking (e.g. page/section name)
 */
export const cebia = {
	/**
	 * eHub affiliate URL (text banner) with optional VIN → Cebia.
	 * Same tracking as getTextLinkUrl / getTextLinkUrlWithVin; kept for existing call sites.
	 */
	getDirectUrl: (vin?: string, data1?: string): string =>
		vin
			? buildEhubClickUrlWithDest(
					campaigns.cebia.textBannerId,
					`${campaigns.cebia.baseUrl}/?vin=${encodeURIComponent(vin)}`,
					data1,
				)
			: buildEhubClickUrl(campaigns.cebia.textBannerId, data1),

	/** eHub affiliate URL for text/CTA links (Benefits, fallbacks, etc.) */
	getTextLinkUrl: (data1?: string): string =>
		buildEhubClickUrl(campaigns.cebia.textBannerId, data1),

	/** eHub affiliate URL to Cebia with VIN pre-filled */
	getTextLinkUrlWithVin: (vin: string, data1?: string): string =>
		buildEhubClickUrlWithDest(
			campaigns.cebia.textBannerId,
			`${campaigns.cebia.baseUrl}/?vin=${encodeURIComponent(vin)}`,
			data1
		),

	/** eHub affiliate URL for graphic banner (VehicleInfo) */
	getGraphicBannerUrl: (data1?: string): string =>
		buildEhubClickUrl(campaigns.cebia.graphicBannerId, data1),

	/** Graphic banner image URL */
	getGraphicBannerImage: (): string => campaigns.cebia.graphicBannerImage,

	/** Impression pixel URL for graphic banner */
	getImpressionPixelUrl: (): string =>
		buildEhubImpressionUrl(campaigns.cebia.graphicBannerId),

	label: campaigns.cebia.label,
	shortLabel: campaigns.cebia.shortLabel,
} as const

/**
 * CSOB Pojišťovna – coupon-based offers via eHub
 */
export const csob = {
	/** Get affiliate URL for a specific coupon */
	getCouponUrl: (couponId: CsobCouponId): string => {
		const c = csobCoupons[couponId]
		return buildEhubClickUrlWithDest(CSOB_EHUB_BID, c.destUrl)
	},

	/** All coupons, sorted by sortOrder */
	getAllCoupons: (): Array<{ id: CsobCouponId; label: string; shortLabel: string; validFrom: string; validTo: string }> =>
		(Object.entries(csobCoupons) as [CsobCouponId, (typeof csobCoupons)[CsobCouponId]][])
			.map(([id, c]) => ({ id, ...c }))
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map(({ id, label, shortLabel, validFrom, validTo }) => ({ id, label, shortLabel, validFrom, validTo })),

	/** Coupons valid for a given date (default: today) */
	getValidCoupons: (asOfDate?: string): Array<{ id: CsobCouponId; label: string; shortLabel: string }> => {
		const date = asOfDate ?? new Date().toISOString().slice(0, 10)
		return (Object.entries(csobCoupons) as [CsobCouponId, (typeof csobCoupons)[CsobCouponId]][])
			.filter(([, c]) => c.validFrom <= date && date <= c.validTo)
			.map(([id, c]) => ({ id, label: c.label, shortLabel: c.shortLabel }))
			.sort((a, b) => csobCoupons[a.id].sortOrder - csobCoupons[b.id].sortOrder)
	},

	/** General landing (autopojištění) – use when no specific coupon fits */
	getAutopojisteniUrl: (): string =>
		buildEhubClickUrlWithDest(CSOB_EHUB_BID, 'https://www.csobpoj.cz/pojisteni/pojisteni-vozidel'),

	/** Text pro odkazy na kalkulačku vozidel (sleva při online sjednání) */
	vehicleKalkulackaTagline: 'Pojištění se slevou za sjednání online.',

	/**
	 * Kalkulačka vozidel přes eHub (`a_bid=f5e0f8fb`) + `desturl` na kalkulacka.csobpoj.cz.
	 * @param data1 – identifikátor umístění odkazu (tracking)
	 */
	getVehicleKalkulackaUrl: (kind: CsobVehicleKalkulackaKind, data1: string): string => {
		const destUrls: Record<CsobVehicleKalkulackaKind, string> = {
			povinne_ruceni: 'https://kalkulacka.csobpoj.cz/povinne-ruceni',
			havarijni: 'https://kalkulacka.csobpoj.cz/havarijni-pojisteni',
			komplexni: 'https://kalkulacka.csobpoj.cz/komplexni-pojisteni-vozidla',
		}
		return buildEhubClickUrlWithDest(CSOB_EHUB_BID, destUrls[kind], data1)
	},

	label: 'CSOB Pojišťovna',
	shortLabel: 'CSOB Pojišťovna',
	tagline: 'slevové kódy a bonusy',
} as const

/** Cestovní pojištění – CJ affiliate (dpbolvw.net) */
const AXA_CESTOVNI_AFFILIATE_BASE = 'https://www.dpbolvw.net/click-101607830-12934852'

/**
 * Cestovní pojištění – affiliate s `sid` podle umístění odkazu.
 */
export const axaCestovniPojisteni = {
	/**
	 * @param placementSid – jednoznačný identifikátor místa (např. `client_zone_benefits`, `footer`)
	 */
	getUrl: (placementSid: string): string => {
		const sep = AXA_CESTOVNI_AFFILIATE_BASE.includes('?') ? '&' : '?'
		return `${AXA_CESTOVNI_AFFILIATE_BASE}${sep}sid=${encodeURIComponent(placementSid)}`
	},

	headline: 'Cestovní pojištění se slevou 50 %',

	/** Krátký neutrální popis pro karty (bez jména partnera) */
	partnerInfo:
		'Léčebné výlohy, asistence, úraz, odpovědnost, zavazadla i rizika spojená s letem. Sjednáte online.',
} as const

/**
 * All affiliate campaigns as a map for iteration / documentation
 */
export const allCampaigns = {
	dealora,
	cebia,
	csob,
	axaCestovniPojisteni,
} as const
