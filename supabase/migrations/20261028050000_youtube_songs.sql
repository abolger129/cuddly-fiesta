-- The Gauntlet: YouTube links for songs that aren't on Spotify
--
-- A player who can't find their song on Spotify can submit a YouTube link
-- instead. These songs can't go on the Spotify playlist, so the app shows them
-- in the round with a button to open them on YouTube. Who picked them stays
-- hidden like any other song.

alter table public.submissions add column if not exists youtube_url text;

-- Only for songs not on Spotify, and only real YouTube links.
alter table public.submissions drop constraint if exists submissions_youtube_url_check;
alter table public.submissions add constraint submissions_youtube_url_check check (
  youtube_url is null
  or (
    spotify_track_id is null
    and youtube_url ~ '^https://(www\.|m\.|music\.)?(youtube\.com|youtu\.be)/'
  )
);

-- round_songs now also returns the YouTube link. Its columns changed, so it
-- has to be dropped and made again.
drop function if exists public.round_songs(uuid);

-- The round's songs without who picked them, for ranking. Only available once
-- voting has started. is_mine lets the app leave out your own song.
create function public.round_songs(rid uuid)
returns table (
  id uuid,
  spotify_track_id text,
  youtube_url text,
  track_name text,
  artist_name text,
  album_art_url text,
  is_mine boolean
)
language sql
stable
security definer set search_path = ''
as $$
  select s.id, s.spotify_track_id, s.youtube_url, s.track_name, s.artist_name, s.album_art_url,
         s.user_id = auth.uid()
  from public.submissions s
  join public.rounds r on r.id = s.round_id
  where s.round_id = rid
    and r.status in ('voting', 'finished')
    and public.is_group_member(r.group_id)
  order by s.created_at;
$$;

grant execute on function public.round_songs(uuid) to authenticated;
