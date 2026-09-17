import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL='https://wybpxixkjimbpvufozub.supabase.co';
const SUPABASE_KEY='sb_publishable_0bNGPfELmwuT32zmhXXkMQ_sJIXotwE';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=(s)=>document.querySelector(s);

function setStatus(text,type=''){const el=$('#paymentStatus');if(!el)return;el.textContent=text;el.className=`formStatus ${type}`.trim();}
function setButtonState(button,disabled){button.disabled=disabled;button.classList.toggle('disabled',disabled);}

async function init(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){location.href='/login/';return;}
  $('#signOut')?.addEventListener('click',async()=>{await supabase.auth.signOut();location.href='/';});
  const [{data:profile},{data:subscription},{data:wallet}]=await Promise.all([
    supabase.from('member_profiles').select('status,profile_photo_path,verification_status,is_admin').eq('user_id',session.user.id).maybeSingle(),
    supabase.from('member_subscriptions').select('access_until').eq('user_id',session.user.id).maybeSingle(),
    supabase.from('member_wallets').select('balance_credits').eq('user_id',session.user.id).maybeSingle()
  ]);
  const membershipEligible=Boolean(profile && !profile.is_admin && profile.status==='approved' && profile.profile_photo_path);
  const adultServicesEligible=membershipEligible && profile.verification_status==='verified';
  const gate=$('#paymentGate');
  document.querySelectorAll('.payButton').forEach(button=>setButtonState(button,button.closest('[data-product-kind]')?.dataset.productKind==='membership'?!membershipEligible:!adultServicesEligible));
  if(!membershipEligible){
    const msg=!profile?.profile_photo_path?'Submit the required profile picture before checkout.':profile?.status!=='approved'?'Camille must approve your account before checkout.':'Checkout is not available for this account.';
    gate.innerHTML=`<strong>Checkout locked</strong><span>${msg}</span>`;
  } else {
    const access=subscription?.access_until&&new Date(subscription.access_until)>new Date()?new Date(subscription.access_until).toLocaleDateString():'Not active';
    gate.classList.add('activeAccess');
    gate.innerHTML=`<strong>SFW membership checkout ready</strong><span>Current access: ${access} · Credits: ${wallet?.balance_credits ?? 0}${adultServicesEligible?'':' · Adult-service credit packs remain locked.'}</span>`;
  }
  const result=new URLSearchParams(location.search).get('payment');
  if(result==='pending') setStatus('Payment submitted. Provider confirmation can take a few moments. Benefits update automatically after confirmation.','success');
  if(result==='cancelled') setStatus('Payment was cancelled. No benefits were distributed.','error');
  document.querySelectorAll('.payButton').forEach(button=>button.addEventListener('click',async()=>{
    const isMembership=button.closest('[data-product-kind]')?.dataset.productKind==='membership';
    if(isMembership?!membershipEligible:!adultServicesEligible)return;
    const product_id=button.closest('[data-product-id]')?.dataset.productId;if(!product_id)return;
    const original=button.textContent;button.disabled=true;button.textContent='Opening secure checkout…';setStatus('Creating your secure crypto invoice…');
    const {data,error}=await supabase.functions.invoke('create-nowpayments-checkout',{body:{product_id}});
    if(error||!data?.checkout_url){button.disabled=false;button.textContent=original;setStatus(data?.error||error?.message||'Checkout could not start. Please try again.','error');return;}
    location.href=data.checkout_url;
  }));
}

init().catch(error=>setStatus(error.message||'Payments could not load.','error'));
