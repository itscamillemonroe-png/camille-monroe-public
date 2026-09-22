import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(
  JSON.stringify({ error: "This verification webhook is retired. The Camille Monroe member site is SFW-only." }),
  { status: 410, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
));
