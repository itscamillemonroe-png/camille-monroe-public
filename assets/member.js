import { supabase, $, escapeHtml, prettyDate, requireSession, wireSignOut, captureAttribution } from './app-client.js';

const PROFILE_BUCKET='member-profile-photos';
const ALLOWED_PHOTO_TYPES=new Set(['image/jpeg','image/png','image/webp']);
const setStatus=(text,type='')=>{const el=$('#status');if(!el)return;el.textContent=text;el.className=`formStatus ${type}`.trim();};
function photoExtension(file){if(file.type==='image/png')return 'png';if(file.type==='image/webp')return 'webp';return 'jpg';}

async function uploadProfilePhoto(user,file,oldPath=''){
  if(!file)throw new Error('Choose a clear profile picture to continue.');
  if(!ALLOWED_PHOTO_TYPES.has(file.type))throw new Error('Use a JPG, PNG, or WebP profile picture.');
  if(file.size>8*1024*1024)throw new Error('Your profile picture must be smaller than 8 MB.');
  const path=`${user.id}/profile-${Date.now()}.${photoExtension(file)}`;
  const {error:uploadError}=await supabase.storage.from(PROFILE_BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
  if(uploadError)throw uploadError;
  const {error:profileError}=await supabase.rpc('submit_member_profile_photo',{p_path:path});
  if(profileError){await supabase.storage.from(PROFILE_BUCKET).remove([path]);throw profileError;}
  if(oldPath&&oldPath!==path)await supabase.storage.from(PROFILE_BUCKET).remove([oldPath]);
  return path;
}

async function loginPage(){
  const {data:{session}}=await supabase.auth.getSession();
  if(session){location.href='/member/';return;}
  $('#loginForm')?.addEventListener('submit',async(e)=>{e.preventDefault();setStatus('Signing you in…');const email=$('#email').value.trim();const password=$('#password').value;const {error}=await supabase.auth.signInWithPassword({email,password});if(error){setStatus(error.message,'error');return;}location.href='/member/';});
  $('#signupForm')?.addEventListener('submit',async(e)=>{
    e.preventDefault();const button=e.currentTarget.querySelector('[type="submit"]');button.disabled=true;setStatus('Creating your request…');
    try{
      const full_name=$('#signupName').value.trim(),email=$('#signupEmail').value.trim(),password=$('#signupPassword').value,file=$('#profilePhoto').files[0],ageConfirmed=Boolean($('#signupAge')?.checked);
      if(!ageConfirmed)throw new Error('You must confirm that you are 18 or older.');
      if(!file)throw new Error('A profile picture is required to request access.');
      if(!ALLOWED_PHOTO_TYPES.has(file.type)||file.size>8*1024*1024)throw new Error('Use a JPG, PNG, or WebP picture smaller than 8 MB.');
      const attribution=captureAttribution();const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name,age_confirmed:true,attribution},emailRedirectTo:'https://itscamillemonroe.art/login/'}});
      if(error)throw error;
      if(data.session){await uploadProfilePhoto(data.user,file);location.href='/member/';return;}
      setStatus('Account created. Confirm your email, sign in, then upload the required profile picture to finish your request.','success');
    }catch(error){setStatus(error.message||'Your request could not be created.','error');}
    finally{button.disabled=false;}
  });
  document.querySelectorAll('[data-auth-tab]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b===btn));const show=btn.dataset.authTab;$('#loginPanel').hidden=show!=='login';$('#signupPanel').hidden=show!=='signup';setStatus('');}));
}

function renderPosts(posts){
  const feed=$('#memberFeed');if(!feed)return;feed.innerHTML='';
  if(!posts.length){feed.innerHTML='<article class="memberEmpty">No member posts are available to your account yet.</article>';return;}
  posts.forEach(p=>{const article=document.createElement('article');article.className='memberPost';article.innerHTML=`<div class="postTop"><div class="avatar">CM</div><div><strong>Camille Monroe</strong><small>Member update · ${prettyDate(p.published_at)}</small></div><span class="postGem">◇</span></div><div class="postBody"><h2>${escapeHtml(p.title||'Member update')}</h2><p>${escapeHtml(p.body||'')}</p></div>`;feed.appendChild(article);});
}

