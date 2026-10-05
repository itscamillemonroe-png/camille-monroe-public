-- Applied to production Supabase project wybpxixkjimbpvufozub on 2026-10-05.
-- Keeps Stripe secret access available to server-side checkout/webhook functions while
-- blocking retired NOWPayments and external identity-verification secret retrieval.

create or replace function public.get_payment_provider_secret(secret_name text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  secret_value text;
begin
  if secret_name not in ('stripe_secret_key','stripe_webhook_secret') then
    raise exception 'Payment secret is not available.';
  end if;

  select decrypted_secret into secret_value
  from vault.decrypted_secrets
  where name=secret_name
  order by created_at desc
  limit 1;

  if secret_value is null then
    raise exception 'Payment secret is not configured.';
  end if;

  return secret_value;
end;
$function$;

create or replace function public.get_verification_provider_secret(secret_name text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
begin
  raise exception 'External identity-verification provider secret access is retired in SFW production.';
end;
$function$;

revoke execute on function public.get_payment_provider_secret(text) from public, anon, authenticated;
revoke execute on function public.get_verification_provider_secret(text) from public, anon, authenticated;

grant execute on function public.get_payment_provider_secret(text) to service_role;
grant execute on function public.get_verification_provider_secret(text) to service_role;
