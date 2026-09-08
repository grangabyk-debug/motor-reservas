"use client"

import{useEffect,useState}from"react"
import HotelWebsiteCanvas from"./HotelWebsiteCanvas"
import s from"./hotelSite.module.css"

const TEMPLATE_IDS=["classic","boutique","minimal","coast","urban","lodge","premium"]
function sessionId(){try{const key="hl:web-session",saved=sessionStorage.getItem(key);if(saved)return saved;const value=globalThis.crypto?.randomUUID?.()||`hl-${Date.now()}-${Math.random().toString(36).slice(2)}`;sessionStorage.setItem(key,value);return value}catch{return""}}

export default function HotelSite({slug}){
  const[data,setData]=useState(null),[error,setError]=useState(""),[previewTemplate,setPreviewTemplate]=useState("")
  useEffect(()=>{if(typeof window!=="undefined"&&window.location.hostname.endsWith(".vercel.app")){const candidate=new URLSearchParams(window.location.search).get("template_preview");if(TEMPLATE_IDS.includes(candidate))setPreviewTemplate(candidate)}},[])
  useEffect(()=>{let active=true;fetch(`/api/public/booking/${encodeURIComponent(slug)}/config`,{cache:"no-store"}).then(async response=>{const json=await response.json();if(!response.ok)throw new Error(json.error||"Sitio no disponible.");if(active)setData(json.engine)}).catch(err=>active&&setError(err.message||"Sitio no disponible."));return()=>{active=false}},[slug])
  useEffect(()=>{if(!data||data.analytics_enabled===false||typeof window==="undefined")return;const params=new URLSearchParams(window.location.search),visualTest=window.location.hostname.endsWith(".vercel.app")&&params.has("template_preview");if(visualTest)return;fetch(`/api/public/booking/${encodeURIComponent(slug)}/event`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"site_view",source:"site",session:sessionId()})}).catch(()=>{})},[data,slug])
  if(error)return <main className={s.missing}><b>Sitio temporalmente no disponible</b><span>{error}</span></main>
  if(!data)return <main className={s.missing}>Cargando hotel…</main>
  if(data.website_mode==="external"||data.website_enabled===false)return <main className={s.missing}><b>Este hotel usa su propio sitio web</b><span>El motor de reservas de Habitación Llena sigue disponible.</span><a href={`/book/${slug}?source=site`} className={s.missingCta}>Reservar ahora</a></main>
  return <HotelWebsiteCanvas data={{...data,template:previewTemplate||data.template}} slug={slug}/>
}
