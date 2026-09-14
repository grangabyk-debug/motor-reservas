"use client"

import{useEffect,useState}from"react"

const KEY="hl:pms:return-reservation"
const VIEWS=new Set(["tasks","requests","housekeeping","services","finance","quotes","messages","audit","guests"])

export default function ReservationReturnBar({view,onReturn}){
  const[context,setContext]=useState(null)
  useEffect(()=>{
    if(typeof window==="undefined")return
    if(view==="reservations"){try{window.sessionStorage.removeItem(KEY)}catch{}setContext(null);return}
    if(!VIEWS.has(view)){setContext(null);return}
    try{const raw=window.sessionStorage.getItem(KEY);setContext(raw?JSON.parse(raw):null)}catch{setContext(null)}
  },[view])
  if(!context||!VIEWS.has(view))return null
  return <div style={{margin:"8px 18px 0",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"9px 11px",border:"1px solid color-mix(in srgb,var(--accent) 18%,var(--line))",borderRadius:12,background:"color-mix(in srgb,var(--panelSolid) 86%,transparent)",backdropFilter:"blur(18px) saturate(1.25)",WebkitBackdropFilter:"blur(18px) saturate(1.25)",boxShadow:"inset 0 1px color-mix(in srgb,#fff 52%,transparent),0 8px 22px rgba(25,40,70,.07)"}}>
    <div style={{minWidth:0}}><small style={{display:"block",fontSize:9,color:"var(--muted)",fontWeight:800}}>VENÍS DESDE UNA RESERVA</small><b style={{display:"block",marginTop:2,fontSize:10.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{context.name||"Huésped"}{context.code?` · ${context.code}`:""}</b></div>
    <button type="button" onClick={()=>{try{window.sessionStorage.removeItem(KEY)}catch{}onReturn?.(Number(context.id))}} style={{height:34,padding:"0 11px",flex:"0 0 auto",border:"1px solid color-mix(in srgb,var(--accent) 25%,var(--line))",borderRadius:9,background:"color-mix(in srgb,var(--accent) 7%,var(--panelSolid))",color:"var(--accent)",font:"inherit",fontSize:10.5,fontWeight:850,cursor:"pointer"}}>← Volver a la ficha</button>
  </div>
}
