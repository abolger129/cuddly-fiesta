-- The Gauntlet: shuffled song order
--
-- Songs used to show up in the order they were picked, which gave away who
-- picked early and who picked late. Now each round's songs are shuffled once,
-- when ranking opens, and that same order is used everywhere: the round's
-- Spotify playlist, the ranking screen, the shared song list and the league
-- playlist.
--
-- Safe to run more than once.

alter table public.submissions add column if not exists play_order int;

-- Shuffles a round's songs. Only songs that don't have a place yet are moved,
-- so running it again never changes an order people have already seen.
create or replace function public.shuffle_round_songs(rid uuid)
returns void
language sql
security definer set search_path = ''
as $$
  update public.submissions s
  set play_order = shuffled.n + coalesce(
    (select max(play_order) from public.submissions where round_id = rid), 0)
  from (
    select id, row_number() over (order by random()) as n
    from public.submissions
    where round_id = rid and play_order is null
  ) shuffled
  where s.id = shuffled.id;
$$;

create or replace function public.shuffle_songs_on_voting()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.shuffle_round_songs(new.id);
  return new;
end;
$$;

-- Named to sort before on_round_status_playlists, so the order is in place
-- before the playlist is asked for.
create or replace trigger on_round_status_order_songs
  after update of status on public.rounds
  for each row
  when (new.status = 'voting' and new.status is distinct from old.status)
  execute function public.shuffle_songs_on_voting();

revoke execute on function public.shuffle_round_songs(uuid) from public, anon, authenticated;
revoke execute on function public.shuffle_songs_on_voting() from public, anon, authenticated;

-- Rounds that are already being ranked or are finished get an order now.
select public.shuffle_round_songs(r.id)
from public.rounds r
where r.status in ('voting', 'finished')
  and exists (select 1 from public.submissions s where s.round_id = r.id and s.play_order is null);

-- Same columns as before, now in the shuffled order.
create or replace function public.round_songs(rid uuid)
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
  order by s.play_order nulls last, s.id;
$$;

grant execute on function public.round_songs(uuid) to authenticated;
