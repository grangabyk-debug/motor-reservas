"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const text=value=>String(value||"").trim()
const norm=value=>text(value).toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ")
const digits=value=>text(value).replace(/\D/g,"")
function Icon(){return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 20a5.5 5.5 0 0 1 11 0M10.5 20a5.5 5.5 0 0 1 11 0"/><path d="m10 13 2 2 2-2"/></svg>}

function reasonFor(a,b){
  const ae=norm(a.email),be=norm(b.email),ad=norm(a.document_number),bd=norm(b.document_number),ap=digits(a.phone),bp=digits(b.phone),an=norm(a.full_name),bn=norm(b.full_name)
  if(ae&&be&&ae===be)return"Mismo email"
  if(ad&&bd&&ad===bd)return"Mismo documento"
  if(ap.length>=7&&bp.length>=7&&ap===bp)return"Mismo teléfono"
  if(an&&an===bn&&a.birth_date&&b.birth_date&&a.birth_date===b.birth_date)return"Mismo nombre y fecha de nacimiento"
  return""
}
function completeness(p){return["full_name","email","phone","document_number","birth_date","nationality","address","city","country"].reduce((n,key)=>n+(text(p?.[key])?1:0),0)+(Array.isArray(p?.tags)?p.tags.length:0)}

export default function GuestDuplicateWatch({propertyId}){
  const[profiles,setProfiles]=useState([]),[working,setWorking]=useState(""),[message,setMessage]=useState("")
  const load=useCallback(async()=>{if(!propertyId)return;const{data,error}=await supabase.from("hotel_guest_profiles").select("id,full_name,email,phone,document_number,birth_date,nationality,address,city,country,tags,vip_level,created_at").eq("property_id",propertyId).eq("status","active").order("created_at").limit(800);if(error){setMessage(error.message||"No se pudieron revisar perfiles duplicados.");return}setProfiles(data||[])},[propertyId])
  useEffect(()=>{load()},[load])
  const candidates=useMemo(()=>{
    const out=[]
    for(let i=0;i<profiles.length;i++)for(let j=i+1;j<profiles.length;j++){const reason=reasonFor(profiles[i],profiles[j]);if(!reason)continue;out.push({a:profiles[i],b:profiles[j],reason,key:`${profiles[i].id}:${profiles[j].id}`});if(out.length>=8)return out}
    return out
  },[profiles])
  async function merge(primary,duplicate,key){
    if(working)return
    const ok=window.confirm(`Fusionar ${duplicate.full_name||"el perfil duplicado"} dentro de ${primary.full_name||"el perfil principal"}? Se conservarán historial, reservas, documentos, etiquetas y preferencias.`);if(!ok)return
    setWorking(key);setMessage("")
    try{const{error}=await supabase.rpc("hl_merge_guest_profiles_atomic",{p_primary_id:primary.id,p_duplicate_id:duplicate.id});if(error)throw error;setMessage("Perfiles fusionados. Las reservas y el historial quedaron vinculados a una sola ficha.");await load();if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-reservation-updated"))}
    catch(err){setMessage(err?.message||"No se pudieron fusionar los perfiles.")}finally{setWorking("")}
  }
  if(!candidates.length&&!message)return null
  const shell={marginBottom:12,border:"1px solid color-mix(in srgb,#c79727 24%,var(--line))",borderRadius:15,background:"color-mix(in srgb,#d4a63e 5%,var(--panelSolid))",overflow:"hidden"}
  return <section style={shell} aria-label="Posibles perfiles de huésped duplicados"><header style={{padding:"10px 12px",display:"flex",alignItems:"center",gap:8,borderBottom:candidates.length?"1px solid var(--line)":"0"}}><span style={{width:29,height:29,display:"grid",placeItems:"center",borderRadius:9,background:"color-mix(in srgb,#d4a63e 12%,var(--panelSolid))",color:"#9a6b10"}}><Icon/></span><div><small style={{display:"block",fontSize:8.8,fontWeight:900,letterSpacing:".08em",color:"#946914"}}>PERFILES PARA REVISAR</small><b style={{display:"block",fontSize:11.5}}>{candidates.length?`${candidates.length} posible${candidates.length===1?"":"s"} duplicado${candidates.length===1?"":"s"}`:"Revisión de perfiles"}</b></div></header>{message?<div style={{margin:10,padding:"8px 10px",borderRadius:9,background:"var(--panelSolid)",fontSize:10,color:"var(--muted)"}}>{message}</div>:null}{candidates.length?<div style={{display:"grid",gap:7,padding:10}}>{candidates.slice(0,4).map(pair=>{const preferred=completeness(pair.a)>=completeness(pair.b)?pair.a:pair.b,other=preferred.id===pair.a.id?pair.b:pair.a;return <article key={pair.key} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"center",padding:10,border:"1px solid var(--line)",borderRadius:11,background:"var(--panelSolid)"}}><div><b style={{display:"block",fontSize:10.8}}>{pair.a.full_name||"Sin nombre"} / {pair.b.full_name||"Sin nombre"}</b><small style={{display:"block",marginTop:3,fontSize:9.3,color:"var(--muted)"}}>{pair.reason} · sugerido conservar: {preferred.full_name||"perfil más completo"}</small></div><div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}><button type="button" disabled={Boolean(working)} onClick={()=>merge(preferred,other,pair.key)} style={{height:32,padding:"0 10px",border:0,borderRadius:9,background:"var(--accent)",color:"#fff",font:"inherit",fontSize:9.5,fontWeight:850}}>Fusionar sugerido</button><button type="button" disabled={Boolean(working)} onClick={()=>merge(other,preferred,pair.key)} style={{height:32,padding:"0 9px",border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:9.5,fontWeight:820}}>Conservar el otro</button></div></article>})}</div>:null}</section>
}
