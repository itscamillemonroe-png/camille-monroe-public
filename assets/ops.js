import { supabase, $, escapeHtml, prettyDate, requireSession, wireSignOut } from './app-client.js';

let session;

function money(cents){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(cents)||0)/100);}
function status(text,type=''){const el=$('#opsStatus');el.textContent=text;el.className='opsStatus '+type;}
function dimLabel(key){return key.replace(/^\d+_/,'').replaceAll('_',' ');}

async function requireOwner(){
  session=await requireSession();
  wireSignOut();
  const {data,error}=await supabase.from('member_profiles').select('is_admin').eq('user_id',session.user.id).single();
  if(error||!data?.is_admin){location.replace('/member/');throw new Error('Owner access required.');}
}

function render(snapshot,attribution={},readiness={}){
  const cfg=snapshot.config||{};
  const revenue=snapshot.revenue?.funnel||{};
  const infra=snapshot.infrastructure||{};
  $('#modePill').textContent=(cfg.mode||'unknown').toUpperCase()+(cfg.emergency_pause?' · PAUSED':'');
  $('#autopilotState').textContent=cfg.autopilot_enabled&&!cfg.emergency_pause?'ON':'OFF';
  $('#lastCycle').textContent=cfg.last_cycle_at?'Last cycle '+prettyDate(cfg.last_cycle_at):'No cycle recorded yet';
  $('#memberCount').textContent=String(revenue.members??0);
  $('#activeCount').textContent=`${revenue.active_memberships??0} active membership${revenue.active_memberships===1?'':'s'}`;
  $('#regionCount').textContent=String(infra.regions??0);
  $('#aiCount').textContent=`${infra.ai_capabilities??0} AI capability profiles · ${infra.routing_policies??0} routing policies`;
  $('#paidOrders').textContent=String(revenue.paid_orders??0);
  $('#grossPaid').textContent=`${money(revenue.gross_paid_cents)} confirmed gross`;
  const treasury=attribution.treasury||{};
  $('#bluevineSettled').textContent=money(treasury.bluevine_settled_cents||0);
  $('#revenueTransit').textContent=`${money(treasury.in_transit_cents||0)} still in transit`;

  const sources=attribution.by_source||[];
  $('#sourceRows').innerHTML=sources.length?sources.map(s=>`<tr><td>${escapeHtml(s.source||'direct')}</td><td>${escapeHtml(String(s.orders??0))}</td><td>${escapeHtml(String(s.paid_orders??0))}</td><td>${escapeHtml(money(s.revenue_cents||0))}</td></tr>`).join(''):'<tr><td colspan="4">No attributed orders yet.</td></tr>';

  const blockers=readiness.blocking_requirements||[];
  const rights=readiness.rights||{};
  const products=readiness.products||{};
  $('#launchSummary').textContent=`${blockers.length} blocking requirement${blockers.length===1?'':'s'} remain · ${rights.commercial_rights_cleared??0} rights-cleared asset${rights.commercial_rights_cleared===1?'':'s'} · ${products.live_products??0} live one-time product${products.live_products===1?'':'s'}.`;
  $('#launchBlockers').innerHTML=blockers.length?blockers.map(b=>`<div class="opsDim"><strong>${escapeHtml(b.asset_group)} · ${escapeHtml(b.asset_key)}</strong><br>${escapeHtml(b.requirement)}<br><span class="opsPill">${escapeHtml(b.status)}</span></div>`).join(''):'<p>No blocking launch requirements remain.</p>';

  const rel=snapshot.relationship_members||[];
  $('#relationshipList').innerHTML=rel.length?rel.map(member=>{
    const dims=member.dimensions||{};
    const dimHtml=Object.entries(dims).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`<div class="opsDim"><strong>${escapeHtml(dimLabel(k))}</strong><br>${escapeHtml(v==null?'—':String(v))}</div>`).join('');
    return `<details class="opsMember"><summary>${escapeHtml(member.full_name||'Member')} · health ${member.relationship_health_score}/100 · ${escapeHtml(member.preferred_channel||'none')}</summary><p>${escapeHtml(member.next_best_action||'')}</p><div class="opsDims">${dimHtml}</div></details>`;
  }).join(''):'<p>No relationship profiles yet.</p>';

  const cycles=snapshot.recent_cycles||[];
  $('#cycleRows').innerHTML=cycles.length?cycles.map(c=>`<tr><td>${escapeHtml(prettyDate(c.started_at))}</td><td>${escapeHtml(c.status)}</td><td>${escapeHtml(c.trigger_source)}</td><td><code>${escapeHtml(JSON.stringify(c.summary||{}))}</code></td></tr>`).join(''):'<tr><td colspan="4">No cycles yet.</td></tr>';
}

async function load(){
  status('Refreshing owner operations…');
  const [{data,error},{data:attribution,error:attributionError},{data:readiness,error:readinessError}]=await Promise.all([
    supabase.rpc('owner_ops_snapshot'),
    supabase.rpc('owner_revenue_attribution_snapshot'),
    supabase.rpc('owner_launch_readiness_snapshot')
  ]);
  if(error)throw error;
  if(attributionError)throw attributionError;
  if(readinessError)throw readinessError;
  render(data,attribution,readiness);
  status('Operations console synchronized.','success');
}

async function setMode(mode,pause=false){
  status('Updating operations mode…');
  const {error}=await supabase.rpc('owner_set_ops_mode',{p_mode:mode,p_emergency_pause:pause});
  if(error)throw error;
  await load();
}

async function runNow(){
  status('Running operations cycle…');
  const {data,error}=await supabase.rpc('owner_run_ops_cycle');
  if(error)throw error;
  status(`Cycle complete: ${data?.relationship_rows??0} relationship profiles refreshed.`,'success');
  await load();
}

async function refreshRelationships(){
  status('Refreshing 60-angle relationship core…');
  const {data,error}=await supabase.rpc('owner_refresh_relationship_core');
  if(error)throw error;
  status(`${data??0} relationship profiles refreshed.`,'success');
  await load();
}

async function init(){
  await requireOwner();
  $('#runNow').addEventListener('click',()=>runNow().catch(e=>status(e.message,'error')));
  $('#refreshRelationships').addEventListener('click',()=>refreshRelationships().catch(e=>status(e.message,'error')));
  $('#enableAuto').addEventListener('click',()=>setMode('autopilot',false).catch(e=>status(e.message,'error')));
  $('#manualMode').addEventListener('click',()=>setMode('manual',false).catch(e=>status(e.message,'error')));
  $('#pauseOps').addEventListener('click',()=>setMode('paused',true).catch(e=>status(e.message,'error')));
  await load();
}

init().catch(error=>status(error.message||'Operations console could not load.','error'));