import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const origins=new Set([
  "https://itscamillemonroe.art",
  "https://www.itscamillemonroe.art"
]);
const cors=(req:Request)=>{const o=req.headers.get("origin")||"";return {...(origins.has(o)?{"Access-Control-Allow-Origin":o}:{}),"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}};
const reply=(req:Request,b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors(req),"Content-Type":"application/json","Cache-Control":"no-store"}});
const safe=(v:unknown,n=120)=>typeof v==="string"?v.trim().slice(0,n):"";
const attr=(v:unknown)=>{const x=v&&typeof v==="object"?v as Record<string,unknown>:{};return {source:safe(x.source),medium:safe(x.medium),campaign:safe(x.campaign),content:safe(x.content),term:safe(x.term),referrer_host:safe(x.referrer_host,160),landing_path:safe(x.landing_path,180)}};
const keys=()=>{const p=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");const s=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");return {pub:p.default||Deno.env.get("SUPABASE_ANON_KEY")||"",secret:s.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""}};

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
  if(req.method!=="POST")return reply(req,{error:"Method not allowed."},405);
  try{
    const origin=req.headers.get("origin")||"";
    if(!origins.has(origin))return reply(req,{error:"Checkout origin is not allowed."},403);

    const auth=req.headers.get("Authorization")||"";
    const token=auth.startsWith("Bearer ")?auth.slice(7):"";
    if(!token)return reply(req,{error:"Sign in is required."},401);

    const url=Deno.env.get("SUPABASE_URL")||"";
    const {pub,secret}=keys();
    if(!url||!pub||!secret)return reply(req,{error:"Checkout configuration is incomplete."},503);

    const uc=createClient(url,pub,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:ud,error:ue}=await uc.auth.getUser(token);
    if(ue||!ud.user)return reply(req,{error:"Your sign-in is no longer valid."},401);

    const body=await req.json().catch(()=>({}));
    const productId=typeof body.product_id==="string"?body.product_id:"";
    const preference="card_ach";
    const attribution=attr(body.attribution);
    if(!productId)return reply(req,{error:"Choose a payment option."},400);

    const admin=createClient(url,secret,{auth:{persistSession:false}});
    const [{data:routing},{data:profile},{data:product},{data:settings},{data:sub},{data:stripeRoute}] = await Promise.all([
      admin.from("payment_provider_routing").select("*").eq("id",1).single(),
      admin.from("member_profiles").select("status,is_admin,profile_photo_path").eq("user_id",ud.user.id).single(),
      admin.from("payment_products").select("id,name,description,product_type,price_cents,currency,active").eq("id",productId).single(),
      admin.from("payment_settings").select("checkout_enabled").eq("id",1).single(),
      admin.from("member_subscriptions").select("access_until").eq("user_id",ud.user.id).maybeSingle(),
      admin.from("stripe_product_routes").select("stripe_price_id,stripe_payment_link_url,active").eq("product_id",productId).maybeSingle()
    ]);

    if(!profile||profile.is_admin||profile.status!=="approved"||!profile.profile_photo_path)return reply(req,{error:"A submitted profile picture and Camille's approval are required."},403);
    if(!product||!product.active||!settings?.checkout_enabled)return reply(req,{error:"This payment option is not available yet."},409);

    const active=Boolean(sub?.access_until&&new Date(sub.access_until)>new Date());
    if(["credit_pack","content_unlock","tip"].includes(product.product_type)&&!active)return reply(req,{error:"Active membership is required for this member purchase."},403);

    let stripeSecret=Deno.env.get("STRIPE_SECRET_KEY")||"";
    if(!stripeSecret){
      const {data:vaultStripeSecret}=await admin.rpc("get_payment_provider_secret",{secret_name:"stripe_secret_key"});
      if(typeof vaultStripeSecret==="string")stripeSecret=vaultStripeSecret;
    }
    let webhookReady=false;
    try{
      const {data:vaultWebhookSecret}=await admin.rpc("get_payment_provider_secret",{secret_name:"stripe_webhook_secret"});
      webhookReady=typeof vaultWebhookSecret==="string"&&vaultWebhookSecret.trim().startsWith("whsec_");
    }catch{
      webhookReady=false;
    }
    const cardReady=Boolean(
      routing?.card_ach_enabled &&
      routing?.primary_provider==="bluevine_stripe" &&
      routing?.primary_status==="active" &&
      stripeRoute?.active &&
      stripeRoute?.stripe_price_id &&
      (stripeRoute?.stripe_payment_link_url || stripeSecret) &&
      webhookReady
    );
    if(!cardReady){
      const missing = !routing?.card_ach_enabled ? "routing_disabled"
        : routing?.primary_provider!=="bluevine_stripe" ? "provider_mismatch"
        : routing?.primary_status!=="active" ? "routing_inactive"
        : !stripeRoute?.active ? "product_route_inactive"
        : !stripeRoute?.stripe_price_id ? "stripe_price_missing"
        : !stripeRoute?.stripe_payment_link_url && !stripeSecret ? "stripe_checkout_route_missing"
        : !webhookReady ? "stripe_webhook_secret_missing"
        : "unknown";
      return reply(req,{error:"Card checkout configuration needs attention.",diagnostic:missing},503);
    }

    const {data:order,error:oe}=await admin.from("payment_orders").insert({
      user_id:ud.user.id,
      product_id:product.id,
      provider:"stripe",
      amount_cents:product.price_cents,
      currency:product.currency,
      status:"pending"
    }).select("id").single();
    if(oe||!order)throw new Error("Payment order could not be created.");

    await admin.from("payment_order_attribution").upsert({
      order_id:order.id,
      source:attribution.source||"direct",
      medium:attribution.medium||"none",
      campaign:attribution.campaign||null,
      content:attribution.content||null,
      term:attribution.term||null,
      referrer_host:attribution.referrer_host||null,
      landing_path:attribution.landing_path||null
    },{onConflict:"order_id"});

    if(stripeRoute?.stripe_payment_link_url){
      const checkoutUrl=new URL(String(stripeRoute.stripe_payment_link_url));
      checkoutUrl.searchParams.set("client_reference_id",String(order.id));
      return reply(req,{
        checkout_url:checkoutUrl.toString(),
        order_id:order.id,
        provider:"bluevine_stripe",
        payment_method:"card_ach"
      });
    }

    const form=new URLSearchParams();
    form.set("mode","payment");
    form.set("line_items[0][price]",String(stripeRoute.stripe_price_id));
    form.set("line_items[0][quantity]","1");
    form.set("client_reference_id",String(order.id));
    form.set("metadata[order_id]",String(order.id));
    form.set("metadata[product_id]",String(product.id));
    form.set("success_url","https://itscamillemonroe.art/member/?payment=success&session_id={CHECKOUT_SESSION_ID}");
    form.set("cancel_url","https://itscamillemonroe.art/member/?payment=cancelled");
    if(ud.user.email)form.set("customer_email",ud.user.email);

    const stripeRes=await fetch("https://api.stripe.com/v1/checkout/sessions",{
      method:"POST",
      headers:{"Authorization":`Bearer ${stripeSecret}`,"Content-Type":"application/x-www-form-urlencoded"},
      body:form.toString()
    });
    const session=await stripeRes.json().catch(()=>({}));
    if(!stripeRes.ok||!session?.url){
      await admin.from("payment_orders").update({status:"failed"}).eq("id",order.id);
      console.error("Stripe Checkout Session failed",session?.error?.type||"unknown",session?.error?.code||"");
      return reply(req,{error:"Card / wallet checkout could not start. Crypto is available now."},502);
    }
    await admin.from("payment_orders").update({provider_order_id:String(session.id)}).eq("id",order.id);
    return reply(req,{
      checkout_url:String(session.url),
      order_id:order.id,
      provider:"bluevine_stripe",
      payment_method:"card_ach"
    });
  }catch(e){
    console.error("create-checkout failed",e instanceof Error?e.message:"unknown");
    return reply(req,{error:"Checkout is temporarily unavailable."},500);
  }
});