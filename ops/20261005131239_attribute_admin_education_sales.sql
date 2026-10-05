-- Applied to production Supabase project wybpxixkjimbpvufozub on 2026-10-05.

alter table public.admin_education_purchases
  add column if not exists source text not null default 'direct',
  add column if not exists medium text not null default 'none',
  add column if not exists campaign text,
  add column if not exists content text,
  add column if not exists term text,
  add column if not exists referrer_host text,
  add column if not exists landing_path text;

create index if not exists admin_education_purchases_source_idx on public.admin_education_purchases(source,purchased_at desc);
