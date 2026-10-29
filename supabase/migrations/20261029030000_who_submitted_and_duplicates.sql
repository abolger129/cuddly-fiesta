-- The Gauntlet: who has submitted, and a heads-up on duplicate picks
--
-- 1. Everyone in a league can see which players have already picked a song
--    this round (just who, never what).
-- 2. Before you submit, the app asks whether someone else this round already
--    picked the same song, a song from the same album, or a song by the same
--    artist. The answer says only what matched, never who picked it or what
--    else they picked. It's a warning: you can still submit.
--
-- Safe to run more than once.

-- Album details for Spotify picks, so "same album" can be spotted. YouTube
-- picks leave these empty and are matched on song title and artist instead.
alter table public.submissions add column if not exists spotify_album_id text;
alter table public.submissions add column if not exists album_name text;

-- Who has picked a song this round, for players in the league.
create or replace function public.round_submitters(rid uuid)
returns table (user_id uuid)
language sql
stable
security definer set search_path = ''
as $$
  select s.user_id
  from public.submissions s
  join public.rounds r on r.id = s.round_id
  where s.round_id = rid and public.is_group_member(r.group_id);
$$;

grant execute on function public.round_submitters(uuid) to authenticated;

-- Each artist credited on a song ("A, B feat. C" is three), as typed and
-- normalized the same way as banned artists (see public.normalize_artist).
create or replace function public.credited_artists(artist_name text)
returns table (name text, normalized text)
language sql
immutable
set search_path = ''
as $$
  select trim(a), public.normalize_artist(a)
  from regexp_split_to_table(
    artist_name,
    '\s*(,|&|\+|;|/|\mfeat\M\.?|\mft\M\.?|\mfeaturing\M|\mwith\M)\s*',
    'i'
  ) as a
  where public.normalize_artist(a) <> '';
$$;

-- A song title without the extras that differ between versions:
-- "Dreams - 2004 Remaster" and "Dreams (Official Video)" are both "dreams".
create or replace function public.normalize_title(title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(lower(title), '\s+-\s+.*$', ''),
      '[\(\[][^\)\]]*[\)\]]', '', 'g'
    ),
    '[^[:alnum:]]+', '', 'g'
  );
$$;

-- What the song you're about to submit has in common with other players'
-- picks this round. Your own pick is left out. Only works while songs are
-- being picked, and only for players in the league.
create or replace function public.similar_picks(
  rid uuid,
  title text,
  artists text,
  track_id text default null,
  album_id text default null
)
returns table (
  same_song boolean,
  same_album boolean,
  same_artists text[]
)
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  my_title text := public.normalize_title(title);
begin
  if not exists (
    select 1 from public.rounds r
    where r.id = rid and r.status = 'submitting' and public.is_group_member(r.group_id)
  ) then
    return query select false, false, '{}'::text[];
    return;
  end if;

  return query
  with others as (
    select s.*
    from public.submissions s
    where s.round_id = rid and s.user_id <> auth.uid()
  ),
  mine as (
    select * from public.credited_artists(artists)
  ),
  -- Your credited artists that someone else's song also credits, as you typed them.
  shared as (
    select distinct m.name
    from mine m
    where exists (
      select 1 from others o, public.credited_artists(o.artist_name) c
      where c.normalized = m.normalized
    )
  )
  select
    exists (
      select 1 from others o
      where (track_id is not null and o.spotify_track_id = track_id)
         or (
           my_title <> ''
           and public.normalize_title(o.track_name) = my_title
           and exists (
             select 1 from public.credited_artists(o.artist_name) c
             where c.normalized in (select normalized from mine)
           )
         )
    ),
    exists (
      select 1 from others o
      where album_id is not null and o.spotify_album_id = album_id
    ),
    coalesce((select array_agg(sh.name order by sh.name) from shared sh), '{}'::text[]);
end;
$$;

grant execute on function public.similar_picks(uuid, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
