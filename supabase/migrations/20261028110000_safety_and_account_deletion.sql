-- The Gauntlet: reporting, blocking and account deletion
--
-- App Store guideline 1.2 (user-generated content) asks for a way to report
-- objectionable content, a way to block abusive players, and a developer who
-- acts on reports within 24 hours. Guideline 5.1.1(v) asks for account
-- deletion inside the app.
--
-- Reports and blocks land in tables only the Supabase dashboard can read.
-- Whoever is listed in app_admins gets a push notification for each one.
-- See docs/moderation.md for how to act on them.

-- Admins ----------------------------------------------------------------------

-- Add yourself in the dashboard (Table Editor → app_admins → Insert row) to be
-- notified about reports. No policies: the app can't read or change it.
create table if not exists public.app_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade
);

alter table public.app_admins enable row level security;

create or replace function public.notify_admins(msg_body text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  admins uuid[];
begin
  select array_agg(user_id) into admins from public.app_admins;
  if admins is not null then
    perform public.send_push(admins, 'The Gauntlet moderation', msg_body, '/');
  end if;
end;
$$;

revoke execute on function public.notify_admins(text) from public, anon, authenticated;

-- Blocks ----------------------------------------------------------------------

-- A block hides the blocked player's comments, name and avatar from you, and
-- your comments from them. Their songs stay in the game so rounds still work.
create table if not exists public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

drop policy if exists "Players see who they blocked" on public.blocks;
create policy "Players see who they blocked"
  on public.blocks for select to authenticated
  using (blocker_id = auth.uid());
drop policy if exists "Players can unblock" on public.blocks;
create policy "Players can unblock"
  on public.blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- True if either player has blocked the other.
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- Block a player. Blocking also tells the admins, since it often means
-- something abusive happened.
create or replace function public.block_player(uid uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in';
  end if;
  if uid = auth.uid() then
    raise exception 'You can''t block yourself';
  end if;
  insert into public.blocks (blocker_id, blocked_id)
  values (auth.uid(), uid)
  on conflict do nothing;
  if found then
    perform public.notify_admins('A player was blocked. Check the blocks table.');
  end if;
end;
$$;

grant execute on function public.block_player(uuid) to authenticated;

-- Comments from players you blocked (or who blocked you) are hidden.
drop policy if exists "Voters see own comments, or all once the round is finished" on public.song_comments;
create policy "Voters see own comments, or all once the round is finished"
  on public.song_comments for select to authenticated
  using (
    voter_id = auth.uid()
    or (
      exists (
        select 1 from public.rounds r
        where r.id = round_id and r.status = 'finished' and public.is_group_member(r.group_id)
      )
      and not public.is_blocked_between(auth.uid(), voter_id)
    )
  );

-- Reports ---------------------------------------------------------------------

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  reported_user_id uuid references public.profiles (id) on delete set null,
  -- Set when a comment is reported: the song it was left on.
  submission_id uuid references public.submissions (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 60),
  -- What was reported, copied at the time so it survives the content being deleted.
  reported_name text,
  reported_text text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text
);

alter table public.reports enable row level security;

-- Report a player, or one of their comments (pass the song it was left on).
create or replace function public.report_content(target uuid, report_reason text, comment_submission uuid default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  target_name text;
  comment_body text;
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in';
  end if;
  if target = auth.uid() then
    raise exception 'You can''t report yourself';
  end if;
  if not exists (
    select 1 from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid() and theirs.user_id = target
  ) then
    raise exception 'You can only report players in your leagues';
  end if;

  select display_name into target_name from public.profiles where id = target;
  if comment_submission is not null then
    select body into comment_body from public.song_comments
    where submission_id = comment_submission and voter_id = target;
  end if;

  insert into public.reports (reporter_id, reported_user_id, submission_id, reason, reported_name, reported_text)
  values (auth.uid(), target, comment_submission, left(report_reason, 60), target_name, comment_body);

  perform public.notify_admins(format(
    'New report (%s) about %s. Please review it within 24 hours.',
    left(report_reason, 60),
    case when comment_body is null then 'a player' else 'a comment' end
  ));
end;
$$;

grant execute on function public.report_content(uuid, text, uuid) to authenticated;

-- Account deletion ------------------------------------------------------------

-- Delete your account and everything tied to it. Leagues you host pass to
-- the longest-standing other player; leagues where you're the only player
-- are deleted. In other leagues you leave the same way as tapping Leave, so
-- a round in progress isn't left waiting for you. Finished rounds lose your
-- songs, rankings, guesses and comments.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  g record;
  next_host uuid;
begin
  if me is null then
    raise exception 'You need to be signed in';
  end if;

  for g in select id from public.groups where created_by = me for update loop
    select user_id into next_host from public.group_members
    where group_id = g.id and user_id <> me
    order by joined_at
    limit 1;
    if next_host is null then
      delete from public.groups where id = g.id;
    else
      update public.groups set created_by = next_host, playlist_url = null where id = g.id;
    end if;
  end loop;

  for g in select group_id as id from public.group_members where user_id = me loop
    perform public.remove_member(g.id, me);
  end loop;

  delete from public.push_tokens where user_id = me;
  -- Cascades to the profile and everything that references it.
  delete from auth.users where id = me;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
