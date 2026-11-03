-- The Gauntlet: which migrations are in this database?
-- Add a row here whenever a new migration is added.
-- Read-only: this only looks, it changes nothing. Paste it all into the
-- Supabase SQL editor and press Run. Any row that says "MISSING" is a
-- migration to run (oldest first).

with col(tbl, c) as (select table_name, column_name from information_schema.columns where table_schema = 'public'),
fn(name, body) as (select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'),
tb(name) as (select table_name from information_schema.tables where table_schema = 'public'),
checks(migration, ok) as (values
  ('20261022000000_init',                     exists (select 1 from tb where name = 'profiles') and exists (select 1 from tb where name = 'rankings')),
  ('20261026000000_game_loop',                exists (select 1 from fn where name = 'create_group') and exists (select 1 from fn where name = 'submit_ranking')),
  ('20261028000100_guess_submitter',          exists (select 1 from tb where name = 'guesses') and exists (select 1 from col where tbl = 'groups' and c = 'guessing_enabled')),
  ('20261028000500_comments_and_scoring_rules', exists (select 1 from tb where name = 'song_comments') and exists (select 1 from col where tbl = 'groups' and c = 'downvotes')),
  ('20261028001500_league_playlist',          exists (select 1 from col where tbl = 'groups' and c = 'playlist_url')),
  ('20261028030000_round_timers',             exists (select 1 from col where tbl = 'rounds' and c = 'vote_deadline') and exists (select 1 from fn where name = 'run_round_timers')),
  ('20261028040000_nudges',                   exists (select 1 from fn where name = 'nudge_round') and exists (select 1 from col where tbl = 'rounds' and c = 'last_nudged_at')),
  ('20261028050000_youtube_songs',            exists (select 1 from col where tbl = 'submissions' and c = 'youtube_url') and exists (select 1 from fn where name = 'round_songs' and body like '%youtube_url%')),
  ('20261028060000_host_controls',            exists (select 1 from fn where name = 'remove_member')),
  ('20261028070000_league_extras',            exists (select 1 from tb where name = 'category_suggestions') and exists (select 1 from fn where name = 'transfer_host')),
  ('20261028080000_doodles_and_rematch',      exists (select 1 from col where tbl = 'profiles' and c = 'avatar_doodle') and exists (select 1 from fn where name = 'rematch_league')),
  ('20261028090000_banned_artists',           exists (select 1 from col where tbl = 'rounds' and c = 'banned_artists') and exists (select 1 from fn where name = 'check_banned_artists')
                                              and exists (select 1 from fn where name = 'set_upcoming_rounds' and body like '%banned_artists%')),
  ('20261028100000_negative_points',          exists (select 1 from col where tbl = 'groups' and c = 'negative_points') and exists (select 1 from fn where name = 'lock_scoring_rules' and body like '%negative_points%')),
  ('20261028110000_safety_and_account_deletion', exists (select 1 from tb where name = 'blocks') and exists (select 1 from fn where name = 'is_blocked_between')),
  ('20261029000000_rounds_run_themselves',    exists (select 1 from fn where name = 'start_next_round') and exists (select 1 from tb where name = 'server_settings')),
  ('20261029010000_apple_sign_in_tokens',     exists (select 1 from tb where name = 'apple_tokens')),
  ('20261029030000_who_submitted_and_duplicates', exists (select 1 from col where tbl = 'submissions' and c = 'spotify_album_id') and exists (select 1 from fn where name = 'similar_picks')
                                              and exists (select 1 from fn where name = 'round_submitters')),
  ('20261029020000_nudge_limit',              exists (select 1 from col where tbl = 'groups' and c = 'nudge_cooldown_minutes')),
  ('20261029040000_locked_votes_and_submitters_only', exists (select 1 from fn where name = 'round_voters') and exists (select 1 from fn where name = 'round_votes_so_far')),
  ('20261029050000_who_has_voted',            exists (select 1 from fn where name = 'round_voter_status')),
  ('20261029060000_shuffled_song_order',      exists (select 1 from col where tbl = 'submissions' and c = 'play_order') and exists (select 1 from fn where name = 'shuffle_round_songs')),
  ('20261029070000_avatar_colors_and_stickers', exists (select 1 from col where tbl = 'profiles' and c = 'avatar_sticker') and exists (select 1 from col where tbl = 'profiles' and c = 'avatar_bg')),
  ('20261029080000_comment_on_own_song',      exists (select 1 from fn where name = 'save_my_song_comment')),
  ('20261103000000_finish_round_when_picker_leaves', exists (select 1 from fn where name = 'remove_member' and body like '%round_voters%'))
)
select migration, case when ok then 'ok' else 'MISSING' end as status from checks order by migration;
