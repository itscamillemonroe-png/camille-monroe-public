import { supabase, $, escapeHtml, requireSession, wireSignOut } from './app-client.js';

function status(text,type=''){const el=$('#opsStatus');if(!el)return;el.textContent=text;el.className='opsStatus '+type;}
async function requireOwner(){
  const s=await requireSession();wireSignOut();
  const {data,error}=await supabase.from('member_profiles').select('is_admin').eq('user_id',s.user.id).single();
  if(error||!data?.is_admin){location.replace('/member/');throw new Error('Owner access required.');}
}
function pct(a,b){return b?((a/b)*100).toFixed(1)+'%':'0%';}
function rows(id,items,fn,cols){const el=$(id);if(!el)return;el.innerHTML=items.length?items.map(fn).join(''):`<tr><td colspan="${cols}">No data recorded yet.</td></tr>`;}
function renderDeep(data){
 const d=data||{};
 rows('#trafficBrowserRows',d.browsers||[],x=>`<tr><td><strong>${escapeHtml(x.browser)}</strong></td><td>${x.views||0}</td><td>${x.visitors||0}</td></tr>`,3);
 rows('#trafficOsRows',d.operating_systems||[],x=>`<tr><td>${escapeHtml(x.os)}</td><td>${x.views||0}</td></tr>`,2);
 rows('#trafficLocationRows',d.locations||[],x=>`<tr><td><strong>${escapeHtml(x.region)}</strong></td><td>${escapeHtml(x.timezone)}</td><td>${x.views||0}</td><td>${x.visitors||0}</td></tr>`,4);
 rows('#trafficLanguageRows',d.languages||[],x=>`<tr><td>${escapeHtml(x.language)}</td><td>${x.views||0}</td></tr>`,2);
}
function render(data){
  const s=data.summary||{};
  $('#trafficViews').textContent=String(s.page_views??0);
  $('#trafficVisitors').textContent=String(s.unique_visitors??0);
  $('#trafficSessions').textContent=String(s.sessions??0);
  $('#trafficRequests').textContent=String(s.access_requests??0);
  $('#trafficToday').textContent=String(s.today_views??0);
  $('#trafficClicks').textContent=String(s.link_clicks??0);
  $('#trafficMemberViews').textContent=String(s.member_views??0);
  $('#trafficConversion').textContent=pct(Number(s.access_requests||0),Number(s.unique_visitors||0));
  $('#trafficInternal').textContent=String(s.internal_views??0);

  const pages=Array.isArray(data.top_pages)?data.top_pages:[];
  $('#trafficPageRows').innerHTML=pages.length?pages.map(x=>`<tr><td><strong>${escapeHtml(x.path)}</strong></td><td>${x.views||0}</td><td>${x.visitors||0}</td></tr>`).join(''):'<tr><td colspan="3">No page views recorded yet.</td></tr>';

  const sources=Array.isArray(data.sources)?data.sources:[];
  $('#trafficSourceRows').innerHTML=sources.length?sources.map(x=>`<tr><td><strong>${escapeHtml(x.source)}</strong><br><small>${escapeHtml(x.medium)}</small></td><td>${x.views||0}</td><td>${x.visitors||0}</td></tr>`).join(''):'<tr><td colspan="3">No source data yet.</td></tr>';

  const funnels=Array.isArray(data.funnel_by_source)?data.funnel_by_source:[];
  const paidOrders=funnels.reduce((sum,x)=>sum+Number(x.paid_orders||0),0),revenueCents=funnels.reduce((sum,x)=>sum+Number(x.revenue_cents||0),0),visitors=Number(s.unique_visitors||0);
  if($('#trafficPaidOrders'))$('#trafficPaidOrders').textContent=String(paidOrders);
  if($('#trafficRevenue'))$('#trafficRevenue').textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(revenueCents/100);
  if($('#trafficPaidConversion'))$('#trafficPaidConversion').textContent=pct(paidOrders,visitors);
  if($('#trafficRpv'))$('#trafficRpv').textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(visitors?(revenueCents/100)/visitors:0);
  $('#trafficFunnelRows').innerHTML=funnels.length?funnels.map(x=>`<tr><td><strong>${escapeHtml(x.source)}</strong></td><td>${x.visitors||0}</td><td>${x.access_requests||0}</td><td>${x.paid_orders||0}</td><td>${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(x.revenue_cents)||0)/100)}</td></tr>`).join(''):'<tr><td colspan="5">No source funnel data yet.</td></tr>';

  const campaigns=Array.isArray(data.campaigns)?data.campaigns:[];
  $('#trafficCampaignRows').innerHTML=campaigns.length?campaigns.map(x=>`<tr><td><strong>${escapeHtml(x.source)}</strong></td><td>${escapeHtml(x.campaign)}</td><td>${escapeHtml(x.content)}</td><td>${x.views||0}</td><td>${x.visitors||0}</td></tr>`).join(''):'<tr><td colspan="5">No campaign data yet.</td></tr>';

  const refs=Array.isArray(data.referrers)?data.referrers:[];
  $('#trafficRefRows').innerHTML=refs.length?refs.map(x=>`<tr><td>${escapeHtml(x.referrer_host)}</td><td>${x.views||0}</td></tr>`).join(''):'<tr><td colspan="2">No referral data yet.</td></tr>';

  const devices=Array.isArray(data.devices)?data.devices:[];
  $('#trafficDeviceRows').innerHTML=devices.length?devices.map(x=>`<tr><td>${escapeHtml(x.device)}</td><td>${x.views||0}</td></tr>`).join(''):'<tr><td colspan="2">No device data yet.</td></tr>';

  const daily=Array.isArray(data.daily)?data.daily:[];
  $('#trafficDailyRows').innerHTML=daily.length?daily.map(x=>`<tr><td>${escapeHtml(x.day)}</td><td>${x.views||0}</td><td>${x.visitors||0}</td></tr>`).join(''):'<tr><td colspan="3">No daily traffic yet.</td></tr>';
}
async function load(days=30){
  status('Loading sitewide traffic…');
  const [{data,error},{data:deep,error:deepError}]=await Promise.all([supabase.rpc('owner_site_traffic_snapshot',{p_days:Number(days)||30}),supabase.rpc('owner_site_traffic_deep_snapshot',{p_days:Number(days)||30})]);
  if(error)throw error;if(deepError)throw deepError;
  render(data||{});renderDeep(deep||{});
  status('Traffic analytics updated. Read the conversion funnel before judging raw views; Control Room and Studio activity stays separate from public totals.','success');
}
async function init(){
  await requireOwner();
  document.querySelectorAll('[data-days]').forEach(btn=>btn.addEventListener('click',()=>load(btn.dataset.days).catch(e=>status(e.message,'error'))));
  await load(30);
}
init().catch(e=>status(e.message||'Traffic analytics could not load.','error'));