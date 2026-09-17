import { supabase, $, requireSession, wireSignOut } from './app-client.js';

const BUCKET='member-profile-photos';
const ALLOWED=new Set(['image/jpeg','image/png','image/webp']);
function setMsg(text,type=''){const el=$('#verifyStatus');if(!el)return;el.textContent=text;el.className=`formStatus ${type}`.trim();}
function extension(file){if(file.type==='image/png')return 'png';if(file.type==='image/webp')return 'webp';return 'jpg';}

async function load(){
  const session=await requireSession();
  wireSignOut();
  const {data:profile,error}=await supabase.from('member_profiles').select('status,profile_photo_path,profile_photo_uploaded_at').eq('user_id',session.user.id).single();
  if(error)throw error;
  const state=$('#verifyState');
  if(profile.profile_photo_path){
    const {data}=await supabase.storage.from(BUCKET).createSignedUrl(profile.profile_photo_path,300);
    if(data?.signedUrl)$('#profilePreview').src=data.signedUrl;
    $('#profilePreviewWrap').hidden=false;
    state.innerHTML=`<strong>Profile picture submitted</strong><span>${profile.status==='approved'?'Camille approved your member request.':'Your request is waiting for Camille’s review.'} You may replace the photo below; doing so returns the request to pending.</span>`;
    if(profile.status==='approved')state.classList.add('activeAccess');
  }else{
    state.innerHTML='<strong>Profile picture required</strong><span>Upload a clear picture of yourself before Camille can approve or deny your member request.</span>';
  }
  $('#profilePhotoForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const file=$('#profilePhoto').files[0],button=event.currentTarget.querySelector('button');
    if(!file){setMsg('Choose a profile picture first.','error');return;}
    if(!ALLOWED.has(file.type)){setMsg('Use a JPG, PNG, or WebP picture.','error');return;}
    if(file.size>8*1024*1024){setMsg('Your profile picture must be smaller than 8 MB.','error');return;}
    button.disabled=true;setMsg('Uploading your profile picture…');
    const path=`${session.user.id}/profile-${Date.now()}.${extension(file)}`;
    try{
      const {error:uploadError}=await supabase.storage.from(BUCKET).upload(path,file,{contentType:file.type,cacheControl:'3600'});
      if(uploadError)throw uploadError;
      const {error:rpcError}=await supabase.rpc('submit_member_profile_photo',{p_path:path});
      if(rpcError){await supabase.storage.from(BUCKET).remove([path]);throw rpcError;}
      if(profile.profile_photo_path&&profile.profile_photo_path!==path)await supabase.storage.from(BUCKET).remove([profile.profile_photo_path]);
      setMsg('Profile picture submitted. Your request is now waiting for Camille’s review.','success');
      setTimeout(()=>location.href='/member/',700);
    }catch(uploadError){setMsg(uploadError.message||'The profile picture could not be uploaded.','error');}
    finally{button.disabled=false;}
  });
}

load().catch(error=>setMsg(error.message||'Your profile could not load.','error'));
