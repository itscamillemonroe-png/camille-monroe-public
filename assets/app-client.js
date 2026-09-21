import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(
  'https://wybpxixkjimbpvufozub.supabase.co',
  'sb_publishable_0bNGPfELmwuT32zmhXXkMQ_sJIXotwE'
);

export const $ = selector => document.querySelector(selector);
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export const prettyDate = value => {
  if (!value) return 'Not active yet';
  try { return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)); }
  catch { return String(value); }
};
export async function requireSession() {
  const {data:{session}} = await supabase.auth.getSession();
  if (!session) {
    const ownerPath=/^\/(ops|studio)(\/|$)/.test(location.pathname);
    location.href=ownerPath?'/owner-login/':'/login/';
    throw new Error('Authentication required');
  }
  return session;
}
export function wireSignOut() {
  $('#signOut')?.addEventListener('click', async () => { await supabase.auth.signOut(); location.href='/'; });
}


const attributionKey='cm_attribution_v1';
const clipValue=(value,max=120)=>String(value||'').trim().slice(0,max);
function currentReferrerHost(){
  try{return document.referrer?new URL(document.referrer).hostname.slice(0,160):'';}catch{return '';}
}
export function captureAttribution(){
  try{
    const params=new URLSearchParams(location.search);
    const existing=JSON.parse(sessionStorage.getItem(attributionKey)||localStorage.getItem(attributionKey)||'null');
    const incoming={
      source:clipValue(params.get('utm_source')),
      medium:clipValue(params.get('utm_medium')),
      campaign:clipValue(params.get('utm_campaign')),
      content:clipValue(params.get('utm_content')),
      term:clipValue(params.get('utm_term')),
      referrer_host:clipValue(currentReferrerHost(),160),
      landing_path:clipValue(location.pathname,180)
    };
    const hasCampaign=Boolean(incoming.source||incoming.medium||incoming.campaign||incoming.content||incoming.term);
    const next=existing&&!hasCampaign?existing:{
      source:incoming.source||(incoming.referrer_host?'referral':'direct'),
      medium:incoming.medium||(incoming.referrer_host?'referral':'none'),
      campaign:incoming.campaign,
      content:incoming.content,
      term:incoming.term,
      referrer_host:incoming.referrer_host,
      landing_path:incoming.landing_path
    };
    sessionStorage.setItem(attributionKey,JSON.stringify(next));
    localStorage.setItem(attributionKey,JSON.stringify(next));
    return next;
  }catch{return {source:'direct',medium:'none',campaign:'',content:'',term:'',referrer_host:'',landing_path:location.pathname};}
}
export function getAttribution(){
  try{return JSON.parse(sessionStorage.getItem(attributionKey)||localStorage.getItem(attributionKey)||'null')||captureAttribution();}
  catch{return captureAttribution();}
}
captureAttribution();
