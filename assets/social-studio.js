import { supabase, $, escapeHtml, prettyDate, requireSession, wireSignOut } from './app-client.js';

let snapshot={};
let session;
const safeName=name=>String(name||'upload').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-100)||'upload';
async function signedSocial(path){if(!path)return '';const {data,error}=await supabase.storage.from('social-draft-media').createSignedUrl(path,1800);return error?'':(data?.signedUrl||'');}
function socialMediaPreview(p){const url=p.preview_url||'';if(!url)return '<div style="margin:12px 0;padding:34px 14px;border:1px dashed rgba(255,255,255,.16);border-radius:14px;text-align:center;color:#aaa">Media not attached yet.</div>';const type=String(p.media_mime_type||'').toLowerCase();if(type.startsWith('video/')||p.content_type==='video')return '<video controls playsinline preload="metadata" src="'+escapeHtml(url)+'" style="width:100%;max-height:620px;object-fit:contain;border-radius:14px;background:#080808;margin:12px 0"></video>';return '<img src="'+escapeHtml(url)+'" alt="" style="width:100%;max-height:620px;object-fit:contain;border-radius:14px;background:#080808;margin:12px 0">';}
const setStatus=(text,type='')=>{const el=$('#socialStatus');if(!el)return;el.textContent=text;el.className='opsStatus '+type;};
const setDraftStatus=(text,type='')=>{const el=$('#draftStatus');if(!el)return;el.textContent=text;el.className='formStatus '+type;};

async function requireOwner(){
  session=await requireSession();
  wireSignOut();
  const {data,error}=await supabase.from('member_profiles').select('is_admin').eq('user_id',session.user.id).single();
  if(error||!data?.is_admin){location.replace('/member/');throw new Error('Owner access required.');}
  return session;
}

function pill(status){
  const s=String(status||'not_connected');
  if(s==='connected')return '<span class="opsPill">CONNECTED</span>';
  if(s==='expired'||s==='error')return '<span class="opsPill">ATTENTION</span>';
  return '<span class="opsPill">STAGED</span>';
}

function renderPlatforms(platforms=[]){
  const connected=platforms.filter(p=>p.connection_status==='connected');
  $('#connectedCount').textContent=String(connected.length);
  const target=$('#platformGrid');
  target.innerHTML=platforms.map(p=>`
    <article class="opsLane">
      <span class="opsLaneNo">${escapeHtml((p.platform||'?').slice(0,2).toUpperCase())}</span>
      <div>
        <strong>${escapeHtml(p.platform||'Platform')}</strong>
        <small>${escapeHtml(p.account_label|| (p.connection_status==='connected'?'Connected':'Ready to connect'))}</small>
        <small>${Array.isArray(p.best_hours)&&p.best_hours.length?'Best: '+p.best_hours.map(h=>String(h).padStart(2,'0')+':00').join(' · ')+' · '+(p.timing_source==='metricool'?'Metricool':'shared default'):'Timing intelligence not available yet'}</small>
      </div>
      <b>${pill(p.connection_status)}</b>
    </article>`).join('')||'<p>No platforms configured.</p>';

  const select=$('#socialPlatform');
  select.innerHTML=platforms.map(p=>`<option value="${escapeHtml(p.platform)}">${escapeHtml(p.platform)} · ${p.connection_status==='connected'?'connected':'staged'}</option>`).join('');
}

function renderConfig(cfg={},counts={}){
  $('#socialMode').textContent=cfg.enabled?'ACTIVE':'PAUSED';
  $('#reviewPill').textContent=cfg.review_required?'REVIEW FIRST':'DIRECT';
  $('#draftTarget').textContent=String(cfg.drafts_per_day??0);
  $('#postingHours').textContent=Array.isArray(cfg.posting_hours)?cfg.posting_hours.map(h=>String(h).padStart(2,'0')+':00').join(' · '):'—';
  $('#executorName').textContent=String(cfg.executor||'metricool').toUpperCase();
  $('#taskCount').textContent=String(counts.content_tasks??0);
  $('#draftCount').textContent=String(counts.drafts??0);
  $('#readyCount').textContent=String(counts.ready??0);
  $('#publishedCount').textContent=String(counts.published??0);
  $('#contentLaneSummary').textContent=`${cfg.drafts_per_day??0} SFW draft opportunities per day across ${(cfg.target_platforms||[]).join(', ')}. AI may prepare/adapt copy and recommend timing; founder approval is required before Metricool scheduling.`;
}

