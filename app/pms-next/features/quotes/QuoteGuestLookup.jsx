"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const clean=value=>String(value||"").trim()
const safeLike=value=>clean(value).replace(/[%_*,()]/g," ").replace(/\s+/g," ")
const shortDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`)).replaceAll(".",""):""

export default function QuoteGuestLookup({propertyId,name,email,phone,selectedId="",onSelect}){
  const[matches,setMatches]=useState([]),[stats,setStats]=useState({}),[loading,setLoading]=useState(false)
  const query=useMemo(()=>({name:clean(name),email:clean(email).toLowerCase(),phone:clean(phone)}),[name,email,phone])
  useEffect(()=>{
    if(!propertyId){setMatches([]);return}
    const byName=query.name.length>=3,byEmail=query.email.length>=3,byPhone=query.phone.replace(/\D/g,"").length>=4
    if(!byName&&!byEmail&&!byPhone){setMatches([]);setStats({});return}
    let cancelled=false
    const timer=setTimeout(async()=>{
      setLoading(true)
      try{
        const select="id,full_name,email,phone,country,last_stay_at,status,merged_into_id",requests=[]
        if(byName)requests.push(supabase.from("hotel_guest_profiles").select(select).eq("property_id",propertyId).eq("status","active").is("merged_into_id",null).ilike("full_name",`%${safeLike(query.name)}%`).limit(6))
        if(byEmail)requests.push(supabase.from("hotel_guest_profiles").select(select).eq("property_id",propertyId).eq("status","active").is("merged_into_id",null).ilike("email",`%${safeLike(query.email)}%`).limit(6))
        if(byPhone)requests.push(supabase.from("hotel_guest_profiles").select(select).eq("property_id",propertyId).eq("status","active").is("merged_into_id",null).ilike("phone",`%${safeLike(query.phone)}%`).limit(6))
        const results=await Promise.all(requests),byId=new Map()
        for(const result of results)if(!result.error)for(const profile of result.data||[])byId.set(profile.id,profile)
        const rows=[...byId.values()].slice(0,6),nextStats={}
        if(rows.length){
          const ids=rows.map(row=>row.id),today=new Date().toISOString().slice(0,10)
          const reservations=await supabase.from("reservas").select("guest_profile_id,fecha_salida,estado,no_show").eq("property_id",propertyId).in("guest_profile_id",ids).neq("estado","cancelada")
          if(!reservations.error)for(const profile of rows){
            const stays=(reservations.data||[]).filter(row=>String(row.guest_profile_id)===String(profile.id)&&row.no_show!==true&&row.fecha_salida&&row.fecha_salida<=today)
            nextStats[profile.id]={stays:stays.length,lastStay:stays.map(row=>row.fecha_salida).sort().at(-1)||profile.last_stay_at||null}
          }
        }
        if(!cancelled){setMatches(rows);setStats(nextStats)}
      }catch{if(!cancelled){setMatches([]);setStats({})}}
      finally{if(!cancelled)setLoading(false)}
    },240)
    return()=>{cancelled=true;clearTimeout(timer)}
  },[propertyId,query.name,query.email,query.phone])

  if(!loading&&!matches.length)return null
  return <section style={{gridColumn:"1 / -1",padding:"10px 11px",border:"1px solid var(--line)",borderRadius:12,background:"color-mix(in srgb,var(--bg) 45%,var(--panelSolid))"}}>
    <div style={{marginBottom:7}}><b style={{display:"block",fontSize:11.5}}>Huéspedes registrados</b><small style={{display:"block",marginTop:2,color:"var(--muted)",fontSize:9.5}}>Buscá un pasajero frecuente y usá sus datos en el presupuesto.</small></div>
    {loading?<small style={{color:"var(--muted)"}}>Buscando huéspedes…</small>:<div style={{display:"grid",gap:6}}>{matches.map(profile=>{const selected=String(profile.id)===String(selectedId),info=stats[profile.id]||{};return <button key={profile.id} type="button" onClick={()=>onSelect?.(profile)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,width:"100%",padding:"8px 9px",border:`1px solid ${selected?"color-mix(in srgb,var(--accent) 48%,var(--line))":"var(--line)"}`,borderRadius:9,background:selected?"color-mix(in srgb,var(--accent) 7%,var(--panelSolid))":"var(--panelSolid)",color:"var(--text)",font:"inherit",textAlign:"left",cursor:"pointer"}}><span style={{minWidth:0}}><b style={{display:"block",fontSize:10.8}}>{profile.full_name}</b><small style={{display:"block",marginTop:2,color:"var(--muted)",fontSize:9.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{profile.email||profile.phone||profile.country||"Huésped registrado"}{info.lastStay?` · Última ${shortDate(info.lastStay)}`:""}</small></span><span style={{flex:"0 0 auto",fontSize:9.3,fontWeight:850,color:selected?"#2d9f62":"var(--accent)"}}>{selected?"Seleccionado":info.stays>1?`${info.stays} estadías`:info.stays===1?"Ya se alojó":"Usar datos"}</span></button>})}</div>}
  </section>
}
