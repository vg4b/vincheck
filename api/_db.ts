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

	await sql`
		CREATE TABLE IF NOT EXISTS odometer_readings (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
			recorded_at date NOT NULL,
			km integer NOT NULL CHECK (km >= 0),
			note text,
			created_at timestamptz NOT NULL DEFAULT now()
		);
	`

	await sql`
		CREATE INDEX IF NOT EXISTS odometer_readings_vehicle_idx
		ON odometer_readings(vehicle_id);
	`
	await sql`
		CREATE INDEX IF NOT EXISTS odometer_readings_vehicle_date_idx
		ON odometer_readings(vehicle_id, recorded_at);
	`
	await sql`
		CREATE INDEX IF NOT EXISTS odometer_readings_user_vehicle_idx
		ON odometer_readings(user_id, vehicle_id);
	`

	// Sellable vehicle-history certificates. The `snapshot` freezes the registry
	// data at purchase time so a certificate stays immutable across monthly cache
	// refreshes; the PDF is regenerated on demand from it. `user_id` is optional —
	// guest checkout links by email only.
	await sql`
		CREATE TABLE IF NOT EXISTS certificates (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			code text UNIQUE NOT NULL,
			vin text NOT NULL,
			buyer_email text NOT NULL,
			user_id uuid REFERENCES users(id) ON DELETE SET NULL,
			status text NOT NULL DEFAULT 'pending',
			snapshot jsonb NOT NULL,
			registry_snapshot_date date,
			provider text NOT NULL,
			provider_ref text,
			amount_czk integer,
			download_token text NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			issued_at timestamptz
		);
	`

	await sql`
		CREATE INDEX IF NOT EXISTS certificates_provider_ref_idx
		ON certificates(provider_ref)
		WHERE provider_ref IS NOT NULL;
	`
	await sql`
		CREATE INDEX IF NOT EXISTS certificates_buyer_email_idx
		ON certificates(buyer_email);
	`
	await sql`
		CREATE INDEX IF NOT EXISTS certificates_user_idx
		ON certificates(user_id)
		WHERE user_id IS NOT NULL;
	`

	tablesReady = true
}
