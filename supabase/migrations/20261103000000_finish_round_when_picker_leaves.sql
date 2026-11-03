-- The Gauntlet: a round no longer gets stuck when someone leaves mid-vote
--
-- Since only players who picked a song can rank (20261029040000), a round
-- finishes once every picker still in the league has ranked. But leaving a
-- league (or deleting your account, or being removed by the host) still
-- checked the old rule, "everyone in the league has ranked", so a picker
-- leaving before they ranked left the round open for good when there was no
-- ranking timer. The host's "End voting now" button was hidden too, because
-- the app saw nobody left to rank.
--
-- This makes leaving use the same rule as saving a ranking, and finishes any
-- round that is already stuck that way.
--
-- Run after 20261029040000_locked_votes_and_submitters_only.sql (it uses
-- round_voters). Safe to run more than once.

create or replace function public.remove_member(gid uuid, uid uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  host uuid;
  r public.rounds;
  member_count int;
begin
  select created_by into host from public.groups where id = gid;
  if host is null or not public.is_group_member(gid) then
    raise exception 'You are not in this group';
  end if;
  if uid = host then
    raise exception 'The host can''t leave their own league. Delete it instead.';
  end if;
  if uid <> auth.uid() and auth.uid() <> host then
    raise exception 'Only the host can remove players';
  end if;

  delete from public.group_members where group_id = gid and user_id = uid;
  if not found then
    raise exception 'That player is not in this group';
  end if;

  select count(*) into member_count from public.group_members where group_id = gid;

  for r in
    select * from public.rounds
    where group_id = gid and status in ('submitting', 'voting')
    for update
  loop
    if r.status = 'submitting' then
      delete from public.submissions where round_id = r.id and user_id = uid;
      if (select count(*) from public.submissions where round_id = r.id) >= greatest(2, member_count) then
        update public.rounds set status = 'voting' where id = r.id;
      end if;
    else
      delete from public.rankings where round_id = r.id and voter_id = uid;
      delete from public.guesses where round_id = r.id and guesser_id = uid;
      delete from public.song_comments where round_id = r.id and voter_id = uid;
      -- Everyone who picked a song and is still here has ranked: the round is over.
      if not exists (
        select 1 from public.round_voters(r.id) v
        where not exists (select 1 from public.rankings k where k.round_id = r.id and k.voter_id = v)
      ) then
        update public.rounds set status = 'finished' where id = r.id;
      end if;
    end if;
  end loop;
end;
$$;

grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- Rounds already stuck: ranking is open but every picker still in the league
-- has ranked. Oldest first, so each finished round opens the next one.
do $$
declare
  stuck record;
begin
  for stuck in
    select r.id from public.rounds r
    where r.status = 'voting'
      and exists (select 1 from public.rankings k where k.round_id = r.id)
      and not exists (
        select 1 from public.round_voters(r.id) v
        where not exists (select 1 from public.rankings k where k.round_id = r.id and k.voter_id = v)
      )
    order by r.group_id, r.round_number
  loop
    update public.rounds set status = 'finished' where id = stuck.id and status = 'voting';
  end loop;
end;
$$;
