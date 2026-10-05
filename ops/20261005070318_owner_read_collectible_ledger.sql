-- Applied to production Supabase project wybpxixkjimbpvufozub on 2026-10-05.

drop policy if exists collectible_purchases_owner_read on public.collectible_purchases;
create policy collectible_purchases_owner_read on public.collectible_purchases for select to authenticated using (app_private.is_member_admin());
grant select on public.collectible_purchases to authenticated;
