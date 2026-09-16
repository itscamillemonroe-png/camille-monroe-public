import { supabase, $, escapeHtml, prettyDate, requireSession, wireSignOut } from './app-client.js';

let session, profile, settings, activeRoom, peer, localStream, signalTimer, offerSent=false, ending=false;
let lastSignalId=0, queuedIce=[];
const setCallStatus=(text,type='')=>{const el=$('#callStatus');el.textContent=text;el.className=`formStatus ${type}`.trim();};

async function refreshWallet(){const {data}=await supabase.from('member_wallets').select('balance_credits').eq('user_id',session.user.id).maybeSingle();$('#callCredits').textContent=data?.balance_credits??'0';}
function updateEstimate(){const type=$('#callType').value,minutes=Math.max(Number($('#callMinutes').value)||settings.minimum_call_minutes,settings.minimum_call_minutes),rate=type==='video'?settings.video_price_per_minute_credits:settings.voice_price_per_minute_credits;$('#callEstimate').textContent=`${rate} credits/minute · ${minutes*rate} credits held when requested. Unused credits return when the call ends.`;}

async function loadRequests(){
  let query=supabase.from('call_requests').select('id,member_id,call_type,requested_minutes,price_per_minute_credits,total_credits,status,member_note,requested_for,scheduled_for,refunded_at,created_at').order('created_at',{ascending:false}).limit(50);
  if(!profile.is_admin)query=query.eq('member_id',session.user.id);
  const {data:requests,error}=await query;if(error){setCallStatus(error.message,'error');return;}
  const ids=(requests||[]).map(item=>item.id);let rooms=[];if(ids.length){rooms=(await supabase.from('call_rooms').select('id,call_request_id,member_id,owner_id,call_type,status,started_at,ended_at,refunded_credits').in('call_request_id',ids)).data||[];}
  const roomMap=new Map(rooms.map(room=>[room.call_request_id,room]));const target=$('#callRequests');
  if(!requests?.length){target.innerHTML='<p class="memberEmpty">No call requests yet.</p>';return;}
  target.innerHTML=requests.map(request=>{const room=roomMap.get(request.id);const canJoin=room&&room.status!=='ended';const adminActions=profile.is_admin&&request.status==='requested'?`<div class="requestActions"><button class="heroButton primary" data-accept="${request.id}" type="button">Accept</button><button class="heroButton" data-decline="${request.id}" type="button">Decline</button></div>`:'';const join=canJoin?`<button class="heroButton primary" data-room="${room.id}" type="button">Join ${escapeHtml(request.call_type)}</button>`:'';return `<article class="requestCard"><div><span>${escapeHtml(request.call_type)} call</span><strong>${request.requested_minutes} minutes · ${request.total_credits} credits</strong><small>${prettyDate(request.created_at)} · ${escapeHtml(request.status)}${room?.refunded_credits?` · ${room.refunded_credits} returned`:''}</small>${request.member_note?`<p>${escapeHtml(request.member_note)}</p>`:''}</div>${adminActions}${join}</article>`;}).join('');
  target.querySelectorAll('[data-accept]').forEach(button=>button.addEventListener('click',()=>decideRequest(button.dataset.accept,'accepted')));target.querySelectorAll('[data-decline]').forEach(button=>button.addEventListener('click',()=>decideRequest(button.dataset.decline,'declined')));target.querySelectorAll('[data-room]').forEach(button=>button.addEventListener('click',()=>openRoom(rooms.find(room=>room.id===button.dataset.room))));
}

async function decideRequest(id,status){setCallStatus(status==='accepted'?'Opening a private call room…':'Returning the held credits…');const {error}=await supabase.from('call_requests').update({status}).eq('id',id);if(error){setCallStatus(error.message,'error');return;}setCallStatus(status==='accepted'?'Accepted. The call room is ready.':'Declined. Held credits were returned.','success');await loadRequests();}
function openRoom(room){activeRoom=room;$('#callRoom').hidden=false;$('#callRoom').scrollIntoView({behavior:'smooth',block:'center'});$('#connectionState').textContent=room.status==='active'?'Call in progress':'Ready when both sides join';}

async function sendSignal(type,payload={}){if(!activeRoom)return;const {error}=await supabase.from('call_signals').insert({room_id:activeRoom.id,sender_id:session.user.id,signal_type:type,payload});if(error)throw error;}
async function flushIce(){if(!peer?.remoteDescription)return;for(const candidate of queuedIce.splice(0)){try{await peer.addIceCandidate(candidate);}catch{}}}
async function createOffer(){if(offerSent||!peer)return;offerSent=true;const offer=await peer.createOffer();await peer.setLocalDescription(offer);await sendSignal('offer',offer);}
async function handleSignal(signal){
  if(signal.sender_id===session.user.id||!peer)return;
  if(signal.signal_type==='ready'&&profile.is_admin)await createOffer();
  if(signal.signal_type==='offer'&&!profile.is_admin){await peer.setRemoteDescription(signal.payload);await flushIce();const answer=await peer.createAnswer();await peer.setLocalDescription(answer);await sendSignal('answer',answer);}
  if(signal.signal_type==='answer'&&profile.is_admin){await peer.setRemoteDescription(signal.payload);await flushIce();}
  if(signal.signal_type==='ice'){if(peer.remoteDescription)await peer.addIceCandidate(signal.payload).catch(()=>{});else queuedIce.push(signal.payload);}
  if(signal.signal_type==='hangup')await finishCall(false);
}
async function pollSignals(){if(!activeRoom||!peer)return;let query=supabase.from('call_signals').select('id,sender_id,signal_type,payload,created_at').eq('room_id',activeRoom.id).gt('id',lastSignalId).order('id',{ascending:true});const {data}=await query;for(const signal of data||[]){lastSignalId=Math.max(lastSignalId,Number(signal.id));await handleSignal(signal);} }

