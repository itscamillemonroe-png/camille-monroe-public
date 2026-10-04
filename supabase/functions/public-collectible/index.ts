import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const origins = new Set(["https://itscamillemonroe.art","https://www.itscamillemonroe.art"]);
const OFFER = "digital_collectible_001";
const MEDIA_ID = "8a804cf9-3a90-4f79-a6e0-dd35a555e95b";
const PRICE_CENTS = 2500;

const cors=(req:Request)=>{
  const origin=req.headers.get("origin")||"";
  return {
    ...(origins.has(origin)?{"Access-Control-Allow-Origin":origin}:{}),
    "Access-Control-Allow-Headers":"content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Content-Type":"application/json",
    "Cache-Control":"no-store",
    "Vary":"Origin"
  };
};
const reply=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors(req)});
function keys(){
  const secret=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
  return {serviceKey:secret.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""};
}
async function stripeSecret(admin:any){
  let secret=Deno.env.get("STRIPE_SECRET_KEY")||"";
  if(!secret){
    const {data}=await admin.rpc("get_payment_provider_secret",{secret_name:"stripe_secret_key"});
    if(typeof data==="string")secret=data;
  }
  return secret;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
  if(req.method!=="POST")return reply(req,{error:"Method not allowed."},405);
  const origin=req.headers.get("origin")||"";
  if(!origins.has(origin))return reply(req,{error:"Request origin is not allowed."},403);

  try{
    const url=Deno.env.get("SUPABASE_URL")||"";
    const {serviceKey}=keys();
    if(!url||!serviceKey)return reply(req,{error:"Store configuration is incomplete."},503);
    const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
    const stripe=await stripeSecret(admin);
    if(!stripe)return reply(req,{error:"Secure checkout is temporarily unavailable."},503);

    const body=await req.json().catch(()=>({}));
    const action=typeof body.action==="string"?body.action:"";

    if(action==="create_checkout"){
      const {data:assetRows,error:assetError}=await admin.rpc("public_collectible_asset_status");
      const asset=Array.isArray(assetRows)?assetRows[0]:null;
      if(assetError||!asset){
        console.error("collectible rights gate",assetError?.message||"asset unavailable");
        return reply(req,{error:"This collectible is not available for sale."},409);
      }

      const form=new URLSearchParams();
      form.set("mode","payment");
      form.set("line_items[0][price_data][currency]","usd");
      form.set("line_items[0][price_data][unit_amount]",String(PRICE_CENTS));
      form.set("line_items[0][price_data][product_data][name]","Camille Monroe — Digital Collectible No. 001");
      form.set("line_items[0][price_data][product_data][description]","One rights-cleared SFW Camille Monroe digital collectible image. Personal-use download; no resale or sublicensing.");
      form.set("line_items[0][quantity]","1");
      form.set("metadata[offer]",OFFER);
      form.set("metadata[media_id]",MEDIA_ID);
      form.set("payment_intent_data[metadata][offer]",OFFER);
      form.set("success_url","https://itscamillemonroe.art/collectible/001/?payment=success&session_id={CHECKOUT_SESSION_ID}");
      form.set("cancel_url","https://itscamillemonroe.art/collectible/001/?payment=cancelled");

      const stripeRes=await fetch("https://api.stripe.com/v1/checkout/sessions",{
        method:"POST",
        headers:{"Authorization":`Bearer ${stripe}`,"Content-Type":"application/x-www-form-urlencoded"},
        body:form.toString()
      });
      const session=await stripeRes.json().catch(()=>({}));
      if(!stripeRes.ok||!session?.url){
        console.error("public collectible checkout failed",session?.error?.type||"unknown",session?.error?.code||"");
        return reply(req,{error:"Secure checkout could not start. Please try again."},502);
      }
      return reply(req,{checkout_url:String(session.url)});
    }

    if(action==="delivery"){
      const sessionId=typeof body.session_id==="string"?body.session_id.trim():"";
      if(!/^cs_(test_|live_)?[A-Za-z0-9_]+$/.test(sessionId))return reply(req,{error:"A valid purchase session is required."},400);
      const stripeRes=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,{
        headers:{"Authorization":`Bearer ${stripe}`}
      });
      const session=await stripeRes.json().catch(()=>({}));
      const valid = stripeRes.ok &&
        session?.payment_status==="paid" &&
        session?.metadata?.offer===OFFER &&
        session?.metadata?.media_id===MEDIA_ID &&
        Number(session?.amount_total)===PRICE_CENTS &&
        String(session?.currency||"").toLowerCase()==="usd";
      if(!valid)return reply(req,{error:"Payment could not be verified for this collectible."},403);

      const {data:assetRows,error:assetError}=await admin.rpc("public_collectible_asset_status");
      const asset=Array.isArray(assetRows)?assetRows[0]:null;
      if(assetError||!asset)return reply(req,{error:"Delivery is temporarily unavailable."},409);
      const buyerEmail=String(session?.customer_details?.email||session?.customer_email||"").trim();
      const {data:purchaseRows,error:purchaseError}=await admin.rpc("record_collectible_purchase",{
        p_stripe_session_id:sessionId,
        p_offer_key:OFFER,
        p_media_id:MEDIA_ID,
        p_buyer_email:buyerEmail,
        p_amount_cents:PRICE_CENTS,
        p_currency:"usd"
      });
      if(purchaseError)throw purchaseError;
      const purchase=Array.isArray(purchaseRows)?purchaseRows[0]:null;
      const {data,error}=await admin.storage.from("protected-media").createSignedUrl(asset.storage_path,600,{download:"Camille-Monroe-Digital-Collectible-001.png"});
      if(error||!data?.signedUrl)throw error||new Error("Signed delivery URL missing.");
      return reply(req,{
        download_url:data.signedUrl,
        expires_in:600,
        title:"Camille Monroe — Digital Collectible No. 001",
        edition_number:purchase?.edition_number||null,
        license:"Personal use only. No resale, redistribution, sublicensing, or commercial reuse."
      });
    }

    return reply(req,{error:"Unknown action."},400);
  }catch(error){
    console.error("public-collectible failed",error instanceof Error?error.message:"unknown");
    return reply(req,{error:"The store is temporarily unavailable."},500);
  }
});