"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{normalizeTaxSettings}from"../../core/priceTax"

const DEFAULT_TAXES=normalizeTaxSettings({enabled:true,vat_rate:21,price_tax_mode:"tax_included"})

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
        const next=normalizeTaxSettings(settingsRes.data?.settings?.taxes||DEFAULT_TAXES)
        if(cancelled)return
        setTaxConfig(next)
        setDraft(current=>({...current,impuestosDesglosados:next.enabled,ivaPorcentaje:next.enabled?next.vat_rate:0,priceTaxMode:next.price_tax_mode}))
      }catch{}
    }
    load()
    return()=>{cancelled=true}
  },[roomId,setDraft])
  return taxConfig
}
