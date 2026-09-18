import { supabase, $, escapeHtml, prettyDate, requireSession, wireSignOut } from './app-client.js';

let session;
const setStatus=(text,type='')=>{const el=$('#inboxStatus');if(!el)return;el.textContent=text;el.className='opsStatus '+type;};
const safeName=name=>String(name||'upload').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-100)||'upload';

async function requireOwner(){
  session=await requireSession();
  wireSignOut();
  const q=await supabase.from('member_profiles').select('is_admin').eq('user_id',session.user.id).single();
  if(q.error||!q.data?.is_admin){location.replace('/member/');throw new Error('Owner access required.');}
}
async function signed(bucket,path,seconds=900){
  if(!path)return '';
  const q=await supabase.storage.from(bucket).createSignedUrl(path,seconds);
  return q.error?'':(q.data?.signedUrl||'');
}
function mediaHtml(url,mime,kind){
  if(!url)return '<div class="inboxMedia"><p class="inboxEmpty">Media not attached yet.</p></div>';
  const type=String(mime||'').toLowerCase();
  if(type.startsWith('video/')||kind==='video')return '<div class="inboxMedia"><video controls playsinline preload="metadata" src="'+escapeHtml(url)+'"></video></div>';
  if(type.startsWith('audio/')||kind==='audio')return '<div class="inboxMedia"><audio controls src="'+escapeHtml(url)+'"></audio></div>';
  return '<div class="inboxMedia"><img src="'+escapeHtml(url)+'" alt=""></div>';
}
function renderCounts(c){
  const creator=(Number(c.autobot_approvals)||0)+(Number(c.media_approvals)||0);
  const total=(Number(c.access_requests)||0)+(Number(c.social_approvals)||0)+creator+(Number(c.tasks)||0);
  $('#accessCount').textContent=String(c.access_requests||0);
  $('#socialCount').textContent=String(c.social_approvals||0);
  $('#creatorCount').textContent=String(creator);
  $('#taskCount').textContent=String(c.tasks||0);
  $('#inboxTotal').textContent=total?String(total)+' WAITING':'CLEAR';
}
async function enrichAccess(items){
  const out=[];
  for(const m of items){
    out.push({...m,signed_photo:m.profile_photo_path?await signed('member-profile-photos',m.profile_photo_path):''});
  }
  return out;
}
async function enrichSocial(items){
  const out=[];
  for(const p of items){
    let url=p.media_url||'';
    if(p.media_storage_path)url=await signed('social-draft-media',p.media_storage_path,1800);
    out.push({...p,preview_url:url});
  }
  return out;
}
async function enrichMedia(items){
  const out=[];
  for(const m of items){
    out.push({...m,preview_url:m.storage_path?await signed('protected-media',m.storage_path,1800):''});
  }
  return out;
}
function renderAccess(items){
  const target=$('#accessRequests');
  if(!items.length){target.innerHTML='<p class="inboxEmpty">No new access requests.</p>';return;}
  let html='';
  for(const m of items){
    html+='<article class="inboxCard">';
    html+=m.signed_photo?'<img class="inboxProfile" src="'+escapeHtml(m.signed_photo)+'" alt="Submitted member profile photo">':'<div class="inboxMedia"><p class="inboxEmpty">No profile photo submitted.</p></div>';
    html+='<div class="inboxBody"><div class="inboxMeta"><span class="opsPill">ACCESS REQUEST</span></div>';
    html+='<strong>'+escapeHtml(m.full_name||'Unnamed member')+'</strong><p>'+escapeHtml(m.email||'')+'</p><small>Requested '+escapeHtml(prettyDate(m.created_at))+'</small>';
    html+='<div class="inboxActions"><button class="heroButton approveAccess" data-id="'+escapeHtml(m.user_id)+'" type="button" '+(m.profile_photo_path?'':'disabled')+'>Approve</button><button class="heroButton denyAccess" data-id="'+escapeHtml(m.user_id)+'" type="button">Deny</button></div></div></article>';
  }
  target.innerHTML=html;
  target.querySelectorAll('.approveAccess').forEach(btn=>btn.addEventListener('click',()=>decideAccess(btn,'approved')));
  target.querySelectorAll('.denyAccess').forEach(btn=>btn.addEventListener('click',()=>decideAccess(btn,'denied')));
}
async function decideAccess(btn,decision){
  btn.disabled=true;setStatus(decision==='approved'?'Approving member…':'Denying access request…');
  const q=await supabase.functions.invoke('manual-member-approval',{body:{action:'decide',user_id:btn.dataset.id,decision}});
  if(q.error||q.data?.error){setStatus(q.data?.error||q.error?.message||'Access decision failed.','error');btn.disabled=false;return;}
  setStatus(q.data?.message||'Access request updated.','success');await load();
}
function socialCard(p){
  const requires=['photo','video','story'].includes(p.content_type);
  const has=Boolean(p.preview_url);
  let h='<article class="inboxCard"><div class="inboxBody"><div class="inboxMeta"><span class="opsPill">'+escapeHtml(String(p.platform||'SOCIAL').toUpperCase())+'</span><span class="opsPill">'+escapeHtml(String(p.content_type||'POST').toUpperCase())+'</span></div><strong>'+escapeHtml(p.title||'Social post')+'</strong><small>'+escapeHtml(p.campaign||'No campaign')+'</small></div>';
  h+=mediaHtml(p.preview_url,p.media_mime_type,p.content_type);
  h+='<div class="inboxBody"><p class="inboxCaption">'+escapeHtml(p.caption||'')+'</p>';
  if(!has&&requires){
    h+='<div class="mediaAttach"><label>Attach exact media to review<input class="socialMediaFile" data-id="'+escapeHtml(p.id)+'" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"></label><button class="heroButton attachSocialMedia" data-id="'+escapeHtml(p.id)+'" type="button">Attach Media</button></div>';
  }
  if(p.media_note)h+='<p><small>'+escapeHtml(p.media_note)+'</small></p>';
  h+='<div class="inboxActions"><button class="heroButton approveSocialInbox" data-id="'+escapeHtml(p.id)+'" type="button" '+((!requires||has)?'':'disabled')+'>Approve Post</button><button class="heroButton archiveSocialInbox" data-id="'+escapeHtml(p.id)+'" type="button">Archive</button></div></div></article>';
  return h;
}
function renderSocial(items){
  const target=$('#socialApprovals');
  target.innerHTML=items.length?items.map(socialCard).join(''):'<p class="inboxEmpty">No Social Studio posts are waiting for approval.</p>';
  target.querySelectorAll('.attachSocialMedia').forEach(btn=>btn.addEventListener('click',()=>attachSocial(btn)));
  target.querySelectorAll('.approveSocialInbox').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;setStatus('Approving social post…');
    const q=await supabase.rpc('owner_approve_social_draft',{p_post_id:btn.dataset.id});
    if(q.error){setStatus(q.error.message,'error');btn.disabled=false;return;}
    setStatus(q.data?.ready_to_schedule?'Post approved and ready for Metricool scheduling.':'Post approved; platform connection is still required.','success');await load();
  }));
  target.querySelectorAll('.archiveSocialInbox').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;const q=await supabase.rpc('owner_archive_social_draft',{p_post_id:btn.dataset.id});
    if(q.error){setStatus(q.error.message,'error');btn.disabled=false;return;}
    setStatus('Social post archived.','success');await load();
  }));
}
async function attachSocial(btn){
  const input=document.querySelector('.socialMediaFile[data-id="'+btn.dataset.id+'"]');
  const file=input?.files?.[0];
  if(!file){setStatus('Choose the exact image or video first.','error');return;}
  if(file.size>209715200){setStatus('Social draft media must be 200 MB or smaller.','error');return;}
  const allowed=['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'];
  if(!allowed.includes(file.type)){setStatus('Use JPG, PNG, WebP, MP4, or MOV.','error');return;}
  btn.disabled=true;setStatus('Uploading social preview media…');
  const path=session.user.id+'/'+btn.dataset.id+'-'+crypto.randomUUID()+'-'+safeName(file.name);
  const up=await supabase.storage.from('social-draft-media').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
  if(up.error){setStatus(up.error.message,'error');btn.disabled=false;return;}
  const q=await supabase.rpc('owner_attach_social_media',{p_post_id:btn.dataset.id,p_storage_path:path,p_mime_type:file.type});
  if(q.error){await supabase.storage.from('social-draft-media').remove([path]);setStatus(q.error.message,'error');btn.disabled=false;return;}
  setStatus('Media attached. The full post preview is ready.','success');await load();
}
function renderAutobot(items){
  const target=$('#autobotApprovals');
  if(!items.length){target.innerHTML='<p class="inboxEmpty">No autobot drafts are waiting.</p>';return;}
  let html='';
  for(const d of items){
    html+='<article class="inboxCard"><div class="inboxBody"><div class="inboxMeta"><span class="opsPill">AUTOBOT</span><span class="opsPill">LANE '+escapeHtml(String(d.lane_no||'—'))+'</span></div><strong>'+escapeHtml(d.title||'Draft')+'</strong><p class="inboxCaption">'+escapeHtml(d.body||'')+'</p><p><small>'+escapeHtml(d.reason||'Prepared by the content intelligence engine.')+'</small></p><div class="inboxActions"><button class="heroButton approveAutoInbox" data-id="'+escapeHtml(d.id)+'" type="button">Approve</button><button class="heroButton archiveAutoInbox" data-id="'+escapeHtml(d.id)+'" type="button">Archive</button></div></div></article>';
  }
  target.innerHTML=html;
  target.querySelectorAll('.approveAutoInbox').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const q=await supabase.rpc('owner_approve_autobot_draft',{p_post_id:btn.dataset.id});if(q.error){setStatus(q.error.message,'error');btn.disabled=false;return;}setStatus('Autobot draft approved.','success');await load();}));
  target.querySelectorAll('.archiveAutoInbox').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const q=await supabase.rpc('owner_archive_autobot_draft',{p_post_id:btn.dataset.id});if(q.error){setStatus(q.error.message,'error');btn.disabled=false;return;}setStatus('Autobot draft archived.','success');await load();}));
}
function renderMedia(items){
  const target=$('#mediaApprovals');
  if(!items.length){target.innerHTML='<p class="inboxEmpty">No media drafts are waiting.</p>';return;}
  let html='';
  for(const m of items){
    html+='<article class="inboxCard"><div class="inboxBody"><div class="inboxMeta"><span class="opsPill">MEDIA REVIEW</span><span class="opsPill">'+escapeHtml(String(m.media_kind||'MEDIA').toUpperCase())+'</span></div><strong>'+escapeHtml(m.title||'Media draft')+'</strong></div>';
    html+=mediaHtml(m.preview_url,'',m.media_kind);
    html+='<div class="inboxBody"><p class="inboxCaption">'+escapeHtml(m.body||'')+'</p><small>Rights: '+escapeHtml(m.rights_status||'missing')+'</small><div class="inboxActions"><button class="heroButton approveMediaInbox" data-id="'+escapeHtml(m.media_id)+'" type="button">Approve</button><button class="heroButton archiveMediaInbox" data-id="'+escapeHtml(m.media_id)+'" type="button">Archive</button></div></div></article>';
  }
  target.innerHTML=html;
  target.querySelectorAll('.approveMediaInbox').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const q=await supabase.rpc('owner_approve_media_review',{p_media_id:btn.dataset.id});if(q.error){setStatus(q.error.message,'error');btn.disabled=false;return;}setStatus('Media approved.','success');await load();}));
  target.querySelectorAll('.archiveMediaInbox').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const q=await supabase.rpc('owner_archive_media_review',{p_media_id:btn.dataset.id});if(q.error){setStatus(q.error.message,'error');btn.disabled=false;return;}setStatus('Media archived.','success');await load();}));
}
function renderTasks(items){
  const target=$('#taskList');
  if(!items.length){target.innerHTML='<p class="inboxEmpty">No open content tasks.</p>';return;}
  let html='';
  for(const t of items){
    html+='<article class="productCatalogCard"><div><span class="productState">'+escapeHtml(String(t.status||'planned').toUpperCase())+'</span><strong>'+escapeHtml(t.title||'Task')+'</strong><small>'+escapeHtml(t.channel||'')+(t.due_on?' · due '+escapeHtml(t.due_on):'')+'</small></div></article>';
  }
  target.innerHTML=html;
}
async function load(){
  setStatus('Loading Founder Inbox…');
  const q=await supabase.rpc('owner_founder_inbox_snapshot');
  if(q.error)throw q.error;
  const data=q.data||{};
  const access=await enrichAccess(data.access_requests||[]);
  const social=await enrichSocial(data.social_posts||[]);
  const media=await enrichMedia(data.media_drafts||[]);
  renderCounts(data.counts||{});
  renderAccess(access);
  renderSocial(social);
  renderAutobot(data.autobot_drafts||[]);
  renderMedia(media);
  renderTasks(data.tasks||[]);
  setStatus('Founder Inbox is current.','success');
}
async function init(){await requireOwner();await load();}
init().catch(error=>setStatus(error.message||'Founder Inbox could not load.','error'));
