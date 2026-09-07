"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const DEFAULT_TAXES={enabled:true,country:"AR",vat_rate:21,show_breakdown:true,default_recipient_condition:"consumidor_final",additional_taxes_enabled:true}

export default function useReservationTaxConfig(roomId,setDraft){
  const[taxConfig,setTaxConfig]=useState(DEFAULT_TAXES)

  useEffect(()=>{
    let cancelled=false
    async function load(){
      if(!roomId)return
      try{
        const roomRes=await supabase.from("habitaciones").select("property_id").eq("id",Number(roomId)).maybeSingle()
        if(roomRes.error||!roomRes.data?.property_id)return
        const settingsRes=await supabase.from("property_settings").select("settings").eq("property_id",roomRes.data.property_id).maybeSingle()
        if(settingsRes.error)return
        const raw=settingsRes.data?.settings?.taxes||{}
        const next={...DEFAULT_TAXES,...raw,enabled:raw.enabled!==false,vat_rate:Math.max(0,Number(raw.vat_rate??21))}
        if(cancelled)return
        setTaxConfig(next)
        setDraft(current=>({...current,impuestosDesglosados:next.enabled,ivaPorcentaje:next.enabled?next.vat_rate:0}))
      }catch{}
    }
    load()
    return()=>{cancelled=true}
  },[roomId,setDraft])

  return taxConfig
}
