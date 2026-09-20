import { supabase, $, escapeHtml, prettyDate, requireSession, wireSignOut } from './app-client.js';

let session;
let library=[];
const setStudioStatus=(text,type='')=>{const el=$('#studioStatus');el.textContent=text;el.className=`formStatus ${type}`.trim();};
const setProductStatus=(text,type='')=>{const el=$('#productStatus');el.textContent=text;el.className=`formStatus ${type}`.trim();};
const setCoverStatus=(text,type='')=>{const el=$('#coverStatus');if(!el)return;el.textContent=text;el.className=`formStatus ${type}`.trim();};
const setReviewStatus=(text,type='')=>{const el=$('#reviewStatus');if(!el)return;el.textContent=text;el.className=`formStatus ${type}`.trim();};
const safeName=name=>name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-100)||'upload';
const mediaKind=type=>type.startsWith('video/')?'video':type.startsWith('audio/')?'audio':'photo';
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(cents)||0)/100);
function coverPublicUrl(path=''){
  if(!path)return '';
  if(String(path).startsWith('/assets/'))return path;
  const {data}=supabase.storage.from('lane-cover-media').getPublicUrl(path);
  return data?.publicUrl||'';
}


async function loadStudioSnapshot(){
  const {data,error}=await supabase.rpc('owner_creator_studio_snapshot');
  if(error)return;
  const w=data?.website||{},s=data?.social||{},d=data?.indm||{};
  const libraryTotal=Number(w.published_member_posts||0)+Number(w.published_protected_media||0);
  const reviewTotal=Number(w.media_waiting_review||0)+Number(w.autobot_waiting_review||0);
  if($('#studioLibraryCount'))$('#studioLibraryCount').textContent=String(libraryTotal);
  if($('#studioReviewCount'))$('#studioReviewCount').textContent=String(reviewTotal);
  if($('#studioProductCount'))$('#studioProductCount').textContent=String(w.active_products||0);
  if($('#studioCoverCount'))$('#studioCoverCount').textContent=String(w.active_covers||0);
  if($('#reviewQueuePill'))$('#reviewQueuePill').textContent=reviewTotal?reviewTotal+' WAITING':'CLEAR';
  const metricool=$('#metricoolState');
  if(metricool){
    const connected=Number(s.connected_platforms||0);
    metricool.textContent=(String(s.executor||'').toLowerCase()==='metricool'?'Metricool':'Social')+' · '+connected+' connected';
    metricool.classList.toggle('good',connected>0);
  }
  const indm=$('#indmState');
  if(indm){
    const state=String(d.status||'NOT_CONFIGURED');
    const connected=state.includes('CONNECTED');
    const pending=state.includes('PENDING');
    indm.textContent=connected?(pending?'inDM · setup pending':'inDM · connected'):'inDM · not connected';
    indm.classList.toggle('good',connected&&!pending);
    indm.classList.toggle('warn',pending);
  }
}

