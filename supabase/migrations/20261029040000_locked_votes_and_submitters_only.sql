-- The Gauntlet: votes are final, and only players who picked a song can vote
--
-- 1. Once you save your ranking it's locked in: no changing it, your guesses
--    or your comments afterwards.
-- 2. Only players who picked a song this round can rank, guess or comment.
--    Everyone else sits the round out and plays again next round.
-- 3. A round finishes once everyone who picked a song has ranked. Nudges and
--    "time is almost up" reminders only go to them.
-- 4. Once you've ranked (or if you're sitting the round out) you can see the
--    points so far for each song, without who picked it or who voted how.
--
-- Safe to run more than once.

-- Players who picked a song in a round and are still in the league.
create or replace function public.round_voters(rid uuid)
returns setof uuid
language sql
stable
security definer set search_path = ''
as $$
  select s.user_id
  from public.submissions s
  join public.rounds r on r.id = s.round_id
  join public.group_members m on m.group_id = r.group_id and m.user_id = s.user_id
  where s.round_id = rid;
$$;

revoke execute on function public.round_voters(uuid) from public, anon, authenticated;

-- Rankings only go in through submit_ranking, and never come out.
drop policy if exists "Members can rank while voting is open" on public.rankings;
drop policy if exists "Members can redo their ranking while voting is open" on public.rankings;

-- 1 + 2 + 3. Saving a ranking --------------------------------------------------

create or replace function public.submit_ranking(rid uuid, ordered_ids uuid[])
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  r public.rounds;
  expected uuid[];
begin
  select * into r from public.rounds where id = rid for update;
  if r.id is null or not public.is_group_member(r.group_id) then
    raise exception 'You are not in this group';
  end if;
  if r.status <> 'voting' then
    raise exception 'Voting is not open for this round';
  end if;
  if not exists (select 1 from public.submissions where round_id = rid and user_id = auth.uid()) then
    raise exception 'Only players who picked a song this round can vote. You''re back in next round.';
  end if;
  if exists (select 1 from public.rankings where round_id = rid and voter_id = auth.uid()) then
    raise exception 'Your ranking is already locked in';
  end if;

  select coalesce(array_agg(id order by id), '{}') into expected
  from public.submissions
  where round_id = rid and user_id <> auth.uid();

  if (select coalesce(array_agg(x order by x), '{}') from unnest(ordered_ids) as x) <> expected then
    raise exception 'Rank every song except your own, once each';
  end if;

  insert into public.rankings (round_id, voter_id, submission_id, position)
  select rid, auth.uid(), sid, pos
  from unnest(ordered_ids) with ordinality as t(sid, pos);

  -- Everyone who picked a song has voted: the round is over.
  if not exists (
    select 1 from public.round_voters(rid) v
    where not exists (select 1 from public.rankings k where k.round_id = rid and k.voter_id = v)
  ) then
    update public.rounds set status = 'finished' where id = rid;
  end if;
end;
$$;

-- Guesses and comments are saved just before the ranking, so they lock with it.
create or replace function public.save_guesses(rid uuid, submission_ids uuid[], guessed_user_ids uuid[])
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  r public.rounds;
begin
  select * into r from public.rounds where id = rid;
  if r.id is null or not public.is_group_member(r.group_id) then
    raise exception 'You are not in this group';
  end if;
  if not (select guessing_enabled from public.groups where id = r.group_id) then
    raise exception 'Guessing is turned off for this group';
  end if;
  if r.status <> 'voting' then
    raise exception 'Voting is not open for this round';
  end if;
  if not exists (select 1 from public.submissions where round_id = rid and user_id = auth.uid()) then
    raise exception 'Only players who picked a song this round can guess';
  end if;
  if exists (select 1 from public.rankings where round_id = rid and voter_id = auth.uid()) then
    raise exception 'Your guesses are already locked in';
  end if;
  if coalesce(array_length(submission_ids, 1), 0) <> coalesce(array_length(guessed_user_ids, 1), 0) then
    raise exception 'Every guess needs a song and a player';
  end if;

  if exists (
    select 1
    from unnest(submission_ids, guessed_user_ids) as g(sid, uid)
    left join public.submissions s on s.id = g.sid and s.round_id = rid
    where s.id is null
       or s.user_id = auth.uid()
       or g.uid = auth.uid()
       or not exists (
         select 1 from public.group_members m where m.group_id = r.group_id and m.user_id = g.uid
       )
  ) then
    raise exception 'Guess other players for songs in this round, not yourself';
  end if;

  delete from public.guesses where round_id = rid and guesser_id = auth.uid();
  insert into public.guesses (round_id, guesser_id, submission_id, guessed_user_id)
  select distinct on (sid) rid, auth.uid(), sid, uid
  from unnest(submission_ids, guessed_user_ids) as g(sid, uid);
