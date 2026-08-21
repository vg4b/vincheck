-- Two columns on stats_model, batched deliberately.
--
-- The precompute takes 105 minutes, and every column added costs one full run.
-- Adding these separately would cost two. If a third metric is wanted later,
-- add it here before the next rebuild rather than after it.
--
-- ADDITIVE ONLY, nullable, no defaults — catalog-only on PG 17, so applying this
-- to a 764-row table is instant and the read layer degrades to "not computed"
-- until the rebuild fills them.

ALTER TABLE stats_model
  -- Top defect codes for the cohort: [{code, count, share}, ...], biggest first.
  -- Codes only. The human text is resolved at read time from the vendored
  -- api/_defectCatalog.json, the same rule the certificate follows, so improving
  -- the catalog never requires a re-ingest.
  ADD COLUMN IF NOT EXISTS top_defects JSONB,
  -- Thefts per 1 000 registered vehicles of this model. A rate, not a count:
  -- raw theft counts rank ŠKODA 6 162 / VOLKSWAGEN 1 070 / FORD 920, which is a
  -- ranking of how common a car is, not of how often it is stolen.
  ADD COLUMN IF NOT EXISTS stolen_per_1000 NUMERIC(6,2),
  -- The numerator behind that rate, so the page can show its denominator and a
  -- reader can judge the number.
  ADD COLUMN IF NOT EXISTS stolen_count INT;
