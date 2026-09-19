import { supabase, $, requireSession, wireSignOut } from './app-client.js';

const endpoint='https://wybpxixkjimbpvufozub.supabase.co/functions/v1/owner-payment-setup';
function setStatus(text,type=''){
  const el=$('#setupStatus');
  if(!el)return;
  el.textContent=text;
  el.className=`formStatus ${type}`.trim();
}
function paint(data){
  const checkout=$('#checkoutSecretState');
  const webhook=$('#webhookSecretState');
  const ready=$('#stripeReadyState');
  if(checkout)checkout.textContent=data?.stripe_checkout_secret_configured?'Configured':'Missing';
  if(webhook)webhook.textContent=data?.stripe_webhook_secret_configured?'Configured':'Missing';
  if(ready)ready.textContent=data?.card_ach_ready?'Ready':'Not ready';
}
async function call(action,payload={}){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token)throw new Error('Your sign-in expired. Please sign in again.');
  const res=await fetch(endpoint,{
    method:'POST',
    headers:{
      'Authorization':`Bearer ${session.access_token}`,
      'apikey':'sb_publishable_0bNGPfELmwuT32zmhXXkMQ_sJIXotwE',
      'Content-Type':'application/json'
    },
    body:JSON.stringify({action,...payload})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data?.error||'Secure setup could not be completed.');
  return data;
}

async function init(){
  await requireSession();
  wireSignOut();
  const status=await call('status');
  paint(status);

  $('#stripeSetupForm')?.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const stripeKey=$('#stripeSecretKey')?.value.trim()||'';
    const webhookSecret=$('#stripeWebhookSecret')?.value.trim()||'';
    if(!stripeKey&&!webhookSecret){
      setStatus('Paste at least one secret before saving.','error');
      return;
    }
    const button=$('#saveStripeSecrets');
    if(button){button.disabled=true;button.textContent='Verifying & saving…';}
    setStatus('Verifying directly with Stripe and saving securely…');
    try{
      const data=await call('save',{
        stripe_secret_key:stripeKey||undefined,
        stripe_webhook_secret:webhookSecret||undefined
      });
      if($('#stripeSecretKey'))$('#stripeSecretKey').value='';
      if($('#stripeWebhookSecret'))$('#stripeWebhookSecret').value='';
      paint(data);
      setStatus(data.card_ach_ready?'Stripe checkout is now production-ready.':'Saved. One Stripe credential is still missing.','success');
    }catch(error){
      setStatus(error.message||'Secure setup could not be completed.','error');
    }finally{
      if(button){button.disabled=false;button.textContent='Verify & save securely';}
    }
  });
}

init().catch(error=>setStatus(error.message||'Owner setup could not load.','error'));