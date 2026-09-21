import { supabase, $ } from './app-client.js';

function setStatus(text,type=''){
  const el=$('#ownerLoginStatus');
  if(!el)return;
  el.textContent=text;
  el.className='formStatus '+type;
}
async function validateOwner(session){
  if(!session?.user)return false;
  const {data,error}=await supabase.from('member_profiles').select('is_admin').eq('user_id',session.user.id).single();
  return !error&&Boolean(data?.is_admin);
}
async function init(){
  const {data:{session}}=await supabase.auth.getSession();
  if(session&&await validateOwner(session)){location.replace('/ops/');return;}
  if(session){await supabase.auth.signOut();}

  $('#ownerLoginForm')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=event.currentTarget.querySelector('[type="submit"]');
    button.disabled=true;setStatus('Checking owner access…');
    try{
      const email=$('#ownerEmail').value.trim();
      const password=$('#ownerPassword').value;
      const {data,error}=await supabase.auth.signInWithPassword({email,password});
      if(error)throw error;
      const ok=await validateOwner(data.session);
      if(!ok){
        await supabase.auth.signOut();
        throw new Error('Owner access required.');
      }
      location.replace('/ops/');
    }catch(error){
      setStatus(error.message||'Owner sign-in failed.','error');
      button.disabled=false;
    }
  });
}
init().catch(()=>setStatus('Owner sign-in is temporarily unavailable.','error'));