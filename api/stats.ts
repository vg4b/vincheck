/**
 * JSON API for the aggregate brand/model statistics that power the public
 * /znacky/:brand/:model pages. The pages themselves are React routes in the SPA
 * (rendered client-side like the rest of the site); this endpoint just serves the
 * precomputed numbers. ONE Serverless Function for every stats route via a `type`
 * discriminator (the Hobby plan caps a deployment at 12 functions).
 *
 *   GET /api/stats?type=model&brand=<slug>&model=<slug>
 *     → 200 { stats }  |  404 { error }
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
	type BrandStats,
	getAllPublishedBrands,
	getAllPublishedModels,
	getBrandIndex,
	getBrandStatsBySlug,
	getModelIndex,
	getModelStatsBySlug,
	getModelsForBrand,
	type IndexModel,
	type ModelStats,
	resolveModelAlias
} from './_statsData'

function q(v: string | string[] | undefined): string {
	return (Array.isArray(v) ? v[0] : (v ?? '')).toLowerCase()
}

function baseUrl(): string {
	return (process.env.PUBLIC_BASE_URL ?? 'https://www.vininfo.cz').replace(
		/\/$/,
		''
	)
}

function xmlEscape(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function htmlEscape(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

// Display + number formatting mirrored from src/utils/carLabels.ts and
// BrandModelStatsPage so the crawl-time <title>/description this handler renders
// match the values the client injects after hydration (no crawl-vs-render drift).
const KEEP_UPPER = new Set(['BMW', 'VW', 'MG', 'DS', 'KGM', 'DFSK', 'SWM'])
function titleCase(s: string): string {
	return s
		.split(/\s+/)
		.map((w) =>
			KEEP_UPPER.has(w.toUpperCase())
				? w.toUpperCase()
				: w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
		)
		.join(' ')
}
const fmtInt = (n: number) => Math.round(n).toLocaleString('cs-CZ')
const fmtKm = (n: number) => `${fmtInt(n)} km`
const fmtNum1 = (n: number) =>
	n.toLocaleString('cs-CZ', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	})

// The built SPA shell, read once per warm function; the hashed asset refs are
// what boot the SPA, so we serve the real built file, not public/index.html.
// Candidates, most-reliable first: api/_shell.html is copied there at build time
// (copy-shell.ts) and bundled like _fonts; build/index.html is the fallback.
// Both are declared in vercel.json includeFiles.
const SHELL_PATHS = ['api/_shell.html', 'build/index.html']
let shellCache: string | null = null
function readShell(): string | null {
	if (shellCache !== null) return shellCache
	for (const rel of SHELL_PATHS) {
		try {
			shellCache = readFileSync(join(process.cwd(), rel), 'utf8')
			return shellCache
		} catch {
			// Try the next candidate.
		}
	}
	return shellCache
}

type HeadOpts = {
	title?: string
	description?: string
	canonical?: string
	robots: string
	og?: { title: string; description: string; url: string }
	/** Emitted as <script type="application/ld+json"> at crawl time. The client
	 *  adopts these nodes instead of appending its own — see the pages. */
	jsonLd?: object[]
}

// Serialise JSON-LD for embedding in HTML.
//
// The one thing that must not survive verbatim is `<`: a `</script>` sequence
// anywhere inside terminates the script element early and injects the remainder
// as markup. Brand and model names come from free-text registry data, so this is
// reachable rather than theoretical. htmlEscape() is the wrong tool — it would
// corrupt the JSON — so escape the character in its JSON form instead.
function jsonLdScript(node: object): string {
	const json = JSON.stringify(node).replace(/</g, '\\u003c')
	return `<script type="application/ld+json" data-stats-ld="true">${json}</script>`
}

// Fill the SEO head server-side: swap <title>/description in place, then insert
// robots (+ canonical + OG) before </head>. Values are HTML-escaped.
function injectHead(shell: string, opts: HeadOpts): string {
	let html = shell
	if (opts.title !== undefined) {
		html = html.replace(
			/<title>[\s\S]*?<\/title>/,
			`<title>${htmlEscape(opts.title)}</title>`
		)
	}
	if (opts.description !== undefined) {
		html = html.replace(
			/<meta name="description"[^>]*>/,
			`<meta name="description" content="${htmlEscape(opts.description)}"/>`
		)
	}
	const tags: string[] = [`<meta name="robots" content="${opts.robots}"/>`]
	if (opts.canonical) {
		tags.push(`<link rel="canonical" href="${htmlEscape(opts.canonical)}"/>`)
	}
	if (opts.og) {
		tags.push(
			`<meta property="og:title" content="${htmlEscape(opts.og.title)}"/>`,
			`<meta property="og:description" content="${htmlEscape(opts.og.description)}"/>`,
			`<meta property="og:url" content="${htmlEscape(opts.og.url)}"/>`,
			'<meta property="og:type" content="website"/>'
		)
	}
	for (const node of opts.jsonLd ?? []) tags.push(jsonLdScript(node))
	return html.replace('</head>', `${tags.join('')}</head>`)
}

