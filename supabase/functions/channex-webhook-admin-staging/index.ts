import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(() => new Response(JSON.stringify({ok:false,staging:true,test:true,disabled:true,message:"Temporary Channex STAGING webhook registration helper disabled after webhook registration completed."}),{status:410,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}}));
