import { supabase, $, escapeHtml, requireSession, wireSignOut } from './app-client.js';

function status(text,type=''){const el=$('#opsStatus');if(!el)return;el.textContent=text;el.className='opsStatus '+type;}
function money(cents){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(cents)||0)/100);}
function pretty(v=''){return String(v||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());}
async function requireOwner(){
  const s=await requireSession();wireSignOut();
  const {data,error}=await supabase.from('member_profiles').select('is_admin').eq('user_id',s.user.id).single();
  if(error||!data?.is_admin){location.replace('/member/');throw new Error('Owner access required.');}
}
function renderProfile(p={}){
  $('#operatingName').textContent=p.operating_name||'—';
  $('#legalOperator').textContent=p.legal_operator_name||'—';
  $('#communicationMode').textContent=pretty(p.communication_mode||'—');
  const structure=p.structure_status==='registered_entity'?'REGISTERED':'OPERATING UMBRELLA';
  $('#structureState').textContent=structure;
  $('#structurePill').textContent=structure;
  $('#companyObjective').textContent=p.primary_objective||'—';
  $('#companyNotes').textContent=p.notes||'';
}
function renderSummary(s={}){
  $('#activeDivisions').textContent=String(s.active_divisions??0);
  $('#buildingDivisions').textContent=String(s.building_divisions??0)+' building';
  $('#liveOffers').textContent=String(s.live_offers??0);
  $('#buildingOffers').textContent=String(s.building_offers??0)+' being built/planned';
  $('#paymentReadyOffers').textContent=String(s.payment_ready_offers??0);
  $('#companyRevenue').textContent=money(s.total_collected_revenue_cents||0);
}
function renderDivisions(items=[]){
  $('#divisionCountPill').textContent=items.length+' DIVISIONS';
  $('#divisionGrid').innerHTML=items.map(d=>`
    <article class="companyDivisionCard">
      <div class="opsItemHead">
        <div><span class="opsPill">${escapeHtml(String(d.status||'').toUpperCase())}</span><strong>${escapeHtml(d.name)}</strong></div>
        <span class="companyPriority">P${escapeHtml(String(d.priority||3))}</span>
      </div>
      <p>${escapeHtml(d.purpose||'')}</p>
      <div class="companyMeta"><b>Revenue model</b><span>${escapeHtml(d.revenue_model||'—')}</span></div>
      <div class="companyMeta"><b>Brand fit</b><span>${escapeHtml(d.brand_fit_rule||'—')}</span></div>
      <div class="companyMeta"><b>Guardrail</b><span>${escapeHtml(d.guardrail||'—')}</span></div>
    </article>`).join('');
}
function renderOffers(items=[]){
  $('#offerPill').textContent=items.filter(x=>x.status==='live').length+' LIVE';
  $('#offerRows').innerHTML=items.length?items.map(o=>`
    <tr>
      <td><strong>${escapeHtml(o.name)}</strong>${o.route_path?`<br><a href="${escapeHtml(o.route_path)}" target="_blank" rel="noopener">Open offer →</a>`:''}</td>
      <td>${escapeHtml(pretty(o.division_slug))}</td>
      <td><span class="opsPill">${escapeHtml(String(o.status||'').toUpperCase())}</span><br><small>${o.payment_ready?'Payment ready':'Not payment ready'}</small></td>
      <td>${escapeHtml(o.price_label||'—')}</td>
      <td><strong>${escapeHtml(String(o.cash_now_score??0))}/100</strong></td>
      <td>${escapeHtml(o.next_action||'—')}</td>
    </tr>`).join(''):'<tr><td colspan="6">No company offers configured.</td></tr>';
}
function actionButtons(p){
  if(p.status==='complete')return '';
  return `<div class="opsActions companyProjectActions">
    ${p.status!=='active'?'<button class="opsButton projectStatus" data-key="'+escapeHtml(p.project_key)+'" data-status="active" type="button">Make active</button>':''}
    ${p.status!=='waiting'?'<button class="opsButton projectStatus" data-key="'+escapeHtml(p.project_key)+'" data-status="waiting" type="button">Waiting</button>':''}
    <button class="opsButton projectStatus" data-key="${escapeHtml(p.project_key)}" data-status="complete" type="button">Mark complete</button>
  </div>`;
}
function renderProjects(items=[]){
  const active=items.filter(x=>x.status==='active').length;
  $('#projectPill').textContent=active+' ACTIVE';
  $('#projectList').innerHTML=items.length?items.map(p=>`
    <article class="opsItem companyProject">
      <div class="opsItemHead">
        <div><span class="opsPill">${escapeHtml(String(p.status||'').toUpperCase())}</span><strong>${escapeHtml(p.title)}</strong></div>
        <span class="companyPriority">P${escapeHtml(String(p.priority||3))}</span>
      </div>
      <p><strong>Cash impact:</strong> ${escapeHtml(p.cash_impact||'—')}</p>
      <p><strong>Time to cash:</strong> ${escapeHtml(p.time_to_cash||'—')}</p>
      <p><strong>Next:</strong> ${escapeHtml(p.next_action||'—')}</p>
      ${p.owner_approval_required?'<p><span class="opsPill">FOUNDER APPROVAL REQUIRED</span></p>':''}
      ${actionButtons(p)}
    </article>`).join(''):'<p>No open parent-company projects.</p>';
  document.querySelectorAll('.projectStatus').forEach(btn=>btn.addEventListener('click',()=>setProjectStatus(btn)));
}
async function setProjectStatus(btn){
  const old=btn.textContent;btn.disabled=true;btn.textContent='Saving…';
  try{
    const {error}=await supabase.rpc('owner_company_set_project_status',{p_project_key:btn.dataset.key,p_status:btn.dataset.status});
    if(error)throw error;
    status('Parent-company priority updated.','success');
    await load();
  }catch(e){status(e.message||'Could not update project.','error');}
  finally{btn.disabled=false;btn.textContent=old;}
}
async function load(){
  status('Loading parent-company operating layer…');
  const {data,error}=await supabase.rpc('owner_company_snapshot');
  if(error)throw error;
  renderProfile(data?.profile||{});
  renderSummary(data?.summary||{});
  renderDivisions(data?.divisions||[]);
  renderOffers(data?.offers||[]);
  renderProjects(data?.projects||[]);
  status('Operating records loaded. Review the linked sales trackers and payment evidence for current status.','success');
}
async function init(){await requireOwner();await load();}
init().catch(e=>status(e.message||'Parent-company view could not load.','error'));
