"use client"

import s from"./bookingEngineStudio.module.css"

const IMG={
  resort:"https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=82",
  room:"https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1400&q=82",
  modern:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=82",
  coast:"https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1400&q=82",
  warm:"https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=82",
  suite:"https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1400&q=82"
}

export const templates=[
  {id:"classic",name:"Lumen",help:"Luminoso, limpio y directo",tag:"Hotel contemporáneo",primary:"#5B5CEB",accent:"#9B8CFF",font:"Serif editorial",featured:true,cover:IMG.resort,gallery:[IMG.resort,IMG.room,IMG.suite]},
  {id:"boutique",name:"Aura",help:"Editorial, cálido y elegante",tag:"Boutique & premium",primary:"#A85F4E",accent:"#D7A78F",font:"Serif cálida",featured:true,cover:IMG.room,gallery:[IMG.room,IMG.warm,IMG.modern]},
  {id:"minimal",name:"Nómada",help:"Minimal, visual y contemporáneo",tag:"Apart & urbano",primary:"#111827",accent:"#64748B",font:"Sans geométrica",featured:true,cover:IMG.modern,gallery:[IMG.modern,IMG.suite,IMG.room]},
  {id:"coast",name:"Brisa",help:"Aireado, relajado y fotográfico",tag:"Resort & costa",primary:"#167E88",accent:"#62BFC1",font:"Serif relajada",featured:true,cover:IMG.coast,gallery:[IMG.coast,IMG.resort,IMG.room]},
  {id:"lodge",name:"Sierra",help:"Natural, cálido y con carácter",tag:"Hosterías & cabañas",primary:"#607653",accent:"#B08A5B",font:"Serif natural",featured:true,cover:IMG.warm,gallery:[IMG.warm,IMG.room,IMG.resort]},
  {id:"urban",name:"Distrito",help:"Nítido, práctico y sofisticado",tag:"Urbano & business",primary:"#5663FF",accent:"#9BA2FF",font:"Sans técnica",featured:false,cover:IMG.suite,gallery:[IMG.suite,IMG.modern,IMG.room]},
  {id:"premium",name:"Noir",help:"Oscuro, refinado y de alto impacto",tag:"Luxury & autor",primary:"#B7985D",accent:"#D4BC83",font:"Serif de lujo",featured:false,cover:IMG.room,gallery:[IMG.room,IMG.modern,IMG.warm]}
]
export const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value)||0)
export const galleryUrls=gallery=>(Array.isArray(gallery)?gallery:[]).map(item=>typeof item==="string"?item:item?.url||item?.src||"").filter(Boolean)
export const originLines=value=>Array.isArray(value)?value.join("\n"):String(value||"")
export function Light({tone="green",children}){return <span className={s.lightLabel}><i data-tone={tone}/>{children}</span>}
export function Switch({checked,onChange,disabled=false,label,help}){return <label className={`${s.switchRow} ${disabled?s.disabled:""}`}><span><b>{label}</b>{help?<small>{help}</small>:null}</span><input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={e=>onChange(e.target.checked)}/><i aria-hidden="true"/></label>}
export function CopyCard({title,help,value,onCopy,copied}){return <article className={s.copyCard}><div><small>{title}</small><p>{help}</p></div><code>{value||"Disponible cuando el motor esté creado"}</code><button type="button" disabled={!value} onClick={onCopy}>{copied?"Copiado ✓":"Copiar"}</button></article>}
