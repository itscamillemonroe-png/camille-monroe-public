-- Applied to production Supabase project wybpxixkjimbpvufozub on 2026-10-05.

create index if not exists collectible_purchases_media_id_idx on public.collectible_purchases(media_id);
create index if not exists digital_product_delivery_protected_media_id_idx on public.digital_product_delivery(protected_media_id);
create index if not exists global_intelligence_markets_recommended_lane_no_idx on public.global_intelligence_markets(recommended_lane_no);
create index if not exists global_networking_opportunities_market_key_idx on public.global_networking_opportunities(market_key);
create index if not exists global_networking_opportunities_recommended_lane_no_idx on public.global_networking_opportunities(recommended_lane_no);
create index if not exists market_country_profiles_region_key_idx on public.market_country_profiles(region_key);
create index if not exists member_content_unlocks_product_id_idx on public.member_content_unlocks(product_id);
create index if not exists product_auto_activation_queue_media_id_idx on public.product_auto_activation_queue(media_id);
create index if not exists regional_revenue_experiments_country_code_idx on public.regional_revenue_experiments(country_code);
create index if not exists regional_revenue_experiments_region_key_idx on public.regional_revenue_experiments(region_key);
