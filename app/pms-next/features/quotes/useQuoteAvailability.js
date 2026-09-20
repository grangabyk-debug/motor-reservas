"use client"

import{useCallback}from"react"
import{supabase}from"../../../../lib/supabase"
import{pricingRoomsById,resolvePricingQuote}from"../../core/pricingContract"

export default function useQuoteAvailability(propertyId){
  return useCallback(async(start,end,{excludeGroupId=null}={})=>{
    if(!propertyId||!start||!end||end<=start)return{types:[],rooms:[],occupiedCount:0,pricing:null}
    const[roomRes,resRes,blockRes,groupBlockRes]=await Promise.all([
      supabase.from("habitaciones").select("id,nombre,tipo,capacidad,activa,sort_order").eq("property_id",propertyId).eq("activa",true).order("sort_order").order("nombre"),
      supabase.from("reservas").select("id,habitacion_id,habitaciones_ids,estado,no_show,fecha_entrada,fecha_salida").eq("property_id",propertyId).neq("estado","cancelada").eq("no_show",false).lt("fecha_entrada",end).gt("fecha_salida",start),
      supabase.from("bloqueos").select("id,habitacion_id,fecha_desde,fecha_hasta,motivo").eq("property_id",propertyId).lt("fecha_desde",end).gt("fecha_hasta",start),
      supabase.from("hotel_group_inventory_blocks").select("id,group_id,room_type,quantity,arrival_date,departure_date,status").eq("property_id",propertyId).neq("status","released").lt("arrival_date",end).gt("departure_date",start),
    ])
    for(const result of[roomRes,resRes,blockRes,groupBlockRes])if(result.error)throw result.error
    const occupied=new Set()
    for(const reservation of resRes.data||[]){if(reservation.habitacion_id)occupied.add(Number(reservation.habitacion_id));for(const id of reservation.habitaciones_ids||[])occupied.add(Number(id))}
    for(const block of blockRes.data||[])occupied.add(Number(block.habitacion_id))
    const freeBase=(roomRes.data||[]).filter(room=>!occupied.has(Number(room.id)))
    const pricing=await resolvePricingQuote({propertyId,start,end,roomIds:freeBase.map(room=>room.id)})
    const pricingByRoom=pricingRoomsById(pricing)
    const free=freeBase.map(room=>{const quote=pricingByRoom.get(Number(room.id));return{...room,pricing:quote,quoteRate:Number(quote?.average_net),quoteFinalRate:Number(quote?.average_final),quoteConfiguredRate:Number(quote?.average_configured),quoteRates:(quote?.nightly_rates||[]).map(n=>Number(n.net_amount)),quoteFinalRates:(quote?.nightly_rates||[]).map(n=>Number(n.final_amount)),quoteConfiguredRates:(quote?.nightly_rates||[]).map(n=>Number(n.configured_amount))}}).filter(room=>room.pricing?.is_complete)
    const groupBlocks=(groupBlockRes.data||[]).filter(block=>!excludeGroupId||String(block.group_id)!==String(excludeGroupId)),reservedByType=new Map()
    for(const block of groupBlocks){const key=String(block.room_type||"").toLowerCase();reservedByType.set(key,(reservedByType.get(key)||0)+Math.max(0,Number(block.quantity)||0))}
    const grouped=new Map();for(const room of free){const name=room.tipo||"Sin tipo";if(!grouped.has(name))grouped.set(name,[]);grouped.get(name).push(room)}
    const types=[...grouped.entries()].map(([name,rawRooms])=>{const typeRooms=[...rawRooms].sort((a,b)=>(Number(a.quoteFinalRate)||0)-(Number(b.quoteFinalRate)||0)||String(a.nombre).localeCompare(String(b.nombre),"es",{numeric:true})),reserved=reservedByType.get(name.toLowerCase())||0,available=Math.max(0,typeRooms.length-reserved),sellable=typeRooms.slice(reserved),rateCandidates=sellable.map(room=>Number(room.quoteRate)||0),finalRateCandidates=sellable.map(room=>Number(room.quoteFinalRate)||0),configuredRateCandidates=sellable.map(room=>Number(room.quoteConfiguredRate)||0),capacity=typeRooms.reduce((max,room)=>Math.max(max,Number(room.capacidad)||1),1);return{name,available,reserved,capacity,basePrice:rateCandidates[0]??0,baseFinalPrice:finalRateCandidates[0]??0,baseConfiguredPrice:configuredRateCandidates[0]??0,rateCandidates,finalRateCandidates,configuredRateCandidates,freeRooms:typeRooms}}).filter(type=>type.available>0).sort((a,b)=>a.name.localeCompare(b.name,"es"))
    return{types,rooms:roomRes.data||[],occupiedCount:occupied.size,pricing}
  },[propertyId])
}
