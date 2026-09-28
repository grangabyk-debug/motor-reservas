"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const roomIds=item=>[...new Set([item?.habitacion_id,...(item?.habitaciones_ids||[])].filter(Boolean).map(Number))]
const normalizeName=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ")
const normalizeEmail=value=>String(value||"").trim().toLowerCase()
const normalizePhone=value=>String(value||"").replace(/\D/g,"")
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${value}T12:00:00`)):"—"
const todayKey=()=>{const value=new Date();return`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`}
function reasonFor(a,b){if(a.guest_profile_id&&String(a.guest_profile_id)===String(b.guest_profile_id))return"Mismo huésped";const aEmail=normalizeEmail(a.email_huesped),bEmail=normalizeEmail(b.email_huesped);if(aEmail&&aEmail===bEmail)return"Mismo email";const aPhone=normalizePhone(a.telefono_huesped),bPhone=normalizePhone(b.telefono_huesped);if(aPhone.length>=6&&aPhone===bPhone)return"Mismo teléfono";const aName=normalizeName(a.nombre_huesped),bName=normalizeName(b.nombre_huesped);if(aName&&aName.split(" ").length>=2&&aName===bName)return"Mismo nombre";return""}
function findPairs(rows){const result=[];for(let index=0;index<rows.length;index++){const a=rows[index];for(let next=index+1;next<rows.length;next++){const b=rows[next];if(!(a.fecha_entrada<b.fecha_salida&&b.fecha_entrada<a.fecha_salida))continue;const reason=reasonFor(a,b);if(reason)result.push({a,b,reason})}}return result.sort((x,y)=>String(y.a.created_at||y.a.fecha_entrada||"").localeCompare(String(x.a.created_at||x.a.fecha_entrada||"")))}\nconst pairKey=(a,b)=>`duplicate:${[Number(a?.id),Number(b?.id)].sort((x,y)=>x-y).join(":")}`

export default function ReservationDuplicateWatch({propertyId}){
  const[rows,setRows]=useState([]),[rooms,setRooms]=useState([])
  const roomById=useMemo(()=>new Map(rooms.map(room=>[Number(room.id),room])),[rooms])
  const dismissSet=useMemo(()=>new Set(dismissed),[dismissed])\n  const pairs=useMemo(()=>findPairs(rows).filter(({a,b})=>!dismissSet.has(pairKey(a,b))),[rows,dismissSet])
  useEffect(()=>{
    if(!propertyId){setRows([]);setRooms([]);return}
    let cancelled=false,timer=null
    const load=async()=>{const[reservationRes,roomRes,settingsRes]=await Promise.all([supabase.from("reservas").select("id,numero_reserva,nombre_huesped,email_huesped,telefono_huesped,guest_profile_id,fecha_entrada,fecha_salida,estado,no_show,canal_reserva,habitacion_id,habitaciones_ids,created_at").eq("property_id",propertyId).neq("estado","cancelada").neq("estado","fusionada").eq("no_show",false).gte("fecha_salida",todayKey()).order("fecha_entrada").limit(1000),supabase.from("habitaciones").select("id,nombre").eq("property_id",propertyId).eq("activa",true),supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle()]);if(cancelled)return;if(!reservationRes.error)setRows(reservationRes.data||[]);if(!roomRes.error)setRooms(roomRes.data||[]);if(!settingsRes.error){const next=settingsRes.data?.settings||{},list=Array.isArray(next?.alert_dismissals?.reservation_duplicates)?next.alert_dismissals.reservation_duplicates:[];setSettings(next);setDismissed(list)}}
    load()
    const channel=supabase.channel(`reservation-duplicate-watch-${propertyId}`).on("postgres_changes",{event:"*",schema:"public",table:"reservas",filter:`property_id=eq.${propertyId}`},()=>{if(timer)clearTimeout(timer);timer=setTimeout(load,120)}).subscribe()
    return()=>{cancelled=true;if(timer)clearTimeout(timer);supabase.removeChannel(channel)}
  },[propertyId])
  async function dismissPair(a,b,event){
    event?.preventDefault?.();event?.stopPropagation?.()
    const key=pairKey(a,b);if(!key||savingKey)return
    setSavingKey(key)
    try{
      const current=await supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle()
      if(current.error)throw current.error
      const latest=current.data?.settings||settings||{},dismissals=latest.alert_dismissals||{},existing=Array.isArray(dismissals.reservation_duplicates)?dismissals.reservation_duplicates:[],nextDismissed=[key,...existing.filter(value=>value!==key)].slice(0,500),next={...latest,alert_dismissals:{...dismissals,reservation_duplicates:nextDismissed}}
      const{error}=await supabase.from("property_settings").upsert({property_id:propertyId,settings:next,updated_at:new Date().toISOString()},{onConflict:"property_id"})
      if(error)throw error
      setSettings(next);setDismissed(nextDismissed)
    }catch(err){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{tone:"error",title:"No se pudo descartar",message:err?.message||"Volvé a intentar."}}))}
    finally{setSavingKey("")}
  }

  function openReservation(item,event){event?.preventDefault?.();event?.stopPropagation?.();onOpenReservation?.(Number(item.id))}

  if(!pairs.length)return null
  return <div style={{margin:"0 14px 10px",padding:"11px 12px",border:"1px solid color-mix(in srgb,#d99424 38%,var(--line))",borderRadius:11,background:"color-mix(in srgb,#d99424 7%,var(--panelSolid))"}}><div><small style={{display:"block",fontSize:9.5,fontWeight:900,letterSpacing:".07em",color:"#b87917"}}>REVISIÓN AUTOMÁTICA</small><b style={{display:"block",marginTop:2,fontSize:12.5}}>Posibles reservas duplicadas · {pairs.length}</b><span style={{display:"block",marginTop:2,fontSize:10,color:"var(--muted)"}}>Abrí cualquiera de las reservas para revisarla. Si confirmás que son estadías distintas o habitaciones adicionales, cerrá el aviso con ×.</span></div><div style={{display:"grid",gap:6,marginTop:9}}>{pairs.slice(0,4).map(({a,b,reason})=>{const aRooms=roomIds(a).map(id=>roomById.get(id)?.nombre||id).join(", "),bRooms=roomIds(b).map(id=>roomById.get(id)?.nombre||id).join(", "),key=pairKey(a,b);return <div key={key} style={{position:"relative",padding:"9px 42px 9px 9px",border:"1px solid color-mix(in srgb,#d99424 20%,var(--line))",borderRadius:9,background:"color-mix(in srgb,var(--panelSolid) 93%,transparent)"}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",flexWrap:"wrap"}}><b style={{fontSize:10.5}}>{a.nombre_huesped||b.nombre_huesped||"Huésped"}</b><span style={{fontSize:9,fontWeight:850,color:"#b87917"}}>{reason}</span></div><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:5}}><button type="button" onClick={event=>openReservation(a,event)} style={{border:"1px solid var(--line)",borderRadius:8,background:"var(--panelSolid)",color:"var(--accent)",padding:"5px 8px",font:"inherit",fontSize:9.5,fontWeight:850,cursor:"pointer"}}>{a.numero_reserva||a.id} · Hab. {aRooms||"—"}</button><span style={{fontSize:9,color:"var(--muted)"}}>↔</span><button type="button" onClick={event=>openReservation(b,event)} style={{border:"1px solid var(--line)",borderRadius:8,background:"var(--panelSolid)",color:"var(--accent)",padding:"5px 8px",font:"inherit",fontSize:9.5,fontWeight:850,cursor:"pointer"}}>{b.numero_reserva||b.id} · Hab. {bRooms||"—"}</button></div><small style={{display:"block",marginTop:4,fontSize:9.5,color:"var(--muted)"}}>{a.canal_reserva||"Directa"} · {fmtDate(a.fecha_entrada)} → {fmtDate(a.fecha_salida)} / {b.canal_reserva||"Directa"} · {fmtDate(b.fecha_entrada)} → {fmtDate(b.fecha_salida)}</small><button type="button" onClick={event=>dismissPair(a,b,event)} disabled={savingKey===key} aria-label="Descartar coincidencia" title="No son duplicadas · cerrar aviso" style={{position:"absolute",right:8,top:8,width:26,height:26,display:"grid",placeItems:"center",border:"1px solid color-mix(in srgb,#d99424 28%,var(--line))",borderRadius:8,background:"var(--panelSolid)",color:"#9c6917",font:"inherit",fontSize:16,lineHeight:1,cursor:savingKey===key?"wait":"pointer"}}>×</button></div>})}</div>{pairs.length>4?<small style={{display:"block",marginTop:7,fontSize:9.5,color:"var(--muted)"}}>Hay {pairs.length-4} coincidencia{pairs.length-4===1?"":"s"} más pendientes de revisión.</small>:null}</div>
