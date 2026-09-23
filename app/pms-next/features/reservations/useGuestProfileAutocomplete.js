"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const PROFILE_FIELDS=["full_name","email","phone","document_type","document_number","birth_date","sex","marital_status","cuil","nationality","language","address","city","province","country","postal_code","occupation","travel_reason","document_front_path","document_back_path"]

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
        const{data,error}=await supabase.from("hotel_guest_profiles").select("id,full_name,email,phone,document_type,document_number,birth_date,sex,marital_status,cuil,nationality,language,address,city,province,country,postal_code,occupation,travel_reason,document_front_path,document_back_path,last_stay_at,status,merged_into_id").eq("property_id",propertyId).eq("status","active").is("merged_into_id",null).ilike("full_name",`%${needle}%`).order("last_stay_at",{ascending:false,nullsFirst:false}).limit(6)
        if(error)throw error
        if(!cancelled)setProfileMatches((data||[]).filter(profile=>String(profile.id)!==String(draft?.guest_profile_id||"")))
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
