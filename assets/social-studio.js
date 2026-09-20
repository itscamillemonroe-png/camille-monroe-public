import { supabase, $, escapeHtml, prettyDate, requireSession, wireSignOut } from './app-client.js';

let snapshot={};
let session;
const safeName=name=>String(name||'upload').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-100)||'upload';
async function signedSocial(path){if(!path)return '';const {data,error}=await supabase.storage.from('social-draft-media').createSignedUrl(path,1800);return error?'':(data?.signedUrl||'');}
function socialMediaPreview(p){const url=p.preview_url||'';if(!url)return '<div style="margin:12px 0;padding:34px 14px;border:1px dashed rgba(255,255,255,.16);border-radius:14px;text-align:center;color:#aaa">Media not attached yet.</div>';const type=String(p.media_mime_type||'').toLowerCase();if(type.startsWith('video/'))return '<video controls playsinline preload="metadata" src="'+escapeHtml(url)+'" style="width:100%;max-height:620px;object-fit:contain;border-radius:14px;background:#080808;margin:12px 0"></video>';if(type.startsWith('image/'))return '<img src="'+escapeHtml(url)+'" alt="" style="width:100%;max-height:620px;object-fit:contain;border-radius:14px;background:#080808;margin:12px 0">';if(p.content_type==='video')return '<video controls playsinline preload="metadata" src="'+escapeHtml(url)+'" style="width:100%;max-height:620px;object-fit:contain;border-radius:14px;background:#080808;margin:12px 0"></video>';return '<img src="'+escapeHtml(url)+'" alt="" style="width:100%;max-height:620px;object-fit:contain;border-radius:14px;background:#080808;margin:12px 0">';}
const setStatus=(text,type='')=>{const el=$('#socialStatus');if(!el)return;el.textContent=text;el.className='opsStatus '+type;};
const setDraftStatus=(text,type='')=>{const el=$('#draftStatus');if(!el)return;el.textContent=text;el.className='formStatus '+type;};

async function requireOwner(){
  session=await requireSession();
  wireSignOut();
  const {data,error}=await supabase.from('member_profiles').select('is_admin').eq('user_id',session.user.id).single();
  if(error||!data?.is_admin){location.replace('/member/');throw new Error('Owner access required.');}
  return session;
}

function pill(status,role){
  const s=String(status||'not_connected'),r=String(role||'candidate');
  if(s==='connected')return '<span class="opsPill">CONNECTED</span>';
  if(r==='external_destination')return '<span class="opsPill">EXTERNAL DESTINATION</span>';
  if(r==='official_external')return '<span class="opsPill">OFFICIAL LINK</span>';
  if(s==='expired'||s==='error')return '<span class="opsPill">ATTENTION</span>';
  return '<span class="opsPill">NOT CONNECTED</span>';
}

function renderPlatforms(platforms=[]){
  const connected=platforms.filter(p=>p.connection_status==='connected');
  const officialExternal=platforms.filter(p=>['official_external','external_destination'].includes(String(p.studio_role||'')));
  $('#connectedCount').textContent=String(connected.length);
  if($('#officialExternalCount'))$('#officialExternalCount').textContent=String(officialExternal.length);
  const target=$('#platformGrid');
  target.innerHTML=platforms.map(p=>{
    const timing=Array.isArray(p.best_hours)&&p.best_hours.length
      ?'Best test times: '+p.best_hours.map(h=>String(h).padStart(2,'0')+':00').join(' · ')+' · '+(p.timing_source==='metricool'?'Metricool':'shared timing')
      :(p.connection_status==='connected'?'Timing intelligence not available yet':'Not in the active Metricool publishing connection');
    const profile=p.external_url?'<small><a href="'+escapeHtml(p.external_url)+'" target="_blank" rel="noopener">Open official profile ↗</a></small>':'';
    const note=p.notes?'<small>'+escapeHtml(p.notes)+'</small>':'';
    return `
    <article class="opsLane">
      <span class="opsLaneNo">${escapeHtml((p.platform||'?').slice(0,2).toUpperCase())}</span>
      <div>
        <strong>${escapeHtml(p.platform||'Platform')}</strong>
        <small>${escapeHtml(p.account_label|| (p.connection_status==='connected'?'Connected account':'No verified working account in this flow'))}</small>
        <small>${escapeHtml(timing)}</small>
        ${note}${profile}
      </div>
      <b>${pill(p.connection_status,p.studio_role)}</b>
    </article>`;
  }).join('')||'<p>No platforms configured.</p>';

  const select=$('#socialPlatform');
  const draftable=[...connected,...officialExternal.filter(p=>p.studio_role==='official_external')];
  select.innerHTML=draftable.map(p=>`<option value="${escapeHtml(p.platform)}">${escapeHtml(p.platform)} · ${p.connection_status==='connected'?'Metricool connected':'manual / external'}</option>`).join('');
}

