import { supabase, $, escapeHtml, prettyDate, requireSession, wireSignOut } from './app-client.js';

let session, profile, activeConversation, lastMessageSignature='';
const setMessageStatus=(text,type='')=>{const el=$('#messageStatus');el.textContent=text;el.className=`formStatus ${type}`.trim();};

async function refreshWallet(){const {data}=await supabase.from('member_wallets').select('balance_credits').eq('user_id',session.user.id).maybeSingle();$('#serviceCredits').textContent=data?.balance_credits??'0';}

async function ensureMemberConversation(){
  let {data}=await supabase.from('conversations').select('id,member_id,status,updated_at').eq('member_id',session.user.id).order('updated_at',{ascending:false}).limit(1).maybeSingle();
  if(!data){const created=await supabase.from('conversations').insert({member_id:session.user.id}).select('id,member_id,status,updated_at').single();if(created.error)throw created.error;data=created.data;}
  return data;
}

async function loadConversations(){
  const list=$('#conversationList');
  if(!profile.is_admin){activeConversation=await ensureMemberConversation();list.innerHTML='<button class="conversationButton active" type="button"><strong>Camille Monroe</strong><small>Private conversation</small></button>';return;}
  const {data:conversations,error}=await supabase.from('conversations').select('id,member_id,status,updated_at').order('updated_at',{ascending:false});
  if(error)throw error;
  const ids=[...new Set((conversations||[]).map(item=>item.member_id))];
  const profiles=ids.length?(await supabase.from('member_profiles').select('user_id,full_name,email').in('user_id',ids)).data||[]:[];
  const profileMap=new Map(profiles.map(item=>[item.user_id,item]));
  if(!conversations?.length){list.innerHTML='<p class="memberEmpty">No member conversations yet.</p>';$('#messageForm').hidden=true;return;}
  if(!activeConversation)activeConversation=conversations[0];
  list.innerHTML=conversations.map(item=>{const person=profileMap.get(item.member_id)||{};return `<button class="conversationButton ${item.id===activeConversation.id?'active':''}" data-conversation="${item.id}" type="button"><strong>${escapeHtml(person.full_name||'Member')}</strong><small>${escapeHtml(person.email||'Private member')}</small></button>`;}).join('');
  list.querySelectorAll('[data-conversation]').forEach(button=>button.addEventListener('click',()=>{activeConversation=conversations.find(item=>item.id===button.dataset.conversation);lastMessageSignature='';loadConversations();loadMessages();}));
}

async function loadMessages(){
  if(!activeConversation)return;
  const {data,error}=await supabase.from('messages').select('id,sender_id,body,price_credits,read_at,created_at').eq('conversation_id',activeConversation.id).order('created_at',{ascending:true}).limit(200);
  if(error){setMessageStatus(error.message,'error');return;}
  const signature=(data||[]).map(item=>item.id+item.read_at).join('|'); if(signature===lastMessageSignature)return; lastMessageSignature=signature;
  const thread=$('#messageThread');
  thread.innerHTML=data?.length?data.map(item=>`<article class="messageBubble ${item.sender_id===session.user.id?'mine':'theirs'}"><p>${escapeHtml(item.body)}</p><small>${prettyDate(item.created_at)}${item.price_credits?` · ${item.price_credits} credits`:''}</small></article>`).join(''):'<p class="memberEmpty">Start the conversation when you’re ready.</p>';
  thread.scrollTop=thread.scrollHeight;
  await supabase.from('messages').update({read_at:new Date().toISOString()}).eq('conversation_id',activeConversation.id).neq('sender_id',session.user.id).is('read_at',null);
}

async function init(){
  session=await requireSession();wireSignOut();
  const [{data:p,error:pError},{data:settings}]=await Promise.all([supabase.from('member_profiles').select('status,is_admin,verification_status').eq('user_id',session.user.id).single(),supabase.from('communication_settings').select('messaging_enabled,message_price_credits').eq('id',1).single()]);
  if(pError)throw pError;profile=p;
  if(!profile.is_admin&&(profile.status!=='approved'||profile.verification_status!=='verified')){setMessageStatus('Paid private messaging is part of the adult service lane and remains locked until a compliant 18+ check is active.','error');$('#messageForm').hidden=true;return;}
  $('#messagePricing').textContent=profile.is_admin?'Reply to members from the same private thread.':`${settings?.message_price_credits??0} credits per sent message. Replies from Camille do not charge you.`;
  if(!settings?.messaging_enabled&&!profile.is_admin){setMessageStatus('Paid messaging is currently paused.','error');$('#messageForm').hidden=true;return;}
  await Promise.all([refreshWallet(),loadConversations()]);await loadMessages();
  $('#messageForm').addEventListener('submit',async event=>{event.preventDefault();const body=$('#messageBody').value.trim();if(!body||!activeConversation)return;setMessageStatus('Sending…');const {error}=await supabase.from('messages').insert({conversation_id:activeConversation.id,sender_id:session.user.id,body});if(error){setMessageStatus(error.message,'error');return;}$('#messageBody').value='';setMessageStatus('Sent.','success');lastMessageSignature='';await Promise.all([loadMessages(),refreshWallet()]);});
  setInterval(()=>{loadMessages();refreshWallet();if(profile.is_admin)loadConversations();},2500);
}
init().catch(error=>setMessageStatus(error.message||'Messages could not load.','error'));
