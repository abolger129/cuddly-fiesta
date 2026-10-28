-- Music League: initial schema
--
-- A group is a league of friends. It runs a fixed number of rounds, each with a
-- category. Every member submits one song per round, then ranks the round's
-- songs. Scores are calculated in the app from the rankings so the scoring rule
-- is easy to change.

-- Profiles ------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- Create a profile automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), ''));
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Groups --------------------------------------------------------------------

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique
    default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_by uuid not null default auth.uid() references public.profiles (id),
  total_rounds int not null default 8 check (total_rounds between 1 and 30),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- The creator of a group is always a member of it.
create or replace function public.add_creator_as_member()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id)
  values (new.id, new.created_by);
  return new;
end;
$$;

create or replace trigger on_group_created
  after insert on public.groups
  for each row execute function public.add_creator_as_member();

-- Used by row level security policies. Security definer so that checking
-- membership does not itself trip the group_members policies.
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- Join a group with its invite code. Returns the group id.
create or replace function public.join_group(code text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  gid uuid;
begin
  select id into gid from public.groups where invite_code = upper(trim(code));
  if gid is null then
    raise exception 'No group found with that invite code';
  end if;
  insert into public.group_members (group_id, user_id)
  values (gid, auth.uid())
  on conflict do nothing;
  return gid;
end;
$$;

-- Rounds --------------------------------------------------------------------

do $$
begin
  create type public.round_status as enum ('upcoming', 'submitting', 'voting', 'finished');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  round_number int not null check (round_number >= 1),
  category text not null check (char_length(category) between 1 and 120),
  status public.round_status not null default 'upcoming',
  playlist_url text,
  created_at timestamptz not null default now(),
  unique (group_id, round_number)
);

-- Submissions ---------------------------------------------------------------

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  spotify_track_id text not null,
  track_name text not null,
  artist_name text not null,
  album_art_url text,
  created_at timestamptz not null default now(),
  unique (round_id, user_id)
);

-- Rankings ------------------------------------------------------------------

-- One row per (voter, song). position 1 is the voter's favourite.
create table if not exists public.rankings (
  round_id uuid not null references public.rounds (id) on delete cascade,
  voter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  position int not null check (position >= 1),
  created_at timestamptz not null default now(),
  primary key (round_id, voter_id, submission_id),
  unique (round_id, voter_id, position)
);

-- Row level security ----------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.rounds enable row level security;
alter table public.submissions enable row level security;
alter table public.rankings enable row level security;

drop policy if exists "Signed-in users can see profiles" on public.profiles;
create policy "Signed-in users can see profiles"
  on public.profiles for select to authenticated using (true);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Members can see their groups" on public.groups;
create policy "Members can see their groups"
  on public.groups for select to authenticated
  using (created_by = auth.uid() or public.is_group_member(id));
drop policy if exists "Signed-in users can create groups" on public.groups;
create policy "Signed-in users can create groups"
  on public.groups for insert to authenticated
  with check (created_by = auth.uid());
drop policy if exists "Creators can update their groups" on public.groups;
create policy "Creators can update their groups"
  on public.groups for update to authenticated
  using (created_by = auth.uid());
drop policy if exists "Creators can delete their groups" on public.groups;
create policy "Creators can delete their groups"
  on public.groups for delete to authenticated
  using (created_by = auth.uid());

drop policy if exists "Members can see who is in their groups" on public.group_members;
create policy "Members can see who is in their groups"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists "Members can leave groups" on public.group_members;
create policy "Members can leave groups"
  on public.group_members for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Members can see rounds" on public.rounds;
create policy "Members can see rounds"
  on public.rounds for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists "Group creators can manage rounds" on public.rounds;
create policy "Group creators can manage rounds"
  on public.rounds for all to authenticated
  using (exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()))
  with check (exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()));

-- Who submitted which song stays hidden until the round is finished, so
-- members only see their own submission rows before then. The app will read
-- the anonymous song list for ranking through a view added with the game loop.
drop policy if exists "Members see own submissions, or all once the round is finished" on public.submissions;
create policy "Members see own submissions, or all once the round is finished"
  on public.submissions for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rounds r
      where r.id = round_id and r.status = 'finished' and public.is_group_member(r.group_id)
    )
  );
drop policy if exists "Members can submit while the round is open" on public.submissions;
create policy "Members can submit while the round is open"
  on public.submissions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.rounds r
      where r.id = round_id and r.status = 'submitting' and public.is_group_member(r.group_id)
    )
  );
drop policy if exists "Members can change their submission while the round is open" on public.submissions;
create policy "Members can change their submission while the round is open"
  on public.submissions for update to authenticated
  using (user_id = auth.uid() and exists (
    select 1 from public.rounds r where r.id = round_id and r.status = 'submitting'))
  with check (user_id = auth.uid());
drop policy if exists "Members can withdraw their submission while the round is open" on public.submissions;
create policy "Members can withdraw their submission while the round is open"
  on public.submissions for delete to authenticated
  using (user_id = auth.uid() and exists (
    select 1 from public.rounds r where r.id = round_id and r.status = 'submitting'));

drop policy if exists "Voters see own rankings, or all once the round is finished" on public.rankings;
create policy "Voters see own rankings, or all once the round is finished"
  on public.rankings for select to authenticated
  using (
    voter_id = auth.uid()
    or exists (
      select 1 from public.rounds r
      where r.id = round_id and r.status = 'finished' and public.is_group_member(r.group_id)
    )
  );
drop policy if exists "Members can rank while voting is open" on public.rankings;
create policy "Members can rank while voting is open"
  on public.rankings for insert to authenticated
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.rounds r
      where r.id = round_id and r.status = 'voting' and public.is_group_member(r.group_id)
    )
  );
drop policy if exists "Members can redo their ranking while voting is open" on public.rankings;
create policy "Members can redo their ranking while voting is open"
  on public.rankings for delete to authenticated
  using (voter_id = auth.uid() and exists (
    select 1 from public.rounds r where r.id = round_id and r.status = 'voting'));
