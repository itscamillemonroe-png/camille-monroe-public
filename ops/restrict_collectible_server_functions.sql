revoke all on function public.record_collectible_purchase(text,text,uuid,text,integer,text) from public, anon, authenticated;
grant execute on function public.record_collectible_purchase(text,text,uuid,text,integer,text) to service_role;
revoke all on function public.public_collectible_asset_status() from public, anon, authenticated;
grant execute on function public.public_collectible_asset_status() to service_role;
