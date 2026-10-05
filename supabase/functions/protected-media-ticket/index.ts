import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(
  JSON.stringify({
    error: "Legacy adult-content protected-session delivery is retired. Camille Monroe production is SFW-only."
  }),
  {
    status: 410,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  }
));
