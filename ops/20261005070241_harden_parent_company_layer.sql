-- Applied to production Supabase project wybpxixkjimbpvufozub on 2026-10-05.

create index if not exists company_offers_division_slug_idx on public.company_offers(division_slug);
create index if not exists company_projects_division_slug_idx on public.company_projects(division_slug);

alter function public.owner_company_snapshot() security invoker;
alter function public.owner_company_set_project_status(text,text) security invoker;
