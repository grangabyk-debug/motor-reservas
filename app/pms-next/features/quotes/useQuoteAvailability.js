"use client"

import{useCallback}from"react"
import{supabase}from"../../../../lib/supabase"

const DAY=86400000
const daysBetween=(start,end)=>{const out=[];for(let d=new Date(`${start}T12:00:00`),limit=new Date(`${end}T12:00:00`);d<limit;d=new Date(d.getTime()+DAY))out.push(d.toISOString().slice(0,10));return out}

export default function useQuoteAvailability(propertyId){
  return useCallback(async(start,end,{excludeGroupId=null}={})=>{
    if(!propertyId||!start||!end||end<=start)return{types:[],rooms:[],occupiedCount:0}
    const[roomRes,resRes,blockRes,groupBlockRes,rateRes]=await Promise.all([
      supabase.from("habitaciones").select("id,nombre,tipo,capacidad,precio,activa,sort_order").eq("property_id",propertyId).eq("activa",true).order("sort_order").order("nombre"),
      supabase.from("reservas").select("id,habitacion_id,habitaciones_ids,estado,no_show,fecha_entrada,fecha_salida").eq("property_id",propertyId).neq("estado","cancelada").eq("no_show",false).lt("fecha_entrada",end).gt("fecha_salida",start),
      supabase.from("bloqueos").select("id,habitacion_id,fecha_desde,fecha_hasta,motivo").eq("property_id",propertyId).lt("fecha_desde",end).gt("fecha_hasta",start),
      supabase.from("hotel_group_inventory_blocks").select("id,group_id,room_type,quantity,arrival_date,departure_date,status").eq("property_id",propertyId).neq("status","released").lt("arrival_date",end).gt("departure_date",start),
      supabase.from("hotel_rate_calendar").select("habitacion_id,stay_date,price").eq("property_id",propertyId).gte("stay_date",start).lt("stay_date",end),
    ])
    for(const result of[roomRes,resRes,blockRes,groupBlockRes,rateRes])if(result.error)throw result.error
    const occupied=new Set()
    for(const reservation of resRes.data||[]){if(reservation.habitacion_id)occupied.add(Number(reservation.habitacion_id));for(const id of reservation.habitaciones_ids||[])occupied.add(Number(id))}
    for(const block of blockRes.data||[])occupied.add(Number(block.habitacion_id))
    const dates=daysBetween(start,end),rateMap=new Map((rateRes.data||[]).map(row=>[`${Number(row.habitacion_id)}:${row.stay_date}`,Number(row.price)]))
    const free=(roomRes.data||[]).filter(room=>!occupied.has(Number(room.id))).map(room=>{const rates=dates.map(day=>{const exact=rateMap.get(`${Number(room.id)}:${day}`);return Number.isFinite(exact)?exact:Math.max(0,Number(room.precio)||0)}),quoteRate=rates.length?rates.reduce((sum,value)=>sum+value,0)/rates.length:Math.max(0,Number(room.precio)||0);return{...room,quoteRate,quoteRates:rates}})
    const groupBlocks=(groupBlockRes.data||[]).filter(block=>!excludeGroupId||String(block.group_id)!==String(excludeGroupId))
    const reservedByType=new Map()
    for(const block of groupBlocks){const key=String(block.room_type||"").toLowerCase();reservedByType.set(key,(reservedByType.get(key)||0)+Math.max(0,Number(block.quantity)||0))}
    const grouped=new Map()
    for(const room of free){const name=room.tipo||"Sin tipo";if(!grouped.has(name))grouped.set(name,[]);grouped.get(name).push(room)}
    const types=[...grouped.entries()].map(([name,rawRooms])=>{
      const typeRooms=[...rawRooms].sort((a,b)=>(Number(a.quoteRate)||0)-(Number(b.quoteRate)||0)||String(a.nombre).localeCompare(String(b.nombre),"es",{numeric:true}))
      const reserved=reservedByType.get(name.toLowerCase())||0,available=Math.max(0,typeRooms.length-reserved),sellable=typeRooms.slice(reserved),rateCandidates=sellable.map(room=>Number(room.quoteRate)||0),basePrice=rateCandidates[0]??0,capacity=typeRooms.reduce((max,room)=>Math.max(max,Number(room.capacidad)||1),1)
      return{name,available,reserved,capacity,basePrice,rateCandidates,freeRooms:typeRooms}
    }).filter(type=>type.available>0).sort((a,b)=>a.name.localeCompare(b.name,"es"))
    return{types,rooms:roomRes.data||[],occupiedCount:occupied.size}
  },[propertyId])
}