function renderConfig(cfg={},counts={}){
  $('#socialMode').textContent=cfg.enabled?'ACTIVE':'PAUSED';
  $('#reviewPill').textContent=cfg.review_required?'REVIEW FIRST':'DIRECT';
  $('#draftTarget').textContent=String(cfg.drafts_per_day??0);
  $('#postingHours').textContent=Array.isArray(cfg.posting_hours)?cfg.posting_hours.map(h=>String(h).padStart(2,'0')+':00').join(' · '):'—';
  $('#executorName').textContent=String(cfg.executor||'metricool').toUpperCase();
  $('#taskCount').textContent=String(counts.content_tasks??0)+' open';
  $('#draftCount').textContent=String(counts.drafts??0);
  $('#readyCount').textContent=String(counts.ready??0);
  $('#publishedCount').textContent=String(counts.published??0);
  $('#contentLaneSummary').textContent=`${cfg.drafts_per_day??0} public-safe draft opportunities per day across ${(cfg.target_platforms||[]).join(', ')}. Camille can prepare copy, media notes, campaign tags, and timing recommendations; you still approve the final post before the Metricool lane moves it forward.`;
}

function renderDistributionFlow(data={}){
  const social=data.social||{},indm=data.indm||{},mirror=social.metricool_mirror||{};
  const metricDetail=$('#metricoolDetail');
  if(metricDetail)metricDetail.textContent=(social.metricool_brand_id?'brand '+social.metricool_brand_id+' · ':'')+(social.connected_platforms||0)+' connected platforms';
  if($('#socialMetricRows'))$('#socialMetricRows').textContent=String(social.metric_rows||0);
  if($('#socialLinkClicks'))$('#socialLinkClicks').textContent=String(social.link_clicks||0);
  if($('#socialPaidSubs'))$('#socialPaidSubs').textContent=String(social.paid_subscribers||0);
  const state=String(indm.status||'NOT_CONFIGURED');
  const connected=state.includes('CONNECTED'),pending=state.includes('PENDING');
  if($('#indmFlowState'))$('#indmFlowState').textContent=connected?(pending?'SETUP PENDING':'CONNECTED'):'NOT CONNECTED';
  if($('#websiteReturnState'))$('#websiteReturnState').textContent='ACTIVE';

  if($('#metricoolBridgeState'))$('#metricoolBridgeState').textContent=Number(mirror.items||0)>0?'MIRROR LIVE':'NO MIRROR';
  if($('#metricoolMatchedJobs'))$('#metricoolMatchedJobs').textContent=String(social.metricool_matched_jobs||0);
  if($('#metricoolUnmatchedReady'))$('#metricoolUnmatchedReady').textContent=String(social.ready_without_metricool||0);
  if($('#indmBridgeState'))$('#indmBridgeState').textContent=connected?'TRACKED HANDOFF':'NOT READY';
  if($('#indmTrackedLink'))$('#indmTrackedLink').textContent=indm.tracked_return_link||'https://itscamillemonroe.art/go/indm/?c=engagement';
  if($('#integrationNote'))$('#integrationNote').textContent=social.background_direct_api===false
    ?'Metricool is synchronized through the connected Metricool workflow and Camille’s verified mirror; it is not a secret background API embedded in the website. inDM remains an external Instagram automation service, while its return traffic is tracked through the Camille link above.'
    :'The direct publishing bridge is active.';

  if($('#metricoolMirrorItems'))$('#metricoolMirrorItems').textContent=String(mirror.items||0);
  if($('#metricoolMirrorDrafts'))$('#metricoolMirrorDrafts').textContent=String(mirror.draft_items||0);
  if($('#metricoolMirrorAuto'))$('#metricoolMirrorAuto').textContent=String(mirror.auto_publish_items||0);
  const next=Array.isArray(mirror.next_posts)?mirror.next_posts:[];
  if($('#metricoolMirrorNext'))$('#metricoolMirrorNext').textContent=next[0]?.publication_at?prettyDate(next[0].publication_at):'—';
  if($('#metricoolMirrorFreshness'))$('#metricoolMirrorFreshness').textContent=mirror.last_synced_at?'Synced '+prettyDate(mirror.last_synced_at):'Sync pending';
  if($('#metricoolMirrorRows'))$('#metricoolMirrorRows').innerHTML=next.length?next.map(p=>{
    const networks=(p.networks||[]).join(', ')||'—';
    const statuses=(p.provider_statuses||[]).join(', ')||'—';
    const copy=String(p.post_text||'').length>150?String(p.post_text).slice(0,147)+'…':String(p.post_text||'');
    return `<tr><td>${p.publication_at?escapeHtml(prettyDate(p.publication_at)):'—'}</td><td>${escapeHtml(networks)}</td><td>${escapeHtml(statuses)}${p.is_draft?' · DRAFT':''}</td><td>${p.auto_publish?'Yes':'No'}</td><td>${escapeHtml(copy||'—')}</td></tr>`;
  }).join(''):'<tr><td colspan="5">No mirrored Metricool items in the current window.</td></tr>';
}

