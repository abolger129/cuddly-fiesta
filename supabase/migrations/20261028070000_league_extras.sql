-- Music League: editing rounds, category suggestions, passing hosting on

-- The host can rewrite the rounds that haven't started: rename, reorder, add
-- or remove them. categories is the new list of upcoming rounds, in order.
-- Upcoming rounds have no songs or votes yet, so they are simply replaced.
create or replace function public.set_upcoming_rounds(gid uuid, categories text[])
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  started int;
  n int := coalesce(array_length(categories, 1), 0);
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

  delete from public.rounds where group_id = gid and status = 'upcoming';
  insert into public.rounds (group_id, round_number, category)
  select gid, started + i, trim(categories[i])
  from generate_subscripts(categories, 1) as i;
  update public.groups set total_rounds = started + n where id = gid;
end;
$$;

grant execute on function public.set_upcoming_rounds(uuid, text[]) to authenticated;

-- Players suggest categories; the host can add them as rounds.
create table if not exists public.category_suggestions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category text not null check (char_length(category) between 1 and 120),
  created_at timestamptz not null default now()
);

alter table public.category_suggestions enable row level security;

drop policy if exists "Members see their group's suggestions" on public.category_suggestions;
create policy "Members see their group's suggestions"
  on public.category_suggestions for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists "Members can suggest categories" on public.category_suggestions;
create policy "Members can suggest categories"
  on public.category_suggestions for insert to authenticated
  with check (user_id = auth.uid() and public.is_group_member(group_id));
drop policy if exists "Suggesters and the host can remove suggestions" on public.category_suggestions;
create policy "Suggesters and the host can remove suggestions"
  on public.category_suggestions for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
  );

-- Hand the league to another player. The league playlist lives on the old
-- host's Spotify account, so its link is cleared for the new host to make
-- their own.
create or replace function public.transfer_host(gid uuid, new_host uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  g public.groups;
  sender text;
begin
  select * into g from public.groups where id = gid for update;
  if g.id is null or g.created_by <> auth.uid() then
    raise exception 'Only the host can pass hosting on';
  end if;
  if new_host = auth.uid() then
    raise exception 'You are already the host';
  end if;
  if not exists (select 1 from public.group_members where group_id = gid and user_id = new_host) then
    raise exception 'That player is not in this group';
  end if;

  update public.groups set created_by = new_host, playlist_url = null where id = gid;

  select coalesce(nullif(display_name, ''), 'Someone') into sender
  from public.profiles where id = auth.uid();
  perform public.send_push(
    array[new_host],
    g.name,
    format('%s made you the host. You can now start rounds and change the settings.', sender),
    '/group/' || gid
  );
end;
$$;

grant execute on function public.transfer_host(uuid, uuid) to authenticated;
