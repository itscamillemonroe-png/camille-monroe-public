import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

function serviceKey(){
  const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
  return keys.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
}

function normalize(value:unknown):unknown{
  if(Array.isArray(value))return value.map(normalize);
  if(value&&typeof value==="object")return Object.keys(value as Record<string,unknown>).sort().reduce<Record<string,unknown>>((out,key)=>{out[key]=normalize((value as Record<string,unknown>)[key]);return out;},{});
  if(typeof value==="number"&&Number.isInteger(value))return Math.trunc(value);
  return value;
}

async function hmacHex(secret:string,message:string){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signature=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

function safeEqual(left:string,right:string){
  if(left.length!==right.length)return false;
  let difference=0;
  for(let index=0;index<left.length;index++)difference|=left.charCodeAt(index)^right.charCodeAt(index);
  return difference===0;
}

async function sha256(value:string){
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return new Response("Method not allowed",{status:405});
  try{
    const url=Deno.env.get("SUPABASE_URL")||"";
    const key=serviceKey();
    if(!url||!key)return new Response("Unavailable",{status:503});
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:webhookSecret,error:secretError}=await admin.rpc("get_verification_provider_secret",{secret_name:"didit_webhook_secret"});
    if(secretError||typeof webhookSecret!=="string"||!webhookSecret)return new Response("Unavailable",{status:503});

    const raw=await req.text();
    const payload=JSON.parse(raw) as Record<string,unknown>;
    const timestampHeader=req.headers.get("x-timestamp")||"";
    const timestamp=Number(timestampHeader);
    if(!timestampHeader||!Number.isFinite(timestamp)||Math.abs(Date.now()/1000-timestamp)>300)return new Response("Stale webhook",{status:401});
    const provided=(req.headers.get("x-signature-v2")||"").toLowerCase();
    const expected=await hmacHex(webhookSecret,JSON.stringify(normalize(payload)));
    if(!/^[a-f0-9]{64}$/.test(provided)||!safeEqual(provided,expected))return new Response("Invalid signature",{status:401});
    if(req.headers.get("x-didit-test-webhook")==="true")return new Response("ok",{status:200});
    if(String(payload.webhook_type||"")!=="status.updated")return new Response("ok",{status:200});

    const sessionId=String(payload.session_id||"");
    const userId=String(payload.vendor_data||"");
    const environment=String(payload.environment||"");
    const providerStatus=String(payload.status||"");
    if(!sessionId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)||environment!=="live")return new Response("ok",{status:200});

    let localStatus="pending";
    if(providerStatus==="Approved")localStatus="verified";
    else if(providerStatus==="Declined")localStatus="failed";
    else if(providerStatus==="Expired"||providerStatus==="Kyc Expired")localStatus="expired";
    else if(providerStatus==="Abandoned")localStatus="canceled";

    const now=new Date().toISOString();
    const referenceHash=await sha256(sessionId);
    await admin.from("verification_attempts").update({status:localStatus,...(localStatus!=="pending"?{completed_at:now}:{})}).eq("user_id",userId).eq("provider","didit").eq("provider_reference_hash",referenceHash);

    const {data:profile}=await admin.from("member_profiles").select("status,profile_photo_path,approved_content_scope").eq("user_id",userId).eq("is_admin",false).maybeSingle();
    if(!profile)return new Response("ok",{status:200});

    if(localStatus==="verified"){
      const fullyApproved=profile.status==="approved"&&Boolean(profile.profile_photo_path);
      await admin.from("member_profiles").update({
        verification_status:"verified",
        verification_provider:"didit",
        verification_checked_at:now,
        ...(fullyApproved?{approval_basis:"provider_verified",approved_content_scope:"adult_content"}:{})
      }).eq("user_id",userId).eq("is_admin",false);
    }else if(["failed","expired","canceled"].includes(localStatus)){
      await admin.from("member_profiles").update({
        verification_status:localStatus==="canceled"?"failed":localStatus,
        verification_provider:"didit",
        verification_checked_at:now,
        approval_basis:profile.status==="approved"?"owner_discretion":"unreviewed",
        approved_content_scope:profile.status==="approved"?"sfw_member":"none"
      }).eq("user_id",userId).eq("is_admin",false).neq("verification_status","verified");
    }
    return new Response("ok",{status:200});
  }catch(error){
    console.error("didit-webhook failed",error instanceof Error?error.message:"unknown");
    return new Response("Processing failed",{status:500});
  }
});
