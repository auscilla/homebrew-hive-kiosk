-- NOT APPLIED. Rolls back hide-pin.sql and drops the pin RPCs.
-- Do not run this while the kiosk still calls check_pin / change_pin.

begin;
revoke select, update on table public.users from anon, authenticated;
grant select, update on table public.users to anon, authenticated;
drop function if exists public.check_pin(text, text, text);
drop function if exists public.change_pin(text, text, text, text);
commit;
notify pgrst, 'reload schema';
