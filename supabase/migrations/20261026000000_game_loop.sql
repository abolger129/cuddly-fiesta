-- Music League: functions that run the game
--
-- Round lifecycle: upcoming -> submitting -> voting -> finished.
-- The group creator starts each round. A round moves to voting on its own once
-- every member has submitted, and to finished once every member has ranked.
-- The creator can also move a round on early, for friends who never get to it.

-- Songs are typed in by hand until Spotify search is added.
alter table public.submissions alter column spotify_track_id drop not null;

-- Create a group and its rounds in one go. One round per category, in order.
create function public.create_group(group_name text, categories text[])
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  gid uuid;
  n int := coalesce(array_length(categories, 1), 0);
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in';
  end if;
  if n = 0 then
    raise exception 'Add at least one round';
  end if;

  insert into public.groups (name, total_rounds, created_by)
  values (trim(group_name), n, auth.uid())
  returning id into gid;

  insert into public.rounds (group_id, round_number, category)
  select gid, i, trim(categories[i])
  from generate_subscripts(categories, 1) as i;

  return gid;
end;
$$;

-- Open the next round for submissions. Rounds are played in order, one at a time.
create function public.start_round(rid uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  r public.rounds;
begin
  select * into r from public.rounds where id = rid for update;
  if r.id is null or not exists (
    select 1 from public.groups where id = r.group_id and created_by = auth.uid()
  ) then
    raise exception 'Only the group creator can start rounds';
  end if;
  if r.status <> 'upcoming' then
    raise exception 'This round has already started';
  end if;
  if exists (
    select 1 from public.rounds
    where group_id = r.group_id and round_number < r.round_number and status <> 'finished'
  ) then
    raise exception 'Finish the earlier rounds first';
  end if;

  update public.rounds set status = 'submitting' where id = rid;
end;
$$;

-- Move a round on early: close submissions, or close voting.
create function public.advance_round(rid uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  r public.rounds;
begin
  select * into r from public.rounds where id = rid for update;
  if r.id is null or not exists (
    select 1 from public.groups where id = r.group_id and created_by = auth.uid()
  ) then
    raise exception 'Only the group creator can move rounds on';
  end if;

  if r.status = 'submitting' then
    if (select count(*) from public.submissions where round_id = rid) < 2 then
      raise exception 'At least two songs are needed before voting';
    end if;
    update public.rounds set status = 'voting' where id = rid;
  elsif r.status = 'voting' then
    update public.rounds set status = 'finished' where id = rid;
  else
    raise exception 'This round is not in progress';
  end if;
end;
$$;

-- How far along a round is, without revealing who has submitted what.
create function public.round_progress(rid uuid)
returns table (
  member_count int,
  submitted_count int,
  ranked_count int,
  has_submitted boolean,
  has_ranked boolean
)
language sql
stable
security definer set search_path = ''
as $$
  select
    (select count(*)::int from public.group_members m where m.group_id = r.group_id),
    (select count(*)::int from public.submissions s where s.round_id = r.id),
    (select count(distinct k.voter_id)::int from public.rankings k where k.round_id = r.id),
    exists (select 1 from public.submissions s where s.round_id = r.id and s.user_id = auth.uid()),
    exists (select 1 from public.rankings k where k.round_id = r.id and k.voter_id = auth.uid())
  from public.rounds r
  where r.id = rid and public.is_group_member(r.group_id);
$$;

-- The round's songs without who picked them, for ranking. Only available once
-- voting has started. is_mine lets the app leave out your own song.
create function public.round_songs(rid uuid)
returns table (
  id uuid,
  spotify_track_id text,
  track_name text,
  artist_name text,
  album_art_url text,
  is_mine boolean
)
language sql
stable
security definer set search_path = ''
as $$
  select s.id, s.spotify_track_id, s.track_name, s.artist_name, s.album_art_url,
         s.user_id = auth.uid()
  from public.submissions s
  join public.rounds r on r.id = s.round_id
  where s.round_id = rid
    and r.status in ('voting', 'finished')
    and public.is_group_member(r.group_id)
  order by s.created_at;
$$;

-- Save a ranking. ordered_ids is every song in the round except your own,
-- favourite first. Replaces any ranking you saved before.
create function public.submit_ranking(rid uuid, ordered_ids uuid[])
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  r public.rounds;
  expected uuid[];
begin
  select * into r from public.rounds where id = rid;
  if r.id is null or not public.is_group_member(r.group_id) then
    raise exception 'You are not in this group';
  end if;
  if r.status <> 'voting' then
    raise exception 'Voting is not open for this round';
  end if;

  select coalesce(array_agg(id order by id), '{}') into expected
  from public.submissions
  where round_id = rid and user_id <> auth.uid();

  if (select coalesce(array_agg(x order by x), '{}') from unnest(ordered_ids) as x) <> expected then
    raise exception 'Rank every song except your own, once each';
  end if;

  delete from public.rankings where round_id = rid and voter_id = auth.uid();
  insert into public.rankings (round_id, voter_id, submission_id, position)
  select rid, auth.uid(), sid, pos
  from unnest(ordered_ids) with ordinality as t(sid, pos);

  -- Everyone has voted: the round is over.
  if (select count(distinct voter_id) from public.rankings where round_id = rid)
     >= (select count(*) from public.group_members where group_id = r.group_id) then
    update public.rounds set status = 'finished' where id = rid;
  end if;
end;
$$;

-- Everyone has submitted: start voting.
create function public.open_voting_when_all_submitted()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  gid uuid;
begin
  select group_id into gid from public.rounds where id = new.round_id;
  if (select count(*) from public.submissions where round_id = new.round_id)
     >= greatest(2, (select count(*) from public.group_members where group_id = gid)) then
    update public.rounds set status = 'voting'
    where id = new.round_id and status = 'submitting';
  end if;
  return new;
end;
$$;

create trigger on_submission_added
  after insert on public.submissions
  for each row execute function public.open_voting_when_all_submitted();
