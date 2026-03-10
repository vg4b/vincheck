/**
 * Central configuration for all affiliate campaigns.
 * Single source of truth for affiliate links, campaign IDs, and banner assets.
 */

/** eHub affiliate network (Cebia, etc.) */
const EHUB_AID = '9a3cbf23'

/** Campaign definitions */
export const campaigns = {
	/** Direct pojišťovna – povinné ručení, havarijní (CJ/Impact network) */
	direct: {
		/** CJ affiliate click URL */
		affiliateClickUrl: 'https://www.anrdoezrs.net/click-101607830-15284807',
		/** Destination: povinné ručení s VIN */
		povinneRuceniUrl: 'https://www.direct.cz/auto/povinne-ruceni',
		/** Destination: havarijní pojištění s VIN */
		havarijniPojisteniUrl: 'https://www.direct.cz/auto/havarijni-pojisteni',
		/** Destination: přehled autopojištění (povinné + havarijní) */
		autoUrl: 'https://www.direct.cz/auto',
		label: 'Pojištění na Direct.cz',
		shortLabel: 'Direct pojišťovna',
		tagline: 'nízká cena, sjednání i správa pojištění zdarma, vysoké plnění',
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

/** Build eHub click URL for a given banner ID */
function buildEhubClickUrl(bannerId: string): string {
	return `https://ehub.cz/system/scripts/click.php?a_aid=${EHUB_AID}&a_bid=${bannerId}`
}

/** Build eHub click URL with desturl (for CSOB coupon links) */
function buildEhubClickUrlWithDest(bannerId: string, destUrl: string): string {
	return `https://ehub.cz/system/scripts/click.php?a_aid=${EHUB_AID}&a_bid=${bannerId}&desturl=${encodeURIComponent(destUrl)}`
}

/** Build eHub impression pixel URL for a given banner ID */
function buildEhubImpressionUrl(bannerId: string): string {
	return `https://ehub.cz/system/scripts/imp.php?a_aid=${EHUB_AID}&a_bid=${bannerId}`
}

/**
 * Cebia.cz affiliate links and helpers
 */
export const cebia = {
	/** Direct link with optional VIN (no affiliate tracking, use for VIN-specific checks) */
	getDirectUrl: (vin?: string): string => {
		const base = campaigns.cebia.baseUrl
		return vin ? `${base}/?vin=${vin}` : base
	},

	/** eHub affiliate URL for text/CTA links (Benefits, fallbacks, etc.) */
	getTextLinkUrl: (): string =>
		buildEhubClickUrl(campaigns.cebia.textBannerId),

	/** eHub affiliate URL to Cebia with VIN pre-filled */
	getTextLinkUrlWithVin: (vin: string): string =>
		buildEhubClickUrlWithDest(
			campaigns.cebia.textBannerId,
			`${campaigns.cebia.baseUrl}/?vin=${encodeURIComponent(vin)}`
		),

	/** eHub affiliate URL for graphic banner (VehicleInfo) */
	getGraphicBannerUrl: (): string =>
		buildEhubClickUrl(campaigns.cebia.graphicBannerId),

	/** Graphic banner image URL */
	getGraphicBannerImage: (): string => campaigns.cebia.graphicBannerImage,

	/** Impression pixel URL for graphic banner */
	getImpressionPixelUrl: (): string =>
		buildEhubImpressionUrl(campaigns.cebia.graphicBannerId),

	label: campaigns.cebia.label,
	shortLabel: campaigns.cebia.shortLabel,
} as const

/** Přidá ?vin= nebo ?spz= podle délky kódu (VIN = 17 znaků) */
function appendVinOrSpzParam(baseUrl: string, code: string): string {
	const sep = baseUrl.includes('?') ? '&' : '?'
	const param = code.length === 17 ? 'vin' : 'spz'
	return `${baseUrl}${sep}${param}=${encodeURIComponent(code)}`
}

/**
 * Direct pojišťovna – povinné ručení, havarijní (CJ/Impact affiliate)
 */
export const direct = {
	/** Affiliate URL pro povinné ručení (bez VIN/SPZ) */
	getTextLinkUrl: (): string => {
		const dest = campaigns.direct.povinneRuceniUrl
		return `${campaigns.direct.affiliateClickUrl}?url=${encodeURIComponent(dest)}`
	},

	/** Affiliate URL pro povinné ručení s VIN nebo SPZ předvyplněným */
	getDirectUrl: (vinOrSpz?: string): string => {
		const base = campaigns.direct.affiliateClickUrl
		const dest = vinOrSpz && vinOrSpz.length >= 5
			? appendVinOrSpzParam(campaigns.direct.povinneRuceniUrl, vinOrSpz)
			: campaigns.direct.povinneRuceniUrl
		return `${base}?url=${encodeURIComponent(dest)}`
	},

	/** Affiliate URL pro havarijní pojištění (bez VIN/SPZ) */
	getHavarijniUrl: (): string => {
		const dest = campaigns.direct.havarijniPojisteniUrl
		return `${campaigns.direct.affiliateClickUrl}?url=${encodeURIComponent(dest)}`
	},

	/** Affiliate URL pro havarijní pojištění s VIN nebo SPZ předvyplněným */
	getHavarijniUrlWithVin: (vinOrSpz?: string): string => {
		const base = campaigns.direct.affiliateClickUrl
		const dest = vinOrSpz && vinOrSpz.length >= 5
			? appendVinOrSpzParam(campaigns.direct.havarijniPojisteniUrl, vinOrSpz)
			: campaigns.direct.havarijniPojisteniUrl
		return `${base}?url=${encodeURIComponent(dest)}`
	},

	/** Affiliate URL pro autopojištění (povinné i havarijní) */
	getAutoUrl: (vinOrSpz?: string): string => {
		const base = campaigns.direct.affiliateClickUrl
		const dest = vinOrSpz && vinOrSpz.length >= 5
			? appendVinOrSpzParam(campaigns.direct.autoUrl, vinOrSpz)
			: campaigns.direct.autoUrl
		return `${base}?url=${encodeURIComponent(dest)}`
	},

	label: campaigns.direct.label,
	shortLabel: campaigns.direct.shortLabel,
	tagline: campaigns.direct.tagline,
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

	label: 'CSOB Pojišťovna',
	shortLabel: 'CSOB Pojišťovna',
	tagline: 'slevové kódy a bonusy',
} as const

/**
 * All affiliate campaigns as a map for iteration / documentation
 */
export const allCampaigns = {
	cebia,
	direct,
	csob,
} as const
