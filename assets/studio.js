import { supabase, $, escapeHtml, prettyDate, requireSession, wireSignOut } from './app-client.js';

let session;
const setStudioStatus=(text,type='')=>{const el=$('#studioStatus');el.textContent=text;el.className=`formStatus ${type}`.trim();};
const safeName=name=>name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-100)||'upload';
const mediaKind=type=>type.startsWith('video/')?'video':type.startsWith('audio/')?'audio':'image';

async function signedPreview(item){const {data}=await supabase.storage.from('protected-media').createSignedUrl(item.storage_path,300);return {...item,signed_url:data?.signedUrl||''};}
async function loadLibrary(){
  const {data,error}=await supabase.from('protected_media').select('id,title,media_kind,storage_path,status,audience_scope,updated_at').order('updated_at',{ascending:false}).limit(50);
  const target=$('#studioMedia');if(error){target.innerHTML=`<p class="memberEmpty">${escapeHtml(error.message)}</p>`;return;}
  const media=await Promise.all((data||[]).map(signedPreview));
  target.innerHTML=media.length?media.map(item=>`<article class="studioMediaCard">${item.media_kind==='image'&&item.signed_url?`<img src="${escapeHtml(item.signed_url)}" alt="">`:'<div class="mediaKind">'+escapeHtml(item.media_kind)+'</div>'}<div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.audience_scope.replaceAll('_',' '))} · ${escapeHtml(item.status)} · ${prettyDate(item.updated_at)}</small></div></article>`).join(''):'<p class="memberEmpty">No protected content has been uploaded yet.</p>';
}

async function init(){
  session=await requireSession();wireSignOut();const {data:profile,error}=await supabase.from('member_profiles').select('is_admin').eq('user_id',session.user.id).single();if(error||!profile?.is_admin){location.href='/member/';return;}await loadLibrary();
  $('#publishForm').addEventListener('submit',async event=>{event.preventDefault();const file=$('#contentFile').files[0],title=$('#contentTitle').value.trim(),body=$('#contentBody').value.trim(),scope=$('#contentScope').value;if(!file||!title||!body)return;
    if(file.size>536870912){setStudioStatus('That file is larger than the 512 MB protected upload limit.','error');return;}
    const allowed=['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','audio/mpeg','audio/mp4'];if(!allowed.includes(file.type)){setStudioStatus('Choose a JPG, PNG, WebP, MP4, MOV, MP3, or M4A file.','error');return;}
    const button=$('#publishForm button[type="submit"]');button.disabled=true;$('#uploadProgress').hidden=false;$('#uploadProgress span').style.width='18%';setStudioStatus('Uploading to the private member vault…');
    const path=`${session.user.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const upload=await supabase.storage.from('protected-media').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
    if(upload.error){button.disabled=false;$('#uploadProgress').hidden=true;setStudioStatus(upload.error.message,'error');return;}$('#uploadProgress span').style.width='65%';
    const media=await supabase.from('protected_media').insert({title,media_kind:mediaKind(file.type),storage_path:path,status:'published',watermark_mode:'visible_and_forensic',downloads_allowed:false,audience_scope:scope,created_by:session.user.id}).select('id').single();
    if(media.error){await supabase.storage.from('protected-media').remove([path]);button.disabled=false;$('#uploadProgress').hidden=true;setStudioStatus(media.error.message,'error');return;}
    const post=await supabase.from('member_posts').insert({title,body,visibility_scope:scope,status:'published',published_at:new Date().toISOString(),created_by:session.user.id});
    if(post.error){setStudioStatus(`The media published, but the feed post needs attention: ${post.error.message}`,'error');}else{setStudioStatus('Published. Eligible members can see it now.','success');event.target.reset();}
    $('#uploadProgress span').style.width='100%';setTimeout(()=>{$('#uploadProgress').hidden=true;$('#uploadProgress span').style.width='0';},800);button.disabled=false;await loadLibrary();
  });
}
init().catch(error=>setStudioStatus(error.message||'Creator Studio could not load.','error'));
