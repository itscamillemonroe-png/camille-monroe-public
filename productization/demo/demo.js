const drawer=document.querySelector('#drawer');
const content=document.querySelector('#drawerContent');
const scrim=document.querySelector('#scrim');

const views={
  public:{
    kicker:'Public destination',
    title:'A brand-owned front door',
    text:'Social channels can drive discovery here while the creator controls the presentation, links and path into paid membership.',
    cards:[
      ['Brand-first landing page','Creator name, visual identity, CTA and links.'],
      ['Controlled entry','Public visitors do not see private member content.'],
      ['Tracked acquisition','Campaign and referrer attribution can follow visits into conversion.']
    ]
  },
  member:{
    kicker:'Private member side',
    title:'The audience becomes a managed relationship',
    text:'Approved, paid members enter a separate experience built around content, communication and member-only offers.',
    cards:[
      ['Member feed','Protected posts, photos, video and updates.'],
      ['Messaging','Credit-based private communication.'],
      ['Voice calls','Reserved credits, minimum booking and unused-credit return logic.'],
      ['Premium Drops','One-time protected purchases.']
    ]
  },
  money:{
    kicker:'Monetization',
    title:'Multiple revenue lanes in one operating system',
    text:'Membership is only the first lane. The creator can layer communication credits, calls, premium releases and tips without sending the customer through unrelated systems.',
    cards:[
      ['$30 / 30 days','SAMPLE membership configuration'],
      ['5 credits / message','SAMPLE messaging configuration'],
      ['4 credits / minute','SAMPLE voice-call configuration'],
      ['Premium Drops','Creator-defined pricing per protected product'],
      ['Tips','Optional configurable support amounts']
    ]
  },
  owner:{
    kicker:'Creator Control Room',
    title:'Operate the business from the owner side',
    text:'The creator gets an internal operating view for approvals, content, money, notifications and growth intelligence.',
    cards:[
      ['Members & approvals','Review signup photos; approve, deny, revoke or block.'],
      ['Creator Studio','Upload, review, publish and package member content.'],
      ['Revenue','Orders, products, attribution and settlement evidence.'],
      ['Analytics','Traffic and conversion funnel visibility.'],
      ['Notifications','Member, message, call, payment and security events.'],
      ['AI-assisted operations','Research and drafts prepared under creator approval controls.']
    ]
  }
};

function openView(name){
  const view=views[name];
  if(!view)return;
  content.innerHTML=`<span class="kicker">${view.kicker}</span><h3>${view.title}</h3><p class="muted">${view.text}</p>${view.cards.map(([a,b])=>`<div class="drawerCard"><strong>${a}</strong><span>${b}</span></div>`).join('')}`;
  drawer.classList.add('open');
  scrim.classList.add('open');
  drawer.setAttribute('aria-hidden','false');
}
function closeView(){
  drawer.classList.remove('open');
  scrim.classList.remove('open');
  drawer.setAttribute('aria-hidden','true');
}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>openView(button.dataset.view)));
document.querySelectorAll('[data-scroll]').forEach(button=>button.addEventListener('click',()=>document.querySelector('#'+button.dataset.scroll)?.scrollIntoView({behavior:'smooth'})));
document.querySelector('#closeDrawer').addEventListener('click',closeView);
scrim.addEventListener('click',closeView);
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeView();});


const DEMO_BACKEND='https://gebaqosgncyboutsujcv.supabase.co';
const DEMO_KEY='sb_publishable_6tMgtr5PGdyB8Yr4-AR4ow_-mssHwha';

async function loadLiveDemoSnapshot(){
  const state=document.querySelector('#backendState');
  try{
    const response=await fetch(DEMO_BACKEND+'/rest/v1/rpc/creator_os_public_demo_snapshot',{
      method:'POST',
      headers:{'apikey':DEMO_KEY,'Content-Type':'application/json'},
      body:'{}'
    });
    if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json();
    document.querySelector('#liveMembers').textContent=String(data.members??'—');
    document.querySelector('#liveActiveMembers').textContent=String(data.active_members??'—');
    document.querySelector('#liveOrders').textContent=String(data.paid_orders??'—');
    document.querySelector('#liveRevenue').textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(data.sample_revenue_cents)||0)/100);
    state.textContent='Isolated demo backend connected · synthetic records only · live charges disabled.';
  }catch(error){
    state.textContent='Demo backend status unavailable. The presentation shell remains usable.';
  }
}
loadLiveDemoSnapshot();
