-- Music League: guess who picked each song
--
-- A group can turn on guessing. While voting, players can guess who picked
-- each song (except their own). Each correct guess earns bonus points, which
-- the app adds up from these rows, like the ranking points.

alter table public.groups add column guessing_enabled boolean not null default false;

-- One row per (guesser, song). Guesses stay private until the round is finished.
create table public.guesses (
  round_id uuid not null references public.rounds (id) on delete cascade,
  guesser_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  guessed_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (round_id, guesser_id, submission_id)
);

alter table public.guesses enable row level security;

-- Guesses are written through save_guesses below, so there are no insert or
-- delete policies.
create policy "Guessers see own guesses, or all once the round is finished"
  on public.guesses for select to authenticated
  using (
    guesser_id = auth.uid()
    or exists (
      select 1 from public.rounds r
      where r.id = round_id and r.status = 'finished' and public.is_group_member(r.group_id)
    )
  );

-- Save your guesses for a round. submission_ids[i] was picked by
-- guessed_user_ids[i]. Songs you leave out are not guessed. Replaces any
-- guesses you saved before.
create function public.save_guesses(rid uuid, submission_ids uuid[], guessed_user_ids uuid[])
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
  if not (select guessing_enabled from public.groups where id = r.group_id) then
    raise exception 'Guessing is turned off for this group';
  end if;
  if r.status <> 'voting' then
    raise exception 'Voting is not open for this round';
  end if;
  if coalesce(array_length(submission_ids, 1), 0) <> coalesce(array_length(guessed_user_ids, 1), 0) then
    raise exception 'Every guess needs a song and a player';
  end if;

  if exists (
    select 1
    from unnest(submission_ids, guessed_user_ids) as g(sid, uid)
    left join public.submissions s on s.id = g.sid and s.round_id = rid
    where s.id is null
       or s.user_id = auth.uid()
       or g.uid = auth.uid()
       or not exists (
         select 1 from public.group_members m where m.group_id = r.group_id and m.user_id = g.uid
       )
  ) then
    raise exception 'Guess other players for songs in this round, not yourself';
  end if;

  delete from public.guesses where round_id = rid and guesser_id = auth.uid();
  insert into public.guesses (round_id, guesser_id, submission_id, guessed_user_id)
  select distinct on (sid) rid, auth.uid(), sid, uid
  from unnest(submission_ids, guessed_user_ids) as g(sid, uid);
end;
$$;
