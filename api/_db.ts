import { sql } from '@vercel/postgres'

let tablesReady = false

export async function ensureTables() {
	if (tablesReady) {
		return
	}

	await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`

	await sql`
		CREATE TABLE IF NOT EXISTS users (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			email text UNIQUE NOT NULL,
			password_hash text NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now()
		);
	`

	// Add new columns for email verification and preferences
	await sql`
		ALTER TABLE users
		ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
	`
	await sql`
		ALTER TABLE users
		ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
	`
	await sql`
		ALTER TABLE users
		ADD COLUMN IF NOT EXISTS email_verification_code text;
	`
	await sql`
		ALTER TABLE users
		ADD COLUMN IF NOT EXISTS email_verification_expires_at timestamptz;
	`
	await sql`
		ALTER TABLE users
		ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;
	`
	await sql`
		ALTER TABLE users
		ADD COLUMN IF NOT EXISTS marketing_enabled boolean NOT NULL DEFAULT true;
	`

	await sql`
		CREATE TABLE IF NOT EXISTS vehicles (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			vin text,
			tp text,
			orv text,
			title text,
			brand text,
			model text,
			snapshot jsonb,
			created_at timestamptz NOT NULL DEFAULT now()
		);
	`

	await sql`
		ALTER TABLE vehicles
		ADD COLUMN IF NOT EXISTS title text;
	`

	await sql`
		CREATE UNIQUE INDEX IF NOT EXISTS vehicles_user_vin_unique
		ON vehicles(user_id, vin)
		WHERE vin IS NOT NULL;
	`

	await sql`
		CREATE TABLE IF NOT EXISTS reminders (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
			type text NOT NULL,
			due_date date NOT NULL,
			note text,
			is_done boolean NOT NULL DEFAULT false,
			created_at timestamptz NOT NULL DEFAULT now()
		);
	`

	await sql`
		CREATE INDEX IF NOT EXISTS reminders_user_due_idx
		ON reminders(user_id, due_date);
	`

	// Add email reminder columns to reminders table
	await sql`
		ALTER TABLE reminders
		ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT true;
	`
	await sql`
		ALTER TABLE reminders
		ADD COLUMN IF NOT EXISTS email_send_at date;
	`
	await sql`
		ALTER TABLE reminders
		ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
	`

	await sql`
		CREATE INDEX IF NOT EXISTS reminders_email_send_idx 
		ON reminders(email_send_at) 
		WHERE email_enabled = true;
	`

	tablesReady = true
}
