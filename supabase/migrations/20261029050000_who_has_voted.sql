-- The Gauntlet: who has voted
--
-- While ranking is open, everyone in a league can see which of the players
-- who picked a song have locked in their ranking (just who, never how they
-- voted). Players who didn't pick a song aren't listed: they sit the round out.
--
-- Safe to run more than once.

create or replace function public.round_voter_status(rid uuid)
returns table (user_id uuid, has_ranked boolean)
language sql
stable
security definer set search_path = ''
as $$
  select v, exists (select 1 from public.rankings k where k.round_id = rid and k.voter_id = v)
  from public.round_voters(rid) v
  join public.rounds r on r.id = rid
  where r.status = 'voting' and public.is_group_member(r.group_id);
$$;

grant execute on function public.round_voter_status(uuid) to authenticated;