end;
$$;

create or replace function public.save_song_comments(rid uuid, submission_ids uuid[], bodies text[])
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  r public.rounds;
begin
  select * into r from public.rounds where id = rid;
  if r.id is null or not public.is_group_member(r.group_id) then
    raise exception 'You are not in this group';
  end if;
  if r.status <> 'voting' then
    raise exception 'Comments can only be left while voting is open';
  end if;
  if not exists (select 1 from public.submissions where round_id = rid and user_id = auth.uid()) then
    raise exception 'Only players who picked a song this round can comment';
  end if;
  if exists (select 1 from public.rankings where round_id = rid and voter_id = auth.uid()) then
    raise exception 'Your comments are already locked in';
  end if;
  if coalesce(array_length(submission_ids, 1), 0) <> coalesce(array_length(bodies, 1), 0) then
    raise exception 'Each comment needs a song';
  end if;
  if exists (
    select 1 from unnest(submission_ids) as sid
    where not exists (
      select 1 from public.submissions s
      where s.id = sid and s.round_id = rid and s.user_id <> auth.uid()
    )
  ) then
    raise exception 'You can only comment on other players'' songs in this round';
  end if;

  delete from public.song_comments where round_id = rid and voter_id = auth.uid();
  insert into public.song_comments (round_id, submission_id, voter_id, body)
  select rid, sid, auth.uid(), trim(body)
  from unnest(submission_ids, bodies) as t(sid, body)
  where trim(coalesce(body, '')) <> ''
  on conflict (submission_id, voter_id) do update set body = excluded.body;
end;
$$;

