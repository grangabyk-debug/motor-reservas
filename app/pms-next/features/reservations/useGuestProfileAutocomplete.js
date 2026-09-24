"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const PROFILE_FIELDS=["full_name","email","phone","document_type","document_number","birth_date","sex","marital_status","cuil","nationality","language","address","city","province","country","postal_code","occupation","travel_reason","document_front_path","document_back_path","notes"]
const lower=value=>String(value||"").trim().toLocaleLowerCase("es")
const digits=value=>String(value||"").replace(/\D/g,"")
const alnum=value=>lower(value).replace(/[^a-z0-9áéíóúüñ]/g,"")
const identityMatches=(profile,guest)=>Boolean(
  profile&&guest&&(
    (profile.email&&guest.email&&lower(profile.email)===lower(guest.email))||
    (profile.document_number&&guest.document_number&&alnum(profile.document_number)===alnum(guest.document_number))||
    (profile.phone&&guest.phone&&digits(profile.phone)&&digits(profile.phone)===digits(guest.phone))
  )
)

export default function useGuestProfileAutocomplete({propertyId,draft,setDraft}){
  const[profileMatches,setProfileMatches]=useState([]),[profileSearching,setProfileSearching]=useState(false),[profileApplied,setProfileApplied]=useState("")
  useEffect(()=>{
    const term=String(draft?.full_name||"").trim()
    if(!propertyId||draft?.checked_out_at||term.length<3){setProfileMatches([]);setProfileSearching(false);return}
    let cancelled=false
    const timer=setTimeout(async()=>{
      setProfileSearching(true)
      try{
        const needle=term.replace(/[%_*,()]/g," ").trim().replace(/\s+/g," ")
        if(needle.length<3){if(!cancelled)setProfileMatches([]);return}
        const selectFields="id,full_name,email,phone,document_type,document_number,birth_date,sex,marital_status,cuil,nationality,language,address,city,province,country,postal_code,occupation,travel_reason,document_front_path,document_back_path,notes,last_stay_at,status,merged_into_id"
        const direct=await supabase.from("hotel_guest_profiles").select(selectFields).eq("property_id",propertyId).eq("status","active").is("merged_into_id",null).ilike("full_name",`%${needle}%`).order("last_stay_at",{ascending:false,nullsFirst:false}).limit(6)
        if(direct.error)throw direct.error
        const matches=[...(direct.data||[])]
        if(matches.length<6){
          const historical=await supabase.from("hotel_reservation_guests").select("guest_profile_id,full_name,email,phone,document_number,updated_at").eq("property_id",propertyId).not("guest_profile_id","is",null).ilike("full_name",`%${needle}%`).order("updated_at",{ascending:false}).limit(12)
          if(!historical.error&&historical.data?.length){
            const known=new Set(matches.map(profile=>String(profile.id)))
            const ids=[...new Set(historical.data.map(row=>row.guest_profile_id).filter(Boolean).map(String))].filter(id=>!known.has(id))
            if(ids.length){
              const linked=await supabase.from("hotel_guest_profiles").select(selectFields).eq("property_id",propertyId).eq("status","active").is("merged_into_id",null).in("id",ids)
              if(!linked.error){
                for(const row of historical.data){
                  if(matches.length>=6)break
                  const profile=(linked.data||[]).find(candidate=>String(candidate.id)===String(row.guest_profile_id))
                  if(!profile||known.has(String(profile.id))||!identityMatches(profile,row))continue
                  matches.push({...profile,full_name:row.full_name||profile.full_name,_historical_name:row.full_name||""})
                  known.add(String(profile.id))
                }
              }
            }
          }
        }
        if(!cancelled)setProfileMatches(matches.slice(0,6))
      }catch{if(!cancelled)setProfileMatches([])}
      finally{if(!cancelled)setProfileSearching(false)}
    },240)
    return()=>{cancelled=true;clearTimeout(timer)}
  },[propertyId,draft?.full_name,draft?.checked_out_at,draft?.guest_profile_id])

  function resetGuestProfileSearch(){setProfileMatches([]);setProfileApplied("")}
  function clearAppliedProfile(){setProfileApplied("")}
  function applyGuestProfile(profile){
    if(!profile)return
    setDraft(current=>{const next={...current,guest_profile_id:profile.id};for(const key of PROFILE_FIELDS)next[key]=profile[key]??"";return next})
    setProfileApplied(profile.full_name||"Huésped registrado");setProfileMatches([])
  }
  return{profileMatches,profileSearching,profileApplied,applyGuestProfile,resetGuestProfileSearch,clearAppliedProfile}
}
