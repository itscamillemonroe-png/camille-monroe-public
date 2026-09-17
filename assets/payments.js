import { supabase, $, requireSession, wireSignOut } from './app-client.js';

function setStatus(text,type=''){const el=$('#paymentStatus');if(!el)return;el.textContent=text;el.className=`formStatus ${type}`.trim();}

async function init(){
  const session=await requireSession();wireSignOut();
  const [{data:profile,error:profileError},{data:subscription,error:subError}]=await Promise.all([
    supabase.from('member_profiles').select('status,profile_photo_path,is_admin').eq('user_id',session.user.id).maybeSingle(),
    supabase.from('member_subscriptions').select('access_until').eq('user_id',session.user.id).maybeSingle()
  ]);
  if(profileError)throw profileError;if(subError)throw subError;
  const membershipEligible=Boolean(profile&&!profile.is_admin&&profile.status==='approved'&&profile.profile_photo_path);
  const gate=$('#paymentGate'),button=$('.payButton');
  button.disabled=!membershipEligible;button.classList.toggle('disabled',!membershipEligible);
  if(!membershipEligible){
    const msg=!profile?.profile_photo_path?'Submit the required profile picture before checkout.':profile?.status!=='approved'?'Camille must approve your account before checkout.':'Checkout is not available for this account.';
    gate.innerHTML=`<strong>Checkout locked</strong><span>${msg}</span>`;
  }else{
    const access=subscription?.access_until&&new Date(subscription.access_until)>new Date()?new Date(subscription.access_until).toLocaleDateString():'Not active';
    gate.classList.add('activeAccess');
    gate.innerHTML=`<strong>SFW membership checkout ready</strong><span>Current access: ${access}</span>`;
  }
  const result=new URLSearchParams(location.search).get('payment');
  if(result==='pending')setStatus('Payment submitted. Provider confirmation can take a few moments. Access updates automatically after confirmation.','success');
  if(result==='cancelled')setStatus('Payment was cancelled. No access was distributed.','error');
  button.addEventListener('click',async()=>{
    if(!membershipEligible)return;
    const product_id=button.closest('[data-product-id]')?.dataset.productId;if(!product_id)return;
    const original=button.textContent;button.disabled=true;button.textContent='Opening secure checkout…';setStatus('Creating your secure crypto invoice…');
    const {data,error}=await supabase.functions.invoke('create-nowpayments-checkout',{body:{product_id}});
    if(error||!data?.checkout_url){button.disabled=false;button.textContent=original;setStatus(data?.error||error?.message||'Checkout could not start. Please try again.','error');return;}
    location.href=data.checkout_url;
  });
}
init().catch(error=>setStatus(error.message||'Membership checkout could not load.','error'));