function postCard(p){
  const canReview=p.status==='draft';
  const requiresMedia=['photo','video','story'].includes(p.content_type);
  const hasMedia=Boolean(p.preview_url);
  const type=String(p.media_mime_type||'').toLowerCase();
  const privateMedia=Boolean(p.media_storage_path);
  const mediaCompatible=!requiresMedia||!privateMedia||
    (p.content_type==='photo'&&type.startsWith('image/'))||
    (p.content_type==='video'&&type.startsWith('video/'))||
    (p.content_type==='story'&&(type.startsWith('image/')||type.startsWith('video/')));
  const mediaMismatch=hasMedia&&requiresMedia&&!mediaCompatible?'<p><small>The attached file does not match this post type. Replace it with the exact '+escapeHtml(p.content_type)+' media before approval.</small></p>':'';
  const note=p.publish_error?'<p><small>'+escapeHtml(p.publish_error)+'</small></p>':'';
  let attach='';
  if(canReview&&requiresMedia&&(!hasMedia||!mediaCompatible)){
    attach='<label style="display:block;margin:12px 0">Attach exact media<input class="socialCardMediaFile" data-id="'+escapeHtml(p.id)+'" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"></label><button class="heroButton attachSocialCardMedia" data-id="'+escapeHtml(p.id)+'" type="button">Attach Media</button>';
  }
  return `<article class="productCatalogCard">
    <div style="width:100%">
      <span class="productState ${p.status==='published'?'active':''}">${escapeHtml(String(p.status||'draft').toUpperCase())}</span>
      <strong>${escapeHtml(p.title||'Social draft')}</strong>
      <small>${escapeHtml(p.platform||'')} · ${escapeHtml(p.content_type||'post')} · approval: ${escapeHtml(p.approval_status||'pending')} · publish: ${escapeHtml(p.publish_status||'not submitted')}</small>
      ${socialMediaPreview(p)}
      <p style="white-space:pre-wrap;line-height:1.55">${escapeHtml(p.caption||'')}</p>
      ${mediaMismatch}
      ${p.media_note?'<p><small>'+escapeHtml(p.media_note)+'</small></p>':''}
      ${attach}${note}
    </div>
    <div class="heroButtons">
      ${canReview?'<button class="heroButton approveSocial" data-id="'+escapeHtml(p.id)+'" type="button" '+((!requiresMedia||(hasMedia&&mediaCompatible))?'':'disabled')+'>Approve</button><button class="heroButton archiveSocial" data-id="'+escapeHtml(p.id)+'" type="button">Archive</button>':''}
      ${p.status==='ready'?'<span class="opsPill">READY FOR METRICOOL</span>':''}
      ${p.external_post_url?'<a class="heroButton" href="'+escapeHtml(p.external_post_url)+'" target="_blank" rel="noopener">Open Post</a>':''}
    </div>
  </article>`;
}