function postCard(p){
  const canReview=p.status==='draft';
  const requiresMedia=['photo','video','story'].includes(p.content_type);
  const hasMedia=Boolean(p.preview_url);
  const note=p.publish_error?'<p><small>'+escapeHtml(p.publish_error)+'</small></p>':'';
  let attach='';
  if(canReview&&requiresMedia&&!hasMedia){
    attach='<label style="display:block;margin:12px 0">Attach exact media<input class="socialCardMediaFile" data-id="'+escapeHtml(p.id)+'" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"></label><button class="heroButton attachSocialCardMedia" data-id="'+escapeHtml(p.id)+'" type="button">Attach Media</button>';
  }
  return `<article class="productCatalogCard">
    <div style="width:100%">
      <span class="productState ${p.status==='published'?'active':''}">${escapeHtml(String(p.status||'draft').toUpperCase())}</span>
      <strong>${escapeHtml(p.title||'Social draft')}</strong>
      <small>${escapeHtml(p.platform||'')} · ${escapeHtml(p.content_type||'post')} · approval: ${escapeHtml(p.approval_status||'pending')} · publish: ${escapeHtml(p.publish_status||'not submitted')}</small>
      ${socialMediaPreview(p)}
      <p style="white-space:pre-wrap;line-height:1.55">${escapeHtml(p.caption||'')}</p>
      ${p.media_note?'<p><small>'+escapeHtml(p.media_note)+'</small></p>':''}
      ${attach}${note}
    </div>
    <div class="heroButtons">
      ${canReview?'<button class="heroButton approveSocial" data-id="'+escapeHtml(p.id)+'" type="button" '+((!requiresMedia||hasMedia)?'':'disabled')+'>Approve</button><button class="heroButton archiveSocial" data-id="'+escapeHtml(p.id)+'" type="button">Archive</button>':''}
      ${p.status==='ready'?'<span class="opsPill">READY FOR METRICOOL</span>':''}
      ${p.external_post_url?'<a class="heroButton" href="'+escapeHtml(p.external_post_url)+'" target="_blank" rel="noopener">Open Post</a>':''}
    </div>
  </article>`;
}

function wirePostActions(){
  document.querySelectorAll('.attachSocialCardMedia').forEach(btn=>btn.addEventListener('click',()=>attachCardMedia(btn)));
  document.querySelectorAll('.approveSocial').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;setStatus('Approving social draft…');
    const {data,error}=await supabase.rpc('owner_approve_social_draft',{p_post_id:btn.dataset.id});
    if(error){setStatus(error.message,'error');btn.disabled=false;return;}
    setStatus(data?.ready_to_schedule?'Approved and ready for Metricool scheduling.':'Approved, but that platform still needs connection.','success');
    await load();
  }));
  document.querySelectorAll('.archiveSocial').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;
    const {error}=await supabase.rpc('owner_archive_social_draft',{p_post_id:btn.dataset.id});
    if(error){setStatus(error.message,'error');btn.disabled=false;return;}
    setStatus('Social draft archived.','success');
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
  setStatus('Synchronizing Social Studio…');
  const {data,error}=await supabase.rpc('owner_social_studio_snapshot');
  if(error)throw error;
  snapshot=data||{};
  renderPlatforms(snapshot.platforms||[]);
  renderConfig(snapshot.config||{},snapshot.counts||{});
  const enrichedPosts=[];for(const p of (snapshot.posts||[])){let preview=p.media_url||'';if(p.media_storage_path)preview=await signedSocial(p.media_storage_path);enrichedPosts.push({...p,preview_url:preview});}renderPosts(enrichedPosts);
  renderTasks(snapshot.tasks||[]);
  renderJobs(snapshot.jobs||[]);
  setStatus('Social Studio synchronized.','success');
}

async function init(){
  await requireOwner();
  await load();

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