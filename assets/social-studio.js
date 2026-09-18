import { supabase, $, escapeHtml, prettyDate, requireSession, wireSignOut } from './app-client.js';

let snapshot={};
const setStatus=(text,type='')=>{const el=$('#socialStatus');if(!el)return;el.textContent=text;el.className='opsStatus '+type;};
const setDraftStatus=(text,type='')=>{const el=$('#draftStatus');if(!el)return;el.textContent=text;el.className='formStatus '+type;};

async function requireOwner(){
  const session=await requireSession();
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
        <small>${Array.isArray(p.best_hours)&&p.best_hours.length?'Best: '+p.best_hours.map(h=>String(h).padStart(2,'0')+':00').join(' · '):'Timing intelligence not available yet'}</small>
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
  const note=p.publish_error?'<p><small>'+escapeHtml(p.publish_error)+'</small></p>':'';
  const media=p.media_url?'<p><small>Media attached</small></p>':(p.media_note?'<p><small>'+escapeHtml(p.media_note)+'</small></p>':'');
  return `<article class="productCatalogCard">
    <div>
      <span class="productState ${p.status==='published'?'active':''}">${escapeHtml(String(p.status||'draft').toUpperCase())}</span>
      <strong>${escapeHtml(p.title||'Social draft')}</strong>
      <small>${escapeHtml(p.platform||'')} · ${escapeHtml(p.content_type||'post')} · approval: ${escapeHtml(p.approval_status||'pending')} · publish: ${escapeHtml(p.publish_status||'not submitted')}</small>
      <p>${escapeHtml(p.caption||'')}</p>
      ${media}${note}
    </div>
    <div class="heroButtons">
      ${canReview?'<button class="heroButton approveSocial" data-id="'+escapeHtml(p.id)+'" type="button">Approve</button><button class="heroButton archiveSocial" data-id="'+escapeHtml(p.id)+'" type="button">Archive</button>':''}
      ${p.status==='ready'?'<span class="opsPill">READY FOR METRICOOL</span>':''}
      ${p.external_post_url?'<a class="heroButton" href="'+escapeHtml(p.external_post_url)+'" target="_blank" rel="noopener">Open Post</a>':''}
    </div>
  </article>`;
}

function wirePostActions(){
  document.querySelectorAll('.approveSocial').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;setStatus('Approving social draft…');
    const {data,error}=await supabase.rpc('owner_approve_social_draft',{p_post_id:btn.dataset.id});
    if(error){setStatus(error.message,'error');btn.disabled=false;return;}
    setStatus(data?.ready_to_schedule?'Approved and queued for Metricool scheduling.':'Approved, but that platform still needs connection.','success');
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

function renderPosts(posts=[]){
  const visible=posts.filter(p=>p.status!=='archived');
  $('#socialPostQueue').innerHTML=visible.length?visible.map(postCard).join(''):'<p class="memberEmpty">No social drafts are waiting.</p>';
  wirePostActions();
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
  renderPosts(snapshot.posts||[]);
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
    const mediaNote=$('#socialMediaNote').value.trim();
    const local=$('#socialSchedule').value;
    const scheduledFor=local?new Date(local).toISOString():null;
    if(!title||!caption||!platform)return;
    const button=event.target.querySelector('button[type="submit"]');
    button.disabled=true;setDraftStatus('Saving review draft…');
    const {error}=await supabase.rpc('owner_create_social_draft',{
      p_title:title,
      p_caption:caption,
      p_platform:platform,
      p_content_type:contentType,
      p_campaign:campaign||null,
      p_media_note:mediaNote||null,
      p_media_url:mediaUrl||null,
      p_scheduled_for:scheduledFor
    });
    button.disabled=false;
    if(error){setDraftStatus(error.message,'error');return;}
    event.target.reset();
    setDraftStatus('Draft saved. Nothing has been published or scheduled.','success');
    await load();
  });
}

init().catch(e=>setStatus(e.message||'Social Studio could not load.','error'));