async function signedPreview(item){const {data}=await supabase.storage.from('protected-media').createSignedUrl(item.storage_path,300);return {...item,signed_url:data?.signedUrl||''};}
function reviewMediaPreview(d){if(!d.signed_url)return '<div style="padding:28px;border:1px dashed rgba(255,255,255,.15);border-radius:14px;margin-bottom:12px">Media preview unavailable.</div>';if(d.media_kind==='video')return '<video controls playsinline preload="metadata" src="'+escapeHtml(d.signed_url)+'" style="width:100%;max-height:620px;object-fit:contain;border-radius:14px;background:#080808;margin-bottom:12px"></video>';if(d.media_kind==='audio')return '<audio controls preload="metadata" src="'+escapeHtml(d.signed_url)+'" style="width:100%;margin-bottom:12px"></audio>';return '<img src="'+escapeHtml(d.signed_url)+'" alt="" style="width:100%;max-height:620px;object-fit:contain;border-radius:14px;background:#080808;margin-bottom:12px">';}
function refreshProductMediaOptions(){
  const select=$('#productMedia');
  if(!select)return;
  select.innerHTML='<option value="">Choose a published asset</option>'+library.filter(item=>item.status==='published').map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)} · ${escapeHtml(item.media_kind)}</option>`).join('');
}
async function loadLibrary(){
  const {data,error}=await supabase.from('protected_media').select('id,title,media_kind,storage_path,status,audience_scope,updated_at').eq('audience_scope','sfw_member').order('updated_at',{ascending:false}).limit(50);
  const target=$('#studioMedia');if(error){target.innerHTML=`<p class="memberEmpty">${escapeHtml(error.message)}</p>`;return;}
  library=await Promise.all((data||[]).map(signedPreview));
  target.innerHTML=library.length?library.map(item=>`<article class="studioMediaCard">${item.media_kind==='photo'&&item.signed_url?`<img src="${escapeHtml(item.signed_url)}" alt="">`:'<div class="mediaKind">'+escapeHtml(item.media_kind)+'</div>'}<div><strong>${escapeHtml(item.title)}</strong><small>SFW members · ${escapeHtml(item.status)} · ${prettyDate(item.updated_at)}</small></div></article>`).join(''):'<p class="memberEmpty">No SFW protected content has been uploaded yet.</p>';
  refreshProductMediaOptions();
}
async function loadAutobotReview(){
  const target=$('#autobotReviewQueue');if(!target)return;
  const {data,error}=await supabase.rpc('owner_autobot_review_queue');
  if(error){target.innerHTML=`<p class="memberEmpty">${escapeHtml(error.message)}</p>`;return;}
  const drafts=Array.isArray(data)?data:[];
  target.innerHTML=drafts.length?drafts.map(d=>`<article class="productCatalogCard"><div><span class="productState">Review</span><strong>${escapeHtml(d.title||'Draft')}</strong><small>Lane ${escapeHtml(String(d.lane_no||'—'))} · ${escapeHtml(d.lane_name||'Revenue objective')} · score ${escapeHtml(String(d.intelligence_score??0))}</small><p>${escapeHtml(d.body||'')}</p><p><small>${escapeHtml(d.reason||'Prepared by the intelligence autobot.')}</small></p></div><div class="heroButtons"><button class="heroButton approveAutoDraft" data-id="${escapeHtml(d.id)}" type="button">Approve</button><button class="heroButton archiveAutoDraft" data-id="${escapeHtml(d.id)}" type="button">Archive</button></div></article>`).join(''):'<p class="memberEmpty">No autobot drafts are waiting for review.</p>';
  target.querySelectorAll('.approveAutoDraft').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;setReviewStatus('Publishing approved draft…');const {error}=await supabase.rpc('owner_approve_autobot_draft',{p_post_id:button.dataset.id});if(error){setReviewStatus(error.message,'error');button.disabled=false;return;}setReviewStatus('Draft approved and published.','success');await Promise.all([loadAutobotReview(),loadStudioSnapshot()]);}));
  target.querySelectorAll('.archiveAutoDraft').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;const {error}=await supabase.rpc('owner_archive_autobot_draft',{p_post_id:button.dataset.id});if(error){setReviewStatus(error.message,'error');button.disabled=false;return;}setReviewStatus('Draft archived.','success');await loadAutobotReview();}));
}

async function loadMediaReview(){
  const target=$('#mediaReviewQueue');if(!target)return;
  const {data,error}=await supabase.rpc('owner_media_review_queue');
  if(error){target.innerHTML=`<p class="memberEmpty">${escapeHtml(error.message)}</p>`;return;}
  const drafts=Array.isArray(data)?data:[];
  const enriched=await Promise.all(drafts.map(async d=>{const {data:signed}=await supabase.storage.from('protected-media').createSignedUrl(d.storage_path,300);return {...d,signed_url:signed?.signedUrl||''};}));
  target.innerHTML=enriched.length?enriched.map(d=>`<article class="productCatalogCard"><div>${reviewMediaPreview(d)}<span class="productState">Review</span><strong>${escapeHtml(d.title||'Media draft')}</strong><small>${escapeHtml(d.media_kind||'media')} · rights: ${escapeHtml(d.rights_status||'missing')}</small><p>${escapeHtml(d.body||'')}</p></div><div class="heroButtons"><button class="heroButton approveMediaDraft" data-id="${escapeHtml(d.media_id)}" type="button">Approve</button><button class="heroButton archiveMediaDraft" data-id="${escapeHtml(d.media_id)}" type="button">Archive</button></div></article>`).join(''):'<p class="memberEmpty">No media drafts are waiting for review.</p>';
  target.querySelectorAll('.approveMediaDraft').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;setReviewStatus('Publishing approved media…');const {error}=await supabase.rpc('owner_approve_media_review',{p_media_id:button.dataset.id});if(error){setReviewStatus(error.message,'error');button.disabled=false;return;}setReviewStatus('Media approved and published.','success');await Promise.all([loadMediaReview(),loadLibrary(),loadProducts(),loadStudioSnapshot()]);}));
  target.querySelectorAll('.archiveMediaDraft').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;const {error}=await supabase.rpc('owner_archive_media_review',{p_media_id:button.dataset.id});if(error){setReviewStatus(error.message,'error');button.disabled=false;return;}setReviewStatus('Media draft archived.','success');await Promise.all([loadMediaReview(),loadLibrary(),loadStudioSnapshot()]);}));
}

async function loadProducts(){
  const {data,error}=await supabase.rpc('owner_digital_product_catalog');
  const target=$('#productCatalog');
  if(error){target.innerHTML=`<p class="memberEmpty">${escapeHtml(error.message)}</p>`;return;}
  const products=Array.isArray(data)?data:[];
  target.innerHTML=products.length?products.map(p=>`<article class="productCatalogCard"><div><span class="productState ${p.active?'active':''}">${p.active?'Live':'Draft'}</span><strong>${escapeHtml(p.name)}</strong><small>${money(p.price_cents)} · ${escapeHtml(p.media_title||'No media')} · ${p.commercial_rights?'Rights cleared':'Rights not cleared'}</small><p>${escapeHtml(p.description||'No description')}</p></div><div class="heroButtons"><button class="heroButton productToggle" type="button" data-product-id="${escapeHtml(p.id)}" data-active="${p.active?'true':'false'}">${p.active?'Pause':'Activate'}</button>${p.active?'':`<button class="heroButton archiveProduct" type="button" data-product-id="${escapeHtml(p.id)}">Archive</button>`}</div></article>`).join(''):'<p class="memberEmpty">No paid Premium Drops are ready yet.</p>';
  target.querySelectorAll('.productToggle').forEach(button=>button.addEventListener('click',async()=>{
    button.disabled=true;
    const next=button.dataset.active!=='true';
    const {error}=await supabase.rpc('owner_set_digital_product_active',{p_product_id:button.dataset.productId,p_active:next});
    if(error){setProductStatus(error.message,'error');button.disabled=false;return;}
    setProductStatus(next?'Product activated. Premium Drops checkout can now surface it.':'Product paused.','success');
    await Promise.all([loadProducts(),loadStudioSnapshot()]);
  }));
  target.querySelectorAll('.archiveProduct').forEach(button=>button.addEventListener('click',async()=>{
    if(!confirm('Archive this draft? Historical orders stay intact, but the product will disappear from Creator Studio.'))return;
    button.disabled=true;
    const {error}=await supabase.rpc('owner_archive_digital_product',{p_product_id:button.dataset.productId});
    if(error){setProductStatus(error.message,'error');button.disabled=false;return;}
    setProductStatus('Draft archived. Historical records were preserved.','success');
    await loadProducts();
  }));
}

async function loadCovers(){
  const target=$('#coverCatalog');if(!target)return;
  const {data,error}=await supabase.rpc('owner_revenue_cover_snapshot');
  if(error){target.innerHTML=`<p class="memberEmpty">${escapeHtml(error.message)}</p>`;return;}
  const covers=Array.isArray(data)?data:[];
  target.innerHTML=covers.length?covers.map(c=>{
    const share=`https://itscamillemonroe.art/cover/?c=${encodeURIComponent(c.slug)}`;
    const ctr=Number(c.views_7d||0)>0?Math.round((Number(c.clicks_7d||0)/Number(c.views_7d))*100):0;
    const image=coverPublicUrl(c.storage_path);
    return `<article class="productCatalogCard revenueCoverCard">${image?`<img class="revenueCoverThumb" src="${escapeHtml(image)}" alt="${escapeHtml(c.title||'Revenue cover')}">`:''}<div><span class="productState ${c.active?'active':''}">${c.active?'Live':'Paused'}</span><strong>${escapeHtml(c.title)}</strong><small>${escapeHtml(c.lane_name||'Lane')} · ${c.views_7d||0} views · ${c.clicks_7d||0} clicks · ${ctr}% CTR (7d)</small><p>${escapeHtml(c.short_copy||'')}</p><p><a href="${escapeHtml(share)}" target="_blank" rel="noopener">${escapeHtml(share)}</a></p></div><button class="heroButton copyCoverLink" type="button" data-url="${escapeHtml(share)}">Copy link</button></article>`;
  }).join(''):'<p class="memberEmpty">No revenue covers yet.</p>';
  target.querySelectorAll('.copyCoverLink').forEach(button=>button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(button.dataset.url||'');setCoverStatus('Share link copied.','success');}catch{setCoverStatus('Open the link and copy it from the address bar.','error');}}));
}

