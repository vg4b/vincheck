-- Read-only user for the API lookup path (api/_vehicleCache.ts).
-- The app only ever SELECTs; the ingest uses the admin user separately.
--
-- No password is set here on purpose — keeping the secret out of the repo and
-- out of shell history. Two steps:
--
--   1. Apply this file as the admin user (creates the role + grants):
--        psql '<ADMIN connection string>' -f scripts/migrations/003_readonly_user.sql
--
--   2. Set the password interactively (prompts, never echoed or logged):
--        psql '<ADMIN connection string>'
--        => \password vincheck_api
--
--   Then use vincheck_api's credentials in VEHICLE_CACHE_DATABASE_URL.
--
-- Run AFTER the cache tables exist (i.e. after at least one ingest), so the
-- GRANT below covers them. The ALTER DEFAULT PRIVILEGES line additionally makes
-- any future tables created by the admin role readable without re-granting.
--
-- SCALEWAY NOTE: on Scaleway Managed PostgreSQL the admin role does NOT own the
-- database or the public schema, so the GRANT CONNECT / GRANT USAGE statements
-- below are no-ops — they print "GRANT" but emit "WARNING: no privileges were
-- granted". Database-level read access must be set through Scaleway's control
-- plane instead:
--   scw rdb privilege set region=nl-ams instance-id=<uuid> \
--     database-name=rdb user-name=vincheck_api permission=readonly
--   (or Console -> instance -> Users -> Update permissions -> rdb: Read)
-- The GRANT SELECT below DOES apply (admin owns the tables), so keep this file.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vincheck_api') THEN
    CREATE ROLE vincheck_api LOGIN;
  END IF;
END
$$;

-- No-ops on Scaleway (admin owns neither object) — see SCALEWAY NOTE above.
-- Kept for portability to self-hosted/owner-admin Postgres.
GRANT CONNECT ON DATABASE rdb TO vincheck_api;
GRANT USAGE ON SCHEMA public TO vincheck_api;
-- This one applies: admin owns the cache tables.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO vincheck_api;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO vincheck_api;
