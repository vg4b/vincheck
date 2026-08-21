-- Theft rate, replacing the columns added in 010.
--
-- 010's stolen_count / stolen_per_1000 were computed inside _base, which is
-- restricted to status = 'PROVOZOVANÉ'. A stolen car gets deregistered, so
-- 17 924 of the 19 355 'Odcizeno' rows sit on VYŘAZENO Z PROVOZU vehicles and
-- the join saw 4.4% of them. What it measured was "stolen and still on the
-- road" — closer to a recovery rate than a theft rate. Those columns were never
-- published; these replace them.
--
-- The rate is windowed: thefts in a fixed five-year period over the fleet that
-- existed during that period. 010's version divided all-time thefts by today's
-- population, which is two different periods over two different populations.

ALTER TABLE stats_model
  DROP COLUMN IF EXISTS stolen_per_1000,
  DROP COLUMN IF EXISTS stolen_count;

ALTER TABLE stats_model
  -- Thefts recorded in the window (see THEFT_FROM/THEFT_TO in compute-stats.sql).
  ADD COLUMN IF NOT EXISTS theft_count INT,
  -- Vehicles of this model that existed during the window: registered before it
  -- ended and not deregistered for a non-theft reason before it began. Counted
  -- OUTSIDE the PROVOZOVANÉ filter, which is the fix.
  ADD COLUMN IF NOT EXISTS theft_fleet INT,
  -- theft_count per 1 000 of theft_fleet. Null unless the numerator clears the
  -- floor: a rate over two events is noise with a decimal point.
  ADD COLUMN IF NOT EXISTS theft_per_1000 NUMERIC(6,2);
