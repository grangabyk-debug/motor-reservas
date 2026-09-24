"use client"

import{useMemo,useState}from"react"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const fmtNight=value=>value?new Intl.DateTimeFormat("es-AR",{weekday:"short",day:"2-digit",month:"short"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)).replaceAll(".",""):"—"
const fmtStay=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):"—"
const round2=value=>Math.round((Number(value)||0)*100)/100

function nightlyRows(detail,taxEnabled,vatRate){
  const raw=Array.isArray(detail?.tarifas_por_noche)?detail.tarifas_por_noche:[]
  const factor=taxEnabled?1+Math.max(0,Number(vatRate)||0)/100:1
  return raw.map((entry,index)=>{
    const net=Number(entry?.tarifa_neta??entry?.price??entry?.tarifa)
    const grossStored=Number(entry?.tarifa_final)
    const gross=Number.isFinite(grossStored)?grossStored:round2(net*factor)
    return{key:`${entry?.fecha||entry?.stay_date||index}`,date:String(entry?.fecha||entry?.stay_date||""),net:Number.isFinite(net)?net:0,gross:Number.isFinite(gross)?gross:0,source:String(entry?.fuente||entry?.source||"")}
  }).filter(entry=>entry.date&&Number.isFinite(entry.gross)).sort((a,b)=>a.date.localeCompare(b.date))
}

export default function ReservationRoomRateRow({row,detail,checkoutDate="",currency="ARS",taxEnabled=false,vatRate=0,defaultOpen=false}){
  const nightly=useMemo(()=>nightlyRows(detail,taxEnabled,vatRate),[detail,taxEnabled,vatRate])
  const varied=useMemo(()=>nightly.length>1&&nightly.some(entry=>Math.abs(entry.gross-nightly[0].gross)>.01),[nightly])
  const[open,setOpen]=useState(()=>Boolean(defaultOpen&&varied))
  const total=nightly.reduce((sum,entry)=>sum+entry.gross,0)
  const parts=[]
  if(row.matrimonial)parts.push(`${row.matrimonial} matrimonial${row.matrimonial===1?"":"es"}`)
  if(row.individual)parts.push(`${row.individual} individual${row.individual===1?"":"es"}`)
  const changed=row.soldAs!==row.physicalCategory,checkedOut=Boolean(checkoutDate),earlyActive=Boolean(detail?.early_checkin_requested),lateActive=Boolean(detail?.late_checkout_requested)
  const canExpand=nightly.length>0&&varied

  return <div style={{display:"block",padding:0,borderLeft:checkedOut?"3px solid #2e9b61":"3px solid transparent",background:checkedOut?"color-mix(in srgb,#2e9b61 6%,var(--panelSolid))":"transparent"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,padding:"10px 12px"}}>
      <span style={{minWidth:0,fontFamily:"inherit"}}>
        <b style={{display:"block",fontSize:11,fontWeight:850,lineHeight:1.35}}>Hab. {row.name} · vendida como {row.soldAs} · {fmtStay(row.start)} → {fmtStay(row.end)}</b>
        <small style={{display:"block",marginTop:2,fontSize:11,lineHeight:1.35,fontFamily:"inherit",color:"var(--muted)"}}>Asignada: {row.physicalCategory}{changed?" · categoría física distinta":""} · {row.guests} huésped{row.guests===1?"":"es"} · {parts.length?parts.join(" + "):"Rooming sin configurar"}</small>{earlyActive||lateActive?<span style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:6}}>{earlyActive?<span style={{padding:"4px 7px",border:"1px solid color-mix(in srgb,#2e9b61 38%,var(--line))",borderRadius:999,background:"color-mix(in srgb,#2e9b61 10%,var(--panelSolid))",color:"#26794d",fontSize:10,fontWeight:900}}>✓ EARLY CHECK-IN · desde {detail?.early_checkin_time||"08:00"}</span>:null}{lateActive?<span style={{padding:"4px 7px",border:"1px solid #2e9b61",borderRadius:999,background:"#2e9b61",color:"#fff",fontSize:10,fontWeight:900,boxShadow:"0 5px 14px rgba(46,155,97,.18)"}}>✓ LATE CHECK-OUT · hasta {detail?.late_checkout_time||"18:00"}</span>:null}</span>:null}
      </span>
      <span style={{display:"grid",justifyItems:"end",gap:3,flex:"0 0 auto",textAlign:"right"}}>
        {checkedOut?<span style={{padding:"4px 7px",border:"1px solid color-mix(in srgb,#2e9b61 30%,var(--line))",borderRadius:999,background:"color-mix(in srgb,#2e9b61 9%,var(--panelSolid))",color:"#26794d",fontSize:8.8,fontWeight:950,letterSpacing:".02em"}}>✓ CHECK-OUT · {fmtStay(checkoutDate)}</span>:null}
        <strong style={{fontSize:11,fontFamily:"inherit"}}>{money(row.rate,currency)}</strong>
        <small style={{marginTop:0,fontWeight:650,color:"var(--muted)"}}>{varied?"promedio/noche":"/ noche"}</small>
        {canExpand?<button type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open} style={{border:0,padding:0,background:"transparent",color:"var(--accent)",font:"inherit",fontSize:9.5,fontWeight:850,cursor:"pointer"}}>{open?"Ocultar detalle":"Ver detalle de tarifas"}</button>:null}
      </span>
    </div>
    {open&&canExpand?<div style={{margin:"0 12px 11px",border:"1px solid var(--line)",borderRadius:10,overflow:"hidden",background:"color-mix(in srgb,var(--bg) 42%,var(--panelSolid))"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"8px 10px",borderBottom:"1px solid var(--line)",background:"color-mix(in srgb,var(--accent) 4%,var(--panelSolid))"}}>
        <span style={{fontSize:9.5,fontWeight:900,letterSpacing:".035em",color:"var(--text)"}}>TARIFA ACORDADA POR FECHA</span>
        <small style={{margin:0,fontSize:9,color:"var(--muted)"}}>Snapshot de la reserva</small>
      </div>
      <div style={{display:"grid"}}>{nightly.map(entry=><div key={entry.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"7px 10px",borderBottom:"1px solid color-mix(in srgb,var(--line) 78%,transparent)"}}><span style={{fontSize:10.5,fontWeight:750,textTransform:"capitalize"}}>{fmtNight(entry.date)}</span><strong style={{fontSize:10.5}}>{money(entry.gross,currency)}</strong></div>)}</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"8px 10px",background:"color-mix(in srgb,var(--bg) 34%,var(--panelSolid))"}}><span style={{fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>Total alojamiento · {nightly.length} noche{nightly.length===1?"":"s"}</span><strong style={{fontSize:11.5}}>{money(total,currency)}</strong></div>
    </div>:null}
  </div>
}
