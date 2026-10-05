-- Applied to production Supabase project wybpxixkjimbpvufozub on 2026-10-05.
-- Activates the Administrative Education division after the Starter Kit launch, closes the build-MVP project, and creates the first-sale validation project.

update public.company_divisions set status='active',updated_at=now() where slug='admin-education';
update public.company_projects set status='complete',next_action='Documentation Workflow Starter Kit v1 launched at $19 with public checkout and verified-access delivery.',updated_at=now() where project_key='starter-kit-mvp';

insert into public.company_projects(division_slug,project_key,title,status,priority,cash_impact,time_to_cash,owner_approval_required,next_action,notes)
values('admin-education','starter-kit-first-sale','Prove the first Documentation Starter Kit sale','active',1,'Validates the first non-creator direct digital revenue stream.','Immediate once a qualified buyer completes checkout.',false,'Drive qualified traffic to /admin-education/starter-kit/ and verify the first completed $19 purchase, buyer unlock, and template download.','Use a real customer transaction; do not manufacture a fake sale for metrics.')
on conflict(project_key) do update set status='active',priority=1,cash_impact=excluded.cash_impact,time_to_cash=excluded.time_to_cash,owner_approval_required=false,next_action=excluded.next_action,notes=excluded.notes,updated_at=now();