async function init(){
  session=await requireSession();wireSignOut();
  const {data:profile,error}=await supabase.from('member_profiles').select('is_admin').eq('user_id',session.user.id).single();
  if(error||!profile?.is_admin){location.href='/member/';return;}
  await Promise.all([loadStudioSnapshot(),loadLibrary(),loadProducts(),loadCovers(),loadAutobotReview(),loadMediaReview()]);

  $('#publishForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const file=$('#contentFile').files[0],title=$('#contentTitle').value.trim(),body=$('#contentBody').value.trim();
    if(!file||!title||!body)return;
    if(file.size>536870912){setStudioStatus('That file is larger than the 512 MB protected upload limit.','error');return;}
    const allowed=['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','audio/mpeg','audio/mp4'];
    if(!allowed.includes(file.type)){setStudioStatus('Choose a JPG, PNG, WebP, MP4, MOV, MP3, or M4A file.','error');return;}
    const button=$('#publishForm button[type="submit"]');button.disabled=true;$('#uploadProgress').hidden=false;$('#uploadProgress span').style.width='18%';setStudioStatus('Uploading to the private SFW review queue…');
    const path=`${session.user.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const upload=await supabase.storage.from('protected-media').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
    if(upload.error){button.disabled=false;$('#uploadProgress').hidden=true;setStudioStatus(upload.error.message,'error');return;}
    $('#uploadProgress span').style.width='65%';
    const {data:published,error}=await supabase.rpc('owner_publish_media_post',{p_title:title,p_body:body,p_scope:'sfw_member',p_media_kind:mediaKind(file.type),p_storage_path:path});
    if(error){await supabase.storage.from('protected-media').remove([path]);button.disabled=false;$('#uploadProgress').hidden=true;setStudioStatus(error.message,'error');return;}
    const mediaId=published?.media_id;
    if(mediaId&&$('#rightsConfirm').checked){
      const {error:rightsError}=await supabase.rpc('owner_confirm_asset_rights',{p_media_id:mediaId,p_rights_status:'owned',p_rights_basis:'Owner confirmed original/controlled commercial rights at upload',p_commercial_use_allowed:true,p_creator_or_licensor:'Camille Monroe',p_evidence_reference:null,p_notes:'Confirmed in Creator Studio upload flow'});
      if(rightsError){setStudioStatus(`Uploaded for review, but rights clearance could not be recorded: ${rightsError.message}`,'error');button.disabled=false;await Promise.all([loadLibrary(),loadMediaReview(),loadStudioSnapshot()]);return;}
    }
    setStudioStatus('Uploaded for review and commercial rights recorded. Nothing is live until you approve it above.','success');event.target.reset();
    $('#uploadProgress span').style.width='100%';setTimeout(()=>{$('#uploadProgress').hidden=true;$('#uploadProgress span').style.width='0';},800);button.disabled=false;await Promise.all([loadLibrary(),loadMediaReview(),loadStudioSnapshot()]);
  });

  $('#coverForm')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const file=$('#coverFile').files[0],title=$('#coverTitle').value.trim(),copy=$('#coverCopy').value.trim(),laneNo=Number($('#coverLane').value);
    if(!file||!title||!Number.isInteger(laneNo)||laneNo<1||laneNo>6){setCoverStatus('Choose an image, title, and revenue lane.','error');return;}
    if(file.size>20*1024*1024){setCoverStatus('Cover images must be 20 MB or smaller.','error');return;}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setCoverStatus('Use a JPG, PNG, or WebP cover image.','error');return;}
    const button=$('#coverForm button[type="submit"]');button.disabled=true;setCoverStatus('Uploading public revenue cover…');
    const path=`${session.user.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const upload=await supabase.storage.from('lane-cover-media').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
    if(upload.error){button.disabled=false;setCoverStatus(upload.error.message,'error');return;}
    const {data,error}=await supabase.rpc('owner_create_revenue_cover',{p_lane_no:laneNo,p_title:title,p_short_copy:copy,p_storage_path:path});
    if(error){await supabase.storage.from('lane-cover-media').remove([path]);button.disabled=false;setCoverStatus(error.message,'error');return;}
    const oldPath=String(data?.old_storage_path||'');
    if(data?.action==='updated'&&oldPath&&!oldPath.startsWith('/assets/')&&oldPath!==path){
      await supabase.storage.from('lane-cover-media').remove([oldPath]).catch(()=>{});
    }
    const share=`https://itscamillemonroe.art${data?.share_path||'/cover/'}`;
    const verb=data?.action==='updated'?'updated':'created';
    event.target.reset();button.disabled=false;setCoverStatus(`Revenue cover ${verb}: ${share}`,'success');await Promise.all([loadCovers(),loadStudioSnapshot()]);
  });

  $('#productForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const mediaId=$('#productMedia').value;
    const name=$('#productName').value.trim();
    const description=$('#productDescription').value.trim();
    const dollars=Number($('#productPrice').value);
    const active=$('#productActive').checked;
    if(!mediaId||!name||!Number.isFinite(dollars)||dollars<1){setProductStatus('Choose media and enter a price of at least $1.00.','error');return;}
    const button=$('#productForm button[type="submit"]');button.disabled=true;setProductStatus('Creating product…');
    const {error}=await supabase.rpc('owner_create_digital_product',{p_media_id:mediaId,p_name:name,p_description:description,p_price_cents:Math.round(dollars*100),p_activate:active});
    button.disabled=false;
    if(error){setProductStatus(error.message,'error');return;}
    event.target.reset();setProductStatus(active?'Product created and activated.':'Product created as a draft.','success');await loadProducts();
  });
}
init().catch(error=>setStudioStatus(error.message||'Creator Studio could not load.','error'));