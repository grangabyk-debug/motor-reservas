"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const norm=value=>String(value||"").trim().toLowerCase()
const inactiveReservation=row=>["cancelada","cancelled","anulada","anulado","fusionada","fusionado","merged"].includes(norm(row?.estado))||Boolean(row?.no_show)
const dateKey=date=>date.toLocaleDateString("en-CA")
const addDays=(value,days)=>{const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+days);return dateKey(date)}
const nights=(start,end)=>Math.max(1,Math.round((new Date(`${end}T12:00:00`)-new Date(`${start}T12:00:00`))/86400000))
const inNight=(date,start,end)=>Boolean(start&&end&&start<=date&&date<end)
const money=(value,currency)=>{try{return new Intl.NumberFormat("es-AR",{style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0)}catch{return`${currency} ${(Number(value)||0).toFixed(2)}`}}
const pct=value=>`${(Number(value)||0).toLocaleString("es-AR",{minimumFractionDigits:1,maximumFractionDigits:1})} %`

function dateRange(start,end){
  const out=[];if(!start||!end||start>end)return out
  for(let value=start;value<=end;value=addDays(value,1))out.push(value)
  return out
}

function detailDates(detail,reservation){
  return{
    start:detail?.fecha_entrada||reservation?.fecha_entrada,
    end:detail?.planned_fecha_salida||detail?.fecha_salida||reservation?.fecha_salida,
  }
}

function roomIdsForNight(reservation,date){
  const details=Array.isArray(reservation?.habitaciones_detalle)?reservation.habitaciones_detalle:[],ids=new Set()
  for(const detail of details){
    const id=Number(detail?.habitacion_id),role=norm(detail?.segment_role),span=detailDates(detail,reservation)
    if(!id||role==="transient_room"||!inNight(date,span.start,span.end))continue
    ids.add(id)
  }
  if(ids.size)return[...ids]
  const released=reservation?.room_checkout_dates||{}
  for(const raw of [reservation?.habitacion_id,...(reservation?.habitaciones_ids||[])]){
    const id=Number(raw);if(!id)continue
    const release=released[String(id)]
    if(release&&date>=release)continue
    ids.add(id)
  }
  return[...ids]
}

function guestsForNight(reservation,date){
  const details=Array.isArray(reservation?.habitaciones_detalle)?reservation.habitaciones_detalle:[],active=details.filter(detail=>{
    const span=detailDates(detail,reservation),role=norm(detail?.segment_role)
    return role!=="transient_room"&&inNight(date,span.start,span.end)
  })
  const detailed=active.reduce((sum,detail)=>sum+Math.max(0,Number(detail?.huespedes)||0),0)
  return detailed||Math.max(1,Number(reservation?.cantidad_huespedes)||1)
}

function convert(amount,from,to,fx){
  const source=String(from||to||"ARS").toUpperCase(),target=String(to||source).toUpperCase(),value=Number(amount)||0
  if(source===target)return value
  if(source==="USD"&&target==="ARS"&&fx>0)return value*fx
  if(source==="ARS"&&target==="USD"&&fx>0)return value/fx
  return null
}

function roomRevenueForNight(items,date,currency,fx,reservations){
  let total=0
  const hasRoomRevenue=new Set()
  for(const item of items){
    const type=norm(item?.source_type),meta=item?.metadata||{},reservationId=Number(item?.reservation_id)
    if(type==="lodging"){
      hasRoomRevenue.add(reservationId)
      const start=meta.room_start||item.service_date,end=meta.room_end||(start?addDays(start,Math.max(1,Number(meta.nights)||1)):null)
      if(!inNight(date,start,end))continue
      const divisor=Math.max(1,Number(meta.nights)||nights(start,end)),converted=convert((Number(item.total)||0)/divisor,item.currency,currency,fx)
      if(converted!==null)total+=converted
      continue
    }
    const roomDelta=meta.room_change_financial_component===true||meta.same_day_room_component===true||/^(room-change-delta|same-day-upgrade|same-day-delta):/.test(String(item?.source_key||""))
    if(type==="adjustment"&&roomDelta){
      hasRoomRevenue.add(reservationId)
      if(item.service_date!==date)continue
      const converted=convert(item.total,item.currency,currency,fx)
      if(converted!==null)total+=converted
    }
  }
  for(const reservation of reservations){
    if(hasRoomRevenue.has(Number(reservation.id))||!inNight(date,reservation.fecha_entrada,reservation.fecha_salida))continue
    const stayNights=nights(reservation.fecha_entrada,reservation.fecha_salida),base=Number(reservation.precio_total??reservation.subtotal)||0,converted=convert(base/stayNights,reservation.moneda,currency,fx)
    if(converted!==null)total+=converted
  }
  return total
}

export const OCCUPANCY_COLUMNS=[
  {key:"date",label:"Fecha",required:true},{key:"weekday",label:"Día"},{key:"occupied",label:"Ocupadas",required:true},{key:"adr",label:"ADR",required:true},{key:"revpar",label:"RevPAR",required:true},
  {key:"guests",label:"Huéspedes"},{key:"occupancy",label:"Ocupación"},{key:"available",label:"Disponibles"},{key:"subtotal",label:"Subtotal"},{key:"currency",label:"Moneda"},
]

export const OCCUPANCY_TOTALS=[
  {key:"occupied",label:"Habitaciones/noche",value:rows=>rows.reduce((sum,row)=>sum+(Number(row.occupiedValue)||0),0)},
  {key:"guests",label:"Huéspedes/noche",value:rows=>rows.reduce((sum,row)=>sum+(Number(row.guestsValue)||0),0)},
  {key:"revenue",label:"Ingresos alojamiento",value:rows=>rows.length?money(rows.reduce((sum,row)=>sum+(Number(row.revenueValue)||0),0),rows[0].currency):money(0,"ARS")},
]

export function rangeLabel(start,end){
  const format=value=>{const[y,m,d]=String(value||"").split("-");return y&&m&&d?`${d}/${m}/${y}`:value||""}
  return start===end?format(start):`${format(start)} → ${format(end)}`
}

export default function useOccupancyReport({propertyId,startDate,endDate,enabled=true}){
  const[rows,setRows]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState(""),[currency,setCurrency]=useState("ARS"),[refresh,setRefresh]=useState(0)
  const reload=useCallback(()=>setRefresh(value=>value+1),[])
  useEffect(()=>{
    let alive=true
    if(!propertyId||!enabled||!startDate||!endDate||startDate>endDate){setRows([]);return}
    ;(async()=>{
      setLoading(true);setError("")
      try{
        const[roomRes,reservationRes,blockRes,settingRes]=await Promise.all([
          supabase.from("habitaciones").select("id").eq("property_id",propertyId).eq("activa",true),
          supabase.from("reservas").select("id,fecha_entrada,fecha_salida,estado,no_show,cantidad_huespedes,habitacion_id,habitaciones_ids,habitaciones_detalle,room_checkout_dates,moneda,precio_total,subtotal").eq("property_id",propertyId).lte("fecha_entrada",endDate).gt("fecha_salida",startDate),
          supabase.from("bloqueos").select("habitacion_id,fecha_desde,fecha_hasta").eq("property_id",propertyId).lte("fecha_desde",endDate).gte("fecha_hasta",startDate),
          supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
        ])
        for(const result of[roomRes,reservationRes,blockRes,settingRes])if(result.error)throw result.error
        const reservations=(reservationRes.data||[]).filter(row=>!inactiveReservation(row)),reservationIds=reservations.map(row=>row.id),itemRes=reservationIds.length?await supabase.from("hotel_folio_items").select("reservation_id,source_type,source_key,service_date,total,currency,status,metadata").eq("property_id",propertyId).eq("status","active").in("reservation_id",reservationIds):{data:[],error:null}
        if(itemRes.error)throw itemRes.error
        const settings=settingRes.data?.settings||{},pricing=settings.pricing||{},reportCurrency=String(pricing.rate_currency||"ARS").toUpperCase(),fx=Math.max(0,Number(pricing.last_conversion_rate)||0),roomSet=new Set((roomRes.data||[]).map(room=>Number(room.id))),blocks=blockRes.data||[],items=itemRes.data||[]
        const next=dateRange(startDate,endDate).map(date=>{
          const occupiedIds=new Set(),staying=[]
          for(const reservation of reservations){
            if(!inNight(date,reservation.fecha_entrada,reservation.fecha_salida))continue
            const ids=roomIdsForNight(reservation,date).filter(id=>roomSet.has(id))
            if(!ids.length)continue
            ids.forEach(id=>occupiedIds.add(id));staying.push(reservation)
          }
          const blocked=new Set(blocks.filter(block=>block.fecha_desde<=date&&block.fecha_hasta>=date).map(block=>Number(block.habitacion_id)).filter(id=>roomSet.has(id))),available=Math.max(0,roomSet.size-blocked.size),occupied=occupiedIds.size,guests=staying.reduce((sum,reservation)=>sum+guestsForNight(reservation,date),0),revenue=roomRevenueForNight(items,date,reportCurrency,fx,staying),adr=occupied?revenue/occupied:0,revpar=available?revenue/available:0,occupancy=available?(occupied/available)*100:0
          return{id:`occ-${date}`,date:new Intl.DateTimeFormat("es-AR").format(new Date(`${date}T12:00:00`)),weekday:new Intl.DateTimeFormat("es-AR",{weekday:"long"}).format(new Date(`${date}T12:00:00`)),occupied:String(occupied),occupiedValue:occupied,adr:money(adr,reportCurrency),adrValue:adr,revpar:money(revpar,reportCurrency),revparValue:revpar,guests:String(guests),guestsValue:guests,occupancy:pct(occupancy),occupancyValue:occupancy,available:String(available),availableValue:available,subtotal:money(revenue,reportCurrency),revenueValue:revenue,currency:reportCurrency}
        })
        if(alive){setCurrency(reportCurrency);setRows(next)}
      }catch(err){if(alive){setRows([]);setError(err?.message||"No se pudo calcular el informe de ocupación.")}}
      finally{if(alive)setLoading(false)}
    })()
    return()=>{alive=false}
  },[propertyId,startDate,endDate,enabled,refresh])
  return useMemo(()=>({rows,loading,error,currency,reload}),[rows,loading,error,currency,reload])
}
