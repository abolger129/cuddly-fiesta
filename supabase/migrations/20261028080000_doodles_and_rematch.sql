-- Music League: doodle avatars and rematches

-- Players draw their own stick figure as their avatar. It's stored as SVG path
-- data on a 100 by 100 canvas, drawn by the app.
alter table public.profiles
  add column if not exists avatar_doodle text
    check (avatar_doodle is null or char_length(avatar_doodle) <= 12000);

-- Start a new league with the same players and rules as an old one. Anyone in
-- the old league can start it, and they become the new league's host.
-- Everyone else is added straight away and gets a notification.
create or replace function public.rematch_league(gid uuid, group_name text, categories text[])
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  old public.groups;
  new_gid uuid;
  n int := coalesce(array_length(categories, 1), 0);
  host_name text;
begin
  select * into old from public.groups where id = gid;
  if old.id is null or not public.is_group_member(gid) then
    raise exception 'You are not in this league';
  end if;
  if n = 0 then
    raise exception 'Add at least one round';
  end if;
  if exists (select 1 from unnest(categories) as c where char_length(trim(c)) not between 1 and 120) then
    raise exception 'Every round needs a category of up to 120 characters';
  end if;

  insert into public.groups (
    name, total_rounds, created_by, points_cap, downvotes, submit_hours, vote_hours, guessing_enabled
  )
  values (
    trim(group_name), n, auth.uid(), old.points_cap, old.downvotes, old.submit_hours, old.vote_hours,
    old.guessing_enabled
  )
  returning id into new_gid;

  insert into public.rounds (group_id, round_number, category)
  select new_gid, i, trim(categories[i])
  from generate_subscripts(categories, 1) as i;

  -- The new host was added as a member when the group was made.
  insert into public.group_members (group_id, user_id)
  select new_gid, user_id from public.group_members where group_id = gid
  on conflict do nothing;

  select display_name into host_name from public.profiles where id = auth.uid();
  perform public.send_push(
    array(select user_id from public.group_members where group_id = new_gid and user_id <> auth.uid()),
    'Rematch!',
    coalesce(nullif(host_name, ''), 'Someone') || ' started ' || trim(group_name) || ' with the same crew.',
    '/group/' || new_gid
  );

  return new_gid;
end;
$$;

grant execute on function public.rematch_league(uuid, text, text[]) to authenticated;
