"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{CreateReservationDrawer as LegacyCreateReservationDrawer,ReservationDetailDrawer as LegacyReservationDetailDrawer}from"./PlanningDrawersLegacy"

export const ReservationDetailDrawer=LegacyReservationDetailDrawer

const pad=value=>String(value).padStart(2,"0")
function addDay(value){const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+1);return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function stayDays(start,end){const result=[];for(let day=start;day&&end&&day<end;day=addDay(day))result.push(day);return result}
const selectedIds=draft=>[...new Set((draft?.roomIds?.length?draft.roomIds:[draft?.roomId]).filter(Boolean).map(String))]

export function CreateReservationDrawer(props){
  const{draft,setDraft,availableRooms=[],propertyId}=props
  const[rateCurrency,setRateCurrency]=useState(null),[effectiveRates,setEffectiveRates]=useState({}),[resolvedPropertyId,setResolvedPropertyId]=useState(propertyId||null)
  const roomIdsKey=useMemo(()=>availableRooms.map(room=>room.id).join(","),[availableRooms])
  const baseRatesKey=useMemo(()=>availableRooms.map(room=>`${room.id}:${Number(room.precio)||0}`).join("|"),[availableRooms])
  const presentationPolicies=useMemo(()=>(props.cancellationPolicies||[]).map(policy=>({...policy,is_default:false})),[props.cancellationPolicies])
  const pid=propertyId||resolvedPropertyId

  useEffect(()=>{
    if(propertyId){setResolvedPropertyId(propertyId);return}
    const roomId=availableRooms[0]?.id;if(!roomId)return
    let cancelled=false
    supabase.from("habitaciones").select("property_id").eq("id",Number(roomId)).maybeSingle().then(({data})=>{if(!cancelled&&data?.property_id)setResolvedPropertyId(data.property_id)}).catch(()=>{})
    return()=>{cancelled=true}
  },[propertyId,roomIdsKey])

  useEffect(()=>{
    if(!pid)return
    let cancelled=false
    ;(async()=>{
      try{
        const settingsRes=await supabase.from("property_settings").select("settings").eq("property_id",pid).maybeSingle()
        if(settingsRes.error)throw settingsRes.error
        if(cancelled)return
        const code=String(settingsRes.data?.settings?.pricing?.rate_currency||"ARS").toUpperCase()==="USD"?"USD":"ARS"
        setRateCurrency(code);setDraft(current=>current&&current.currency!==code?{...current,currency:code}:current)
      }catch{if(!cancelled)setRateCurrency(current=>current||"ARS")}
    })()
    return()=>{cancelled=true}
  },[pid,setDraft])

  useEffect(()=>{
    if(typeof window==="undefined"||!pid)return
    const handler=event=>{if(String(event.detail?.propertyId)!==String(pid))return;const code=String(event.detail?.settings?.pricing?.rate_currency||"ARS").toUpperCase()==="USD"?"USD":"ARS";setRateCurrency(code);setDraft(current=>current&&current.currency!==code?{...current,currency:code}:current)}
    window.addEventListener("hl:property-settings-updated",handler)
    return()=>window.removeEventListener("hl:property-settings-updated",handler)
  },[pid,setDraft])

  useEffect(()=>{
    const ids=availableRooms.map(room=>Number(room.id)).filter(Number.isFinite),days=stayDays(draft?.start,draft?.end)
    if(!pid||!ids.length||!days.length){setEffectiveRates({});return}
    let cancelled=false
    ;(async()=>{
      try{
        const{data,error}=await supabase.from("hotel_rate_calendar").select("habitacion_id,stay_date,price").eq("property_id",pid).in("habitacion_id",ids).gte("stay_date",draft.start).lt("stay_date",draft.end)
        if(error)throw error
        if(cancelled)return
        const byDay=new Map((data||[]).map(row=>[`${row.habitacion_id}:${row.stay_date}`,row.price])),next={}
        for(const room of availableRooms){const values=days.map(day=>{const value=byDay.get(`${room.id}:${day}`);return value==null?Number(room.precio)||0:Number(value)||0});next[String(room.id)]=values.reduce((sum,value)=>sum+value,0)/values.length}
        setEffectiveRates(next)
        setDraft(current=>{
          if(!current||current.start!==draft.start||current.end!==draft.end)return current
          const idsNow=selectedIds(current),assignments={...(current.roomAssignments||{})}
          for(const id of idsNow)if(next[id]!=null)assignments[id]={...(assignments[id]||{}),rate:next[id]}
          const rate=idsNow.reduce((sum,id)=>sum+Number(next[id]??assignments[id]?.rate??availableRooms.find(room=>String(room.id)===id)?.precio??0),0)
          return{...current,roomAssignments:assignments,rate}
        })
      }catch{if(!cancelled)setEffectiveRates({})}
    })()
    return()=>{cancelled=true}
  },[pid,draft?.start,draft?.end,roomIdsKey,baseRatesKey,setDraft])

  const pricedRooms=useMemo(()=>availableRooms.map(room=>effectiveRates[String(room.id)]==null?room:{...room,precio:effectiveRates[String(room.id)]}),[availableRooms,effectiveRates])
  const pricedRoomById=useMemo(()=>new Map(pricedRooms.map(room=>[Number(room.id),room])),[pricedRooms])
  const forcedDraft=draft&&rateCurrency?{...draft,currency:rateCurrency}:draft
  const forcedSetDraft=updater=>setDraft(current=>{const next=typeof updater==="function"?updater(current):updater;if(!next||!rateCurrency)return next;return next.currency===rateCurrency?next:{...next,currency:rateCurrency}})
  return <LegacyCreateReservationDrawer {...props} draft={forcedDraft} setDraft={forcedSetDraft} availableRooms={pricedRooms} roomById={pricedRoomById} cancellationPolicies={presentationPolicies}/>
}
