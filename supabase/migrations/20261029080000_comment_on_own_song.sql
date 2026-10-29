-- Players can leave a comment on their own song as well as everyone else's.
-- They can write it when they pick the song or while ranking the others, and
-- it locks with the rest of their comments once their ranking is saved. Like
-- every comment, only the writer sees it until the round is finished, so it
-- never gives away who picked what before the reveal.

-- Same as before, except your own song is allowed too.
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
  if not exists (select 1 from public.submissions where round_id = rid and user_id = auth.uid()) then
    raise exception 'Only players who picked a song this round can comment';
  end if;
  if exists (select 1 from public.rankings where round_id = rid and voter_id = auth.uid()) then
    raise exception 'Your comments are already locked in';
  end if;
  if coalesce(array_length(submission_ids, 1), 0) <> coalesce(array_length(bodies, 1), 0) then
    raise exception 'Each comment needs a song';
  end if;
  if exists (
    select 1 from unnest(submission_ids) as sid
    where not exists (
      select 1 from public.submissions s where s.id = sid and s.round_id = rid
    )
  ) then
    raise exception 'You can only comment on songs in this round';
  end if;

  delete from public.song_comments where round_id = rid and voter_id = auth.uid();
  insert into public.song_comments (round_id, submission_id, voter_id, body)
  select rid, sid, auth.uid(), trim(body)
  from unnest(submission_ids, bodies) as t(sid, body)
  where trim(coalesce(body, '')) <> ''
  on conflict (submission_id, voter_id) do update set body = excluded.body;
end;
$$;

-- Save (or clear, with a blank body) your comment on your own song. Works
-- while songs are being picked and while ranking is open, until your ranking
-- is saved.
create or replace function public.save_my_song_comment(rid uuid, body text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  r public.rounds;
  mine uuid;
begin
  select * into r from public.rounds where id = rid;
  if r.id is null or not public.is_group_member(r.group_id) then
    raise exception 'You are not in this group';
  end if;
  if r.status not in ('submitting', 'voting') then
    raise exception 'This round isn''t taking comments';
  end if;
  select id into mine from public.submissions where round_id = rid and user_id = auth.uid();
  if mine is null then
    raise exception 'Pick a song first';
  end if;
  if exists (select 1 from public.rankings where round_id = rid and voter_id = auth.uid()) then
    raise exception 'Your comments are already locked in';
  end if;
  if char_length(trim(coalesce(body, ''))) > 280 then
    raise exception 'Keep it to 280 characters';
  end if;

  if trim(coalesce(body, '')) = '' then
    delete from public.song_comments where submission_id = mine and voter_id = auth.uid();
  else
    insert into public.song_comments (round_id, submission_id, voter_id, body)
    values (rid, mine, auth.uid(), trim(body))
    on conflict (submission_id, voter_id) do update set body = excluded.body;
  end if;
end;
$$;

grant execute on function public.save_my_song_comment(uuid, text) to authenticated;
