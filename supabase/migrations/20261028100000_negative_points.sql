-- The Gauntlet: hosts pick what songs below the max points get
--
-- points_cap is now shown as "max points": each voter's favourite gets that
-- many points, counting down by 1. negative_points decides what happens to the
-- songs ranked below that: false (the default) gives them 0, true keeps
-- counting down into the negatives (0, -1, -2...). Scores are worked out in
-- the app (src/lib/scoring.ts), so this is only a setting.

alter table public.groups
  add column if not exists negative_points boolean not null default false;

-- Lock the new setting along with the other scoring rules once the first round
-- starts, so past results don't change.
create or replace function public.lock_scoring_rules()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (new.points_cap is distinct from old.points_cap
      or new.downvotes <> old.downvotes
      or new.negative_points <> old.negative_points)
     and exists (select 1 from public.rounds where group_id = new.id and status <> 'upcoming') then
    raise exception 'Scoring rules can only be changed before the first round starts';
  end if;
  return new;
end;
$$;
