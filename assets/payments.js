import { supabase, $, escapeHtml, requireSession, wireSignOut, getAttribution } from './app-client.js';

function setStatus(text,type=''){const el=$('#paymentStatus');if(!el)return;el.textContent=text;el.className=`formStatus ${type}`.trim();}
function money(cents){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(cents)||0)/100);}

function wirePayButtons({approved,active}){
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
      button.disabled=true;
      button.textContent='Opening secure checkout…';
      setStatus('Creating your secure crypto invoice…');
      const {data,error}=await supabase.functions.invoke('create-nowpayments-checkout',{body:{product_id,attribution:getAttribution()}});
      if(error||!data?.checkout_url){
        button.disabled=false;
        button.textContent=original;
        setStatus(data?.error||error?.message||'Checkout could not start. Please try again.','error');
        return;
      }
      location.href=data.checkout_url;
    });
  });
}

async function loadPremiumDrops({approved,active}){
  if(!approved||!active)return;
  const {data,error}=await supabase.rpc('member_active_content_products');
  if(error)throw error;
  const products=data||[];
  if(!products.length)return;
  const section=$('#premiumDrops'),grid=$('#premiumDropGrid');
  grid.innerHTML=products.map(product=>`<article class="paymentCard featured" data-product-id="${escapeHtml(product.id)}" data-kind="content"><span class="paymentTag">Premium SFW drop</span><h2>${escapeHtml(product.name||'Premium Drop')}</h2><strong class="paymentPrice">${escapeHtml(money(product.price_cents||0))}</strong><p>${escapeHtml(product.description||'One-time protected member unlock.')}</p><button class="btn primary wide payButton" type="button">Unlock this drop</button></article>`).join('');
  section.hidden=false;
  wirePayButtons({approved,active});
}

async function init(){
  const session=await requireSession();
  wireSignOut();
  const [{data:profile,error:profileError},{data:subscription,error:subError}]=await Promise.all([
    supabase.from('member_profiles').select('status,profile_photo_path,is_admin').eq('user_id',session.user.id).maybeSingle(),
    supabase.from('member_subscriptions').select('access_until').eq('user_id',session.user.id).maybeSingle()
  ]);
  if(profileError)throw profileError;
  if(subError)throw subError;

  const approved=Boolean(profile&&!profile.is_admin&&profile.status==='approved'&&profile.profile_photo_path);
  const active=Boolean(subscription?.access_until&&new Date(subscription.access_until)>new Date());
  const gate=$('#paymentGate');

  if(!approved){
    gate.innerHTML='<strong>Checkout locked</strong><span>Submit your profile picture and wait for Camille’s approval before checkout.</span>';
  }else{
    gate.classList.add('activeAccess');
    gate.innerHTML=`<strong>Checkout ready</strong><span>Membership: ${active?'Active':'Not active'}.</span>`;
  }

  wirePayButtons({approved,active});
  await loadPremiumDrops({approved,active});
}

init().catch(error=>setStatus(error.message||'Checkout could not load.','error'));