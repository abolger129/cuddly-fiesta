-- Music League: rounds run themselves
--
-- Voting already starts once everyone has picked a song, and a round already
-- finishes once everyone has ranked (or when a timer runs out). This adds:
--
-- 1. When a round finishes, the next round opens for songs straight away, so
--    the host only ever starts round 1.
-- 2. When ranking opens, the round's Spotify playlist is made right then, and
--    when a round finishes the league playlist is brought up to date, without
--    waiting for someone to open the app. The database asks the
--    spotify-playlist function to do it (pg_net). The app still asks for the
--    playlist when a round is opened, so nothing is lost if a request fails.

-- 1. Next round ------------------------------------------------------------------

create or replace function public.start_next_round()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.rounds r set status = 'submitting'
  where r.id = (
      select n.id from public.rounds n
      where n.group_id = new.group_id and n.status = 'upcoming'
      order by n.round_number
      limit 1
    )
    -- Rounds are played in order, one at a time.
    and not exists (
      select 1 from public.rounds e
      where e.group_id = new.group_id
        and e.round_number < r.round_number
        and e.status <> 'finished'
    );
  return new;
end;
$$;

-- Named to run after on_round_status_notify, so "results are in" goes out
-- before "the next round is open".
create or replace trigger on_round_status_start_next
  after update of status on public.rounds
  for each row
  when (new.status = 'finished' and old.status is distinct from 'finished')
  execute function public.start_next_round();

-- 2. Playlists -------------------------------------------------------------------

-- Settings only the server sees: no policies, so the app can't read them, and
-- only edge functions (service role) and these functions can.
--   playlist_hook_secret: proves a playlist request came from the database.
--   functions_url: the project's address, saved by the spotify-playlist
--   function the first time anyone uses it after it's deployed.
create table if not exists public.server_settings (
  key text primary key,
  value text not null
);

alter table public.server_settings enable row level security;
revoke all on public.server_settings from anon, authenticated;
grant select, insert, update on public.server_settings to service_role;

insert into public.server_settings (key, value)
values ('playlist_hook_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- payload is { round_id } or { group_id }, as the app sends.
create or replace function public.request_playlist(payload jsonb)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  base text;
  secret text;
begin
  select value into base from public.server_settings where key = 'functions_url';
  select value into secret from public.server_settings where key = 'playlist_hook_secret';
  if base is null or secret is null then
    -- Not set up yet: the app makes the playlist when the round is opened.
    return;
  end if;
  perform net.http_post(
    url := base || '/functions/v1/spotify-playlist',
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-playlist-hook', secret),
    timeout_milliseconds := 30000
  );
end;
$$;

create or replace function public.make_playlists_on_round_status()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.status = 'voting' then
    perform public.request_playlist(jsonb_build_object('round_id', new.id));
  elsif new.status = 'finished' then
    perform public.request_playlist(jsonb_build_object('group_id', new.group_id));
  end if;
  return new;
end;
$$;

create or replace trigger on_round_status_playlists
  after update of status on public.rounds
  for each row
  when (new.status is distinct from old.status)
  execute function public.make_playlists_on_round_status();

revoke execute on function public.start_next_round() from public, anon, authenticated;
revoke execute on function public.request_playlist(jsonb) from public, anon, authenticated;
revoke execute on function public.make_playlists_on_round_status() from public, anon, authenticated;
