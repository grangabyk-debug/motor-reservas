const SHELL_CACHE='habitacionllena-shell-v3'
const STATIC_CACHE='habitacionllena-static-v3'
const DATA_PREFIX='habitacionllena-data-v3-'
const CORE=['/','/login','/pms-next','/manifest.webmanifest','/icon.svg']

async function addSafe(cache,url){try{await cache.add(url)}catch{}}
async function hashText(value){const data=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',data);return Array.from(new Uint8Array(digest)).slice(0,8).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function scopedDataCache(request){const auth=request.headers.get('authorization')||'anonymous';return `${DATA_PREFIX}${await hashText(auth)}`}
async function trim(cacheName,max=180){const cache=await caches.open(cacheName),keys=await cache.keys();if(keys.length<=max)return;await Promise.all(keys.slice(0,keys.length-max).map(key=>cache.delete(key)))}

self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(SHELL_CACHE).then(cache=>Promise.all(CORE.map(url=>addSafe(cache,url))))})
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>(key.startsWith('habitacionllena-shell-')||key.startsWith('habitacionllena-static-')||key.startsWith('habitacionllena-data-'))&&![SHELL_CACHE,STATIC_CACHE].includes(key)&&!key.startsWith(DATA_PREFIX)).map(key=>caches.delete(key)));await self.clients.claim()})())})
self.addEventListener('message',event=>{if(event.data?.type!=='CACHE_PMS_SHELL')return;event.waitUntil((async()=>{const cache=await caches.open(SHELL_CACHE);await Promise.all(['/pms-next?view=dashboard','/pms-next?view=planning','/pms-next?view=reservations','/pms-next?view=guests'].map(url=>addSafe(cache,url)))})())})

self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url)
  if(request.method!=='GET')return

  const isSupabaseRest=url.hostname.endsWith('.supabase.co')&&url.pathname.startsWith('/rest/v1/')
  if(isSupabaseRest){event.respondWith((async()=>{const cacheName=await scopedDataCache(request),cache=await caches.open(cacheName);try{const response=await fetch(request);if(response.ok){await cache.put(request,response.clone()).catch(()=>{});trim(cacheName).catch(()=>{})}return response}catch{const cached=await cache.match(request);if(cached)return cached;return new Response(JSON.stringify({message:'Sin conexión y sin copia local para esta consulta'}),{status:503,headers:{'Content-Type':'application/json'}})}})());return}

  if(url.origin!==self.location.origin)return
  if(url.pathname.startsWith('/api/'))return

  const staticAsset=url.pathname.startsWith('/_next/static/')||/\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  if(staticAsset){event.respondWith((async()=>{const cache=await caches.open(STATIC_CACHE),cached=await cache.match(request);if(cached)return cached;try{const response=await fetch(request);if(response.ok)cache.put(request,response.clone()).catch(()=>{});return response}catch{throw new Error('Recurso offline no disponible')}})());return}

  if(request.mode==='navigate')event.respondWith((async()=>{const cache=await caches.open(SHELL_CACHE);try{const response=await fetch(request);if(response.ok){cache.put(request,response.clone()).catch(()=>{});if(url.pathname==='/pms-next')cache.put('/pms-next',response.clone()).catch(()=>{})}return response}catch{return(await cache.match(request))||(url.pathname.startsWith('/pms-next')?await cache.match('/pms-next'):null)||(await cache.match('/'))||new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Habitación Llena</title><body style="font-family:system-ui;background:#eef2f8;color:#182235;padding:32px"><h1>Habitación Llena</h1><p>Este dispositivo todavía no tiene una copia offline de esta pantalla. Conectate una vez y volvé a abrirla para dejarla preparada.</p></body>',{headers:{'Content-Type':'text/html; charset=utf-8'}})}})())
})
