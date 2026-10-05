-- Applied to production Supabase project wybpxixkjimbpvufozub on 2026-10-05.

create or replace function public.owner_company_set_project_status(p_project_key text,p_status text)
returns jsonb
language plpgsql
security invoker
set search_path to 'pg_catalog','public','app_private'
as $function$
declare
  row_out public.company_projects%rowtype;
begin
  if auth.uid() is null or not app_private.is_member_admin() then
    raise exception 'Owner access is required.';
  end if;
  if p_status not in ('active','planned','waiting','blocked','complete','paused') then
    raise exception 'Invalid project status.';
  end if;
  update public.company_projects set status=p_status,updated_at=now() where project_key=p_project_key returning * into row_out;
  if row_out.id is null then raise exception 'Project not found.'; end if;
  return to_jsonb(row_out);
end;
$function$;

revoke execute on function public.owner_company_set_project_status(text,text) from public,anon;
grant execute on function public.owner_company_set_project_status(text,text) to authenticated,service_role;
