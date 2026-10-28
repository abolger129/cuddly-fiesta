-- The Gauntlet: comments on songs, and per-league scoring rules
--
-- Comments: while voting, each player can leave one comment on each song they
-- rank. Comments stay private to whoever wrote them until the round is
-- finished, then everyone in the group sees them with the commenter's name.
--
-- Scoring rules: a league can cap how many songs each voter gives points to
-- (only their top N score), and can turn on downvotes (each voter's last-place
-- song loses a point). Scores are worked out in the app (src/lib/scoring.ts),
-- so these are only settings. They are locked once the first round starts so
-- that past results don't change.

-- Scoring rules ---------------------------------------------------------------

alter table public.groups
  add column if not exists points_cap int check (points_cap between 1 and 20),
  add column if not exists downvotes boolean not null default false;

create or replace function public.lock_scoring_rules()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (new.points_cap is distinct from old.points_cap or new.downvotes <> old.downvotes)
     and exists (select 1 from public.rounds where group_id = new.id and status <> 'upcoming') then
    raise exception 'Scoring rules can only be changed before the first round starts';
  end if;
  return new;
end;
$$;

create or replace trigger on_group_scoring_rules_changed
  before update on public.groups
  for each row execute function public.lock_scoring_rules();

-- Comments --------------------------------------------------------------------

create table if not exists public.song_comments (
  round_id uuid not null references public.rounds (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  voter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now(),
  primary key (submission_id, voter_id)
);

create index if not exists song_comments_round_id_idx on public.song_comments (round_id);

alter table public.song_comments enable row level security;

drop policy if exists "Voters see own comments, or all once the round is finished" on public.song_comments;
create policy "Voters see own comments, or all once the round is finished"
  on public.song_comments for select to authenticated
  using (
    voter_id = auth.uid()
    or exists (
      select 1 from public.rounds r
      where r.id = round_id and r.status = 'finished' and public.is_group_member(r.group_id)
    )
  );

-- Save your comments for a round. Replaces any comments you saved before:
-- songs left out (or with a blank comment) have their comment removed.
-- submission_ids and bodies line up one to one.
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
