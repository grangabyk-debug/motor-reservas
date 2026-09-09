"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{CreateReservationDrawer as LegacyCreateReservationDrawer,ReservationDetailDrawer as LegacyReservationDetailDrawer}from"./PlanningDrawersLegacy"

export const ReservationDetailDrawer=LegacyReservationDetailDrawer

export function CreateReservationDrawer(props){
  const{draft,setDraft,availableRooms=[]}=props
  const[rateCurrency,setRateCurrency]=useState(null),[propertyId,setPropertyId]=useState(null)
  const roomId=useMemo(()=>availableRooms.find(room=>room?.id)?.id||draft?.roomId||draft?.roomIds?.[0]||null,[availableRooms,draft?.roomId,draft?.roomIds])

  useEffect(()=>{
    if(!roomId)return
    let cancelled=false
    ;(async()=>{
      try{
        const roomRes=await supabase.from("habitaciones").select("property_id").eq("id",Number(roomId)).maybeSingle()
        if(roomRes.error)throw roomRes.error
        const pid=roomRes.data?.property_id;if(!pid)return
        const settingsRes=await supabase.from("property_settings").select("settings").eq("property_id",pid).maybeSingle()
        if(settingsRes.error)throw settingsRes.error
        if(cancelled)return
        const code=String(settingsRes.data?.settings?.pricing?.rate_currency||"ARS").toUpperCase()==="USD"?"USD":"ARS"
        setPropertyId(pid);setRateCurrency(code)
        setDraft(current=>current&&current.currency!==code?{...current,currency:code}:current)
      }catch{if(!cancelled)setRateCurrency(current=>current||"ARS")}
    })()
    return()=>{cancelled=true}
  },[roomId,setDraft])

  useEffect(()=>{
    if(typeof window==="undefined"||!propertyId)return
    const handler=event=>{if(String(event.detail?.propertyId)!==String(propertyId))return;const code=String(event.detail?.settings?.pricing?.rate_currency||"ARS").toUpperCase()==="USD"?"USD":"ARS";setRateCurrency(code);setDraft(current=>current&&current.currency!==code?{...current,currency:code}:current)}
    window.addEventListener("hl:property-settings-updated",handler)
    return()=>window.removeEventListener("hl:property-settings-updated",handler)
  },[propertyId,setDraft])

  const forcedDraft=draft&&rateCurrency?{...draft,currency:rateCurrency}:draft
  const forcedSetDraft=updater=>setDraft(current=>{const next=typeof updater==="function"?updater(current):updater;if(!next||!rateCurrency)return next;return next.currency===rateCurrency?next:{...next,currency:rateCurrency}})
  return <LegacyCreateReservationDrawer {...props} draft={forcedDraft} setDraft={forcedSetDraft}/>
}
