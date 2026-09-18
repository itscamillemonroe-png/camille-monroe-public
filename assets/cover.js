import { supabase, $, captureAttribution } from './app-client.js';
function safeHost(){try{return document.referrer?new URL(document.referrer).hostname:'';}catch{return '';}}
async function init(){
  const slug=new URLSearchParams(location.search).get('c')||'';
  if(!slug){$('#coverError').innerHTML='<p>This cover link is incomplete.</p>';return;}
  const {data,error}=await supabase.rpc('resolve_revenue_cover',{p_slug:slug});
  if(error||!data?.id){$('#coverError').innerHTML='<p>This cover is not available.</p>';return;}
  const {data:publicData}=supabase.storage.from('lane-cover-media').getPublicUrl(data.storage_path);
  const imageUrl=publicData?.publicUrl||'';
  if(!imageUrl){$('#coverError').innerHTML='<p>This cover image is not available.</p>';return;}
  $('#coverImage').src=imageUrl;$('#coverImage').alt=data.title||'Camille Monroe';
  $('#coverLane').textContent=data.lane_name||'Camille Monroe';
  $('#coverTitle').textContent=data.title||'Camille Monroe';
  $('#coverText').textContent=data.short_copy||'';
  $('#coverCta').textContent=data.cta_primary||'Continue';
  $('#coverError').hidden=true;$('#coverStage').hidden=false;
  const attribution=captureAttribution();
  await supabase.rpc('track_revenue_cover_event',{p_slug:slug,p_event_type:'view',p_source:attribution.source||'direct',p_medium:attribution.medium||'none',p_campaign:attribution.campaign||('cover_'+slug),p_referrer_host:safeHost()});
  $('#coverCta').addEventListener('click',async()=>{
    await supabase.rpc('track_revenue_cover_event',{p_slug:slug,p_event_type:'click',p_source:attribution.source||'direct',p_medium:attribution.medium||'visual',p_campaign:attribution.campaign||('cover_'+slug),p_referrer_host:safeHost()});
    const target=new URL(data.destination_path||'/',location.origin);
    target.searchParams.set('utm_source','lane_cover');
    target.searchParams.set('utm_medium','visual');
    target.searchParams.set('utm_campaign','cover_'+slug);
    target.searchParams.set('utm_content',slug);
    location.href=target.toString();
  });
}
init();