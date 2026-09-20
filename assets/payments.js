import { supabase, appConfig, $, escapeHtml, requireSession, wireSignOut, getAttribution } from './app-client.js';

function setStatus(text,type=''){const el=$('#paymentStatus');if(!el)return;el.textContent=text;el.className=`formStatus ${type}`.trim();}
function money(cents){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(cents)||0)/100);}

let selectedPaymentMethod='crypto';
function trackCheckout(eventType,target=''){
  if(globalThis.CreatorOSAnalytics?.track){globalThis.CreatorOSAnalytics.track(eventType,target);return;}
  globalThis.creatorOsTelemetryQueue=Array.isArray(globalThis.creatorOsTelemetryQueue)?globalThis.creatorOsTelemetryQueue:[];
  globalThis.creatorOsTelemetryQueue.push({eventType,target});
}
function updatePaymentMethodUI(route){const card=$('#chooseCard'),crypto=$('#chooseCrypto');if(card){card.disabled=!route?.card_ach_ready;card.classList.toggle('primary',selectedPaymentMethod==='card_ach');card.classList.toggle('glass',selectedPaymentMethod!=='card_ach');}if(crypto){crypto.disabled=!route?.crypto_ready;crypto.classList.toggle('primary',selectedPaymentMethod==='crypto');crypto.classList.toggle('glass',selectedPaymentMethod!=='crypto');}}
function wirePayButtons({approved,active,route}){
  document.querySelectorAll('.payButton:not([data-wired])').forEach(button=>{
    button.dataset.wired='true';
    const kind=button.closest('[data-kind]')?.dataset.kind;
    button.disabled=!approved||((kind==='credits'||kind==='tip'||kind==='content')&&!active);
    button.classList.toggle('disabled',button.disabled);
    button.addEventListener('click',async()=>{
      if(button.disabled)return;
      const product_id=button.closest('[data-product-id]')?.dataset.productId;
      if(!product_id)return;
      const original=button.textContent;
      trackCheckout('checkout_attempt',`${selectedPaymentMethod}:${product_id}`);
      button.disabled=true;
      button.textContent='Opening secure checkout…';
      setStatus(selectedPaymentMethod==='card_ach'?'Opening secure card / wallet / bank checkout…':'Opening secure crypto checkout…');
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token){
        button.disabled=false;button.textContent=original;
        trackCheckout('checkout_blocked',`expired_session:${selectedPaymentMethod}:${product_id}`);
        setStatus('Your sign-in expired. Please sign in again.','error');return;
      }
      const endpoint=`${appConfig.supabaseUrl}/functions/v1/${appConfig.checkoutFunction}`;
      const response=await fetch(endpoint,{
        method:'POST',
        headers:{'Authorization':`Bearer ${session.access_token}`,'apikey':appConfig.supabasePublishableKey,'Content-Type':'application/json'},
        body:JSON.stringify({product_id,payment_method:selectedPaymentMethod,attribution:getAttribution()})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data?.checkout_url){
        button.disabled=false;button.textContent=original;
        trackCheckout('checkout_error',`http_${response.status}:${selectedPaymentMethod}:${product_id}`);
        setStatus(data?.error||`Checkout could not start (HTTP ${response.status}). Please try again.`,'error');return;
      }
      trackCheckout('checkout_redirect',`${selectedPaymentMethod}:${product_id}`);
      location.href=data.checkout_url;
    });
  });
}

async function loadPremiumDrops({approved,active,route}){
  if(!approved||!active)return;
  const {data,error}=await supabase.rpc('member_active_content_products');
  if(error)throw error;
  const products=data||[];
  if(!products.length)return;
  const section=$('#premiumDrops'),grid=$('#premiumDropGrid');
  grid.innerHTML=products.map(product=>`<article class="paymentCard featured" data-product-id="${escapeHtml(product.id)}" data-kind="content"><span class="paymentTag">Premium drop</span><h2>${escapeHtml(product.name||'Premium Drop')}</h2><strong class="paymentPrice">${escapeHtml(money(product.price_cents||0))}</strong><p>${escapeHtml(product.description||'One-time protected member unlock.')}</p><button class="btn primary wide payButton" type="button">Unlock this drop</button></article>`).join('');
  section.hidden=false;wirePayButtons({approved,active,route});
}

async function init(){
  const session=await requireSession();wireSignOut();
  const [{data:profile,error:profileError},{data:subscription,error:subError},{data:route,error:routeError}]=await Promise.all([
    supabase.from('member_profiles').select('status,profile_photo_path,is_admin').eq('user_id',session.user.id).maybeSingle(),
    supabase.from('member_subscriptions').select('access_until').eq('user_id',session.user.id).maybeSingle(),
    supabase.rpc('member_payment_provider_status')
  ]);
  if(profileError)throw profileError;if(subError)throw subError;if(routeError)throw routeError;
  const approved=Boolean(profile&&!profile.is_admin&&profile.status==='approved'&&profile.profile_photo_path);
  const active=Boolean(subscription?.access_until&&new Date(subscription.access_until)>new Date());
  const gate=$('#paymentGate'),provider=$('#paymentProvider');
  if(route?.card_ach_ready){selectedPaymentMethod='card_ach';provider.classList.add('activeAccess');provider.innerHTML='<strong>Payment options ready</strong><span>Secure card / wallet / bank checkout is available. Crypto can remain an optional configured route.</span>';}
  else{selectedPaymentMethod='crypto';provider.innerHTML='<strong>Payment route status</strong><span>The deployment has not enabled card / wallet / bank checkout yet.</span>';}
  updatePaymentMethodUI(route);
  $('#chooseCard')?.addEventListener('click',()=>{if(!route?.card_ach_ready){setStatus('Card / wallet / bank checkout is not configured for this deployment.','error');return;}selectedPaymentMethod='card_ach';updatePaymentMethodUI(route);setStatus('Card / wallet / bank checkout selected.','success');});
  $('#chooseCrypto')?.addEventListener('click',()=>{if(!route?.crypto_ready)return;selectedPaymentMethod='crypto';updatePaymentMethodUI(route);setStatus('Crypto selected.','success');});
  if(!approved){trackCheckout('checkout_blocked','approval_gate');gate.innerHTML='<strong>Checkout locked</strong><span>A profile photo and owner approval are required before checkout.</span>';}
  else{gate.classList.add('activeAccess');gate.innerHTML=`<strong>Checkout ready</strong><span>Membership: ${active?'Active':'Not active'}.</span>`;}
  wirePayButtons({approved,active,route});await loadPremiumDrops({approved,active,route});
}
init().catch(error=>setStatus(error.message||'Checkout could not load.','error'));
