import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const allowedOrigins=new Set(["https://itscamillemonroe.art","https://www.itscamillemonroe.art"]);
const allowedEvents=new Set(["view","click"]);
const clip=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";

function cors(req:Request){
  const origin=req.headers.get("origin")||"";
  return {
    ...(allowedOrigins.has(origin)?{"Access-Control-Allow-Origin":origin}:{}),
    "Access-Control-Allow-Headers":"content-type, apikey, authorization",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Vary":"Origin"
  };
}
function json(req:Request,body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:{...cors(req),"Content-Type":"application/json","Cache-Control":"no-store"}});
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors(req)});
  if(req.method!=="POST") return json(req,{ok:false},405);
  const origin=req.headers.get("origin")||"";
  if(!allowedOrigins.has(origin)) return json(req,{ok:false},403);

  try{
    const body=await req.json().catch(()=>({}));
    const slug=clip(body.slug,120);
    const eventType=clip(body.event_type,16);
    if(!slug || !allowedEvents.has(eventType)) return json(req,{ok:false},400);

    const url=Deno.env.get("SUPABASE_URL")||"";
    const secrets=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
    const serviceKey=secrets.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
    if(!url||!serviceKey) return json(req,{ok:false},503);

    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:cover,error:coverError}=await admin
      .from("revenue_visual_covers")
      .select("id,lane_no")
      .eq("slug",slug)
      .eq("active",true)
      .maybeSingle();
    if(coverError) throw coverError;
    if(!cover) return json(req,{ok:false},404);

    const {error}=await admin.from("revenue_cover_events").insert({
      cover_id:cover.id,
      lane_no:cover.lane_no,
      event_type:eventType,
      source:clip(body.source,120)||null,
      medium:clip(body.medium,120)||null,
      campaign:clip(body.campaign,120)||null,
      referrer_host:clip(body.referrer_host,160)||null
    });
    if(error) throw error;
    return new Response(null,{status:204,headers:cors(req)});
  }catch(error){
    console.error("track-revenue-cover-event failed",error instanceof Error?error.message:"unknown");
    return json(req,{ok:false},500);
  }
});