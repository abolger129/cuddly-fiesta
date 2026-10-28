-- The Gauntlet: banned artists
--
-- The host can ban artists for the whole league or for one round. A song by a
-- banned artist can't be submitted, from Spotify or as a YouTube link. The app
-- warns players as they pick; the trigger below has the final say.
--
-- Matching ignores case, spaces, punctuation and a leading "the", and checks
-- each artist credited on the song ("A, B feat. C") as well as the whole
-- credit. src/lib/banned-artists.ts does the same in the app: keep the two in step.

alter table public.groups add column if not exists banned_artists text[] not null default '{}';
alter table public.rounds add column if not exists banned_artists text[] not null default '{}';

alter table public.groups drop constraint if exists groups_banned_artists_check;
alter table public.groups add constraint groups_banned_artists_check
  check (cardinality(banned_artists) <= 100);
alter table public.rounds drop constraint if exists rounds_banned_artists_check;
alter table public.rounds add constraint rounds_banned_artists_check
  check (cardinality(banned_artists) <= 100);

-- Only the host can change either list: only the host can update a group, and
-- only the host can update rounds (see the init migration's policies).

create or replace function public.normalize_artist(name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    regexp_replace(lower(trim(name)), '^the\s+', ''),
    '[^[:alnum:]]+', '', 'g'
  );
$$;

-- The ban that rules out a song credited to artist_name, as the host typed it.
-- null if none does.
create or replace function public.banned_artist_in(artist_name text, bans text[])
returns text
language sql
immutable
set search_path = ''
as $$
  with credited as (
    select public.normalize_artist(a) as name
    from regexp_split_to_table(
      artist_name,
      '\s*(,|&|\+|;|/|\mfeat\M\.?|\mft\M\.?|\mfeaturing\M|\mwith\M)\s*',
      'i'
    ) as a
    union
    select public.normalize_artist(artist_name)
  )
  select ban
  from unnest(bans) with ordinality as b(ban, n)
  where public.normalize_artist(ban) <> ''
    and public.normalize_artist(ban) in (select name from credited)
  order by n
  limit 1;
$$;

create or replace function public.check_banned_artists()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  league_bans text[];
  round_bans text[];
  hit text;
begin
  select g.banned_artists, r.banned_artists into league_bans, round_bans
  from public.rounds r
  join public.groups g on g.id = r.group_id
  where r.id = new.round_id;

  hit := public.banned_artist_in(new.artist_name, round_bans);
  if hit is not null then
    raise exception '% is banned this round. Pick a song by someone else.', hit;
  end if;
  hit := public.banned_artist_in(new.artist_name, league_bans);
  if hit is not null then
    raise exception '% is banned in this league. Pick a song by someone else.', hit;
  end if;
  return new;
end;
$$;

drop trigger if exists check_banned_artists on public.submissions;
create trigger check_banned_artists
  before insert or update of artist_name, round_id on public.submissions
  for each row execute function public.check_banned_artists();

-- Editing the upcoming rounds replaces them, so carry each round's bans over
-- to the round with the same category.
create or replace function public.set_upcoming_rounds(gid uuid, categories text[])
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  started int;
  n int := coalesce(array_length(categories, 1), 0);
  kept jsonb;
begin
  if not exists (select 1 from public.groups where id = gid and created_by = auth.uid()) then
    raise exception 'Only the host can change the rounds';
  end if;
  if exists (select 1 from unnest(categories) as c where char_length(trim(c)) not between 1 and 120) then
    raise exception 'Every round needs a category of up to 120 characters';
  end if;

  perform 1 from public.rounds where group_id = gid for update;
  select coalesce(max(round_number), 0) into started
  from public.rounds where group_id = gid and status <> 'upcoming';
  if started + n = 0 then
    raise exception 'Add at least one round';
  end if;
  if started + n > 30 then
    raise exception 'A league can have up to 30 rounds';
  end if;

  -- Each upcoming category's bans, by lowercase category, before the rounds go.
  select coalesce(jsonb_object_agg(category, bans), '{}') into kept
  from (
    select distinct on (lower(category)) lower(category) as category, to_jsonb(banned_artists) as bans
    from public.rounds
    where group_id = gid and status = 'upcoming' and cardinality(banned_artists) > 0
    order by lower(category), round_number
  ) as b;

  delete from public.rounds where group_id = gid and status = 'upcoming';
  insert into public.rounds (group_id, round_number, category, banned_artists)
  select gid, started + i, trim(categories[i]),
         coalesce(
           array(select jsonb_array_elements_text(kept -> lower(trim(categories[i])))),
           '{}'
         )
  from generate_subscripts(categories, 1) as i;
  update public.groups set total_rounds = started + n where id = gid;
end;
$$;

grant execute on function public.set_upcoming_rounds(uuid, text[]) to authenticated;
