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
function findPairs(rows){const result=[];for(let index=0;index<rows.length;index++){const a=rows[index];for(let next=index+1;next<rows.length;next++){const b=rows[next];if(!(a.fecha_entrada<b.fecha_salida&&b.fecha_entrada<a.fecha_salida))continue;const reason=reasonFor(a,b);if(reason)result.push({a,b,reason})}}return result.sort((x,y)=>String(y.a.created_at||y.a.fecha_entrada||"").localeCompare(String(x.a.created_at||x.a.fecha_entrada||"")))}

export default function ReservationDuplicateWatch({propertyId}){
  const[rows,setRows]=useState([]),[rooms,setRooms]=useState([])
  const roomById=useMemo(()=>new Map(rooms.map(room=>[Number(room.id),room])),[rooms])
  const pairs=useMemo(()=>findPairs(rows),[rows])
  useEffect(()=>{
    if(!propertyId){setRows([]);setRooms([]);return}
    let cancelled=false,timer=null
    const load=async()=>{const[reservationRes,roomRes]=await Promise.all([supabase.from("reservas").select("id,numero_reserva,nombre_huesped,email_huesped,telefono_huesped,guest_profile_id,fecha_entrada,fecha_salida,estado,no_show,canal_reserva,habitacion_id,habitaciones_ids,created_at").eq("property_id",propertyId).neq("estado","cancelada").neq("estado","fusionada").eq("no_show",false).gte("fecha_salida",todayKey()).order("fecha_entrada").limit(1000),supabase.from("habitaciones").select("id,nombre").eq("property_id",propertyId).eq("activa",true)]);if(cancelled)return;if(!reservationRes.error)setRows(reservationRes.data||[]);if(!roomRes.error)setRooms(roomRes.data||[])}
    load()
    const channel=supabase.channel(`reservation-duplicate-watch-${propertyId}`).on("postgres_changes",{event:"*",schema:"public",table:"reservas",filter:`property_id=eq.${propertyId}`},()=>{if(timer)clearTimeout(timer);timer=setTimeout(load,120)}).subscribe()
    return()=>{cancelled=true;if(timer)clearTimeout(timer);supabase.removeChannel(channel)}
  },[propertyId])
  if(!pairs.length)return null
  return <div style={{margin:"0 14px 10px",padding:"11px 12px",border:"1px solid color-mix(in srgb,#d99424 38%,var(--line))",borderRadius:11,background:"color-mix(in srgb,#d99424 7%,var(--panelSolid))"}}><div><small style={{display:"block",fontSize:9.5,fontWeight:900,letterSpacing:".07em",color:"#b87917"}}>REVISIÓN AUTOMÁTICA</small><b style={{display:"block",marginTop:2,fontSize:12.5}}>Posibles reservas duplicadas · {pairs.length}</b><span style={{display:"block",marginTop:2,fontSize:10,color:"var(--muted)"}}>Coinciden huésped, email, teléfono o nombre y se superponen las fechas. No se bloquean porque podrían ser habitaciones adicionales intencionales.</span></div><div style={{display:"grid",gap:6,marginTop:9}}>{pairs.slice(0,4).map(({a,b,reason})=>{const aRooms=roomIds(a).map(id=>roomById.get(id)?.nombre||id).join(", "),bRooms=roomIds(b).map(id=>roomById.get(id)?.nombre||id).join(", ");return <div key={`${a.id}-${b.id}`} style={{padding:"8px 9px",border:"1px solid color-mix(in srgb,#d99424 20%,var(--line))",borderRadius:9,background:"color-mix(in srgb,var(--panelSolid) 93%,transparent)"}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><b style={{fontSize:10.5}}>{a.nombre_huesped||b.nombre_huesped||"Huésped"}</b><span style={{fontSize:9,fontWeight:850,color:"#b87917"}}>{reason}</span></div><small style={{display:"block",marginTop:3,fontSize:9.5,color:"var(--muted)"}}>{a.numero_reserva||a.id} · {a.canal_reserva||"Directa"} · Hab. {aRooms||"—"} ↔ {b.numero_reserva||b.id} · {b.canal_reserva||"Directa"} · Hab. {bRooms||"—"}</small><small style={{display:"block",marginTop:1,fontSize:9.5,color:"var(--muted)"}}>{fmtDate(a.fecha_entrada)} → {fmtDate(a.fecha_salida)} / {fmtDate(b.fecha_entrada)} → {fmtDate(b.fecha_salida)}</small></div>})}</div>{pairs.length>4?<small style={{display:"block",marginTop:7,fontSize:9.5,color:"var(--muted)"}}>Hay {pairs.length-4} coincidencia{pairs.length-4===1?"":"s"} más. Usá la búsqueda de Reservas para revisarlas.</small>:null}</div>
}
