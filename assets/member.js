import { supabase, $, escapeHtml, prettyDate, requireSession, wireSignOut } from './app-client.js';

const setStatus=(text,type='')=>{const el=$('#status');if(!el)return;el.textContent=text;el.className=`formStatus ${type}`.trim();};

async function loginPage(){
  const {data:{session}}=await supabase.auth.getSession();
  if(session){location.href='/member/';return;}
  $('#loginForm')?.addEventListener('submit',async(e)=>{e.preventDefault();setStatus('Signing you in…');const email=$('#email').value.trim();const password=$('#password').value;const {error}=await supabase.auth.signInWithPassword({email,password});if(error){setStatus(error.message,'error');return;}location.href='/member/';});
  $('#signupForm')?.addEventListener('submit',async(e)=>{e.preventDefault();setStatus('Creating your request…');const full_name=$('#signupName').value.trim();const email=$('#signupEmail').value.trim();const password=$('#signupPassword').value;const age_confirmed=$('#ageConfirmed').checked;if(!age_confirmed){setStatus('You must confirm you are 18 or older to request access.','error');return;}const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name,age_confirmed},emailRedirectTo:'https://itscamillemonroe.art/login/'}});if(error){setStatus(error.message,'error');return;}if(data.session){location.href='/member/';return;}setStatus('Request created. Check your email to confirm your account, then come back here to sign in.','success');});
  document.querySelectorAll('[data-auth-tab]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b===btn));const show=btn.dataset.authTab;$('#loginPanel').hidden=show!=='login';$('#signupPanel').hidden=show!=='signup';setStatus('');}));
}

function renderPosts(posts){
  const feed=$('#memberFeed'); if(!feed)return; feed.innerHTML='';
  if(!posts.length){feed.innerHTML='<article class="memberEmpty">No member posts are available to your account yet.</article>';return;}
  posts.forEach(p=>{const article=document.createElement('article');article.className='memberPost';article.innerHTML=`<div class="postTop"><div class="avatar">CM</div><div><strong>Camille Monroe</strong><small>${p.visibility_scope==='adult_content'?'Private release':'Member update'} · ${prettyDate(p.published_at)}</small></div><span class="postGem">◇</span></div><div class="postBody"><h2>${escapeHtml(p.title||'Member update')}</h2><p>${escapeHtml(p.body||'')}</p></div>`;feed.appendChild(article);});
}

function mediaElement(item){
  if(item.media_kind==='video') return `<video controls playsinline preload="metadata" src="${escapeHtml(item.signed_url)}"></video>`;
  if(item.media_kind==='audio') return `<audio controls preload="metadata" src="${escapeHtml(item.signed_url)}"></audio>`;
  return `<img loading="lazy" src="${escapeHtml(item.signed_url)}" alt="${escapeHtml(item.title)}">`;
}

async function loadGallery(){
  const gallery=$('#memberGallery'); if(!gallery)return;
  const {data,error}=await supabase.functions.invoke('member-media',{body:{action:'list'}});
  if(error||data?.error){gallery.innerHTML=`<article class="memberEmpty">${escapeHtml(data?.error||'Protected releases are unavailable right now.')}</article>`;return;}
  const items=data?.media||[];
  if(!items.length){gallery.innerHTML='<article class="memberEmpty">No protected releases have been published yet.</article>';return;}
  gallery.innerHTML=items.map(item=>`<article class="mediaCard">${mediaElement(item)}<div><strong>${escapeHtml(item.title)}</strong><small>${item.audience_scope==='adult_content'?'Verified member release':'Member release'}</small></div></article>`).join('');
}

async function memberPage(){
  const session=await requireSession(); wireSignOut(); const user=session.user;
  const [profileR,subR,walletR,postsR]=await Promise.all([
    supabase.from('member_profiles').select('full_name,email,status,is_admin,verification_status,verification_provider,approved_content_scope').eq('user_id',user.id).maybeSingle(),
    supabase.from('member_subscriptions').select('access_until').eq('user_id',user.id).maybeSingle(),
    supabase.from('member_wallets').select('balance_credits').eq('user_id',user.id).maybeSingle(),
    supabase.from('member_posts').select('id,title,body,visibility_scope,published_at').order('published_at',{ascending:false}).limit(30)
  ]);
  const profile=profileR.data||{}, sub=subR.data||{}, wallet=walletR.data||{};
  $('#memberName').textContent=profile.full_name||'Member'; $('#memberEmail').textContent=profile.email||user.email||'';
  $('#approvalStatus').textContent=(profile.status||'pending').replaceAll('_',' '); $('#verificationStatus').textContent=(profile.verification_status||'not started').replaceAll('_',' '); $('#accessUntil').textContent=prettyDate(sub.access_until); $('#creditBalance').textContent=Number.isFinite(wallet.balance_credits)?wallet.balance_credits:'0';
  const approved=profile.status==='approved', verified=profile.verification_status==='verified', active=sub.access_until&&new Date(sub.access_until)>new Date(), admin=Boolean(profile.is_admin);
  if(verified){$('#verificationAction')?.setAttribute('hidden','');$('#verificationService')?.setAttribute('hidden','');}
  if(admin){const services=$('.memberServices');services?.insertAdjacentHTML('afterbegin','<a class="serviceCard" href="/studio/"><span>00</span><div><strong>Creator Studio</strong><small>Upload and publish protected content.</small></div><b>→</b></a>');}
  const banner=$('#memberBanner');
  if(admin){banner.innerHTML='<strong>Owner controls active</strong><span>Creator Studio, member messages, and call requests are ready.</span>';banner.classList.add('activeAccess');}
  else if(approved&&verified&&active){banner.innerHTML='<strong>Private access active</strong><span>Your complete member experience is open below.</span>';banner.classList.add('activeAccess');}
  else if(!verified){banner.innerHTML='<strong>Age & identity verification required</strong><span>Complete Didit verification before protected access and checkout can open. <a href="/verify/">Verify now →</a></span>';}
  else{const next=!approved?'Your account is waiting for Camille’s approval.':!active?'Your membership access is not active.':'Your account is being prepared.';banner.innerHTML=`<strong>Access status</strong><span>${escapeHtml(next)}</span>`;}
  if(postsR.error) renderPosts([]); else renderPosts(postsR.data||[]);
  await loadGallery();
}

if(document.body.dataset.page==='login')loginPage();
if(document.body.dataset.page==='member')memberPage().catch(()=>{});
