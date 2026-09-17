import { supabase, $, requireSession, wireSignOut } from './app-client.js';

const BUCKET='member-profile-photos';
const ALLOWED=new Set(['image/jpeg','image/png','image/webp']);
function setMsg(text,type=''){const el=$('#verifyStatus');if(!el)return;el.textContent=text;el.className=`formStatus ${type}`.trim();}
function setDiditMsg(text,type=''){const el=$('#diditStatus');if(!el)return;el.textContent=text;el.className=`formStatus ${type}`.trim();}
function extension(file){if(file.type==='image/png')return 'png';if(file.type==='image/webp')return 'webp';return 'jpg';}

function renderDidit(status='not_started'){
  const title=$('#adultVerifyTitle'),copy=$('#adultVerifyCopy'),button=$('#startDidit');
  if(status==='verified'){
    title.textContent='18+ check complete';
    copy.textContent='Didit approved your verification. NSFW access unlocks after Camille approves your profile and your eligible access is active.';
    button.hidden=true;
    $('#adultVerifyPanel').classList.add('activeAccess');
    return;
  }
  $('#adultVerifyPanel').classList.remove('activeAccess');
  button.hidden=false;
  if(status==='pending'){
    title.textContent='18+ check in progress';
    copy.textContent='Finish the secure Didit check or wait a moment if you just completed it.';
    button.textContent='Continue secure 18+ check';
  }else if(status==='failed'||status==='expired'){
    title.textContent=status==='expired'?'18+ check expired':'18+ check needs another try';
    copy.textContent='Start a fresh secure verification. Your identity documents are handled by Didit, not stored on this site.';
    button.textContent='Try secure 18+ check again';
  }else{
    title.textContent='Secure 18+ check required';
    copy.textContent='Complete the private Didit check once. Camille receives only the verification result.';
    button.textContent='Complete secure 18+ check';
  }
}

async function loadDidit(){
  const {data,error}=await supabase.functions.invoke('didit-verification',{body:{action:'status'}});
  if(error||data?.error)throw new Error(data?.error||'Your 18+ verification status could not load.');
  renderDidit(data?.verification_status||'not_started');
}

async function startDidit(){
  const button=$('#startDidit');button.disabled=true;setDiditMsg('Opening the secure Didit check…');
  try{
    const {data,error}=await supabase.functions.invoke('didit-verification',{body:{action:'start'}});
    if(error||data?.error)throw new Error(data?.error||'The secure verification could not start.');
    if(data?.verified){renderDidit('verified');setDiditMsg('Your 18+ check is already complete.','success');return;}
    if(!data?.verification_url)throw new Error('Didit did not return a verification link.');
    location.assign(data.verification_url);
  }catch(error){setDiditMsg(error.message||'The secure verification could not start.','error');button.disabled=false;}
}

async function load(){
  const session=await requireSession();
  wireSignOut();
  const {data:profile,error}=await supabase.from('member_profiles').select('status,profile_photo_path,profile_photo_uploaded_at,verification_status').eq('user_id',session.user.id).single();
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
  renderDidit(profile.verification_status||'not_started');
  $('#startDidit').addEventListener('click',startDidit);
  loadDidit().catch(error=>setDiditMsg(error.message,'error'));
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
