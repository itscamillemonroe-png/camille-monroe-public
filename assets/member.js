import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL='https://wybpxixkjimbpvufozub.supabase.co';
const SUPABASE_KEY='sb_publishable_0bNGPfELmwuT32zmhXXkMQ_sJIXotwE';
export const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);

const $=(s)=>document.querySelector(s);
const setStatus=(text,type='')=>{const el=$('#status');if(!el)return;el.textContent=text;el.className=`formStatus ${type}`.trim();};

async function loginPage(){
  const {data:{session}}=await supabase.auth.getSession();
  if(session){location.href='/member/';return;}
  $('#loginForm')?.addEventListener('submit',async(e)=>{e.preventDefault();setStatus('Signing you in…');const email=$('#email').value.trim();const password=$('#password').value;const {error}=await supabase.auth.signInWithPassword({email,password});if(error){setStatus(error.message,'error');return;}location.href='/member/';});
  $('#signupForm')?.addEventListener('submit',async(e)=>{e.preventDefault();setStatus('Creating your request…');const full_name=$('#signupName').value.trim();const email=$('#signupEmail').value.trim();const password=$('#signupPassword').value;const age_confirmed=$('#ageConfirmed').checked;if(!age_confirmed){setStatus('You must confirm you are 18 or older to request access.','error');return;}const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name,age_confirmed},emailRedirectTo:'https://itscamillemonroe.art/login/'}});if(error){setStatus(error.message,'error');return;}if(data.session){location.href='/member/';return;}setStatus('Request created. Check your email to confirm your account, then come back here to sign in.','success');});
  document.querySelectorAll('[data-auth-tab]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b===btn));const show=btn.dataset.authTab;$('#loginPanel').hidden=show!=='login';$('#signupPanel').hidden=show!=='signup';setStatus('');}));
}

function prettyDate(v){if(!v)return 'Not active yet';try{return new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(v));}catch{return v;}}

async function memberPage(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){location.href='/login/';return;}
  $('#signOut')?.addEventListener('click',async()=>{await supabase.auth.signOut();location.href='/';});
  const user=session.user;
  const [profileR,subR,walletR,postsR]=await Promise.all([
    supabase.from('member_profiles').select('full_name,email,status,verification_status,approved_content_scope').eq('user_id',user.id).maybeSingle(),
    supabase.from('member_subscriptions').select('access_until').eq('user_id',user.id).maybeSingle(),
    supabase.from('member_wallets').select('balance_credits').eq('user_id',user.id).maybeSingle(),
    supabase.from('member_posts').select('id,title,body,visibility_scope,published_at').order('published_at',{ascending:false}).limit(30)
  ]);
  const profile=profileR.data||{}; const sub=subR.data||{}; const wallet=walletR.data||{};
  $('#memberName').textContent=profile.full_name||'Member';
  $('#memberEmail').textContent=profile.email||user.email||'';
  $('#approvalStatus').textContent=(profile.status||'pending').replaceAll('_',' ');
  $('#verificationStatus').textContent=(profile.verification_status||'pending').replaceAll('_',' ');
  $('#accessUntil').textContent=prettyDate(sub.access_until);
  $('#creditBalance').textContent=Number.isFinite(wallet.balance_credits)?wallet.balance_credits:'0';
  const approved=profile.status==='approved'; const verified=profile.verification_status==='verified'; const active=sub.access_until&&new Date(sub.access_until)>new Date();
  const banner=$('#memberBanner');
  if(approved&&verified&&active){banner.innerHTML='<strong>Private access active</strong><span>Your member access is open. Member posts available to your account appear below.</span>';banner.classList.add('activeAccess');}
  else {const next=!verified?'Verification is still required.':!approved?'Your account is waiting for Camille’s approval.':!active?'Your membership access is not active.':'Your account is being prepared.';banner.innerHTML=`<strong>Access status</strong><span>${next}</span>`;}
  const feed=$('#memberFeed'); feed.innerHTML='';
  if(postsR.error){feed.innerHTML='<article class="memberEmpty">Member posts will appear here when your access allows them.</article>';return;}
  const posts=postsR.data||[];
  if(!posts.length){feed.innerHTML='<article class="memberEmpty">No member posts are available to your account yet.</article>';return;}
  posts.forEach(p=>{const article=document.createElement('article');article.className='memberPost';article.innerHTML=`<div class="postTop"><div class="avatar">CM</div><div><strong>Camille Monroe</strong><small>${p.visibility_scope==='adult_content'?'Private release':'Member update'} · ${prettyDate(p.published_at)}</small></div><span class="postGem">◇</span></div><div class="postBody"><h2>${escapeHtml(p.title||'Member update')}</h2><p>${escapeHtml(p.body||'')}</p></div>`;feed.appendChild(article);});
}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

if(document.body.dataset.page==='login')loginPage();
if(document.body.dataset.page==='member')memberPage();
