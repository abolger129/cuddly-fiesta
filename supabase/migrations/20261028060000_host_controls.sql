-- Music League: host controls
--
-- The host (the group's creator) can remove players, and players can leave.
-- Deleting a league needs nothing new: only the host can delete a group, and
-- its rounds, members, songs, rankings, guesses and comments go with it.
-- Host settings (guessing, scoring, timers) were already host-only: only the
-- creator can update a group.

-- Take a player out of a group. The host can remove anyone but themselves;
-- anyone else can only remove themselves (leave).
--
-- Finished rounds keep the player's songs and votes so past results stand.
-- In the round in progress, their unplayed song is withdrawn while songs are
-- being picked, and their ranking, guesses and comments are dropped while
-- ranking. If everyone left has then played, the round moves on.
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
      if (select count(distinct voter_id) from public.rankings where round_id = r.id) >= member_count then
        update public.rounds set status = 'finished' where id = r.id;
      end if;
    end if;
  end loop;
end;
$$;

grant execute on function public.remove_member(uuid, uuid) to authenticated;
