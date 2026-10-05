(()=>{
const endpoint='https://wybpxixkjimbpvufozub.supabase.co/functions/v1/public-admin-kit';
const apikey='sb_publishable_0bNGPfELmwuT32zmhXXkMQ_sJIXotwE';
const sessionId=new URLSearchParams(location.search).get('session_id')||'';
const form=document.getElementById('unlockForm');
const status=document.getElementById('accessStatus');
const panel=document.getElementById('unlockPanel');
const contentEl=document.getElementById('kitContent');
let kitData=null;
const setStatus=(text,type='')=>{status.textContent=text;status.className=('formStatus '+type).trim();};
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
async function call(body){
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','apikey':apikey},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error||'Access could not be verified.');
  return data;
}
function csvValue(v){const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}
function downloadBlob(name,type,text){
  const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}
function downloadTemplate(t){
  const rows=[t.columns||[]];const csv=rows.map(row=>row.map(csvValue).join(',')).join('\n')+'\n';
  downloadBlob(t.filename||'template.csv','text/csv;charset=utf-8',csv);
}
function completeText(data){
  const c=data.content||{};const lines=[data.title||'',data.subtitle||'','',c.disclaimer||'','', 'QUICK START'];
  (c.quick_start||[]).forEach((x,i)=>lines.push((i+1)+'. '+x));
  (c.sections||[]).forEach(s=>{lines.push('','',String(s.title||'').toUpperCase());(s.body||[]).forEach(x=>lines.push('- '+x));});
  lines.push('','DOWNLOADABLE TEMPLATE COLUMNS');
  (c.templates||[]).forEach(t=>lines.push('',t.filename+': '+(t.columns||[]).join(' | ')));
  return lines.join('\n');
}
function render(data){
  kitData=data;const c=data.content||{};
  document.getElementById('kitTitle').textContent=data.title||'Documentation Workflow Starter Kit';
  document.getElementById('kitSubtitle').textContent=data.subtitle||'';
  document.getElementById('kitDisclaimer').textContent=c.disclaimer||'';
  document.getElementById('kitVersion').textContent='Version '+(data.version||'1.0');
  document.getElementById('quickStart').innerHTML=(c.quick_start||[]).map(x=>'<li>'+esc(x)+'</li>').join('');
  const templateMap=new Map((c.templates||[]).map(t=>[t.key,t]));
  document.getElementById('kitSections').innerHTML=(c.sections||[]).map(s=>{
    const t=templateMap.get(s.template_key);
    return '<section class="systemsSection kitSection"><p class="eyebrow">Workflow module</p><h2>'+esc(s.title)+'</h2>'+
      (s.body||[]).map(x=>'<p>'+esc(x)+'</p>').join('')+
      (t?'<div class="kitTemplateColumns"><strong>Template columns</strong><p>'+esc((t.columns||[]).join(' · '))+'</p></div>':'')+
      '</section>';
  }).join('');
  document.getElementById('templateDownloads').innerHTML=(c.templates||[]).map(t=>
    '<article class="templateCard"><strong>'+esc(t.filename)+'</strong><small>'+esc((t.columns||[]).length)+' columns · blank CSV</small><button class="btn downloadTemplate" data-key="'+esc(t.key)+'" type="button">Download CSV</button></article>'
  ).join('');
  document.querySelectorAll('.downloadTemplate').forEach(btn=>btn.addEventListener('click',()=>{
    const t=(c.templates||[]).find(x=>x.key===btn.dataset.key);if(t)downloadTemplate(t);
  }));
  panel.hidden=true;contentEl.hidden=false;window.scrollTo({top:0,behavior:'smooth'});
}
if(!sessionId){setStatus('This access page needs the successful Stripe checkout session. Return to the Starter Kit page and complete checkout first.','error');form.querySelector('button').disabled=true;}
form?.addEventListener('submit',async event=>{
  event.preventDefault();const email=document.getElementById('purchaseEmail').value.trim();const btn=document.getElementById('unlockKit');
  btn.disabled=true;const original=btn.textContent;btn.textContent='Verifying purchase…';setStatus('Checking your Stripe purchase…');
  try{
    const data=await call({action:'access',session_id:sessionId,email});render(data);setStatus('');
  }catch(error){setStatus(error.message||'Purchase could not be verified.','error');}
  finally{btn.disabled=false;btn.textContent=original;}
});
document.getElementById('printKit')?.addEventListener('click',()=>window.print());
document.getElementById('downloadText')?.addEventListener('click',()=>{if(kitData)downloadBlob('documentation-workflow-starter-kit.txt','text/plain;charset=utf-8',completeText(kitData));});
})();