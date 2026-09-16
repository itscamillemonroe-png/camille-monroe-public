import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL='https://wybpxixkjimbpvufozub.supabase.co';
const SUPABASE_KEY='sb_publishable_0bNGPfELmwuT32zmhXXkMQ_sJIXotwE';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=(s)=>document.querySelector(s);

function setStatus(text,type=''){const el=$('#paymentStatus');if(!el)return;el.textContent=text;el.className=`formStatus ${type}`.trim();}
function disableButtons(disabled){document.querySelectorAll('.payButton').forEach(b=>{b.disabled=disabled;b.classList.toggle('disabled',disabled);});}

async function init(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){location.href='/login/';return;}
  $('#signOut')?.addEventListener('click',async()=>{await supabase.auth.signOut();location.href='/';});
  const [{data:profile},{data:subscription},{data:wallet}]=await Promise.all([
    supabase.from('member_profiles').select('status,verification_status,is_admin').eq('user_id',session.user.id).maybeSingle(),
    supabase.from('member_subscriptions').select('access_until').eq('user_id',session.user.id).maybeSingle(),
    supabase.from('member_wallets').select('balance_credits').eq('user_id',session.user.id).maybeSingle()
  ]);
  const eligible=Boolean(profile && !profile.is_admin && profile.status==='approved' && profile.verification_status==='verified');
  const gate=$('#paymentGate');
  if(!eligible){
    disableButtons(true);
    const msg=profile?.verification_status!=='verified'?'Identity verification must be completed before checkout.':profile?.status!=='approved'?'Camille must approve your account before checkout.':'Checkout is not available for this account.';
    gate.innerHTML=`<strong>Checkout locked</strong><span>${msg}</span>`;
  } else {
    const access=subscription?.access_until&&new Date(subscription.access_until)>new Date()?new Date(subscription.access_until).toLocaleDateString():'Not active';
    gate.classList.add('activeAccess');
    gate.innerHTML=`<strong>Checkout ready</strong><span>Current access: ${access} · Credits: ${wallet?.balance_credits ?? 0}</span>`;
  }
  const query=new URLSearchParams(location.search); const result=query.get('payment');
  if(result==='pending') setStatus('Payment submitted. Provider confirmation can take a few moments. Your access or credits will update automatically once confirmed.','success');
  if(result==='cancelled') setStatus('Payment was cancelled. Nothing was charged here.','error');
  document.querySelectorAll('.payButton').forEach(button=>button.addEventListener('click',async()=>{
    if(!eligible)return;
    const card=button.closest('[data-product-id]'); const product_id=card?.dataset.productId;
    if(!product_id)return;
    const original=button.textContent; button.disabled=true; button.textContent='Opening secure checkout…'; setStatus('Creating your secure crypto invoice…');
    const {data,error}=await supabase.functions.invoke('create-nowpayments-checkout',{body:{product_id}});
    if(error || !data?.checkout_url){button.disabled=false;button.textContent=original;setStatus(data?.error||error?.message||'Checkout could not start. Please try again.','error');return;}
    location.href=data.checkout_url;
  }));
}

init();
