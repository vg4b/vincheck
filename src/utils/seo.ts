/**
 * Head helpers for the SPA routes. The app renders client-side, so per-page SEO
 * tags are applied on mount and undone on unmount — otherwise a tag set by one
 * route would leak into the next one the visitor navigates to.
 */

/**
 * Marks the current route as noindex. Meant for account pages (login, client
 * zone) that are useless in search results and would only spend crawl budget.
 *
 * Returns the cleanup function; call it from the effect's teardown.
 */
export function applyNoindex(): () => void {
	let meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
	const existed = Boolean(meta)
	const previous = meta?.getAttribute('content') ?? null

	if (!meta) {
		meta = document.createElement('meta')
		meta.setAttribute('name', 'robots')
		document.head.appendChild(meta)
	}
	meta.setAttribute('content', 'noindex, follow')

	return () => {
		if (existed) {
			if (previous) meta?.setAttribute('content', previous)
		} else {
			meta?.remove()
		}
	}
}
