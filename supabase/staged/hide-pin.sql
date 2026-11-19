-- NOT APPLIED; apply only after the new kiosk and site code is live and tested.

begin;
revoke select on table public.users from anon, authenticated;
grant select (id, created_at, email, account_type, wishlist, purchases) on table public.users to anon, authenticated;
commit;
notify pgrst, 'reload schema';
