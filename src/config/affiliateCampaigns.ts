import generatedCoupons from './csobCoupons.generated.json'

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
		tagline: 'Slevové kódy a kupony do oblíbených obchodů'
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
		shortLabel: 'Cebia.cz'
	}
} as const

/**
 * CSOB Pojišťovna – eHub program with coupon-based offers.
 * Advantages: no phone calls, low prices.
 */
const CSOB_EHUB_BID = 'f5e0f8fb'

/**
 * Coupon definitions come from `src/config/csobCoupons.generated.json`, which
 * `scripts/sync-ehub-coupons.ts` regenerates from the eHub v3 API (weekly CI job
 * `sync-ehub-coupons`). Do NOT hand-edit either file.
 *
 * Why generated: ČSOB rotates the "Sleva X %" coupons MONTHLY, so a hand-kept
 * list goes stale on the 1st. Between 2026-04 and 2026-08 every coupon here was
 * expired and the ČSOB block rendered nothing on all three insurance pages,
 * with nothing to signal it.
 *
 * `url` is eHub's own tracking URL, taken verbatim. It already carries a_aid,
 * a_bid and (where the campaign defines one) desturl.
 */
export type CsobCoupon = {
	id: string
	label: string
	shortLabel: string
	url: string
	validFrom: string
	validTo: string
	sortOrder: number
}

export const csobCoupons = generatedCoupons as CsobCoupon[]

export type CsobCouponId = string

/**
 * Dealora.cz – odkazy na slevové kódy
 */
export const dealora = {
	getUrl: (): string => campaigns.dealora.baseUrl,
	label: campaigns.dealora.label,
	shortLabel: campaigns.dealora.shortLabel,
	tagline: campaigns.dealora.tagline
} as const

/** Build eHub click URL for a given banner ID */
function buildEhubClickUrl(bannerId: string, data1?: string): string {
	const base = `https://ehub.cz/system/scripts/click.php?a_aid=${EHUB_AID}&a_bid=${bannerId}`
	return data1 ? `${base}&data1=${encodeURIComponent(data1)}` : base
}

/** Build eHub click URL with desturl (for CSOB coupon links) */
function buildEhubClickUrlWithDest(
	bannerId: string,
	destUrl: string,
	data1?: string
): string {
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
					data1
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
	shortLabel: campaigns.cebia.shortLabel
} as const

/**
 * CSOB Pojišťovna – coupon-based offers via eHub
 */
/**
 * Product-specific eHub "Odkaz" creatives, all landing on kalkulacka.csobpoj.cz.
 *
 * These are official campaign creatives, so using them needs no approval. Each
 * product has its OWN banner id, which matters for reporting: routing everything
 * through the default link (f5e0f8fb + desturl) collapses every click in eHub
 * into a single creative and we cannot tell povinné ručení from cestovní.
 */
const CSOB_PRODUCT_BIDS = {
	povinne: 'edd3eab1',
	havarijni: 'f2cbd4a7',
	vozidlo: '31ad0287',
	cestovni: 'ce3024c2',
	odpovednost: '9892e41f',
	majetek: 'a6886874'
} as const

export type CsobProduct = keyof typeof CSOB_PRODUCT_BIDS

/**
 * Which coupons belong to which product.
 *
 * eHub exposes no product field on a voucher, only free-text `rules`, so the
 * match is on the label. This lives here rather than in the pages because it was
 * previously duplicated as hardcoded coupon ids in three files — and those ids
 * were the OLD hand-written slugs ('sleva_20_auto', …). Once the list became
 * generated from the API the ids turned into eHub's numeric voucher ids, every
 * `includes(c.id)` silently went false, and the coupon block vanished from
 * /povinne-ruceni and /havarijni-pojisteni. Matching on meaning survives that.
 */
const CSOB_COUPON_PATTERNS: Record<CsobProduct, RegExp> = {
	povinne: /autopojištění|pojištění vozidel/i,
	havarijni: /autopojištění|pojištění vozidel/i,
	vozidlo: /autopojištění|pojištění vozidel/i,
	cestovni: /cestovn/i,
	odpovednost: /odpovědnost/i,
	majetek: /majetk/i
}

/** Prefix a coupon label so it reads as the advertiser's promotion, not our claim. */
export const promoLabel = (label: string): string => `AKCE: ${label}`

export const csob = {
	/** Tracking URL for a coupon, straight from eHub. */
	getCouponUrl: (couponId: CsobCouponId): string =>
		csobCoupons.find((c) => c.id === couponId)?.url ??
		buildEhubClickUrl(CSOB_EHUB_BID),

	/** All coupons, sorted by sortOrder. */
	getAllCoupons: (): CsobCoupon[] =>
		[...csobCoupons].sort((a, b) => a.sortOrder - b.sortOrder),

	/**
	 * Valid coupons for one or more products, in sortOrder.
	 * Empty when nothing is running — callers must handle that, since ČSOB rotates
	 * the discount coupons monthly and gaps between them are normal.
	 */
	getCouponsFor: (...products: CsobProduct[]): CsobCoupon[] => {
		const date = new Date().toISOString().slice(0, 10)
		return csobCoupons
			.filter((c) => c.validFrom <= date && date <= c.validTo)
			.filter((c) =>
				products.some((p) => CSOB_COUPON_PATTERNS[p].test(c.label))
			)
			.sort((a, b) => a.sortOrder - b.sortOrder)
	},

	/** Coupons valid for a given date (default: today). */
	getValidCoupons: (asOfDate?: string): CsobCoupon[] => {
		const date = asOfDate ?? new Date().toISOString().slice(0, 10)
		return csobCoupons
			.filter((c) => c.validFrom <= date && date <= c.validTo)
			.sort((a, b) => a.sortOrder - b.sortOrder)
	},

	/**
	 * Tracking URL for one product's calculator.
	 * @param placement – where the link sits; passed as eHub `data1`.
	 */
	getProductUrl: (product: CsobProduct, placement?: string): string =>
		buildEhubClickUrl(CSOB_PRODUCT_BIDS[product], placement),

	/** General landing (autopojištění) – use when no specific coupon fits. */
	getAutopojisteniUrl: (): string =>
		buildEhubClickUrlWithDest(
			CSOB_EHUB_BID,
			'https://www.csobpoj.cz/pojisteni/pojisteni-vozidel'
		),

	label: 'CSOB Pojišťovna',
	shortLabel: 'CSOB Pojišťovna',
	tagline: 'slevové kódy a bonusy'
} as const

/**
 * Insurance product kind and link placement.
 *
 * These outlive the ePojištění campaign they were written for: ten entry points
 * across the site (nav, footer, VehicleInfo, client zone, both product pages and
 * the reminder e-mail) link to /sjednat-pojisteni?typ=…&src=…, and `src` is what
 * we pass to eHub as `data1` for placement attribution.
 */
export type InsuranceKind = 'povinne' | 'havarijni' | 'cestovni'

/** Identifikátor umístění odkazu – předává se jako `data1` (atribuce prokliku). */
export type InsurancePlacement =
	| 'sjednat_page'
	| 'email_reminder'
	| 'vehicle_card'
	| 'vehicle_card_due'
	| 'client_zone_benefits'
	| 'povinne_page'
	| 'havarijni_page'
	| 'vehicle_info'
	| 'footer'
	| 'nav'

/**
 * All affiliate campaigns as a map for iteration / documentation
 */
export const allCampaigns = {
	dealora,
	cebia,
	csob
} as const