function wirePostActions(){
  document.querySelectorAll('.attachSocialCardMedia').forEach(btn=>btn.addEventListener('click',()=>attachCardMedia(btn)));
  document.querySelectorAll('.approveSocial').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;setStatus('Approving draft for the Metricool flow…');
    const {data,error}=await supabase.rpc('owner_approve_social_draft',{p_post_id:btn.dataset.id});
    if(error){setStatus(error.message,'error');btn.disabled=false;return;}
    const mode=data?.handoff_mode||'not_connected';
    setStatus(mode==='metricool'?'Approved and ready for the Metricool publishing lane.':mode==='manual_external'?'Approved. This official platform uses the manual/external publishing lane until a connector is linked.':'Approved, but that platform is not connected yet.','success');
    await load();
  }));
  document.querySelectorAll('.archiveSocial').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;
    const {error}=await supabase.rpc('owner_archive_social_draft',{p_post_id:btn.dataset.id});
    if(error){setStatus(error.message,'error');btn.disabled=false;return;}
    setStatus('Draft archived. Nothing was published.','success');
    await load();
  }));
}

async function attachCardMedia(btn){const input=document.querySelector('.socialCardMediaFile[data-id="'+btn.dataset.id+'"]');const file=input?.files?.[0];if(!file){setStatus('Choose the exact image or video first.','error');return;}if(file.size>209715200){setStatus('Media must be 200 MB or smaller.','error');return;}const allowed=['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'];if(!allowed.includes(file.type)){setStatus('Use JPG, PNG, WebP, MP4, or MOV.','error');return;}btn.disabled=true;setStatus('Uploading post media…');const path=session.user.id+'/'+btn.dataset.id+'-'+crypto.randomUUID()+'-'+safeName(file.name);const up=await supabase.storage.from('social-draft-media').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});if(up.error){setStatus(up.error.message,'error');btn.disabled=false;return;}const q=await supabase.rpc('owner_attach_social_media',{p_post_id:btn.dataset.id,p_storage_path:path,p_mime_type:file.type});if(q.error){await supabase.storage.from('social-draft-media').remove([path]);setStatus(q.error.message,'error');btn.disabled=false;return;}setStatus('Media attached. Full post preview is ready.','success');await load();}

function renderPosts(posts=[]){
  const visible=posts.filter(p=>p.status!=='archived');
  $('#socialPostQueue').innerHTML=visible.length?visible.map(postCard).join(''):'<p class="memberEmpty">No social drafts are waiting.</p>';
  wirePostActions();
}

function renderTasks(tasks=[]){
  const target=$('#contentTaskList');if(!target)return;
  target.innerHTML=tasks.length?tasks.map(t=>`<article class="productCatalogCard"><div><span class="productState">${escapeHtml(String(t.status||'planned').toUpperCase())}</span><strong>${escapeHtml(t.title||'Content task')}</strong><small>${t.due_on?'Due '+escapeHtml(t.due_on):'No due date'} · ${escapeHtml(t.channel||'Social Studio')}</small></div></article>`).join(''):'<p class="memberEmpty">No open content tasks.</p>';
}

function renderJobs(jobs=[]){
  $('#socialJobRows').innerHTML=jobs.length?jobs.map(j=>`<tr>
    <td>${escapeHtml(j.platform||'—')}</td>
    <td>${escapeHtml(j.status||'—')}</td>
    <td>${j.scheduled_for?escapeHtml(prettyDate(j.scheduled_for)):'—'}</td>
    <td>${escapeHtml(j.error_message||j.platform_post_id||'—')}</td>
  </tr>`).join(''):'<tr><td colspan="4">No recent publish jobs.</td></tr>';
}

