"use client"

import{useState}from"react"
import{supabase}from"../../../../lib/supabase"
import ReservationPaymentPanel from"../finance/ReservationPaymentPanel"

export default function ReservationRecordPaymentAction({propertyId,reservationId,onSaved}){
  const[open,setOpen]=useState(false),[session,setSession]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState("")

  async function openPayment(event){
    event?.preventDefault?.()
    event?.stopPropagation?.()
    if(loading)return
    setLoading(true);setError("")
    try{
      const{data,error:sessionError}=await supabase.from("hotel_cash_sessions")
        .select("id,opened_by,closed_by,opened_at,closed_at,opening_amount,opening_amount_usd,closing_amount,closing_amount_usd,expected_amount,expected_amount_usd,status,notes")
        .eq("property_id",propertyId).eq("status","open").order("opened_at",{ascending:false}).limit(1)
      if(sessionError)throw sessionError
      setSession(data?.[0]||null)
      setOpen(true)
    }catch(err){setError(err?.message||"No se pudo abrir el cobro.")}finally{setLoading(false)}
  }

  return <>
    <button type="button" onClick={openPayment} disabled={loading}>{loading?"Abriendo…":"＋ Registrar pago"}</button>
    {error?<span style={{fontSize:9.5,color:"var(--red)",fontWeight:800}}>{error}</span>:null}
    {open?<ReservationPaymentPanel propertyId={propertyId} reservationId={reservationId} session={session} onClose={()=>setOpen(false)} onSaved={result=>{setOpen(false);onSaved?.(result)}}/>:null}
  </>
}