function mediaElement(item){if(item.media_kind==='video')return `<video controls playsinline preload="metadata" src="${escapeHtml(item.signed_url)}"></video>`;if(item.media_kind==='audio')return `<audio controls preload="metadata" src="${escapeHtml(item.signed_url)}"></audio>`;return `<img loading="lazy" src="${escapeHtml(item.signed_url)}" alt="${escapeHtml(item.title)}">`;}
function lockMemberServices(active,approved,admin){
  if(admin||active)return;
  const gated=['/messages/','/calls/?type=voice','/lane/premium-drops/','/lane/support/'];
  document.querySelectorAll('.memberServices a.serviceCard').forEach(card=>{
    const href=card.getAttribute('href')||'';
    if(gated.includes(href)){
      card.classList.add('lockedService');
      card.setAttribute('aria-disabled','true');
      card.addEventListener('click',event=>event.preventDefault());
      const small=card.querySelector('small');
      if(small)small.textContent=approved?'Activate membership first.':'Available after approval and active membership.';
    }
  });
}

async function loadGallery(){
  const gallery=$('#memberGallery');if(!gallery)return;
  const {data,error}=await supabase.functions.invoke('member-media',{body:{action:'list'}});
  if(error||data?.error){gallery.innerHTML='<article class="memberEmpty">No protected releases are available to this account yet.</article>';return;}
  const items=(data?.media||[]).filter(item=>item.audience_scope==='sfw_member');
  if(!items.length){gallery.innerHTML='<article class="memberEmpty">No protected releases have been published yet.</article>';return;}
  gallery.innerHTML=items.map(item=>`<article class="mediaCard">${mediaElement(item)}<div><strong>${escapeHtml(item.title)}</strong><small>Member release</small></div></article>`).join('');
}

async function memberPage(){
  const session=await requireSession();wireSignOut();const user=session.user;
  const [profileR,subR]=await Promise.all([
    supabase.from('member_profiles').select('full_name,email,status,is_admin,profile_photo_path').eq('user_id',user.id).maybeSingle(),
    supabase.from('member_subscriptions').select('access_until').eq('user_id',user.id).maybeSingle()
  ]);
  if(profileR.error)throw profileR.error;
  const profile=profileR.data||{},sub=subR.data||{};
  if(!profile.is_admin&&!profile.profile_photo_path){location.replace('/verify/');return;}
  $('#memberName').textContent=profile.full_name||'Member';$('#memberEmail').textContent=profile.email||user.email||'';
  $('#approvalStatus').textContent=(profile.status||'pending').replaceAll('_',' ');$('#profileStatus').textContent=profile.profile_photo_path?'submitted':'required';$('#accessUntil').textContent=prettyDate(sub.access_until);
  const approved=profile.status==='approved',active=Boolean(sub.access_until&&new Date(sub.access_until)>new Date()),admin=Boolean(profile.is_admin);
  if(admin){const banner=$('#memberBanner');if(banner){banner.dataset.ownerPreview='true';}}
  const banner=$('#memberBanner');
  if(admin){banner.innerHTML='<strong>Owner preview</strong><span>You are viewing the member experience exactly as members see it.</span>';banner.classList.add('activeAccess');}
  else if(approved&&active){banner.innerHTML='<strong>Member access active</strong><span>Your approved SFW member experience is open.</span>';banner.classList.add('activeAccess');}
  else{const next=!approved?'Your profile picture is submitted and waiting for Camille’s approval.':!active?'Your approval is complete. Activate membership access to open the member feed.':'Your account is being prepared.';banner.innerHTML=`<strong>Access status</strong><span>${escapeHtml(next)}</span>${approved&&!active?'<a class="heroButton primary" href="/payments/">Activate membership</a>':''}`;}
  lockMemberServices(active,approved,admin);
  if(!admin&&(!approved||!active)){renderPosts([]);$('#memberGallery').innerHTML='<article class="memberEmpty">Your member gallery opens after approval and active membership.</article>';return;}
  const {data:posts,error:postsError}=await supabase.from('member_posts').select('id,title,body,visibility_scope,published_at').eq('visibility_scope','sfw_member').eq('status','published').order('published_at',{ascending:false}).limit(30);
  if(postsError)renderPosts([]);else renderPosts(posts||[]);
  await loadGallery();
}

if(document.body.dataset.page==='login')loginPage();
if(document.body.dataset.page==='member')memberPage().catch(()=>{});