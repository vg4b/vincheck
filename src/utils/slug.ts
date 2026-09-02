// URL slug for a brand/model value: fold Czech diacritics, lowercase, hyphenate.
//
// Character-for-character identical to slugify() in api/_statsData.ts and the
// slugSql() SQL expression that builds the /znacky cohorts. It cannot be shared
// from there — that module pulls in the Postgres pool and never ships to the
// browser — so the fold is duplicated here. Keep the two maps in lockstep: a
// slug that maps to a different string than the API's would silently miss its
// cohort.
const CZ_FROM = 'àáâãäåçèéêëìíîïðñòóôõöùúûüýÿčďěňřšťůž'
const CZ_TO = 'aaaaaaceeeeiiiidnooooouuuuyycdenrstuz'

export function slugify(s: string): string {
	let out = ''
	for (const ch of s.toLowerCase()) {
		const i = CZ_FROM.indexOf(ch)
		out += i >= 0 ? CZ_TO[i] : ch
	}
	return out.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
