import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(() => new Response(JSON.stringify({ok:false,staging:true,test:true,disabled:true,message:"Temporary Channex STAGING pending-inbox processor disabled after direct webhook flow certification."}),{status:410,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}}));
