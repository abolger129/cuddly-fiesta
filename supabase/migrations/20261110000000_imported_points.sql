-- The Gauntlet: points carried over from a league imported from another app.
--
-- Most rankings score from their position (see src/lib/scoring.ts). A league
-- copied in from another app can keep that app's exact points instead: each
-- imported vote stores the points the voter gave, and the app uses that number
-- in place of the position's points. position still orders the voter's songs
-- (most points first). Players can't set this; submit_ranking leaves it empty,
-- so it is only ever filled by an import run in the SQL editor.

alter table public.rankings
  add column if not exists imported_points int;

notify pgrst, 'reload schema';
