import { supabase, $, escapeHtml, prettyDate, requireSession, wireSignOut } from './app-client.js';

let session;
const setStudioStatus=(text,type='')=>{const el=$('#studioStatus');el.textContent=text;el.className=`formStatus ${type}`.trim();};
const safeName=name=>name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-100)||'upload';
const mediaKind=type=>type.startsWith('video/')?'video':type.startsWith('audio/')?'audio':'photo';

async function signedPreview(item){const {data}=await supabase.storage.from('protected-media').createSignedUrl(item.storage_path,300);return {...item,signed_url:data?.signedUrl||''};}
async function loadLibrary(){
  const {data,error}=await supabase.from('protected_media').select('id,title,media_kind,storage_path,status,audience_scope,updated_at').eq('audience_scope','sfw_member').order('updated_at',{ascending:false}).limit(50);
  const target=$('#studioMedia');if(error){target.innerHTML=`<p class="memberEmpty">${escapeHtml(error.message)}</p>`;return;}
  const media=await Promise.all((data||[]).map(signedPreview));
  target.innerHTML=media.length?media.map(item=>`<article class="studioMediaCard">${item.media_kind==='photo'&&item.signed_url?`<img src="${escapeHtml(item.signed_url)}" alt="">`:'<div class="mediaKind">'+escapeHtml(item.media_kind)+'</div>'}<div><strong>${escapeHtml(item.title)}</strong><small>SFW members · ${escapeHtml(item.status)} · ${prettyDate(item.updated_at)}</small></div></article>`).join(''):'<p class="memberEmpty">No SFW protected content has been uploaded yet.</p>';
}

async function init(){
  session=await requireSession();wireSignOut();
  const {data:profile,error}=await supabase.from('member_profiles').select('is_admin').eq('user_id',session.user.id).single();
  if(error||!profile?.is_admin){location.href='/member/';return;}
  await loadLibrary();
  $('#publishForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const file=$('#contentFile').files[0],title=$('#contentTitle').value.trim(),body=$('#contentBody').value.trim();
    if(!file||!title||!body)return;
    if(file.size>536870912){setStudioStatus('That file is larger than the 512 MB protected upload limit.','error');return;}
    const allowed=['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','audio/mpeg','audio/mp4'];
    if(!allowed.includes(file.type)){setStudioStatus('Choose a JPG, PNG, WebP, MP4, MOV, MP3, or M4A file.','error');return;}
    const button=$('#publishForm button[type="submit"]');button.disabled=true;$('#uploadProgress').hidden=false;$('#uploadProgress span').style.width='18%';setStudioStatus('Uploading to the private SFW member vault…');
    const path=`${session.user.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const upload=await supabase.storage.from('protected-media').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
    if(upload.error){button.disabled=false;$('#uploadProgress').hidden=true;setStudioStatus(upload.error.message,'error');return;}
    $('#uploadProgress span').style.width='65%';
    const {data,error}=await supabase.rpc('owner_publish_media_post',{p_title:title,p_body:body,p_scope:'sfw_member',p_media_kind:mediaKind(file.type),p_storage_path:path});
    if(error){await supabase.storage.from('protected-media').remove([path]);button.disabled=false;$('#uploadProgress').hidden=true;setStudioStatus(error.message,'error');return;}
    setStudioStatus('Published. Approved members with active membership can see it now.','success');event.target.reset();
    $('#uploadProgress span').style.width='100%';setTimeout(()=>{$('#uploadProgress').hidden=true;$('#uploadProgress span').style.width='0';},800);button.disabled=false;await loadLibrary();
  });
}
init().catch(error=>setStudioStatus(error.message||'Creator Studio could not load.','error'));