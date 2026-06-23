/**
 * Lightweight, best-effort event monitoring.
 *
 * Two sinks, both fail-safe — monitoring must never break the request it watches:
 *   1. A structured console line (always, synchronous) → searchable in Vercel logs.
 *   2. An insert into the `events` table → durable, queryable history that
 *      outlives Vercel's short Hobby-plan log retention.
 *
 * The table is created lazily on first use (idempotent), so this module is
 * self-contained and callers don't need to run the main `ensureTables()`.
 *
 * Latency note: callers on hot/public paths (e.g. the VIN lookup) should call
 * `logEvent` without awaiting — the console line is emitted synchronously before
 * the first await, so it is reliable even if the function returns first; the DB
 * write is then a non-blocking bonus. Low-frequency paths (webhook, client zone)
 * can await for guaranteed persistence.
 */
import { sql } from '@vercel/postgres'

export type EventType =
	| 'vin_lookup'
	| 'client_op'
	| 'certificate_created'
	| 'certificate_issued'
	| 'certificate_error'

let eventsTableReady = false

async function ensureEventsTable(): Promise<void> {
	if (eventsTableReady) {
		return
	}
	await sql`
		CREATE TABLE IF NOT EXISTS events (
			id bigserial PRIMARY KEY,
			type text NOT NULL,
			props jsonb,
			created_at timestamptz NOT NULL DEFAULT now()
		);
	`
	await sql`
		CREATE INDEX IF NOT EXISTS events_type_created_idx
		ON events(type, created_at DESC);
	`
	eventsTableReady = true
}

export async function logEvent(
	type: EventType,
	props: Record<string, unknown> = {}
): Promise<void> {
	// Structured log first — synchronous, so it survives even if the caller does
	// not await and the function returns before the DB write resolves.
	try {
		console.log(JSON.stringify({ evt: type, ...props, ts: new Date().toISOString() }))
	} catch {
		// Never let logging throw.
	}
	try {
		await ensureEventsTable()
		await sql`
			INSERT INTO events (type, props)
			VALUES (${type}, ${JSON.stringify(props)}::jsonb);
		`
	} catch (error) {
		console.error('logEvent insert failed:', error)
	}
}
