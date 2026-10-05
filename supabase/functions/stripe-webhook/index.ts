import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

function supabaseKeys(){
  const secret=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
  return {serviceKey:secret.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""};
}
function hex(bytes:ArrayBuffer){
  return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function constantTimeEqual(a:string,b:string){
  if(a.length!==b.length)return false;
  let out=0;
  for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);
  return out===0;
}
async function verifySignature(raw:string,header:string,secret:string){
  const fields=header.split(",").map(x=>x.trim().split("="));
  const t=fields.find(([k])=>k==="t")?.[1]||"";
  const sigs=fields.filter(([k])=>k==="v1").map(([,v])=>v);
  if(!t||!sigs.length)return false;
  const ts=Number(t);
  if(!Number.isFinite(ts)||Math.abs(Date.now()/1000-ts)>300)return false;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(`${t}.${raw}`));
  const expected=hex(digest);
  return sigs.some(sig=>constantTimeEqual(sig,expected));
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return new Response("method not allowed",{status:405});
  try{
    const url=Deno.env.get("SUPABASE_URL")||"";
    const {serviceKey}=supabaseKeys();
    if(!url||!serviceKey)return new Response("configuration incomplete",{status:503});
    const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
    let webhookSecret=Deno.env.get("STRIPE_WEBHOOK_SECRET")||"";
    if(!webhookSecret){
      const {data:vaultWebhookSecret}=await admin.rpc("get_payment_provider_secret",{secret_name:"stripe_webhook_secret"});
      if(typeof vaultWebhookSecret==="string")webhookSecret=vaultWebhookSecret;
    }
    if(!webhookSecret)return new Response("webhook not configured",{status:503});

    const raw=await req.text();
    const signature=req.headers.get("stripe-signature")||"";
    if(!await verifySignature(raw,signature,webhookSecret))return new Response("invalid signature",{status:400});
    const event=JSON.parse(raw);

    const session=event?.data?.object||{};
    const orderId=session?.metadata?.order_id||session?.client_reference_id||"";

    if(event?.type==="checkout.session.completed"||event?.type==="checkout.session.async_payment_succeeded"){
      if(session.payment_status==="paid" && session?.metadata?.offer==="digital_collectible_001"){
        const valid = session?.metadata?.media_id==="8a804cf9-3a90-4f79-a6e0-dd35a555e95b" &&
          /^cs_(test_|live_)?[A-Za-z0-9_]+$/.test(String(session.id||"")) &&
          Number(session.amount_total)===2500 &&
          String(session.currency||"").toLowerCase()==="usd";
        if(!valid)return new Response("invalid collectible purchase",{status:400});
        const {data:purchaseRows,error:purchaseError}=await admin.rpc("record_collectible_purchase",{
          p_stripe_session_id:String(session.id),
          p_offer_key:"digital_collectible_001",
          p_media_id:"8a804cf9-3a90-4f79-a6e0-dd35a555e95b",
          p_buyer_email:String(session?.customer_details?.email||session?.customer_email||"").trim(),
          p_amount_cents:2500,
          p_currency:"usd"
        });
        if(purchaseError)throw purchaseError;
        if(!Array.isArray(purchaseRows)||!purchaseRows[0]?.edition_number)throw new Error("Collectible purchase record missing.");
        const {data:collectibleTreasury}=await admin.from("treasury_reconciliation")
          .select("id").eq("source_provider","stripe").eq("source_reference",String(event.id)).maybeSingle();
        if(!collectibleTreasury){
          await admin.from("treasury_reconciliation").insert({
            payment_order_id:null,
            source_provider:"stripe",
            source_reference:String(event.id),
            gross_amount_cents:2500,
            fees_cents:0,
            net_amount_cents:null,
            source_currency:"USD",
            settlement_stage:"provider_confirmed",
            destination_mask:"••••2609",
            evidence_reference:String(session.id||event.id),
            notes:"Stripe confirmed Digital Collectible No. 001 payment. Bluevine bank settlement remains pending until bank-side evidence is observed."
          });
        }
        return new Response("ok",{status:200});
      }
      if(session.payment_status==="paid" && session?.metadata?.offer==="documentation_starter_kit_v1"){
        const buyerEmail=String(session?.customer_details?.email||session?.customer_email||"").trim();
        const valid=/^cs_(test_|live_)?[A-Za-z0-9_]+$/.test(String(session.id||"")) &&
          Number(session.amount_total)===1900 &&
          String(session.currency||"").toLowerCase()==="usd" &&
          buyerEmail;
        if(!valid)return new Response("invalid starter kit purchase",{status:400});
        const {error:purchaseError}=await admin.rpc("record_admin_education_purchase",{
          p_stripe_session_id:String(session.id),
          p_product_key:"documentation_starter_kit_v1",
          p_buyer_email:buyerEmail,
          p_amount_cents:1900,
          p_currency:"USD"
        });
        if(purchaseError)throw purchaseError;
        const {data:adminTreasury}=await admin.from("treasury_reconciliation")
          .select("id").eq("source_provider","stripe").eq("source_reference",String(event.id)).maybeSingle();
        if(!adminTreasury){
          await admin.from("treasury_reconciliation").insert({
            payment_order_id:null,
            source_provider:"stripe",
            source_reference:String(event.id),
            gross_amount_cents:1900,
            fees_cents:0,
            net_amount_cents:null,
            source_currency:"USD",
            settlement_stage:"provider_confirmed",
            destination_mask:"••••2609",
            evidence_reference:String(session.id||event.id),
            notes:"Stripe confirmed Documentation Workflow Starter Kit payment. Bluevine bank settlement remains pending until bank-side evidence is observed."
          });
        }
        return new Response("ok",{status:200});
      }
      if(session.payment_status==="paid" && orderId){
        const {error:fulfillError}=await admin.rpc("fulfill_paid_order",{target_order_id:orderId});
        if(fulfillError && !String(fulfillError.message||"").includes("already")) throw fulfillError;

        const {data:existing}=await admin.from("treasury_reconciliation")
          .select("id").eq("source_provider","stripe").eq("source_reference",String(event.id)).maybeSingle();
        if(!existing){
          await admin.from("treasury_reconciliation").insert({
            payment_order_id:orderId,
            source_provider:"stripe",
            source_reference:String(event.id),
            gross_amount_cents:Number(session.amount_total||0),
            fees_cents:null,
            net_amount_cents:null,
            source_currency:String(session.currency||"usd").toUpperCase(),
            settlement_stage:"provider_confirmed",
            destination_mask:"••••2609",
            evidence_reference:String(session.id||event.id),
            notes:"Stripe confirmed customer payment. Bluevine bank settlement remains pending until bank-side evidence is observed."
          });
        }
      }
    }else if(event?.type==="checkout.session.async_payment_failed" && orderId){
      await admin.from("payment_orders")
        .update({
          status:"failed",
          provider_order_id:String(session.id||"")||null,
          updated_at:new Date().toISOString()
        })
        .eq("id",orderId)
        .eq("provider","stripe")
        .in("status",["created","pending"]);
    }else if(event?.type==="checkout.session.expired" && orderId){
      await admin.from("payment_orders")
        .update({
          status:"cancelled",
          provider_order_id:String(session.id||"")||null,
          updated_at:new Date().toISOString()
        })
        .eq("id",orderId)
        .eq("provider","stripe")
        .in("status",["created","pending"]);
    }
    return new Response("ok",{status:200});
  }catch(error){
    console.error("stripe-webhook failed",error instanceof Error?error.message:"unknown");
    return new Response("error",{status:500});
  }
});