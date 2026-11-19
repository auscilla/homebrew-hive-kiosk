-- Applied live Nov 18, 2026.
-- Documentation of public.check_pin and public.change_pin already in production.
-- Do not run this file against the live database. It does not change RLS.
--
-- check_pin(p_email, p_pin, p_account_type) returns 0 or 1 row:
--   id, created_at, email, account_type, wishlist, purchases
--   (never pin).
-- change_pin(p_email, p_account_type, p_old_pin, p_new_pin) returns boolean.
-- Arguments are passed by name. Both functions are security definer with
-- search_path empty, executable by anon, authenticated, and service_role,
-- and revoked from public.

create or replace function public.check_pin(p_email text, p_pin text, p_account_type text)
returns table (
  id bigint,
  created_at timestamptz,
  email text,
  account_type text,
  wishlist text,
  purchases text
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.created_at, u.email, u.account_type, u.wishlist, u.purchases
  from public.users u
  where pg_catalog.lower(pg_catalog.btrim(u.email)) = pg_catalog.lower(pg_catalog.btrim(p_email))
    and u.pin = pg_catalog.btrim(p_pin)
    and u.account_type = pg_catalog.btrim(p_account_type)
  limit 1;
$$;

create or replace function public.change_pin(
  p_email text,
  p_account_type text,
  p_old_pin text,
  p_new_pin text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_id bigint;
begin
  if p_new_pin is null or pg_catalog.btrim(p_new_pin) !~ '^[0-9]{4}$' then
    return false;
  end if;
  if p_old_pin is null or pg_catalog.btrim(p_old_pin) = '' then
    return false;
  end if;

  update public.users
     set pin = pg_catalog.btrim(p_new_pin)
   where pg_catalog.lower(pg_catalog.btrim(email)) = pg_catalog.lower(pg_catalog.btrim(p_email))
     and account_type = pg_catalog.btrim(p_account_type)
     and pin = pg_catalog.btrim(p_old_pin)
  returning id into updated_id;

  return updated_id is not null;
end;
$$;

revoke all on function public.check_pin(text, text, text) from public;
revoke all on function public.change_pin(text, text, text, text) from public;

grant execute on function public.check_pin(text, text, text) to anon, authenticated, service_role;
grant execute on function public.change_pin(text, text, text, text) to anon, authenticated, service_role;
