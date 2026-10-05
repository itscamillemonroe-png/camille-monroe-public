(()=>{
const endpoint='https://wybpxixkjimbpvufozub.supabase.co/functions/v1/public-admin-kit';
const apikey='sb_publishable_0bNGPfELmwuT32zmhXXkMQ_sJIXotwE';
const buy=document.getElementById('buyStarterKit');
const status=document.getElementById('starterKitStatus');
const setStatus=(text,type='')=>{if(!status)return;status.textContent=text;status.className=('formStatus '+type).trim();};\nfunction getAttribution(){try{return JSON.parse(localStorage.getItem('cm_attribution_v1')||'{}')||{};}catch{return {};}}
async function call(body){
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','apikey':apikey},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error||'The store is temporarily unavailable.');
  return data;
}
if(new URLSearchParams(location.search).get('payment')==='cancelled')setStatus('Checkout was cancelled. Nothing was charged.');
buy?.addEventListener('click',async()=>{
  const original=buy.textContent;buy.disabled=true;buy.textContent='Opening secure checkout…';setStatus('Connecting to Stripe…');
  globalThis.CamilleAnalytics?.track?.('admin_kit_checkout_attempt','documentation_starter_kit_v1');
  try{
    const data=await call({action:'create_checkout',attribution:getAttribution()});
    if(!data?.checkout_url)throw new Error('Secure checkout could not start.');
    globalThis.CamilleAnalytics?.track?.('admin_kit_checkout_redirect','documentation_starter_kit_v1');
    location.href=data.checkout_url;
  }catch(error){
    buy.disabled=false;buy.textContent=original;setStatus(error.message||'Checkout could not start.','error');
  }
});
})();