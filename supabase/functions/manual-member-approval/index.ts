import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const allowedOrigins=new Set(["https://itscamillemonroe.art","https://www.itscamillemonroe.art"]);
function cors(req:Request){
  const origin=req.headers.get("origin")||"";
  return {
    ...(allowedOrigins.has(origin)?{"Access-Control-Allow-Origin":origin}:{}),
    "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Vary":"Origin"
  };
}
function json(req:Request,body:unknown,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{...cors(req),"Content-Type":"application/json","Cache-Control":"no-store"}
  });
}
function keys(){
  const pub=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");
  const sec=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
  return {
    publishable:pub.default||Deno.env.get("SUPABASE_ANON_KEY")||"",
    secret:sec.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""
  };
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
  if(req.method!=="POST")return json(req,{error:"Method not allowed."},405);

  try{
    const auth=req.headers.get("Authorization")||"";
    const token=auth.startsWith("Bearer ")?auth.slice(7):"";
    if(!token)return json(req,{error:"Sign in is required."},401);

    const url=Deno.env.get("SUPABASE_URL")||"";
    const {publishable,secret}=keys();
    if(!url||!publishable||!secret)throw new Error("Function configuration is incomplete.");

    const userClient=createClient(url,publishable,{
      global:{headers:{Authorization:auth}},
      auth:{persistSession:false,autoRefreshToken:false}
    });
    const {data:userData,error:userError}=await userClient.auth.getUser(token);
    if(userError||!userData.user)return json(req,{error:"Your sign-in is no longer valid."},401);

    const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:owner}=await admin
      .from("member_profiles")
      .select("user_id")
      .eq("user_id",userData.user.id)
      .eq("is_admin",true)
      .maybeSingle();
    if(!owner)return json(req,{error:"Owner access required."},403);

    const body=await req.json().catch(()=>({}));
    const action=typeof body.action==="string"?body.action:"list";

    if(action==="list"){
      const requested=typeof body.status==="string"?body.status:"pending";
      const status=requested==="rejected"?"denied":["pending","approved","denied"].includes(requested)?requested:"pending";
      const {data:members,error}=await admin
        .from("member_profiles")
        .select("user_id,full_name,email,age_confirmed,status,approved_content_scope,profile_photo_path,profile_photo_uploaded_at,created_at,reviewed_at")
        .eq("is_admin",false)
        .eq("status",status)
        .order("created_at",{ascending:true});
      if(error)throw error;
      return json(req,{members:members||[],status_filter:status});
    }

    if(action==="decide"){
      const targetUserId=typeof body.user_id==="string"?body.user_id:"";
      const requested=body.decision==="rejected"?"denied":body.decision;
      const decision=requested==="approved"||requested==="denied"?requested:"";
      if(!targetUserId||!decision)return json(req,{error:"Member and approval decision are required."},400);

      const {data:profile,error:profileError}=await admin
        .from("member_profiles")
        .select("user_id,profile_photo_path")
        .eq("user_id",targetUserId)
        .eq("is_admin",false)
        .maybeSingle();
      if(profileError)throw profileError;
      if(!profile)return json(req,{error:"Member profile not found."},404);
      if(decision==="approved"&&!profile.profile_photo_path){
        return json(req,{error:"A member profile picture is required before approval."},409);
      }

      const reviewedAt=new Date().toISOString();
      const changes=decision==="approved"?{
        status:"approved",
        reviewed_at:reviewedAt,
        reviewed_by:userData.user.id,
        approval_basis:"owner_discretion",
        approved_content_scope:"sfw_member"
      }:{
        status:"denied",
        reviewed_at:reviewedAt,
        reviewed_by:userData.user.id,
        approval_basis:"owner_discretion",
        approved_content_scope:"none"
      };

      const {data:updated,error:updateError}=await admin
        .from("member_profiles")
        .update(changes)
        .eq("user_id",targetUserId)
        .eq("is_admin",false)
        .select("user_id,full_name,email,status,approved_content_scope,reviewed_at,reviewed_by")
        .maybeSingle();
      if(updateError)throw updateError;

      return json(req,{
        member:updated,
        manual_approval:true,
        message:decision==="approved"
          ?"Member approved for the SFW member experience."
          :"Member request denied."
      });
    }

    return json(req,{error:"Unknown action."},400);
  }catch(error){
    console.error("manual-member-approval failed",error instanceof Error?error.message:"unknown");
    return json(req,{error:"Manual approval is temporarily unavailable."},500);
  }
});