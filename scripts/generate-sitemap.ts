/**
 * Generates public/sitemap.xml for the static (non-programmatic) routes.
 *
 * The brand/model pages are NOT listed here — they are served dynamically from
 * /znacky-sitemap.xml (api/stats.ts?type=sitemap), which robots.txt announces
 * as a second sitemap.
 *
 * `lastmod` is read from git history for the route's page component, so the
 * dates track real edits instead of drifting into placeholders. Vercel builds
 * from a shallow clone where per-file history is often missing, so every route
 * also pins a `fallback` date: git wins when available, the pin covers the rest.
 * Regenerate and commit whenever you add or retire a public route:
 *
 *   pnpm sitemap
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = 'https://www.vininfo.cz'
const OUT = join(__dirname, '..', 'public', 'sitemap.xml')

type ChangeFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

type Route = {
	/** Path as served, without the trailing slash. */
	path: string
	/** Page component under src/pages, used to date the entry from git. */
	page: string
	/** Pinned date for builds where git history is unavailable (ISO yyyy-mm-dd). */
	fallback: string
	/**
	 * Google ignores changefreq and priority; they are emitted for Seznam, which
	 * we have not confirmed does the same. Set them per route so they stay
	 * meaningful — uniform values would carry no information for any crawler.
	 */
	changefreq: ChangeFreq
	/** Relative to this site only (0.0–1.0); never compared across domains. */
	priority: number
}

/**
 * Public, indexable routes only. Deliberately excluded:
 *  - /prihlaseni, /klientska-zona — account pages, also noindex.
 *  - /kontakt, /podminky, /ochrana-osobnich-udaju — carry the operator's phone,
 *    e-mail and registered address; kept reachable on the site (the disclosure
 *    obligation is about access, not search) but noindex, so they stay out of
 *    results. Footer links them site-wide, which is why noindex does the work
 *    here and this exclusion is only housekeeping.
 *  - /platba and everything keyed by a lookup code (/vin, /tp, /orv, /s,
 *    /certifikat, /overit, /firma) — per-visitor, not landing pages.
 */
const ROUTES: Route[] = [
	{
		path: '/',
		page: 'HomePage',
		fallback: '2026-07-21',
		changefreq: 'weekly',
		priority: 1.0
	},
	{
		path: '/overeny-vypis-vozidla',
		page: 'CertificateLandingPage',
		fallback: '2026-07-08',
		changefreq: 'weekly',
		priority: 0.9
	},
	{
		// Hub over the brand/model pages; gains entries as new models qualify.
		path: '/znacky',
		page: 'ZnackyHubPage',
		fallback: '2026-07-20',
		changefreq: 'weekly',
		priority: 0.9
	},
	{
		path: '/kompletni-historie-vozu',
		page: 'KompletniHistorieVozuPage',
		fallback: '2026-07-03',
		changefreq: 'monthly',
		priority: 0.8
	},
	{
		path: '/sjednat-pojisteni',
		page: 'SjednatPojisteniPage',
		fallback: '2026-06-25',
		changefreq: 'monthly',
		priority: 0.8
	},
	{
		path: '/povinne-ruceni',
		page: 'PovinneRuceniPage',
		fallback: '2026-05-22',
		changefreq: 'monthly',
		priority: 0.7
	},
	{
		path: '/havarijni-pojisteni',
		page: 'HavarijniPojisteniPage',
		fallback: '2026-05-22',
		changefreq: 'monthly',
		priority: 0.7
	},
	{
		path: '/upozorneni-na-terminy',
		page: 'UpozorneniNaTerminyPage',
		fallback: '2026-05-11',
		changefreq: 'monthly',
		priority: 0.7
	},
	{
		// Utility page rather than a content one — lowest of the indexable set.
		path: '/registrace',
		page: 'RegisterPage',
		fallback: '2026-03-15',
		changefreq: 'yearly',
		priority: 0.5
	}
]

/** Author date (yyyy-mm-dd) of the last commit touching the page, or null. */
function gitLastModified(page: string): string | null {
	try {
		const out = execFileSync(
			'git',
			['log', '-1', '--format=%as', '--', `src/pages/${page}.tsx`],
			{
				cwd: join(__dirname, '..'),
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'ignore']
			}
		).trim()
		return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null
	} catch {
		return null
	}
}

function build(): string {
	let pinned = 0
	const entries = ROUTES.map(
		({ path, page, fallback, changefreq, priority }) => {
			const fromGit = gitLastModified(page)
			if (fromGit === null) pinned++
			const lastmod = fromGit ?? fallback
			return [
				'\t<url>',
				`\t\t<loc>${BASE_URL}${path}</loc>`,
				`\t\t<lastmod>${lastmod}</lastmod>`,
				`\t\t<changefreq>${changefreq}</changefreq>`,
				`\t\t<priority>${priority.toFixed(1)}</priority>`,
				'\t</url>'
			].join('\n')
		}
	)
	if (pinned > 0) {
		console.warn(`${pinned}/${ROUTES.length} entries fell back to pinned dates`)
	}
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`
}

writeFileSync(OUT, build(), 'utf8')
console.log(`Wrote ${ROUTES.length} URLs to public/sitemap.xml`)
