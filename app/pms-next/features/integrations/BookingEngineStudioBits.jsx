"use client"

import s from"./bookingEngineStudio.module.css"

export const templates=[
  {id:"classic",name:"Lumen",help:"Luminoso, limpio y directo",tag:"Hoteles y hosterías"},
  {id:"boutique",name:"Aura",help:"Editorial, cálido y elegante",tag:"Boutique y premium"},
  {id:"minimal",name:"Nómada",help:"Minimal, visual y contemporáneo",tag:"Apart y urbano"},
  {id:"coast",name:"Brisa",help:"Aireado, relajado y fotográfico",tag:"Resort y costa"},
  {id:"urban",name:"Distrito",help:"Nítido, práctico y sofisticado",tag:"Urbano y business"},
  {id:"lodge",name:"Sierra",help:"Natural, cálido y con carácter",tag:"Hosterías y cabañas"},
  {id:"premium",name:"Noir",help:"Oscuro, refinado y de alto impacto",tag:"Luxury y autor"}
]
export const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value)||0)
export const galleryUrls=gallery=>(Array.isArray(gallery)?gallery:[]).map(item=>typeof item==="string"?item:item?.url||item?.src||"").filter(Boolean)
export const originLines=value=>Array.isArray(value)?value.join("\n"):String(value||"")
export function Light({tone="green",children}){return <span className={s.lightLabel}><i data-tone={tone}/>{children}</span>}
export function Switch({checked,onChange,disabled=false,label,help}){return <label className={`${s.switchRow} ${disabled?s.disabled:""}`}><span><b>{label}</b>{help?<small>{help}</small>:null}</span><input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={e=>onChange(e.target.checked)}/><i aria-hidden="true"/></label>}
export function CopyCard({title,help,value,onCopy,copied}){return <article className={s.copyCard}><div><small>{title}</small><p>{help}</p></div><code>{value||"Disponible cuando el motor esté creado"}</code><button type="button" disabled={!value} onClick={onCopy}>{copied?"Copiado ✓":"Copiar"}</button></article>}
