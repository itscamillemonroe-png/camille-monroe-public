import { supabase, $, escapeHtml, prettyDate, requireSession, wireSignOut } from './app-client.js';

let session;
let library=[];
const setStudioStatus=(text,type='')=>{const el=$('#studioStatus');el.textContent=text;el.className=`formStatus ${type}`.trim();};
const setProductStatus=(text,type='')=>{const el=$('#productStatus');el.textContent=text;el.className=`formStatus ${type}`.trim();};
const safeName=name=>name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-100)||'upload';
const mediaKind=type=>type.startsWith('video/')?'video':type.startsWith('audio/')?'audio':'photo';
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(cents)||0)/100);

async function signedPreview(item){const {data}=await supabase.storage.from('protected-media').createSignedUrl(item.storage_path,300);return {...item,signed_url:data?.signedUrl||''};}
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
async function loadProducts(){
  const {data,error}=await supabase.rpc('owner_digital_product_catalog');
  const target=$('#productCatalog');
  if(error){target.innerHTML=`<p class="memberEmpty">${escapeHtml(error.message)}</p>`;return;}
  const products=Array.isArray(data)?data:[];
  target.innerHTML=products.length?products.map(p=>`<article class="productCatalogCard"><div><span class="productState ${p.active?'active':''}">${p.active?'Live':'Draft'}</span><strong>${escapeHtml(p.name)}</strong><small>${money(p.price_cents)} · ${escapeHtml(p.media_title||'No media')} · ${p.commercial_rights?'Rights cleared':'Rights not cleared'}</small><p>${escapeHtml(p.description||'No description')}</p></div><button class="heroButton productToggle" type="button" data-product-id="${escapeHtml(p.id)}" data-active="${p.active?'true':'false'}">${p.active?'Pause':'Activate'}</button></article>`).join(''):'<p class="memberEmpty">No one-time products yet.</p>';
  target.querySelectorAll('.productToggle').forEach(button=>button.addEventListener('click',async()=>{
    button.disabled=true;
    const next=button.dataset.active!=='true';
    const {error}=await supabase.rpc('owner_set_digital_product_active',{p_product_id:button.dataset.productId,p_active:next});
    if(error){setProductStatus(error.message,'error');button.disabled=false;return;}
    setProductStatus(next?'Product activated.':'Product paused.','success');
    await loadProducts();
  }));
}

async function init(){
  session=await requireSession();wireSignOut();
  const {data:profile,error}=await supabase.from('member_profiles').select('is_admin').eq('user_id',session.user.id).single();
  if(error||!profile?.is_admin){location.href='/member/';return;}
  await Promise.all([loadLibrary(),loadProducts()]);

  $('#publishForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const file=$('#contentFile').files[0],title=$('#contentTitle').value.trim(),body=$('#contentBody').value.trim();
    if(!file||!title||!body)return;
    if(file.size>536870912){setStudioStatus('That file is larger than the 512 MB protected upload limit.','error');return;}
    const allowed=['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','audio/mpeg','audio/mp4'];
    if(!allowed.includes(file.type)){setStudioStatus('Choose a JPG, PNG, WebP, MP4, MOV, MP3, or M4A file.','error');return;}
    const button=$('#publishForm button[type="submit"]');button.disabled=true;$('#uploadProgress').hidden=false;$('#uploadProgress span').style.width='18%';setStudioStatus('Uploading to the private SFW member vault…');
    const path=`${session.user.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const upload=await supabase.storage.from('protected-media').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
    if(upload.error){button.disabled=false;$('#uploadProgress').hidden=true;setStudioStatus(upload.error.message,'error');return;}
    $('#uploadProgress span').style.width='65%';
    const {data:published,error}=await supabase.rpc('owner_publish_media_post',{p_title:title,p_body:body,p_scope:'sfw_member',p_media_kind:mediaKind(file.type),p_storage_path:path});
    if(error){await supabase.storage.from('protected-media').remove([path]);button.disabled=false;$('#uploadProgress').hidden=true;setStudioStatus(error.message,'error');return;}
    const mediaId=published?.media_id;
    if(mediaId&&$('#rightsConfirm').checked){
      const {error:rightsError}=await supabase.rpc('owner_confirm_asset_rights',{p_media_id:mediaId,p_rights_status:'owned',p_rights_basis:'Owner confirmed original/controlled commercial rights at upload',p_commercial_use_allowed:true,p_creator_or_licensor:'Camille Monroe',p_evidence_reference:null,p_notes:'Confirmed in Creator Studio upload flow'});
      if(rightsError){setStudioStatus(`Published, but rights clearance could not be recorded: ${rightsError.message}`,'error');button.disabled=false;await loadLibrary();return;}
    }
    setStudioStatus('Published and commercial rights recorded. Approved active members can see it now.','success');event.target.reset();
    $('#uploadProgress span').style.width='100%';setTimeout(()=>{$('#uploadProgress').hidden=true;$('#uploadProgress span').style.width='0';},800);button.disabled=false;await loadLibrary();
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