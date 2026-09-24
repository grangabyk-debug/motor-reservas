"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const clean=value=>String(value??"").trim()

export default function useReservationPrimaryContact({reservation,propertyId}){
  const fallback=useMemo(()=>({
    full_name:clean(reservation?.nombre_huesped),
    email:clean(reservation?.email_huesped),
    phone:clean(reservation?.telefono_huesped),
    document_number:clean(reservation?.dni_huesped),
    guest_profile_id:reservation?.guest_profile_id||null
  }),[reservation?.id,reservation?.nombre_huesped,reservation?.email_huesped,reservation?.telefono_huesped,reservation?.dni_huesped,reservation?.guest_profile_id])
  const[contact,setContact]=useState(fallback)

  useEffect(()=>{
    let cancelled=false,timer=null
    async function load(){
      if(!reservation?.id||!propertyId){if(!cancelled)setContact(fallback);return}
      const guestRes=await supabase.from("hotel_reservation_guests")
        .select("full_name,email,phone,document_number,guest_profile_id")
        .eq("property_id",propertyId)
        .eq("reservation_id",Number(reservation.id))
        .eq("role","primary")
        .order("created_at",{ascending:true})
        .limit(1)
        .maybeSingle()
      if(cancelled)return
      if(guestRes.error||!guestRes.data){setContact(fallback);return}
      const guest=guestRes.data
      let profile=null
      if(guest.guest_profile_id){
        const profileRes=await supabase.from("hotel_guest_profiles")
          .select("full_name,email,phone,document_number")
          .eq("property_id",propertyId)
          .eq("id",guest.guest_profile_id)
          .is("merged_into_id",null)
          .maybeSingle()
        if(!cancelled&&!profileRes.error)profile=profileRes.data||null
      }
      if(cancelled)return
      setContact({
        full_name:clean(guest.full_name)||clean(profile?.full_name)||fallback.full_name,
        email:clean(guest.email)||clean(profile?.email)||fallback.email,
        phone:clean(guest.phone)||clean(profile?.phone)||fallback.phone,
        document_number:clean(guest.document_number)||clean(profile?.document_number)||fallback.document_number,
        guest_profile_id:guest.guest_profile_id||fallback.guest_profile_id
      })
    }
    const schedule=()=>{if(timer)clearTimeout(timer);timer=setTimeout(load,60)}
    const reservationEvent=event=>{const id=Number(event?.detail?.reservationId);if(!id||id===Number(reservation?.id))schedule()}
    const dataEvent=event=>{const tables=event?.detail?.tables||[];if(!tables.length||tables.some(table=>["hotel_reservation_guests","hotel_guest_profiles","reservas"].includes(table)))schedule()}
    setContact(fallback);load()
    if(typeof window!=="undefined"){window.addEventListener("hl:pms-reservation-updated",reservationEvent);window.addEventListener("hl:pms-data-updated",dataEvent)}
    return()=>{cancelled=true;if(timer)clearTimeout(timer);if(typeof window!=="undefined"){window.removeEventListener("hl:pms-reservation-updated",reservationEvent);window.removeEventListener("hl:pms-data-updated",dataEvent)}}
  },[reservation?.id,propertyId,fallback])

  return contact
}