// Last-resort document when the built shell can't be read (should not happen in
// a deployed function). Carries the canonical + robots so the crawl-time signal
// survives even though the SPA can't boot without its bundle.
function minimalDoc(opts: HeadOpts): string {
	const head = [
		'<meta charset="utf-8"/>',
		`<meta name="robots" content="${opts.robots}"/>`,
		opts.canonical
			? `<link rel="canonical" href="${htmlEscape(opts.canonical)}"/>`
			: '',
		opts.title ? `<title>${htmlEscape(opts.title)}</title>` : ''
	].join('')
	return `<!doctype html><html lang="cs"><head>${head}</head><body><div id="root"></div></body></html>`
}

// Render the SEO-complete HTML for /znacky/:brand/:model. Returns the status to
// send alongside the body: 200 for a real page, 404 for a clean miss (noindex),
// and 200-but-indexable when the DB lookup failed (never deindex on a blip).
function renderModelPage(
	stats: ModelStats | null,
	lookupFailed: boolean,
	brandSlug: string,
	modelSlug: string,
	base: string
): { status: number; body: string; cacheControl: string } {
	const shell = readShell()
	const canonical = `${base}/znacky/${brandSlug}/${modelSlug}`

	if (stats) {
		const name = `${titleCase(stats.brand)} ${titleCase(stats.model)}`
		const parts = [`Statistiky vozu ${name} z registru silničních vozidel`]
		if (stats.stkFailPct != null) {
			parts.push(`poruchovost STK ${fmtNum1(stats.stkFailPct)} %`)
		}
		if (stats.medianKmByAge?.['10']) {
			parts.push(
				`obvyklý nájezd v 10 letech ${fmtKm(stats.medianKmByAge['10'])}`
			)
		}
		parts.push(`${fmtInt(stats.vehicleCount)} vozidel`)
		const description = `${parts.join(', ')}.`
		const opts: HeadOpts = {
			title: `${name}: statistiky, spolehlivost a nájezd | VIN Info.cz`,
			description,
			canonical,
			robots: 'index, follow',
			og: {
				title: `${name}: statistiky a spolehlivost`,
				description,
				url: canonical
			},
			jsonLd: [
				datasetNode(
					`Statistiky vozu ${name}`,
					description,
					canonical,
					base,
					stats.computedAt
				),
				breadcrumb(base, [
					{ name: 'Značky', url: '/znacky' },
					{ name: titleCase(stats.brand), url: `/znacky/${brandSlug}` },
					{ name, url: `/znacky/${brandSlug}/${modelSlug}` }
				])
			]
		}
		return {
			status: 200,
			body: shell ? injectHead(shell, opts) : minimalDoc(opts),
			cacheControl: 'public, s-maxage=86400, stale-while-revalidate=604800'
		}
	}

	if (lookupFailed) {
		// Transient DB error: keep the page indexable and let the client retry.
		// Self-canonical, no noindex, and no caching so recovery is immediate.
		const opts: HeadOpts = { canonical, robots: 'index, follow' }
		return {
			status: 200,
			body: shell ? injectHead(shell, opts) : minimalDoc(opts),
			cacheControl: 'no-store'
		}
	}

	// Clean miss: a real 404 with noindex (not the old soft-404: 200 + noindex).
	const opts: HeadOpts = {
		title: 'Stránka nenalezena | VIN Info.cz',
		robots: 'noindex'
	}
	return {
		status: 404,
		body: shell ? injectHead(shell, opts) : minimalDoc(opts),
		cacheControl: 'public, s-maxage=3600'
	}
}

// Breadcrumb for the /znacky hierarchy. Google uses it to render the trail in
// results instead of a bare URL, and it is the structured counterpart to the
// links the pages now carry.
function breadcrumb(
	base: string,
	crumbs: Array<{ name: string; url: string }>
): object {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: crumbs.map((c, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: c.name,
			item: `${base}${c.url}`
		}))
	}
}

// Dataset node, matching what the client used to append after hydration. The
// license points at the terms rather than granting reuse — Google's Dataset
// report asks for the field, it does not require an open licence.
function datasetNode(
	name: string,
	description: string,
	url: string,
	base: string,
	computedAt: string | null
): object {
	return {
		'@context': 'https://schema.org',
		'@type': 'Dataset',
		name,
		description,
		url,
		creator: { '@type': 'Organization', name: 'VINInfo.cz' },
		license: `${base}/podminky`,
		...(computedAt ? { dateModified: computedAt.slice(0, 10) } : {})
	}
}

