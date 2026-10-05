import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const origins=new Set(["https://itscamillemonroe.art","https://www.itscamillemonroe.art"]);
const PRODUCT_KEY="documentation_starter_kit_v1";

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
async function getProduct(admin:any){
  const {data,error}=await admin.from("admin_education_products")
    .select("product_key,title,subtitle,price_cents,currency,version,active,content")
    .eq("product_key",PRODUCT_KEY).single();
  if(error||!data?.active)throw new Error("Product is not available.");
  return data;
}
async function stripeSession(stripe:string,sessionId:string){
  const response=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,{
    headers:{"Authorization":`Bearer ${stripe}`}
  });
  const data=await response.json().catch(()=>({}));
  return {response,data};
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
    const product=await getProduct(admin);

    const body=await req.json().catch(()=>({}));
    const action=typeof body.action==="string"?body.action:"";

    if(action==="create_checkout"){
      const form=new URLSearchParams();
      form.set("mode","payment");
      form.set("line_items[0][price_data][currency]",String(product.currency||"USD").toLowerCase());
      form.set("line_items[0][price_data][unit_amount]",String(product.price_cents));
      form.set("line_items[0][price_data][product_data][name]",String(product.title));
      form.set("line_items[0][price_data][product_data][description]",String(product.subtitle));
      form.set("line_items[0][quantity]","1");
      form.set("metadata[offer]",PRODUCT_KEY);
      form.set("metadata[product_key]",PRODUCT_KEY);
      form.set("payment_intent_data[metadata][offer]",PRODUCT_KEY);
      form.set("success_url","https://itscamillemonroe.art/admin-education/starter-kit/access/?session_id={CHECKOUT_SESSION_ID}");
      form.set("cancel_url","https://itscamillemonroe.art/admin-education/starter-kit/?payment=cancelled");

      const stripeRes=await fetch("https://api.stripe.com/v1/checkout/sessions",{
        method:"POST",
        headers:{"Authorization":`Bearer ${stripe}`,"Content-Type":"application/x-www-form-urlencoded"},
        body:form.toString()
      });
      const session=await stripeRes.json().catch(()=>({}));
      if(!stripeRes.ok||!session?.url){
        console.error("admin kit checkout failed",session?.error?.type||"unknown",session?.error?.code||"");
        return reply(req,{error:"Secure checkout could not start. Please try again."},502);
      }
      return reply(req,{checkout_url:String(session.url),price_cents:product.price_cents,currency:product.currency});
    }

    if(action==="access"){
      const sessionId=typeof body.session_id==="string"?body.session_id.trim():"";
      const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
      if(!/^cs_(test_|live_)?[A-Za-z0-9_]+$/.test(sessionId))return reply(req,{error:"A valid Stripe purchase session is required."},400);
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply(req,{error:"Enter the email address used at checkout."},400);

      let {data:purchase}=await admin.from("admin_education_purchases")
        .select("id,buyer_email,amount_cents,currency,status,purchased_at,access_count")
        .eq("stripe_session_id",sessionId).maybeSingle();

      if(!purchase){
        const {response,data:session}=await stripeSession(stripe,sessionId);
        const buyerEmail=String(session?.customer_details?.email||session?.customer_email||"").trim().toLowerCase();
        const valid=response.ok &&
          session?.payment_status==="paid" &&
          session?.metadata?.offer===PRODUCT_KEY &&
          Number(session?.amount_total)===Number(product.price_cents) &&
          String(session?.currency||"").toLowerCase()===String(product.currency||"USD").toLowerCase() &&
          buyerEmail;
        if(!valid)return reply(req,{error:"Payment could not be verified for this product."},403);

        const {error:recordError}=await admin.rpc("record_admin_education_purchase",{
          p_stripe_session_id:sessionId,
          p_product_key:PRODUCT_KEY,
          p_buyer_email:buyerEmail,
          p_amount_cents:Number(product.price_cents),
          p_currency:String(product.currency||"USD")
        });
        if(recordError)throw recordError;

        ({data:purchase}=await admin.from("admin_education_purchases")
          .select("id,buyer_email,amount_cents,currency,status,purchased_at,access_count")
          .eq("stripe_session_id",sessionId).single());
      }

      if(!purchase||purchase.status!=="paid"||String(purchase.buyer_email||"").toLowerCase()!==email){
        return reply(req,{error:"That email does not match the verified purchase."},403);
      }

      await admin.from("admin_education_purchases")
        .update({access_count:Number(purchase.access_count||0)+1,last_access_at:new Date().toISOString()})
        .eq("id",purchase.id);

      return reply(req,{
        product_key:product.product_key,
        title:product.title,
        subtitle:product.subtitle,
        version:product.version,
        purchased_at:purchase.purchased_at,
        content:product.content
      });
    }

    return reply(req,{error:"Unknown action."},400);
  }catch(error){
    console.error("public-admin-kit failed",error instanceof Error?error.message:"unknown");
    return reply(req,{error:"The starter kit is temporarily unavailable."},500);
  }
});