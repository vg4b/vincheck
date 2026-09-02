/**
 * GET /api/admin/metrics — conversion-funnel dashboard data.
 *
 * Auth: `Authorization: Bearer <METRICS_SECRET>` — a dedicated key, separate from
 * the marketing/cron secret so read-only dashboard access can be shared without
 * granting send/cron rights. Read-only aggregates over the `events` table; no PII
 * (the events themselves never store a raw VIN or email). Real sales filter out
 * `testMode` purchases, which run against the provider's test gateway.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '@vercel/postgres'

function metricsSecret(): string | null {
	return process.env.METRICS_SECRET || null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' })
	}

	const secret = metricsSecret()
	if (!secret) {
		return res.status(500).json({ error: 'METRICS_SECRET not configured' })
	}
	if (req.headers.authorization !== `Bearer ${secret}`) {
		return res.status(401).json({ error: 'Unauthorized' })
	}

	try {
		const [funnel, daily, placements, sales] = await Promise.all([
			// Whole-funnel counts + last 30 days.
			sql`
				SELECT type,
					count(*)::int AS total,
					count(*) FILTER (WHERE created_at >= now() - interval '30 day')::int AS d30
				FROM events GROUP BY type ORDER BY total DESC`,
			// Full funnel per day, last 30 days. Sales/revenue exclude test-gateway
			// purchases; every other step is a raw event count.
			sql`
				SELECT to_char(created_at, 'YYYY-MM-DD') AS day,
					count(*) FILTER (WHERE type = 'vin_lookup')::int AS lookups,
					count(*) FILTER (WHERE type = 'comparison_view')::int AS comparisons,
					count(*) FILTER (WHERE type = 'cert_cta_click')::int AS cta,
					count(*) FILTER (WHERE type = 'certificate_created')::int AS created,
					count(*) FILTER (WHERE type = 'certificate_issued'
						AND props->>'testMode' = 'false')::int AS sales,
					coalesce(sum((props->>'amountCzk')::int) FILTER (
						WHERE type = 'certificate_issued'
						AND props->>'testMode' = 'false'), 0)::int AS revenue_czk
				FROM events
				WHERE created_at >= now() - interval '30 day'
				GROUP BY day ORDER BY day DESC`,
			// Which CTA placement drives clicks.
			sql`
				SELECT coalesce(props->>'placement', '(none)') AS placement, count(*)::int AS n
				FROM events WHERE type = 'cert_cta_click' GROUP BY 1 ORDER BY n DESC`,
			// Real revenue (exclude test-gateway purchases).
			sql`
				SELECT count(*)::int AS sales,
					coalesce(sum((props->>'amountCzk')::int), 0)::int AS revenue_czk
				FROM events
				WHERE type = 'certificate_issued' AND props->>'testMode' = 'false'`
		])

		// No-store: always live numbers for the operator.
		res.setHeader('Cache-Control', 'no-store')
		return res.status(200).json({
			funnel: funnel.rows,
			daily: daily.rows,
			placements: placements.rows,
			sales: sales.rows[0] ?? { sales: 0, revenue_czk: 0 },
			generatedAt: new Date().toISOString()
		})
	} catch (error) {
		console.error('metrics query failed:', error)
		return res.status(500).json({ error: 'Query failed' })
	}
}