-- Progress now also says how many players can vote (voter_count). The return
-- type changes, so the function is dropped first.
drop function if exists public.round_progress(uuid);
create function public.round_progress(rid uuid)
returns table (
  member_count int,
  submitted_count int,
  voter_count int,
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
    (select count(*)::int from public.round_voters(r.id)),
    (select count(distinct k.voter_id)::int from public.rankings k where k.round_id = r.id),
    exists (select 1 from public.submissions s where s.round_id = r.id and s.user_id = auth.uid()),
    exists (select 1 from public.rankings k where k.round_id = r.id and k.voter_id = auth.uid())
  from public.rounds r
  where r.id = rid and public.is_group_member(r.group_id);
$$;

grant execute on function public.round_progress(uuid) to authenticated;

-- 3. Notifications -------------------------------------------------------------

-- "Time to rank" goes to players who picked a song. Players who sat the round
-- out hear that the songs are in and they're back next round.
create or replace function public.notify_round_status()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  g public.groups;
  everyone uuid[];
  voters uuid[];
  body text;
begin
  select * into g from public.groups where id = new.group_id;
  select array_agg(user_id) into everyone from public.group_members where group_id = new.group_id;

  if new.status = 'submitting' then
    body := format('Round %s is open: %s. Pick a song', new.round_number, new.category)
      || coalesce(' in the next ' || public.describe_hours(g.submit_hours), '') || '.';
  elsif new.status = 'voting' then
    select array_agg(v) into voters from public.round_voters(new.id) v;
    perform public.send_push(
      voters,
      g.name,
      format('Time to rank the songs for round %s: %s', new.round_number, new.category)
        || coalesce('. You have ' || public.describe_hours(g.vote_hours), '') || '.',
      '/round/' || new.id
    );
    perform public.send_push(
      array(select u from unnest(everyone) u where u <> all (coalesce(voters, '{}'))),
      g.name,
      format('The songs are in for round %s: %s. You sat this one out, so you''re back next round.',
        new.round_number, new.category),
      '/round/' || new.id
    );
    return new;
  elsif new.status = 'finished' then
    body := format('Round %s results are in: %s.', new.round_number, new.category);
  else
    return new;
  end if;

  perform public.send_push(everyone, g.name, body, '/round/' || new.id);
  return new;
end;
$$;

create or replace function public.send_deadline_reminders()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select ro.id, ro.group_id, ro.round_number, ro.category, g.name as group_name
    from public.rounds ro
    join public.groups g on g.id = ro.group_id
    where ro.status = 'submitting'
      and not ro.submit_reminded
      and ro.submit_deadline > now()
      and ro.submit_deadline - now() <= least(interval '3 hours', make_interval(hours => g.submit_hours) / 4)
  loop
    perform public.send_push(
      array(
        select m.user_id from public.group_members m
        where m.group_id = r.group_id
          and not exists (select 1 from public.submissions s where s.round_id = r.id and s.user_id = m.user_id)
      ),
      r.group_name,
      format('Time is almost up to pick a song for round %s: %s.', r.round_number, r.category),
      '/round/' || r.id
    );
    update public.rounds set submit_reminded = true where id = r.id;
  end loop;

  for r in
    select ro.id, ro.group_id, ro.round_number, ro.category, g.name as group_name
    from public.rounds ro
    join public.groups g on g.id = ro.group_id
    where ro.status = 'voting'
      and not ro.vote_reminded
      and ro.vote_deadline > now()
      and ro.vote_deadline - now() <= least(interval '3 hours', make_interval(hours => g.vote_hours) / 4)
  loop
    perform public.send_push(
      array(
        select v from public.round_voters(r.id) v
        where not exists (select 1 from public.rankings k where k.round_id = r.id and k.voter_id = v)
      ),
      r.group_name,
      format('Time is almost up to rank the songs for round %s: %s.', r.round_number, r.category),
      '/round/' || r.id
    );
    update public.rounds set vote_reminded = true where id = r.id;
  end loop;
end;
$$;

revoke execute on function public.send_deadline_reminders() from public, anon, authenticated;

create or replace function public.nudge_round(rid uuid)
returns int
language plpgsql
security definer set search_path = ''
as $$
declare
  r public.rounds;
  cooldown int;
  sender text;
  recipients uuid[];
  body text;
begin
  select * into r from public.rounds where id = rid for update;
  if r.id is null or not public.is_group_member(r.group_id) then
    raise exception 'You are not in this group';
  end if;
  if r.status not in ('submitting', 'voting') then
    raise exception 'This round is not in progress';
  end if;

  select g.nudge_cooldown_minutes into cooldown from public.groups g where g.id = r.group_id;
  if cooldown is null then
    raise exception 'The host has turned off nudges for this league';
  end if;
  if r.last_nudged_at > now() - make_interval(mins => cooldown) then
    raise exception 'Someone already sent a nudge recently. Give everyone a little longer.';
  end if;

  if r.status = 'submitting' then
    select array_agg(m.user_id) into recipients
    from public.group_members m
    where m.group_id = r.group_id
      and m.user_id <> auth.uid()
      and not exists (select 1 from public.submissions s where s.round_id = rid and s.user_id = m.user_id);
  else
    -- Only players who picked a song can rank.
    select array_agg(v) into recipients
    from public.round_voters(rid) v
    where v <> auth.uid()
      and not exists (select 1 from public.rankings k where k.round_id = rid and k.voter_id = v);
  end if;
  if recipients is null then
    raise exception 'Everyone else is already in';
  end if;

  select coalesce(nullif(display_name, ''), 'Someone') into sender
  from public.profiles where id = auth.uid();
  body := format('%s nudged you: %s for round %s, %s.',
    sender,
    case when r.status = 'submitting' then 'pick a song' else 'rank the songs' end,
    r.round_number, r.category);

  perform public.send_push(recipients, (select name from public.groups where id = r.group_id), body, '/round/' || rid);
  update public.rounds set last_nudged_at = now() where id = rid;
  return array_length(recipients, 1);
end;
$$;

-- 4. Points so far ------------------------------------------------------------

-- Every vote saved so far in a round that's still being voted on, for players
-- who have already ranked or who are sitting the round out. Each row is one
-- song's place in one voter's ranking, with no voter attached, and songs are
-- only ids, which match round_songs (that never says who picked what).
-- songs_ranked is how many songs that voter ranked, which the scoring rules
-- need. Empty for anyone else.
create or replace function public.round_votes_so_far(rid uuid)
returns table (submission_id uuid, "position" int, songs_ranked int)
language sql
stable
security definer set search_path = ''
as $$
  select k.submission_id, k.position,
         (count(*) over (partition by k.voter_id))::int
  from public.rankings k
  join public.rounds r on r.id = k.round_id
  where k.round_id = rid
    and r.status = 'voting'
    and public.is_group_member(r.group_id)
    and (
      exists (select 1 from public.rankings mine where mine.round_id = rid and mine.voter_id = auth.uid())
      or not exists (select 1 from public.submissions s where s.round_id = rid and s.user_id = auth.uid())
    )
  order by k.submission_id, k.position;
$$;

grant execute on function public.round_votes_so_far(uuid) to authenticated;