async function beginCall(){
  if(!activeRoom||peer)return;const video=activeRoom.call_type==='video';
  try{localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:video?{facingMode:'user'}:false});}
  catch(error){setCallStatus('Camera or microphone access was blocked. Allow access in your browser settings and try again.','error');return;}
  $('#localVideo').srcObject=localStream;$('#localVideo').hidden=!video;$('#remoteVideo').hidden=!video;$('#audioCallMark').hidden=video;$('#toggleCamera').hidden=!video;$('#joinCall').hidden=true;
  peer=new RTCPeerConnection({iceServers:[{urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']}]});localStream.getTracks().forEach(track=>peer.addTrack(track,localStream));
  peer.ontrack=event=>{$('#remoteVideo').srcObject=event.streams[0];};peer.onicecandidate=event=>{if(event.candidate)sendSignal('ice',event.candidate.toJSON()).catch(()=>{});};peer.onconnectionstatechange=async()=>{$('#connectionState').textContent=peer.connectionState.replaceAll('-',' ');if(peer.connectionState==='connected'){await supabase.from('call_rooms').update({status:'active'}).eq('id',activeRoom.id);setCallStatus('Connected.','success');}if(['failed','closed'].includes(peer.connectionState))setCallStatus('The call disconnected. You can end it to settle unused credits.','error');};
  lastSignalId=0;signalTimer=setInterval(()=>pollSignals().catch(()=>{}),900);await sendSignal('ready');await pollSignals();$('#connectionState').textContent='Waiting for the other side…';
}

async function finishCall(sendHangup=true){
  if(ending||!activeRoom)return;ending=true;if(sendHangup)await sendSignal('hangup').catch(()=>{});clearInterval(signalTimer);localStream?.getTracks().forEach(track=>track.stop());peer?.close();peer=null;localStream=null;
  const {data,error}=await supabase.rpc('end_call',{p_room_id:activeRoom.id});if(error)setCallStatus(error.message,'error');else{const result=Array.isArray(data)?data[0]:data;setCallStatus(`Call ended. ${result?.returned_credits??0} unused credits returned.`, 'success');}
  $('#joinCall').hidden=false;$('#callRoom').hidden=true;activeRoom=null;offerSent=false;ending=false;queuedIce=[];await Promise.all([refreshWallet(),loadRequests()]);
}

async function init(){
  session=await requireSession();wireSignOut();const [{data:p,error:pError},{data:s,error:sError}]=await Promise.all([supabase.from('member_profiles').select('status,is_admin,verification_status').eq('user_id',session.user.id).single(),supabase.from('communication_settings').select('*').eq('id',1).single()]);if(pError||sError)throw pError||sError;profile=p;settings=s;
  if(profile.is_admin)$('#callRequestForm').hidden=true;else if(profile.status!=='approved'||profile.verification_status!=='verified'){$('#callRequestForm').hidden=true;setCallStatus('Approval and Didit verification are required before requesting calls.','error');}
  const requestedType=new URLSearchParams(location.search).get('type');if(['voice','video'].includes(requestedType))$('#callType').value=requestedType;$('#callMinutes').min=settings.minimum_call_minutes;$('#callMinutes').value=Math.max(Number($('#callMinutes').value),settings.minimum_call_minutes);updateEstimate();$('#callType').addEventListener('change',updateEstimate);$('#callMinutes').addEventListener('input',updateEstimate);
  $('#callRequestForm').addEventListener('submit',async event=>{event.preventDefault();const call_type=$('#callType').value,requested_minutes=Number($('#callMinutes').value),member_note=$('#callNote').value.trim();setCallStatus('Holding credits and sending your request…');const {error}=await supabase.from('call_requests').insert({member_id:session.user.id,call_type,requested_minutes,member_note});if(error){setCallStatus(error.message,'error');return;}event.target.reset();$('#callMinutes').value=settings.minimum_call_minutes;updateEstimate();setCallStatus('Request sent. Camille can accept it from this same call desk.','success');await Promise.all([refreshWallet(),loadRequests()]);});
  $('#joinCall').addEventListener('click',beginCall);$('#endCall').addEventListener('click',()=>finishCall(true));$('#toggleMute').addEventListener('click',()=>{const track=localStream?.getAudioTracks()[0];if(!track)return;track.enabled=!track.enabled;$('#toggleMute').textContent=track.enabled?'Mute':'Unmute';});$('#toggleCamera').addEventListener('click',()=>{const track=localStream?.getVideoTracks()[0];if(!track)return;track.enabled=!track.enabled;$('#toggleCamera').textContent=track.enabled?'Camera Off':'Camera On';});
  await Promise.all([refreshWallet(),loadRequests()]);setInterval(()=>{loadRequests();refreshWallet();},5000);
}
init().catch(error=>setCallStatus(error.message||'Calls could not load.','error'));
