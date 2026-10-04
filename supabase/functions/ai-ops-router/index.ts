import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Sensitivity = "public"|"internal"|"restricted";
type Task = "offer"|"pricing"|"localize"|"review"|"market"|"collectible"|"general";

const JSON_HEADERS={"Content-Type":"application/json","Cache-Control":"no-store"};

const FAMILIES=[
 {id:"openai",region:"global",roles:["primary","offer","pricing","review"]},
 {id:"anthropic",region:"global",roles:["review","editorial","analysis"]},
 {id:"google",region:"global",roles:["multimodal","localize","review"]},
 {id:"xai",region:"global",roles:["market","creative","review"]},
 {id:"meta",region:"global",roles:["classify","experiment"]},
 {id:"deepseek",region:"china-global",roles:["zh-localize","reason","review"]},
 {id:"qwen",region:"china-global",roles:["zh-localize","localize","review"]},
 {id:"kimi",region:"china-global",roles:["zh-localize","long-context","review"]},
] as const;

const BLOCKED_HINTS=[
 "password","api key","secret key","access token","credit card","card number","bank account",
 "social security","ssn","medical record","court record","cps","child's","minor's","government id"
];

function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});}
function hasRestrictedText(s:string){const x=s.toLowerCase();return BLOCKED_HINTS.some(k=>x.includes(k));}
function choose(task:Task,language:string){
 const zh=/^(zh|cmn|yue)/i.test(language);
 if(zh) return {primary:"qwen",reviewer:"deepseek",fallback:"kimi"};
 if(task==="localize") return {primary:"google",reviewer:"anthropic",fallback:"openai"};
 if(task==="review") return {primary:"anthropic",reviewer:"openai",fallback:"google"};
 if(task==="market") return {primary:"openai",reviewer:"xai",fallback:"google"};
 return {primary:"openai",reviewer:"anthropic",fallback:"google"};
}

Deno.serve(async(req:Request)=>{
 if(req.method!=="POST") return json({error:"POST required"},405);
 let body:any; try{body=await req.json();}catch{return json({error:"Invalid JSON"},400);}
 const task=(body.task||"general") as Task;
 const language=String(body.language||"en");
 const sensitivity=(body.sensitivity||"public") as Sensitivity;
 const prompt=String(body.prompt||"").trim();
 if(!prompt) return json({error:"prompt required"},400);
 if(prompt.length>20000) return json({error:"prompt too large"},413);
 if(sensitivity==="restricted"||hasRestrictedText(prompt)){
   return json({error:"restricted_content_not_routable",message:"Restricted/private material is blocked from multi-provider routing."},422);
 }
 const route=choose(task,language);
 // Provider execution is intentionally disabled until server-side provider/gateway credentials are configured.
 return json({
   ok:true,
   mode:"routing_ready_execution_locked",
   task,language,sensitivity,route,
   available_families:FAMILIES.map(x=>x.id),
   next:"Configure approved server-side provider/gateway credentials, then enable execution. Never place provider secrets in browser code."
 });
});