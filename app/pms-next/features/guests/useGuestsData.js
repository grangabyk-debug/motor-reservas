"use client"

import{useCallback,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import usePmsAutoRefresh from"../../core/usePmsAutoRefresh"
import{isBookingChannel,isOtaChannel}from"./guestCrm"

const LIST_LIMIT=28
const SEARCH_LIMIT=60
function canonicalKey(draft){const email=draft.email?.trim().toLowerCase();if(email)return`email:${email}`;const phone=draft.phone?.replace(/\D/g,"");if(phone)return`phone:${phone}`;return`manual:${crypto.randomUUID()}`}
const todayKey=()=>new Date().toLocaleDateString("en-CA")
const nightsBetween=(from,to)=>{const a=new Date(`${from}T12:00:00`),b=new Date(`${to}T12:00:00`);return Number.isNaN(a.getTime())||Number.isNaN(b.getTime())?0:Math.max(0,Math.round((b-a)/86400000))}
const emptyStats=profile=>({stays:0,nights:0,spent:0,spentByCurrency:{},lastStay:profile?.last_stay_at||null,nextStay:null,currentStay:null,channelCounts:{},dominantChannel:"",lastChannel:"",otaStays:0,bookingStays:0,directStays:0})
const cleanSearch=value=>String(value||"").trim().replace(/[,%()]/g," ").replace(/\s+/g," ").slice(0,80)

export default function useGuestsData(propertyId,searchTerm=""){
  const[profiles,setProfiles]=useState([])
  const[reservations,setReservations]=useState([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")
  const[totalProfiles,setTotalProfiles]=useState(0)

  const load=useCallback(async(silent=false)=>{
    if(!propertyId)return
    if(!silent)setLoading(true)
    setError("")
    try{
      const term=cleanSearch(searchTerm)
      let profileQuery=supabase.from("hotel_guest_profiles").select("id,full_name,email,phone,document_type,document_number,birth_date,nationality,language,address,city,province,country,preferences,tags,vip_level,status,notes,last_stay_at,created_at,updated_at",{count:"exact"}).eq("property_id",propertyId).order("last_stay_at",{ascending:false,nullsFirst:false}).order("full_name").limit(term?SEARCH_LIMIT:LIST_LIMIT)
      if(term.length>=2)profileQuery=profileQuery.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,document_number.ilike.%${term}%`)
      const profileRes=await profileQuery
      if(profileRes.error)throw profileRes.error
      const nextProfiles=profileRes.data||[]
      const ids=nextProfiles.map(item=>item.id).filter(Boolean)
      let nextReservations=[]
      if(ids.length){
        const reservationRes=await supabase.from("reservas").select("id,guest_profile_id,nombre_huesped,email_huesped,telefono_huesped,fecha_entrada,fecha_salida,estado,precio_total,moneda,canal_reserva,habitacion_id").eq("property_id",propertyId).in("guest_profile_id",ids).neq("estado","cancelada").order("fecha_salida",{ascending:false}).limit(600)
        if(reservationRes.error)throw reservationRes.error
        nextReservations=reservationRes.data||[]
      }
      setProfiles(nextProfiles)
      setReservations(nextReservations)
      setTotalProfiles(Number(profileRes.count||nextProfiles.length))
    }catch(err){setError(err?.message||"No se pudo cargar el CRM de huéspedes.")}
    finally{if(!silent)setLoading(false)}
  },[propertyId,searchTerm])

  usePmsAutoRefresh(propertyId,load,["reservas","hotel_guest_profiles"])

  const statsByProfile=useMemo(()=>{
    const map=new Map(),today=todayKey()
    for(const reservation of reservations){
      if(!reservation.guest_profile_id)continue
      const key=reservation.guest_profile_id,existing=map.get(key)||emptyStats()
      const start=String(reservation.fecha_entrada||"").slice(0,10),end=String(reservation.fecha_salida||"").slice(0,10)
      if(!start)continue
      const isFuture=start>today,isCurrent=!isFuture&&Boolean(end)&&end>today
      const channel=String(reservation.canal_reserva||"Directa").trim()||"Directa"
      if(isFuture){if(!existing.nextStay||start<existing.nextStay)existing.nextStay=start;map.set(key,existing);continue}
      existing.stays+=1;existing.nights+=nightsBetween(start,end)
      const currency=String(reservation.moneda||"ARS").toUpperCase(),amount=Number(reservation.precio_total)||0
      existing.spent+=amount;existing.spentByCurrency[currency]=(existing.spentByCurrency[currency]||0)+amount
      existing.channelCounts[channel]=(existing.channelCounts[channel]||0)+1
      if(isOtaChannel(channel))existing.otaStays+=1;else existing.directStays+=1
      if(isBookingChannel(channel))existing.bookingStays+=1
      if(isCurrent){if(!existing.currentStay||start>existing.currentStay.checkIn)existing.currentStay={reservationId:reservation.id,checkIn:start,checkOut:end,channel}}
      else if(end&&(!existing.lastStay||end>existing.lastStay)){existing.lastStay=end;existing.lastChannel=channel}
      map.set(key,existing)
    }
    for(const stats of map.values())stats.dominantChannel=Object.entries(stats.channelCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]||stats.lastChannel||stats.currentStay?.channel||""
    return map
  },[reservations])

  const guests=useMemo(()=>profiles.map(profile=>({...profile,...(statsByProfile.get(profile.id)||emptyStats(profile))})),[profiles,statsByProfile])

  const createGuest=useCallback(async draft=>{
    const payload={property_id:propertyId,canonical_key:canonicalKey(draft),full_name:draft.full_name.trim(),email:draft.email?.trim()||null,phone:draft.phone?.trim()||null,birth_date:draft.birth_date||null,document_type:draft.document_type||null,document_number:draft.document_number?.trim()||null,country:draft.country?.trim()||null,nationality:draft.nationality?.trim()||null,language:draft.language||"es",address:draft.address?.trim()||null,city:draft.city?.trim()||null,province:draft.province?.trim()||null,preferences:draft.preferences||{},tags:Array.isArray(draft.tags)?draft.tags:[],vip_level:draft.vip_level||"standard",status:"active",notes:draft.notes?.trim()||null}
    const{data,error:insertError}=await supabase.from("hotel_guest_profiles").insert(payload).select().single();if(insertError)throw insertError
    setProfiles(list=>[data,...list].slice(0,SEARCH_LIMIT));setTotalProfiles(value=>value+1);return data
  },[propertyId])

  const updateGuest=useCallback(async(id,patch)=>{
    const{data,error:updateError}=await supabase.from("hotel_guest_profiles").update({...patch,updated_at:new Date().toISOString()}).eq("id",id).eq("property_id",propertyId).select().single();if(updateError)throw updateError
    setProfiles(list=>list.map(item=>item.id===data.id?data:item));return data
  },[propertyId])

  return{guests,reservations,totalProfiles,limited:totalProfiles>profiles.length,loading,error,setError,load,createGuest,updateGuest}
}
