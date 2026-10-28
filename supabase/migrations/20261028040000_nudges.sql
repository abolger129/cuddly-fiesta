-- Music League: nudges
--
-- Any player can nudge the people who haven't picked a song (or ranked) yet,
-- which sends them a push notification. To keep it friendly, a round can be
-- nudged once an hour, whoever does it. Nobody is told who hasn't played.

alter table public.rounds add column last_nudged_at timestamptz;

-- Returns how many players were nudged.
create function public.nudge_round(rid uuid)
returns int
language plpgsql
security definer set search_path = ''
as $$
declare
  r public.rounds;
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
  if r.last_nudged_at > now() - interval '1 hour' then
    raise exception 'Someone already sent a nudge in the last hour. Give everyone a little longer.';
  end if;

  select array_agg(m.user_id) into recipients
  from public.group_members m
  where m.group_id = r.group_id
    and m.user_id <> auth.uid()
    and case when r.status = 'submitting'
      then not exists (select 1 from public.submissions s where s.round_id = rid and s.user_id = m.user_id)
      else not exists (select 1 from public.rankings k where k.round_id = rid and k.voter_id = m.user_id)
    end;
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
