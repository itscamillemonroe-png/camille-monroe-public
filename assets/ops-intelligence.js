import { supabase, $, escapeHtml, requireSession, wireSignOut } from './app-client.js';

function money(cents){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(cents)||0)/100);}
function status(text,type=''){const el=$('#opsStatus');if(!el)return;el.textContent=text;el.className='opsStatus '+type;}
async function requireOwner(){const s=await requireSession();wireSignOut();const {data,error}=await supabase.from('member_profiles').select('is_admin').eq('user_id',s.user.id).single();if(error||!data?.is_admin){location.replace('/member/');throw new Error('Owner access required.');}}

function actionButtons(o){
  const parts=[];
  if((o.localized_message||'').trim()) parts.push(`<button class="opsButton giCopy" type="button" data-copy="${escapeHtml(o.localized_message)}">Copy localized draft</button>`);
  if(o.queue!=='now') parts.push(`<button class="opsButton giAction" type="button" data-id="${o.id}" data-action="now">Move to NOW</button>`);
  if(o.queue!=='watch') parts.push(`<button class="opsButton giAction" type="button" data-id="${o.id}" data-action="watch">Watch</button>`);
  if(o.queue!=='learned') parts.push(`<button class="opsButton giAction" type="button" data-id="${o.id}" data-action="learned">Mark Learned</button>`);
  if(o.approval_status==='pending'&&(o.localized_message||o.draft_message)) parts.push(`<button class="opsButton giAction" type="button" data-id="${o.id}" data-action="approve">Approve Draft</button>`);
  parts.push(`<button class="opsButton giAction" type="button" data-id="${o.id}" data-action="archive">Archive</button>`);
  return parts.join('');
}
function opportunityCard(o){
  const label=[o.platform,o.market_key,o.language_code].filter(Boolean).join(' · ');
  const draft=(o.localized_message||'').trim();
  return `<article class="opsItem giOpportunity"><div class="opsItemHead"><div><span class="opsPill">${escapeHtml(o.opportunity_type||'signal')}</span><strong>${label?escapeHtml(label):'Camille Intelligence'}</strong></div><span class="giScore">${Number(o.priority_score)||0}</span></div><p><strong>Signal:</strong> ${escapeHtml(o.signal||'')}</p><p><strong>Next:</strong> ${escapeHtml(o.recommended_action||'')}</p>${draft?`<div class="giDraft"><small>Localized draft · approval does not send</small><p>${escapeHtml(draft)}</p></div>`:''}<div class="opsActions giActions">${actionButtons(o)}</div></article>`;
}
function bindOpportunityActions(){
  document.querySelectorAll('.giCopy').forEach(btn=>btn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(btn.dataset.copy||'');status('Draft copied. Nothing was sent.','success');}catch{status('Copy failed on this browser.','error');}}));
  document.querySelectorAll('.giAction').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const {error}=await supabase.rpc('owner_global_opportunity_action',{p_id:btn.dataset.id,p_action:btn.dataset.action});if(error){status(error.message,'error');btn.disabled=false;return;}status('Intelligence queue updated. Nothing was sent.','success');await load();}));
}
function render(snapshot){
  const s=snapshot.summary||{}, opportunities=Array.isArray(snapshot.opportunities)?snapshot.opportunities:[];
  $('#giNow').textContent=String(s.now_count??0);$('#giWatch').textContent=String(s.watch_count??0);$('#giLearned').textContent=String(s.learned_count??0);$('#giPlatforms').textContent=String(s.connected_platforms??0);
  const now=opportunities.filter(x=>x.queue==='now'&&x.status!=='archived'),watch=opportunities.filter(x=>x.queue==='watch'&&x.status!=='archived'),learned=opportunities.filter(x=>x.queue==='learned');
  $('#giNowQueue').innerHTML=now.length?now.map(opportunityCard).join(''):'<p>No NOW items. Refresh intelligence after new traffic or content activity.</p>';
  $('#giWatchQueue').innerHTML=watch.length?watch.map(opportunityCard).join(''):'<p>No WATCH items yet.</p>';
  $('#giLearnedQueue').innerHTML=learned.length?learned.map(opportunityCard).join(''):'<p>No learned outcomes yet. This fills as tests finish.</p>';
  const focus=now[0]||watch[0];
  $('#giBrief').innerHTML=focus?`<strong>Highest-priority signal · ${Number(focus.priority_score)||0}/100</strong><p>${escapeHtml(focus.signal||'')}</p><p><strong>Recommended move:</strong> ${escapeHtml(focus.recommended_action||'')}</p><small>Outbound automation is OFF. This is an intelligence recommendation, not an automatic action.</small>`:'<strong>No open intelligence action.</strong>';

  const markets=Array.isArray(snapshot.markets)?snapshot.markets:[];
  $('#giMarketRows').innerHTML=markets.length?markets.map(m=>`<tr><td><strong>${escapeHtml(m.region_label)}</strong><br><small>${escapeHtml((m.country_codes||[]).join(', '))}</small></td><td>${escapeHtml(m.language_label)}</td><td><span class="opsPill">${escapeHtml(m.stage)}</span></td><td>${escapeHtml(m.evidence_level)}<br><small>${escapeHtml(m.evidence_note||'')}</small></td><td>${escapeHtml((m.recommended_platforms||[]).join(', '))}</td><td><div class="giHook">${escapeHtml(m.localized_hook||'')}</div><button class="opsButton giCopy" type="button" data-copy="${escapeHtml(m.localized_hook||'')}">Copy</button></td></tr>`).join(''):'<tr><td colspan="6">No market experiments configured.</td></tr>';

  const timing=Array.isArray(snapshot.timing)?snapshot.timing:[];
  $('#giTimingRows').innerHTML=timing.length?timing.map(t=>`<tr><td><strong>${escapeHtml(t.platform)}</strong></td><td>${escapeHtml((t.best_hours||[]).join(', '))}</td><td>${escapeHtml((t.secondary_hours||[]).join(', '))}</td><td>${escapeHtml(t.timezone||'')}</td><td>${escapeHtml(t.notes||'')}</td></tr>`).join(''):'<tr><td colspan="5">No connected timing intelligence yet.</td></tr>';

  const regions=Array.isArray(snapshot.region_performance)?snapshot.region_performance:[];
  $('#giRegionRows').innerHTML=regions.length?regions.map(r=>`<tr><td>${escapeHtml(r.region_hint)}</td><td>${r.orders||0}</td><td>${r.paid_orders||0}</td><td>${escapeHtml(money(r.revenue_cents||0))}</td></tr>`).join(''):'<tr><td colspan="4">No regional attribution yet.</td></tr>';

  const sources=Array.isArray(snapshot.source_performance)?snapshot.source_performance:[];
  $('#giSourceRows').innerHTML=sources.length?sources.map(r=>`<tr><td><strong>${escapeHtml(r.source)}</strong><br><small>${escapeHtml(r.medium||'')}</small></td><td>${escapeHtml(r.campaign||'')}</td><td>${r.orders||0}</td><td>${escapeHtml(money(r.revenue_cents||0))}</td></tr>`).join(''):'<tr><td colspan="4">No tagged source orders yet.</td></tr>';
  bindOpportunityActions();
}
async function load(){
  status('Loading global intelligence…');
  const {data,error}=await supabase.rpc('owner_global_intelligence_snapshot');
  if(error)throw error;
  render(data||{});
  status('Global intelligence synchronized. Outbound automation remains off.','success');
}
async function refresh(){
  status('Refreshing first-party intelligence…');
  const {error}=await supabase.rpc('owner_refresh_global_intelligence');
  if(error)throw error;
  await load();
}
async function init(){await requireOwner();$('#refreshIntelligence').addEventListener('click',()=>refresh().catch(e=>status(e.message,'error')));await load();}
init().catch(e=>status(e.message||'Global Intelligence could not load.','error'));