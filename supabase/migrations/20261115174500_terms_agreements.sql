-- Homebrew Hive kiosk: record the print-page terms agreement.
-- NOT APPLIED. Review, then apply once (e.g. via Supabase migrations).
-- The kiosk talks to Supabase with the publishable (anon) key only; gamer logins use
-- public.users (bigint id, email + PIN), not Supabase Auth, so requests arrive as role
-- "anon" and auth.uid() is NULL. "authenticated" is included in case Supabase Auth is
-- ever used. Insert-only: no SELECT / UPDATE / DELETE policies or grants.

create table if not exists public.terms_agreements (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  game_id       text not null,          -- matches public.games.id (text)
  game_slug     text,                   -- matches public.games.slug (text)
  user_id       uuid default auth.uid(),-- Supabase Auth user if any; NULL from the kiosk today
  agreed        boolean not null,
  terms_version text not null,
  constraint terms_agreements_game_id_len check (char_length(game_id) between 1 and 200),
  constraint terms_agreements_game_slug_len check (game_slug is null or char_length(game_slug) between 1 and 200),
  constraint terms_agreements_version_len check (char_length(terms_version) between 1 and 32)
);

comment on table public.terms_agreements is
  'Kiosk print-page agreement: "I am at least 13 years old and agree to the Homebrew Hive Terms." Insert-only from clients.';

alter table public.terms_agreements enable row level security;

-- Grants: nothing for clients except INSERT.
revoke all on table public.terms_agreements from public, anon, authenticated;
grant insert on table public.terms_agreements to anon, authenticated;

-- Insert-only policies. No select/update/delete policies exist, so clients cannot read or change rows.
create policy terms_agreements_insert_anon
  on public.terms_agreements
  for insert
  to anon
  with check (agreed = true and user_id is null);

create policy terms_agreements_insert_authenticated
  on public.terms_agreements
  for insert
  to authenticated
  with check (agreed = true and (user_id is null or user_id = auth.uid()));
