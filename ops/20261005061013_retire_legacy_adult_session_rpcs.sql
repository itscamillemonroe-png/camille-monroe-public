-- Applied to production Supabase project wybpxixkjimbpvufozub on 2026-10-05.
-- Removes browser/client execution access to the retired adult-content session RPCs.

revoke execute on function public.start_protected_session(text,text,text) from public, anon, authenticated;
revoke execute on function public.end_protected_session(uuid) from public, anon, authenticated;
revoke execute on function public.touch_protected_session(uuid) from public, anon, authenticated;

grant execute on function public.start_protected_session(text,text,text) to service_role;
grant execute on function public.end_protected_session(uuid) to service_role;
grant execute on function public.touch_protected_session(uuid) to service_role;
