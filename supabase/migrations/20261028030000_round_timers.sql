-- Music League: round timers and push notifications
--
-- The group creator can give each round a time limit for picking songs and
-- another for ranking them, e.g. 24 hours to pick and 48 hours to rank.
-- A limit of null means no timer: the round waits for everyone, as before.
--
-- Deadlines are set when a round reaches each stage. A scheduled job (pg_cron)
-- runs every five minutes to move on rounds whose time is up and to remind
-- players who haven't picked or ranked yet. The app also moves rounds on when
-- someone opens a group or round after its deadline, so nobody waits for the job.
--
-- Push notifications go out through Expo's free push service (pg_net makes the
-- request) when a round opens, when ranking starts, when results are in, and
-- shortly before a deadline.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Timers --------------------------------------------------------------------

alter table public.groups
  add column if not exists submit_hours int check (submit_hours between 1 and 720),
  add column if not exists vote_hours int check (vote_hours between 1 and 720);

alter table public.rounds
  add column if not exists submit_deadline timestamptz,
  add column if not exists vote_deadline timestamptz,
  add column if not exists submit_reminded boolean not null default false,
  add column if not exists vote_reminded boolean not null default false;

-- Set the deadline for a stage when a round enters it, however it got there
-- (the creator starting it, everyone being in, the creator moving it on, or
-- time running out).
create or replace function public.set_round_deadlines()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  g public.groups;
begin
  select * into g from public.groups where id = new.group_id;
  if new.status = 'submitting' then
    new.submit_deadline := now() + make_interval(hours => g.submit_hours);
  elsif new.status = 'voting' then
    new.vote_deadline := now() + make_interval(hours => g.vote_hours);
  end if;
  return new;
end;
$$;

create or replace trigger on_round_status_changed
  before update of status on public.rounds
  for each row
  when (new.status is distinct from old.status)
  execute function public.set_round_deadlines();

-- Move on rounds whose time is up, in one group or (gid null) all of them.
-- Ranking needs at least two songs, so a round with fewer stays open for picks
-- past its deadline until a second song comes in.
create or replace function public.move_rounds_past_deadline(gid uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.rounds r set status = 'voting'
  where (gid is null or r.group_id = gid)
    and r.status = 'submitting'
    and r.submit_deadline <= now()
    and (select count(*) from public.submissions s where s.round_id = r.id) >= 2;

  update public.rounds r set status = 'finished'
  where (gid is null or r.group_id = gid)
    and r.status = 'voting'
    and r.vote_deadline <= now();
end;
$$;

-- For the app: any member can ask for their group's deadlines to be applied.
create or replace function public.close_expired_rounds(gid uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_group_member(gid) then
    raise exception 'You are not in this group';
  end if;
  perform public.move_rounds_past_deadline(gid);
end;
$$;

-- Push notifications ----------------------------------------------------------

-- Expo push tokens, one per device. A device belongs to whoever signed in on
-- it last. Only reachable through the functions below.
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

create or replace function public.save_push_token(t text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in';
  end if;
  insert into public.push_tokens (token, user_id)
  values (t, auth.uid())
  on conflict (token) do update set user_id = auth.uid(), updated_at = now();
end;
$$;

create or replace function public.remove_push_token(t text)
returns void
language sql
security definer set search_path = ''
as $$
  delete from public.push_tokens where token = t and user_id = auth.uid();
$$;

-- Send a notification to some players' devices. link is the app screen to
-- open when it is tapped. Expo takes up to 100 messages per request, plenty
-- for a group of friends.
create or replace function public.send_push(recipients uuid[], msg_title text, msg_body text, link text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'to', t.token,
    'title', msg_title,
    'body', msg_body,
    'sound', 'default',
    'data', jsonb_build_object('url', link)
  ))
  into messages
  from public.push_tokens t
  where t.user_id = any(recipients);

  if messages is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := messages,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;

-- "1 day", "2 days", "12 hours"
create or replace function public.describe_hours(h int)
returns text
language sql
immutable
as $$
  select case
    when h % 24 = 0 then (h / 24) || case when h = 24 then ' day' else ' days' end
    else h || case when h = 1 then ' hour' else ' hours' end
  end;
$$;

-- Tell everyone in the group when a round opens, when ranking starts, and when
-- the results are in.
create or replace function public.notify_round_status()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  g public.groups;
  everyone uuid[];
  body text;
begin
  select * into g from public.groups where id = new.group_id;
  select array_agg(user_id) into everyone from public.group_members where group_id = new.group_id;

  if new.status = 'submitting' then
    body := format('Round %s is open: %s. Pick a song', new.round_number, new.category)
      || coalesce(' in the next ' || public.describe_hours(g.submit_hours), '') || '.';
  elsif new.status = 'voting' then
    body := format('Time to rank the songs for round %s: %s', new.round_number, new.category)
      || coalesce('. You have ' || public.describe_hours(g.vote_hours), '') || '.';
  elsif new.status = 'finished' then
    body := format('Round %s results are in: %s.', new.round_number, new.category);
  else
    return new;
  end if;

  perform public.send_push(everyone, g.name, body, '/round/' || new.id);
  return new;
end;
$$;

create or replace trigger on_round_status_notify
  after update of status on public.rounds
  for each row
  when (new.status is distinct from old.status)
  execute function public.notify_round_status();

-- Remind players who haven't picked or ranked yet. The reminder goes out with
-- 3 hours left, or a quarter of the time for short timers.
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
        select m.user_id from public.group_members m
        where m.group_id = r.group_id
          and not exists (select 1 from public.rankings k where k.round_id = r.id and k.voter_id = m.user_id)
      ),
      r.group_name,
      format('Time is almost up to rank the songs for round %s: %s.', r.round_number, r.category),
      '/round/' || r.id
    );
    update public.rounds set vote_reminded = true where id = r.id;
  end loop;
end;
$$;

-- Run by pg_cron every five minutes.
create or replace function public.run_round_timers()
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.move_rounds_past_deadline(null);
  perform public.send_deadline_reminders();
end;
$$;

select cron.schedule('round-timers', '*/5 * * * *', 'select public.run_round_timers()');

-- Keep the internal functions away from the app.
revoke execute on function public.move_rounds_past_deadline(uuid) from public, anon, authenticated;
revoke execute on function public.send_push(uuid[], text, text, text) from public, anon, authenticated;
revoke execute on function public.send_deadline_reminders() from public, anon, authenticated;
revoke execute on function public.run_round_timers() from public, anon, authenticated;
