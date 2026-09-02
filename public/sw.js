const VERSION="hl-pwa-1"

self.addEventListener("install",()=>self.skipWaiting())

self.addEventListener("activate",event=>{
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET"||event.request.mode!=="navigate")return

  event.respondWith(
    fetch(event.request).catch(()=>new Response(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#ffffff"><title>Habitación Llena · Sin conexión</title><style>html,body{height:100%}body{margin:0;display:grid;place-items:center;background:#f6f7f9;color:#263247;font:15px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.box{max-width:360px;margin:24px;padding:22px;border:1px solid #e3e7ec;border-radius:16px;background:#fff;text-align:center}.logo{width:44px;height:44px;display:grid;place-items:center;margin:0 auto 14px;border-radius:12px;background:#1f2d40;color:#fff;font-weight:900}.box h1{margin:0;font-size:19px}.box p{margin:8px 0 0;color:#7f8b99;line-height:1.5}</style></head><body><main class="box"><div class="logo">HL</div><h1>Sin conexión</h1><p>Habitación Llena necesita internet para actualizar los datos del hotel. Volvé a intentar cuando se restablezca la conexión.</p></main></body></html>`,
      {status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-HL-PWA":VERSION}}
    ))
  )
})
