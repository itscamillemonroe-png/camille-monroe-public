(()=>{
const endpoint='https://wybpxixkjimbpvufozub.supabase.co/functions/v1/public-collectible';
const apikey='sb_publishable_0bNGPfELmwuT32zmhXXkMQ_sJIXotwE';
const buy=document.getElementById('buyCollectible');
const status=document.getElementById('collectibleStatus');
const panel=document.getElementById('deliveryPanel');
const download=document.getElementById('downloadCollectible');
const license=document.getElementById('deliveryLicense');
const edition=document.getElementById('editionRecord');
const setStatus=(text,type='')=>{if(!status)return;status.textContent=text;status.className=('formStatus '+type).trim();};
async function call(body){
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','apikey':apikey},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error||'The store is temporarily unavailable.');
  return data;
}
buy?.addEventListener('click',async()=>{
  const original=buy.textContent;
  buy.disabled=true;buy.textContent='Opening secure checkout…';setStatus('Connecting to Stripe…');
  globalThis.CamilleAnalytics?.track?.('collectible_checkout_attempt','digital_collectible_001');
  try{
    const data=await call({action:'create_checkout'});
    if(!data?.checkout_url)throw new Error('Secure checkout could not start.');
    globalThis.CamilleAnalytics?.track?.('collectible_checkout_redirect','digital_collectible_001');
    location.href=data.checkout_url;
  }catch(error){
    buy.disabled=false;buy.textContent=original;setStatus(error.message||'Checkout could not start.','error');
  }
});
async function loadDelivery(){
  const params=new URLSearchParams(location.search);
  if(params.get('payment')==='cancelled'){setStatus('Checkout was cancelled. Nothing was charged.');return;}
  const sessionId=params.get('session_id');
  if(params.get('payment')!=='success'||!sessionId)return;
  if(buy)buy.disabled=true;
  setStatus('Payment received. Preparing your private download…');
  try{
    const data=await call({action:'delivery',session_id:sessionId});
    download.href=data.download_url;
    license.textContent=data.license||'Personal use only.';
    if(data.edition_number){edition.textContent='First Edition · Collector #'+String(data.edition_number).padStart(3,'0');edition.hidden=false;}
    panel.hidden=false;
    setStatus('Payment verified. Your collectible is ready.','success');
    panel.scrollIntoView({behavior:'smooth',block:'start'});
    globalThis.CamilleAnalytics?.track?.('collectible_delivery_ready','digital_collectible_001');
  }catch(error){setStatus(error.message||'We could not prepare the download.','error');}
}
loadDelivery();
})();