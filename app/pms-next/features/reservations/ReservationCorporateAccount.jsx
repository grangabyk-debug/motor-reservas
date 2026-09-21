"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./reservationRecord.module.css"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)

export default function ReservationCorporateAccount({reservation,propertyId,onNavigate}){
  const[partners,setPartners]=useState([]),[partnerId,setPartnerId]=useState(""),[documents,setDocuments]=useState([]),[folios,setFolios]=useState([]),[folioItems,setFolioItems]=useState([]),[folioPayments,setFolioPayments]=useState([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("")
  useEffect(()=>{let cancelled=false;(async()=>{if(!reservation?.id||!propertyId)return;setLoading(true);setError("");try{const[reservationRes,partnerRes,documentRes,folioRes,itemRes,paymentRes]=await Promise.all([
    supabase.from("reservas").select("partner_id").eq("id",reservation.id).eq("property_id",propertyId).maybeSingle(),
    supabase.from("hotel_partners").select("id,kind,name,tax_id,contact_name,email,phone,credit_limit,billing_terms,negotiated_rate_label,notes,active").eq("property_id",propertyId).eq("active",true).order("name"),
    supabase.from("hotel_finance_documents").select("id,partner_id,reservation_id,document_type,number,status,currency,total,balance,due_at").eq("property_id",propertyId),
    supabase.from("hotel_folios").select("id,payer_type,payer_name,status").eq("property_id",propertyId).eq("reservation_id",reservation.id),
    supabase.from("hotel_folio_items").select("id,folio_id,status,total").eq("property_id",propertyId).eq("reservation_id",reservation.id),
    supabase.from("pagos").select("folio_id,monto,refunded_amount,estado").eq("property_id",propertyId).eq("reserva_id",reservation.id)
  ]);for(const result of[reservationRes,partnerRes,documentRes,folioRes,itemRes,paymentRes])if(result.error)throw result.error;if(cancelled)return;setPartnerId(reservationRes.data?.partner_id||"");setPartners(partnerRes.data||[]);setDocuments(documentRes.data||[]);setFolios(folioRes.data||[]);setFolioItems(itemRes.data||[]);setFolioPayments(paymentRes.data||[])}catch(err){if(!cancelled)setError(err?.message||"No se pudo cargar la cuenta corporativa.")}finally{if(!cancelled)setLoading(false)}})();return()=>{cancelled=true}},[reservation?.id,propertyId])

  const partner=partners.find(row=>String(row.id)===String(partnerId))||null
  const partnerDocuments=partner?documents.filter(row=>String(row.partner_id)===String(partner.id)):[]
  const openDocuments=partnerDocuments.filter(row=>!["paid","void","cancelled","anulado","cancelado"].includes(String(row.status||"").toLowerCase())&&Number(row.balance)>0)
  const balance=openDocuments.reduce((sum,row)=>sum+Number(row.balance||0),0)
  const corporateFolioIds=new Set(folios.filter(row=>row.status!=="void"&&["company","agency"].includes(String(row.payer_type||"").toLowerCase())).map(row=>String(row.id)))
  const corporateCharges=folioItems.filter(row=>corporateFolioIds.has(String(row.folio_id))&&row.status==="active").reduce((sum,row)=>sum+Number(row.total||0),0)
  const corporatePaid=folioPayments.filter(row=>corporateFolioIds.has(String(row.folio_id))&&!["void","anulado","cancelado","cancelada","rejected","rechazado","rechazada"].includes(String(row.estado||"").toLowerCase())).reduce((sum,row)=>sum+Math.max(0,Number(row.monto||0)-Number(row.refunded_amount||0)),0)
  const reservationBalance=Math.max(0,corporateCharges-corporatePaid)

  async function assignPartner(value){
    if(saving)return
    setSaving(true);setError("")
    try{
      const next=value||null
      const{error:updateError}=await supabase.from("reservas").update({partner_id:next}).eq("id",reservation.id).eq("property_id",propertyId)
      if(updateError)throw updateError
      setPartnerId(value)
      Object.assign(reservation,{partner_id:next})
      if(typeof window!=="undefined"){
        window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated",{detail:{reservationId:Number(reservation.id)}}))
        window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId,tables:["reservas","hotel_partners","hotel_finance_documents"]}}))
      }
    }catch(err){setError(err?.message||"No se pudo vincular la empresa.")}
    finally{setSaving(false)}
  }

  function openAccounts(){
    if(typeof window!=="undefined"){
      const url=new URL(window.location.href)
      url.searchParams.set("finance_tab","accounts")
      window.history.replaceState(window.history.state||{},"",url)
    }
    onNavigate?.("finance",{restoreScroll:false})
  }

  return <section className={s.card}>
    <header><h3>Empresa y cuenta corriente</h3><button type="button" onClick={openAccounts}>Abrir Empresas y cuentas</button></header>
    {error?<div className={s.alert}>{error}</div>:null}
    {loading?<div className={s.emptyCard}><span>Cargando cuenta corporativa…</span></div>:<div style={{padding:"12px",display:"grid",gap:11}}>
      <label style={{display:"grid",gap:5,fontSize:10,fontWeight:850,color:"var(--muted)"}}>EMPRESA / CUENTA CORRIENTE<select value={partnerId} disabled={saving} onChange={event=>assignPartner(event.target.value)} style={{height:40,border:"1px solid var(--line)",borderRadius:10,padding:"0 10px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:11,fontWeight:750}}><option value="">Sin empresa vinculada</option>{partners.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      {partner?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>
        <div style={{padding:10,border:"1px solid var(--line)",borderRadius:10}}><small style={{display:"block",color:"var(--muted)"}}>Empresa</small><b style={{fontSize:11}}>{partner.name}</b><small style={{display:"block",marginTop:3,color:"var(--muted)"}}>{partner.tax_id||partner.kind||"Corporativa"}</small></div>
        <div style={{padding:10,border:"1px solid var(--line)",borderRadius:10}}><small style={{display:"block",color:"var(--muted)"}}>Condición de pago</small><b style={{fontSize:11}}>{partner.billing_terms||"Sin definir"}</b><small style={{display:"block",marginTop:3,color:"var(--muted)"}}>{partner.negotiated_rate_label||"Sin tarifa negociada"}</small></div>
        <div style={{padding:10,border:"1px solid var(--line)",borderRadius:10}}><small style={{display:"block",color:"var(--muted)"}}>Límite de crédito</small><b style={{fontSize:11}}>{money(partner.credit_limit||0,reservation.moneda)}</b><small style={{display:"block",marginTop:3,color:"var(--muted)"}}>{openDocuments.length} documento{openDocuments.length===1?"":"s"} pendiente{openDocuments.length===1?"":"s"}</small></div>
        <div style={{padding:10,border:"1px solid color-mix(in srgb,var(--accent) 20%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--accent) 4%,var(--panelSolid))"}}><small style={{display:"block",color:"var(--muted)"}}>Saldo cuenta corriente</small><b style={{fontSize:13,color:"var(--accent)"}}>{money(balance,reservation.moneda)}</b><small style={{display:"block",marginTop:3,color:"var(--muted)"}}>Folio empresa de esta reserva: {money(reservationBalance,reservation.moneda)}</small></div>
      </div>:<div style={{padding:"10px 12px",border:"1px dashed var(--line)",borderRadius:10,color:"var(--muted)",fontSize:10.5}}>Vinculá una empresa para aplicar sus condiciones comerciales y consultar su cuenta corriente desde la misma ficha.</div>}
    </div>}
  </section>
}
