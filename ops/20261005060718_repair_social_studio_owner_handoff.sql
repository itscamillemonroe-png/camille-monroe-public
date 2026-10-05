-- Applied to production Supabase project wybpxixkjimbpvufozub on 2026-10-05.
-- Repairs owner RPC access and removes the retired automatic publisher call.

create or replace function public.owner_approve_social_draft(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'app_private'
as $function$
declare
  p public.social_posts%rowtype;
  connection text;
  role_name text;
  requires_media boolean;
  v_publish_status text;
  v_publish_error text;
begin
  if auth.uid() is null or not app_private.is_member_admin() then
    raise exception 'Owner access is required.';
  end if;

  select * into p from public.social_posts where id=p_post_id for update;
  if p.id is null then raise exception 'Post not found.'; end if;
  if p.status not in ('draft','ready') then raise exception 'Only draft/ready posts can be approved.'; end if;

  requires_media := p.content_type in ('photo','video','story');
  if requires_media and coalesce(p.media_storage_path,'')='' and coalesce(p.media_url,'')='' then
    raise exception 'Attach the exact media that will be posted before approval.';
  end if;

  if coalesce(p.media_storage_path,'')<>'' then
    if coalesce(p.media_mime_type,'')='' then
      raise exception 'Attached private media is missing its media type. Re-attach the exact media before approval.';
    end if;
    if p.content_type='photo' and p.media_mime_type not like 'image/%' then
      raise exception 'This photo post needs an image before approval.';
    end if;
    if p.content_type='video' and p.media_mime_type not like 'video/%' then
      raise exception 'This video post needs a video before approval.';
    end if;
    if p.content_type='story' and p.media_mime_type not like 'image/%' and p.media_mime_type not like 'video/%' then
      raise exception 'This story post needs an image or video before approval.';
    end if;
  end if;

  select connection_status,studio_role into connection,role_name
  from public.social_platform_connections
  where lower(platform)=lower(p.platform);

  if connection='connected' then
    v_publish_status := 'not_submitted';
    v_publish_error := 'Approved for Metricool handoff. Automatic publishing from Supabase is retired; schedule or publish through the connected Metricool workflow.';
  elsif role_name='official_external' then
    v_publish_status := 'awaiting_connection';
    v_publish_error := 'Official external platform: draft is approved, but publishing is manual/external until a supported connector is linked.';
  else
    v_publish_status := 'awaiting_connection';
    v_publish_error := 'Platform is not connected in the active publishing flow yet.';
  end if;

  update public.social_posts
  set status='ready',
      approval_status='approved',
      approved_at=now(),
      approved_by=auth.uid(),
      publish_status=v_publish_status,
      publish_error=v_publish_error,
      updated_at=now()
  where id=p_post_id;

  return jsonb_build_object(
    'post_id',p_post_id,
    'platform',p.platform,
    'connection_status',coalesce(connection,'not_connected'),
    'studio_role',coalesce(role_name,'candidate'),
    'ready_to_schedule',(connection='connected'),
    'handoff_mode',case
      when connection='connected' then 'metricool_manual'
      when role_name='official_external' then 'manual_external'
      else 'not_connected'
    end,
    'media_prepare_requested',false,
    'automatic_publisher_active',false
  );
end;
$function$;

revoke execute on function public.owner_approve_social_draft(uuid) from public, anon;
revoke execute on function public.owner_archive_social_draft(uuid) from public, anon;
revoke execute on function public.owner_attach_social_media(uuid,text,text) from public, anon;
revoke execute on function public.owner_create_social_draft(text,text,text,text,text,text,text,timestamptz) from public, anon;
revoke execute on function public.owner_social_studio_snapshot() from public, anon;

grant execute on function public.owner_approve_social_draft(uuid) to authenticated, service_role;
grant execute on function public.owner_archive_social_draft(uuid) to authenticated, service_role;
grant execute on function public.owner_attach_social_media(uuid,text,text) to authenticated, service_role;
grant execute on function public.owner_create_social_draft(text,text,text,text,text,text,text,timestamptz) to authenticated, service_role;
grant execute on function public.owner_social_studio_snapshot() to authenticated, service_role;
