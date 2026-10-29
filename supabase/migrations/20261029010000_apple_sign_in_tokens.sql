-- Music League: cancel Sign in with Apple when an account is deleted
--
-- Apple asks apps that offer Sign in with Apple to revoke the Apple token
-- when someone deletes their account, so the app also disappears from their
-- iPhone's Settings > Apple Account > Sign in with Apple list. To revoke it
-- later we need the refresh token Apple hands out at sign-in, which the
-- apple-token function saves here.
--
-- Only that function (with the service role) reads or writes this table: no
-- app user can see anyone's token, their own included. Deleting the account
-- removes the row too.

create table if not exists public.apple_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.apple_tokens enable row level security;
revoke all on public.apple_tokens from anon, authenticated;
