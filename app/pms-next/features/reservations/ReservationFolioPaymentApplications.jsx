"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{paymentApplicationsByItem,paymentApplicationSummary}from"../../../pms-shared/features/finance/paymentApplicationPresentation"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const fmt=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"—"

export default function ReservationFolioPaymentApplications({propertyId,reservationId,selectedFolioId,items=[],payments=[],folioAllocations=[]}){
  const[itemAllocations,setItemAllocations]=useState([]),[error,setError]=useState("")
  useEffect(()=>{let cancelled=false;if(!propertyId||!reservationId)return;supabase.from("hotel_folio_item_payment_allocations").select("id,folio_item_id,payment_id,amount,currency,created_at").eq("property_id",propertyId).eq("reservation_id",Number(reservationId)).then(({data,error})=>{if(cancelled)return;if(error){setError(error.message||"No se pudo cargar el detalle de pagos.");setItemAllocations([])}else{setError("");setItemAllocations(data||[])}});return()=>{cancelled=true}},[propertyId,reservationId])
  const applications=useMemo(()=>paymentApplicationsByItem({items,allocations:itemAllocations,payments}),[items,itemAllocations,payments])
  const selectedItemIds=useMemo(()=>new Set(items.filter(item=>item.folio_id===selectedFolioId&&item.status==="active").map(item=>String(item.id))),[items,selectedFolioId])
  const rows=useMemo(()=>{const out=[];for(const id of selectedItemIds){for(const entry of applications.get(id)||[])out.push({...entry,itemId:id})}return out.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt))},[applications,selectedItemIds])
  const selectedAllocTotal=useMemo(()=>folioAllocations.filter(row=>row.folio_id===selectedFolioId).reduce((sum,row)=>sum+Number(row.amount||0),0),[folioAllocations,selectedFolioId])
  const explainedTotal=useMemo(()=>rows.reduce((sum,row)=>sum+Number(row.amount||0),0),[rows])
  const unexplained=Math.max(0,Math.round((selectedAllocTotal-explainedTotal)*100)/100)
  if(!rows.length&&!unexplained&&!error)return null
  return <section style={{margin:"8px 10px 0",border:"1px solid color-mix(in srgb,var(--accent) 18%,var(--line))",borderRadius:11,background:"color-mix(in srgb,var(--accent) 3%,var(--panelSolid))",overflow:"hidden"}}>
    <header style={{padding:"8px 10px",borderBottom:"1px solid var(--line)"}}><b style={{display:"block",fontSize:10.5}}>Pagos y créditos aplicados</b><small style={{display:"block",marginTop:2,fontSize:9.2,color:"var(--muted)"}}>Así se compone el importe de “Pagos asignados” de este folio.</small></header>
    {error?<div style={{padding:"8px 10px",fontSize:9.5,color:"var(--red)"}}>{error}</div>:null}
    {rows.map((row,index)=><div key={row.paymentId+"-"+row.itemId+"-"+index} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:10,padding:"8px 10px",borderTop:index||error?"1px solid color-mix(in srgb,var(--line) 80%,transparent)":"0"}}>
      <span style={{minWidth:0}}><b style={{display:"block",fontSize:10.2}}>Pago #{row.paymentId} · {row.method}</b><small style={{display:"block",marginTop:2,fontSize:9.1,color:"var(--muted)"}}>{fmt(row.createdAt)} · {row.label}</small><small style={{display:"block",marginTop:3,fontSize:9.1,color:row.differentOrigin?"#9a6513":"var(--muted)",lineHeight:1.4}}>{paymentApplicationSummary(row)}</small></span>
      <strong style={{fontSize:10.5,whiteSpace:"nowrap"}}>{money(row.amount,row.currency)}</strong>
    </div>)}
    {unexplained>.009?<div style={{padding:"8px 10px",borderTop:"1px solid var(--line)",fontSize:9.2,color:"var(--muted)"}}>Además hay {money(unexplained,payments[0]?.moneda||"ARS")} asignados al folio sin un cargo individual identificable.</div>:null}
  </section>
}
