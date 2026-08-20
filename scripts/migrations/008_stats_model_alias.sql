-- Retired model slugs -> the cohort they were folded into.
--
-- compute-stats.sql folds engine and drivetrain variants of the same car into
-- one cohort ("OCTAVIA 1.9 TDI" -> "OCTAVIA"), which retires ~500 URLs that
-- Google has already seen. They must 308 rather than 404, or the fold throws
-- away whatever ranking those pages had.
--
-- Why a table and not logic in the handler: the slug is lossy. "OCTAVIA 1.9 TDI"
-- slugifies to "octavia-1-9-tdi", where the displacement has become two tokens,
-- and "320D XDRIVE" folds to "320 D" = "320-d", which is not even a prefix of
-- "320d-xdrive". Only the precompute knows the real mapping, so it records it.
--
-- ADDITIVE ONLY. Rebuilt wholesale by compute-stats.sql on each run, so a fold
-- that is later reverted simply stops emitting its row.

CREATE TABLE IF NOT EXISTS stats_model_alias (
  brand_slug TEXT NOT NULL,
  old_slug   TEXT NOT NULL,   -- the retired URL segment
  model_slug TEXT NOT NULL,   -- the surviving cohort's segment
  PRIMARY KEY (brand_slug, old_slug)
);

-- Read-only app user (created in 003). Role-guarded so this file stays safe to
-- apply against a local dev DB with no vincheck_api role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vincheck_api') THEN
    GRANT SELECT ON stats_model_alias TO vincheck_api;
  END IF;
END
$$;