async function load(){
  setStatus('Updating the social distribution flow…');
  const {error:reconcileError}=await supabase.rpc('owner_reconcile_metricool_mirror');
  if(reconcileError)throw reconcileError;
  const [{data,error},{data:creator,error:creatorError}]=await Promise.all([
    supabase.rpc('owner_social_studio_snapshot'),
    supabase.rpc('owner_creator_studio_snapshot')
  ]);
  if(error)throw error;
  if(creatorError)throw creatorError;
  snapshot=data||{};
  renderPlatforms(snapshot.platforms||[]);
  renderConfig(snapshot.config||{},snapshot.counts||{});
  renderDistributionFlow(creator||{});
  const enrichedPosts=[];for(const p of (snapshot.posts||[])){let preview=p.media_url||'';if(p.media_storage_path)preview=await signedSocial(p.media_storage_path);enrichedPosts.push({...p,preview_url:preview});}renderPosts(enrichedPosts);
  renderTasks(snapshot.tasks||[]);
  renderJobs(snapshot.jobs||[]);
  setStatus('Social flow updated. Nothing was published or messaged automatically.','success');
}

async function init(){
  await requireOwner();
  await load();
  $('#copyIndmLink')?.addEventListener('click',async()=>{
    const link=$('#indmTrackedLink')?.textContent?.trim();
    if(!link)return;
    try{await navigator.clipboard.writeText(link);setStatus('inDM tracked website link copied.','success');}
    catch{setStatus('Copy the inDM tracked link shown on the page.','error');}
  });

  $('#socialDraftForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const title=$('#socialTitle').value.trim();
    const caption=$('#socialCaption').value.trim();
    const platform=$('#socialPlatform').value;
    const contentType=$('#socialType').value;
    const campaign=$('#socialCampaign').value.trim();
    const mediaUrl=$('#socialMediaUrl').value.trim();
    const mediaFile=$('#socialMediaFile').files[0];
    const mediaNote=$('#socialMediaNote').value.trim();
    const local=$('#socialSchedule').value;
    const scheduledFor=local?new Date(local).toISOString():null;
    if(!title||!caption||!platform)return;
    const button=event.target.querySelector('button[type="submit"]');
    button.disabled=true;setDraftStatus('Saving review draft…');
    const {data:newPostId,error}=await supabase.rpc('owner_create_social_draft',{
      p_title:title,
      p_caption:caption,
      p_platform:platform,
      p_content_type:contentType,
      p_campaign:campaign||null,
      p_media_note:mediaNote||null,
      p_media_url:mediaUrl||null,
      p_scheduled_for:scheduledFor
    });
    if(error){button.disabled=false;setDraftStatus(error.message,'error');return;}
    if(mediaFile){if(mediaFile.size>209715200){button.disabled=false;setDraftStatus('Draft saved, but media is over 200 MB. Attach a smaller file from the review card.','error');await load();return;}const allowed=['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'];if(!allowed.includes(mediaFile.type)){button.disabled=false;setDraftStatus('Draft saved, but that media type is not supported. Attach JPG, PNG, WebP, MP4, or MOV from the review card.','error');await load();return;}const path=session.user.id+'/'+newPostId+'-'+crypto.randomUUID()+'-'+safeName(mediaFile.name);const up=await supabase.storage.from('social-draft-media').upload(path,mediaFile,{contentType:mediaFile.type,upsert:false,cacheControl:'3600'});if(up.error){button.disabled=false;setDraftStatus('Draft saved, but media upload failed: '+up.error.message,'error');await load();return;}const aq=await supabase.rpc('owner_attach_social_media',{p_post_id:newPostId,p_storage_path:path,p_mime_type:mediaFile.type});if(aq.error){await supabase.storage.from('social-draft-media').remove([path]);button.disabled=false;setDraftStatus('Draft saved, but media could not be attached: '+aq.error.message,'error');await load();return;}}
    button.disabled=false;event.target.reset();
    setDraftStatus('Draft saved for visual review. Nothing has been published or scheduled.','success');
    await load();
  });
}

init().catch(e=>setStatus(e.message||'Social Studio could not load.','error'));