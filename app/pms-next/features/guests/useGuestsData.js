"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import usePmsAutoRefresh from"../../core/usePmsAutoRefresh"

function canonicalKey(draft){
  const email=draft.email?.trim().toLowerCase();if(email)return`email:${email}`
  const phone=draft.phone?.replace(/\D/g,"");if(phone)return`phone:${phone}`
  return`manual:${crypto.randomUUID()}`
}

export default function useGuestsData(propertyId){
  const[profiles,setProfiles]=useState([])
  const[reservations,setReservations]=useState([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[profileRes,reservationRes]=await Promise.all([
        supabase.from("hotel_guest_profiles").select("id,full_name,email,phone,document_type,document_number,birth_date,nationality,language,address,city,province,country,preferences,tags,vip_level,status,notes,last_stay_at,created_at,updated_at").eq("property_id",propertyId).order("last_stay_at",{ascending:false,nullsFirst:false}).order("full_name"),
        supabase.from("reservas").select("id,guest_profile_id,nombre_huesped,email_huesped,telefono_huesped,fecha_entrada,fecha_salida,estado,precio_total,moneda,canal_reserva,habitacion_id").eq("property_id",propertyId).neq("estado","cancelada").order("fecha_salida",{ascending:false}),
      ])
      if(profileRes.error)throw profileRes.error;if(reservationRes.error)throw reservationRes.error
      setProfiles(profileRes.data||[]);setReservations(reservationRes.data||[])
    }catch(err){setError(err?.message||"No se pudo cargar el CRM de huéspedes.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])
  usePmsAutoRefresh(propertyId,load,["reservas","hotel_guest_profiles"])

  const statsByProfile=useMemo(()=>{
    const map=new Map()
    for(const reservation of reservations){
      if(!reservation.guest_profile_id)continue
      const key=reservation.guest_profile_id,existing=map.get(key)||{stays:0,spent:0,lastStay:null}
      existing.stays+=1;existing.spent+=Number(reservation.precio_total)||0
      if(!existing.lastStay||reservation.fecha_salida>existing.lastStay)existing.lastStay=reservation.fecha_salida
      map.set(key,existing)
    }
    return map
  },[reservations])

  const guests=useMemo(()=>profiles.map(profile=>({...profile,...(statsByProfile.get(profile.id)||{stays:0,spent:0,lastStay:profile.last_stay_at})})),[profiles,statsByProfile])

  const createGuest=useCallback(async draft=>{
    const payload={property_id:propertyId,canonical_key:canonicalKey(draft),full_name:draft.full_name.trim(),email:draft.email?.trim()||null,phone:draft.phone?.trim()||null,country:draft.country?.trim()||null,nationality:draft.nationality?.trim()||null,language:draft.language||"es",preferences:{},tags:[],vip_level:draft.vip_level||"standard",status:"active",notes:draft.notes?.trim()||null}
    const{data,error:insertError}=await supabase.from("hotel_guest_profiles").insert(payload).select().single();if(insertError)throw insertError
    setProfiles(list=>[data,...list]);return data
  },[propertyId])

  const updateGuest=useCallback(async(id,patch)=>{
    const{data,error:updateError}=await supabase.from("hotel_guest_profiles").update({...patch,updated_at:new Date().toISOString()}).eq("id",id).eq("property_id",propertyId).select().single();if(updateError)throw updateError
    setProfiles(list=>list.map(item=>item.id===data.id?data:item));return data
  },[propertyId])

  return{guests,reservations,loading,error,setError,load,createGuest,updateGuest}
}
