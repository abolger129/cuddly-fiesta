-- Music League: one Spotify playlist with every song from the whole league.
-- The group creator makes it on their own Spotify account, like round playlists.
alter table public.groups add column if not exists playlist_url text;
