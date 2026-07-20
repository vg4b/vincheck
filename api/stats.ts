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
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
	getAllPublishedModels,
	getModelIndex,
	getModelStatsBySlug
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	const type = q(req.query.type)

	if (type === 'index') {
		const models = await getModelIndex()
		res.setHeader(
			'Cache-Control',
			'public, s-maxage=86400, stale-while-revalidate=604800'
		)
		return res.status(200).json({ models })
	}

	if (type === 'sitemap') {
		const models = await getAllPublishedModels()
		const base = baseUrl()
		// Hub page first, then every model page.
		const hubUrl = `  <url><loc>${xmlEscape(`${base}/znacky`)}</loc><changefreq>monthly</changefreq></url>`
		const urls = [hubUrl]
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
		return res.status(200).send(xml)
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
			return res.status(404).json({ error: 'not_found' })
		}
		// Cached at the edge for a day, served stale while revalidating. Content only
		// changes with the monthly precompute, so this is very cache-friendly.
		res.setHeader(
			'Cache-Control',
			'public, s-maxage=86400, stale-while-revalidate=604800'
		)
		return res.status(200).json({ stats })
	}

	res.setHeader('Cache-Control', 'public, s-maxage=3600')
	return res.status(404).json({ error: 'not_found' })
}
