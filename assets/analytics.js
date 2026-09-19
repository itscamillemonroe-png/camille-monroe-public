(()=> {
  const endpoint='https://wybpxixkjimbpvufozub.supabase.co/functions/v1/track-site-event';
  const apikey='sb_publishable_0bNGPfELmwuT32zmhXXkMQ_sJIXotwE';
  const attrKey='cm_attribution_v1';
  const visitorKey='cm_visitor_id_v1';
  const sessionKey='cm_session_id_v1';

  function uuid(){
    if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
    const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const h=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
    return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }
  function getId(store,key){
    try{let v=store.getItem(key);if(!v){v=uuid();store.setItem(key,v);}return v;}catch{return uuid();}
  }
  function refHost(){
    try{return document.referrer?new URL(document.referrer).hostname.slice(0,160):'';}catch{return '';}
  }
  function area(){
    const p=location.pathname;
    if(/^\/ops(?:\/|$)/.test(p))return 'ops';
    if(/^\/studio(?:\/|$)/.test(p))return 'studio';
    if(/^\/(?:member|payments|messages|calls|verify)(?:\/|$)/.test(p))return 'member';
    return 'public';
  }
  function device(){
    const w=window.innerWidth||0;
    if(w<768)return 'mobile';
    if(w<1100)return 'tablet';
    return 'desktop';
  }
  function captureAttribution(){
    const q=new URLSearchParams(location.search);
    const incoming={
      source:(q.get('utm_source')||'').slice(0,120),
      medium:(q.get('utm_medium')||'').slice(0,120),
      campaign:(q.get('utm_campaign')||'').slice(0,120),
      content:(q.get('utm_content')||'').slice(0,120),
      term:(q.get('utm_term')||'').slice(0,120),
      referrer_host:refHost(),
      landing_path:location.pathname.slice(0,180)
    };
    const hasUtm=Object.values(incoming).some(Boolean);
    let stored=null;
    try{stored=JSON.parse(localStorage.getItem(attrKey)||'null');}catch{}
    if(hasUtm){try{localStorage.setItem(attrKey,JSON.stringify(incoming));}catch{};return incoming;}
    if(stored)return stored;
    const host=refHost();
    const first={source:host||'direct',medium:host?'referral':'none',campaign:'',content:'',term:'',referrer_host:host,landing_path:location.pathname.slice(0,180)};
    try{localStorage.setItem(attrKey,JSON.stringify(first));}catch{}
    return first;
  }
  const attribution=captureAttribution();
  const visitorId=getId(localStorage,visitorKey);
  const sessionId=getId(sessionStorage,sessionKey);

  function payload(eventType,target=''){
    return {
      event_type:eventType,
      path:location.pathname.slice(0,240),
      area:area(),
      page_title:(document.title||'').slice(0,180),
      visitor_id:visitorId,
      session_id:sessionId,
      referrer_host:refHost(),
      source:attribution.source||'direct',
      medium:attribution.medium||'none',
      campaign:attribution.campaign||'',
      content:attribution.content||'',
      term:attribution.term||'',
      device_class:device(),
      viewport_width:window.innerWidth||0,
      target:String(target||'').slice(0,240)
    };
  }
  function send(eventType,target=''){
    const body=JSON.stringify(payload(eventType,target));
    fetch(endpoint,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':apikey},
      body,
      keepalive:true,
      credentials:'omit'
    }).catch(()=>{});
  }

  globalThis.CamilleAnalytics={track:(eventType,target='')=>send(eventType,target)};
  const queued=Array.isArray(globalThis.cmTelemetryQueue)?globalThis.cmTelemetryQueue.splice(0):[];
  queued.forEach(item=>send(item?.eventType||'page_view',item?.target||''));

  send('page_view');

  document.addEventListener('click',event=>{
    const a=event.target.closest?.('a[href]');
    if(!a)return;
    let target='';
    try{
      const u=new URL(a.href,location.href);
      target=u.origin===location.origin?u.pathname:u.hostname;
    }catch{target=a.getAttribute('href')||'';}
    send('link_click',target);
  },{capture:true});
})();