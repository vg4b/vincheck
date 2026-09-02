-- STK failure rate split by origin: German imports vs domestic cars.
--
-- The research (docs/research/2026-08-25-import-country-sources.md) found that
-- cars imported from Germany fail the technical inspection (STK) more often than
-- domestic ones, across all five tested models (+17 % to +42 %). Germany is 62 %
-- of all imports, so it is both the dominant and the cleanest cohort to compare.
--
-- Buckets, per vehicle:
--   * _de       — has an import record with stat = 'Německo'
--   * _domestic — has NO import record at all
-- Other-country imports fall in NEITHER bucket, so the two rates are not
-- complementary and must not be presented as a two-way split of the fleet.
--
-- Denominators (_inspections_*) are kept for the same honesty reason as the
-- existing stk_inspections: a rate over a handful of inspections is noise, and
-- the page floor uses these counts to decide whether to show the comparison.
--
-- Values are populated by scripts/compute-stats.sql (the _stk block); until the
-- next recompute runs these columns are NULL and every reader treats NULL as
-- "not enough to say", so this migration is safe to apply ahead of the run.
ALTER TABLE stats_model
  ADD COLUMN IF NOT EXISTS stk_fail_pct_de          NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS stk_inspections_de       INT,
  ADD COLUMN IF NOT EXISTS stk_fail_pct_domestic    NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS stk_inspections_domestic INT;
