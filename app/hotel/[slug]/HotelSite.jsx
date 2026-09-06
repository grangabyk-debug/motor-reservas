"use client"

import{useEffect,useMemo,useState}from"react"
import BookingEngine from"../../book/[slug]/BookingEngine"
import s from"./hotelSite.module.css"

const imageUrl=item=>typeof item==="string"?item:item?.url||item?.src||""
export default function HotelSite({slug}){
  const[data,setData]=useState(null),[error,setError]=useState("")
  useEffect(()=>{let active=true;fetch(`/api/public/booking/${encodeURIComponent(slug)}/config`,{cache:"no-store"}).then(async response=>{const json=await response.json();if(!response.ok)throw new Error(json.error||"Sitio no disponible.");if(active)setData(json.engine)}).catch(err=>active&&setError(err.message||"Sitio no disponible."));return()=>{active=false}},[slug])
  const gallery=useMemo(()=>Array.isArray(data?.gallery)?data.gallery.map(imageUrl).filter(Boolean).slice(0,8):[],[data?.gallery])
  if(error)return <main className={s.missing}><b>Sitio temporalmente no disponible</b><span>{error}</span></main>
  if(!data)return <main className={s.missing}>Cargando hotel…</main>
  const template=["classic","boutique","minimal"].includes(data.template)?data.template:"classic",style={"--site-primary":data.primary_color||"#5B5CEB","--site-accent":data.accent_color||"#7C5CFC"}
  return <main className={s.site} data-template={template} style={style}>
    <header className={s.nav}><a className={s.brand} href="#inicio">{data.logo_url?<img src={data.logo_url} alt=""/>:<span>{String(data.name||"H").slice(0,1)}</span>}<b>{data.name}</b></a><nav><a href="#hotel">El hotel</a>{gallery.length?<a href="#galeria">Galería</a>:null}<a href="#reservar">Reservar</a></nav><a className={s.bookTop} href="#reservar">Reservar</a></header>
    <section id="inicio" className={s.hero}>{data.hero_url?<img src={data.hero_url} alt={data.name}/>:null}<div className={s.heroShade}/><div className={s.heroCopy}><small>RESERVA DIRECTA</small><h1>{data.name}</h1>{data.city?<span>{data.city}</span>:null}<p>{data.booking_message||"Reservá directamente con el hotel y consultá disponibilidad en tiempo real."}</p><a href="#reservar">Ver disponibilidad</a></div></section>
    <section id="hotel" className={s.about}><div><small>EL HOTEL</small><h2>{data.name}</h2><p>{data.description||"Una estadía simple de reservar, con disponibilidad actualizada directamente desde el hotel."}</p></div><div className={s.trust}><article><b>Disponibilidad real</b><span>El motor consulta el inventario del hotel al instante.</span></article><article><b>Reserva directa</b><span>La confirmación entra al mismo sistema que usa recepción.</span></article><article><b>Gestión simple</b><span>Después de reservar podés consultar tu estadía desde un enlace privado.</span></article></div></section>
    {gallery.length?<section id="galeria" className={s.gallery}><header><small>GALERÍA</small><h2>Conocé el hotel</h2></header><div>{gallery.map((url,index)=><figure key={`${url}-${index}`}><img src={url} alt={`${data.name} ${index+1}`}/></figure>)}</div></section>:null}
    <section id="reservar" className={s.booking}><header><small>RESERVAS</small><h2>Elegí tus fechas</h2><p>Disponibilidad y tarifas conectadas directamente con {data.name}.</p></header><BookingEngine slug={slug} embedded/></section>
    <footer className={s.footer}><div><b>{data.name}</b>{data.city?<span>{data.city}</span>:null}</div><div>{data.contact_phone?<a href={`tel:${data.contact_phone}`}>{data.contact_phone}</a>:null}{data.contact_email?<a href={`mailto:${data.contact_email}`}>{data.contact_email}</a>:null}</div><small>Sitio y motor operados con Habitación Llena</small></footer>
  </main>
}