// Render the SEO head for /znacky/:brand. Same three-way status contract as
// renderModelPage: a real page, a real 404 for a clean miss, and 200-but-
// indexable when the lookup failed — a DB blip must never deindex a hub.
function renderBrandPage(
	stats: BrandStats | null,
	models: IndexModel[],
	lookupFailed: boolean,
	brandSlug: string,
	base: string
): { status: number; body: string; cacheControl: string } {
	const shell = readShell()
	const canonical = `${base}/znacky/${brandSlug}`

	if (stats) {
		const name = titleCase(stats.brand)
		const parts = [`Statistiky vozů ${name} z registru silničních vozidel`]
		if (stats.stkFailPct != null) {
			parts.push(`poruchovost STK ${fmtNum1(stats.stkFailPct)} %`)
		}
		parts.push(`${fmtInt(stats.vehicleCount)} vozidel`)
		if (models.length) parts.push(`${fmtInt(models.length)} modelů`)
		const description = `${parts.join(', ')}.`
		const opts: HeadOpts = {
			title: `${name}: statistiky, spolehlivost a nájezd | VIN Info.cz`,
			description,
			canonical,
			robots: 'index, follow',
			og: {
				title: `${name}: statistiky a spolehlivost`,
				description,
				url: canonical
			},
			jsonLd: [
				datasetNode(
					`Statistiky vozů ${name}`,
					description,
					canonical,
					base,
					stats.computedAt
				),
				breadcrumb(base, [
					{ name: 'Značky', url: '/znacky' },
					{ name, url: `/znacky/${brandSlug}` }
				])
			]
		}
		return {
			status: 200,
			body: shell ? injectHead(shell, opts) : minimalDoc(opts),
			cacheControl: 'public, s-maxage=86400, stale-while-revalidate=604800'
		}
	}

	if (lookupFailed) {
		const opts: HeadOpts = { canonical, robots: 'index, follow' }
		return {
			status: 200,
			body: shell ? injectHead(shell, opts) : minimalDoc(opts),
			cacheControl: 'no-store'
		}
	}

	const opts: HeadOpts = {
		title: 'Stránka nenalezena | VIN Info.cz',
		robots: 'noindex'
	}
	return {
		status: 404,
		body: shell ? injectHead(shell, opts) : minimalDoc(opts),
		cacheControl: 'public, s-maxage=3600'
	}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	// GET serves; HEAD is answered like GET but with headers only (below), so the
	// /znacky/* pages this handler now renders stay HEAD-able for crawlers, uptime
	// monitors and link-checkers — as they were when served as static files.
	if (req.method !== 'GET' && req.method !== 'HEAD') {
		return res.status(405).json({ error: 'Method not allowed' })
	}
	const headOnly = req.method === 'HEAD'

	const type = q(req.query.type)

	if (type === 'index') {
		// Brands ship with the models so the hub needs one request. The hub leads
		// with brands now — 764 model links on one page is a directory, not a
		// place to start.
		const [models, brands] = await Promise.all([
			getModelIndex(),
			getBrandIndex()
		])
		res.setHeader(
			'Cache-Control',
			'public, s-maxage=86400, stale-while-revalidate=604800'
		)
		if (headOnly) return res.status(200).end()
		return res.status(200).json({ models, brands })
	}

	if (type === 'sitemap') {
		const [models, brands] = await Promise.all([
			getAllPublishedModels(),
			getAllPublishedBrands()
		])
		const base = baseUrl()
		// Hub first, then brand hubs, then model pages — most important first, so
		// a crawler that gives up partway has spent its budget on the pages that
		// matter. Ordering is the only priority signal here; <priority> is not
		// used by Google.
		const hubUrl = `  <url><loc>${xmlEscape(`${base}/znacky`)}</loc><changefreq>monthly</changefreq></url>`
		const brandUrls = brands.map((b) => {
			const loc = xmlEscape(`${base}/znacky/${b.brandSlug}`)
			const lastmod = b.lastmod ? `<lastmod>${b.lastmod}</lastmod>` : ''
			return `  <url><loc>${loc}</loc>${lastmod}<changefreq>monthly</changefreq></url>`
		})
		const urls = [hubUrl]
			.concat(brandUrls)
			.concat(
				models.map((m) => {
					const loc = xmlEscape(`${base}/znacky/${m.brandSlug}/${m.modelSlug}`)
					const lastmod = m.lastmod ? `<lastmod>${m.lastmod}</lastmod>` : ''
					return `  <url><loc>${loc}</loc>${lastmod}<changefreq>monthly</changefreq></url>`
				})
			)
			.join('\n')
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
		res.setHeader('Content-Type', 'application/xml; charset=utf-8')
		res.setHeader(
			'Cache-Control',
			'public, s-maxage=86400, stale-while-revalidate=604800'
		)
		if (headOnly) return res.status(200).end()
		return res.status(200).send(xml)
	}

	if (type === 'brand' || type === 'brandjson') {
		const brandSlug = q(req.query.brand)
		let stats: BrandStats | null = null
		let models: IndexModel[] = []
		let lookupFailed = false
		try {
			if (brandSlug) {
				;[stats, models] = await Promise.all([
					getBrandStatsBySlug(brandSlug),
					getModelsForBrand(brandSlug)
				])
			}
		} catch (e) {
			console.error('brand lookup failed:', (e as Error)?.message)
			lookupFailed = true
		}

		if (type === 'brandjson') {
			if (!stats) {
				res.setHeader('Cache-Control', 'public, s-maxage=3600')
				if (headOnly) return res.status(404).end()
				return res.status(404).json({ error: 'not_found' })
			}
			res.setHeader(
				'Cache-Control',
				'public, s-maxage=86400, stale-while-revalidate=604800'
			)
			if (headOnly) return res.status(200).end()
			return res.status(200).json({ stats, models })
		}

		const { status, body, cacheControl } = renderBrandPage(
			stats,
			models,
			lookupFailed,
			brandSlug,
			baseUrl()
		)
		res.setHeader('Content-Type', 'text/html; charset=utf-8')
		res.setHeader('Cache-Control', cacheControl)
		if (headOnly) return res.status(status).end()
		return res.status(status).send(body)
	}

	if (type === 'page') {
		// Server-rendered HTML shell for /znacky/:brand/:model (rewritten here in
		// vercel.json). Puts canonical/title/description/robots in the crawl-time
		// response so Google gets them without executing JS — the SPA's own
		// useEffect re-sets identical values on hydration (reusing these elements).
		const brandSlug = q(req.query.brand)
		const modelSlug = q(req.query.model)

		let stats: ModelStats | null = null
		let lookupFailed = false
		try {
			stats =
				brandSlug && modelSlug
					? await getModelStatsBySlug(brandSlug, modelSlug)
					: null
		} catch (e) {
			// A missing table/grant already returns null; anything reaching here is an
			// unexpected/transient failure. Do NOT emit noindex for it.
			console.error('stats page lookup failed:', (e as Error)?.message)
			lookupFailed = true
		}

		// A clean miss may be a slug the variant fold retired. Redirect to the
		// surviving cohort instead of 404-ing, so pages Google already indexed
		// keep their ranking. Only on a genuine miss: a DB blip must not send a
		// crawler anywhere, and a 308 is permanent and cached hard.
		if (!stats && !lookupFailed) {
			const target = await resolveModelAlias(brandSlug, modelSlug).catch(
				() => null
			)
			if (target && target !== modelSlug) {
				res.setHeader('Location', `/znacky/${brandSlug}/${target}`)
				res.setHeader('Cache-Control', 'public, s-maxage=86400')
				return res.status(308).end()
			}
		}

		const { status, body, cacheControl } = renderModelPage(
			stats,
			lookupFailed,
			brandSlug,
			modelSlug,
			baseUrl()
		)
		res.setHeader('Content-Type', 'text/html; charset=utf-8')
		res.setHeader('Cache-Control', cacheControl)
		if (headOnly) return res.status(status).end()
		return res.status(status).send(body)
	}

	if (type === 'model') {
		const brandSlug = q(req.query.brand)
		const modelSlug = q(req.query.model)
		const stats =
			brandSlug && modelSlug
				? await getModelStatsBySlug(brandSlug, modelSlug)
				: null
		if (!stats) {
			res.setHeader('Cache-Control', 'public, s-maxage=3600')
			if (headOnly) return res.status(404).end()
			return res.status(404).json({ error: 'not_found' })
		}
		// Cached at the edge for a day, served stale while revalidating. Content only
		// changes with the monthly precompute, so this is very cache-friendly.
		res.setHeader(
			'Cache-Control',
			'public, s-maxage=86400, stale-while-revalidate=604800'
		)
		if (headOnly) return res.status(200).end()
		return res.status(200).json({ stats })
	}

	res.setHeader('Cache-Control', 'public, s-maxage=3600')
	if (headOnly) return res.status(404).end()
	return res.status(404).json({ error: 'not_found' })
}
