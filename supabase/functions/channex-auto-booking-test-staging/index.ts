import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(() => new Response(JSON.stringify({ok:false,staging:true,test:true,disabled:true,message:"Automatic Channex STAGING E2E booking driver disabled after successful NEW/MODIFIED/CANCELLED certification."}),{status:410,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}}));
