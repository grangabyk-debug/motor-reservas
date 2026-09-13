"use client"

import{useEffect,useMemo,useState}from"react"
import{createPortal}from"react-dom"
import{supabase}from"../../../../lib/supabase"
import{CreateReservationDrawer as LegacyCreateReservationDrawer,ReservationDetailDrawer as LegacyReservationDetailDrawer}from"./PlanningDrawersLegacy"
import s from"./planning.module.css"

export const ReservationDetailDrawer=LegacyReservationDetailDrawer

const pad=value=>String(value).padStart(2,"0")
function addDay(value){const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+1);return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function stayDays(start,end){const result=[];for(let day=start;day&&end&&day<end;day=addDay(day))result.push(day);return result}
const selectedIds=draft=>[...new Set((draft?.roomIds?.length?draft.roomIds:[draft?.roomId]).filter(Boolean).map(String))]
const cleanName=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ")
const cleanEmail=value=>String(value||"").trim().toLowerCase()
const cleanPhone=value=>String(value||"").replace(/\D/g,"")
const safeLike=value=>String(value||"").replace(/[%_*,()]/g," ").trim().replace(/\s+/g," ")
const shortDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`)).replaceAll(".",""):"—"
function prettyName(value){const raw=String(value||"").trim().replace(/\s+/g," ");if(!raw)return"";if(raw!==raw.toLowerCase()&&raw!==raw.toUpperCase())return raw;return raw.toLocaleLowerCase("es").replace(/(^|[\s'-])([a-záéíóúñü])/g,(_,prefix,char)=>`${prefix}${char.toLocaleUpperCase("es")}`)}
function splitName(value){const parts=prettyName(value).split(" ").filter(Boolean);return{firstName:parts.length>1?parts.slice(0,-1).join(" "):parts[0]||"",lastName:parts.length>1?parts.at(-1):""}}

function GuestRecognitionPanel({propertyId,draft,setDraft,drawerStep,roomById}){
  const[target,setTarget]=useState(null),[matches,setMatches]=useState([]),[stats,setStats]=useState({}),[duplicates,setDuplicates]=useState([]),[loading,setLoading]=useState(false)
  const fullName=`${draft?.firstName||""} ${draft?.lastName||""}`.trim(),nameKey=cleanName(fullName),emailKey=cleanEmail(draft?.email),phoneKey=cleanPhone(draft?.phone),guestProfileId=String(draft?.guestProfileId||"")

  useEffect(()=>{
    if(drawerStep!==2||typeof document==="undefined"){setTarget(null);return}
    const id=requestAnimationFrame(()=>setTarget(document.querySelector(`[aria-label="Crear reserva"] .${s.drawerBody}`)))
    return()=>cancelAnimationFrame(id)
  },[drawerStep])

  function applyProfile(profile){
    if(!profile)return
    const names=splitName(profile.full_name)
    setDraft(current=>{
      if(!current)return current
      const currentName=`${current.firstName||""} ${current.lastName||""}`.trim(),sameName=cleanName(currentName)===cleanName(profile.full_name)
      return{...current,firstName:sameName&&current.firstName?current.firstName:names.firstName||current.firstName,lastName:sameName&&current.lastName?current.lastName:names.lastName||current.lastName,email:profile.email||current.email||"",phone:profile.phone||current.phone||"",country:profile.country||current.country||"",guestProfileId:profile.id}
    })
  }

  useEffect(()=>{
    if(drawerStep!==2||!propertyId){setMatches([]);setStats({});return}
    const hasName=nameKey.length>=3,hasEmail=emailKey.length>=3,rawPhone=String(draft?.phone||"").trim(),hasPhone=rawPhone.length>=4
    if(!hasName&&!hasEmail&&!hasPhone){setMatches([]);setStats({});return}
    let cancelled=false
    const timer=setTimeout(async()=>{
      setLoading(true)
      try{
        const select="id,full_name,email,phone,country,last_stay_at,status"
        const requests=[]
        if(hasName)requests.push(supabase.from("hotel_guest_profiles").select(select).eq("property_id",propertyId).eq("status","active").ilike("full_name",`%${safeLike(fullName)}%`).limit(6))
        if(hasEmail)requests.push(supabase.from("hotel_guest_profiles").select(select).eq("property_id",propertyId).eq("status","active").ilike("email",`%${safeLike(draft.email)}%`).limit(6))
        if(hasPhone)requests.push(supabase.from("hotel_guest_profiles").select(select).eq("property_id",propertyId).eq("status","active").ilike("phone",`%${safeLike(rawPhone)}%`).limit(6))
        const results=await Promise.all(requests),byId=new Map()
        for(const result of results)if(!result.error)for(const profile of result.data||[])byId.set(profile.id,profile)
        const ranked=[...byId.values()].map(profile=>{const profileName=cleanName(profile.full_name),profileEmail=cleanEmail(profile.email),profilePhone=cleanPhone(profile.phone);let score=0;if(emailKey&&profileEmail===emailKey)score+=1000;if(phoneKey.length>=6&&profilePhone===phoneKey)score+=900;if(nameKey&&profileName===nameKey)score+=800;else if(nameKey&&profileName.startsWith(nameKey))score+=420;else if(nameKey&&profileName.includes(nameKey))score+=260;return{...profile,_score:score}}).sort((a,b)=>b._score-a._score||String(a.full_name||"").localeCompare(String(b.full_name||""),"es")).slice(0,6)
        const nextStats={}
        if(ranked.length){
          const ids=ranked.map(profile=>profile.id),today=new Date().toISOString().slice(0,10),reservationRes=await supabase.from("reservas").select("guest_profile_id,fecha_entrada,fecha_salida,estado,no_show").eq("property_id",propertyId).in("guest_profile_id",ids).neq("estado","cancelada")
          if(!reservationRes.error)for(const profile of ranked){const rows=(reservationRes.data||[]).filter(row=>String(row.guest_profile_id)===String(profile.id)&&row.no_show!==true),past=rows.filter(row=>row.fecha_salida&&row.fecha_salida<=today),future=rows.filter(row=>row.fecha_entrada&&row.fecha_entrada>today);nextStats[profile.id]={stays:past.length,upcoming:future.length,lastStay:past.map(row=>row.fecha_salida).sort().at(-1)||null}}
        }
        if(cancelled)return
        setMatches(ranked);setStats(nextStats)
        const exact=ranked.filter(profile=>(emailKey&&cleanEmail(profile.email)===emailKey)||(phoneKey.length>=6&&cleanPhone(profile.phone)===phoneKey)||(nameKey.split(" ").length>=2&&cleanName(profile.full_name)===nameKey))
        if(!guestProfileId&&exact.length===1)applyProfile(exact[0])
      }catch{if(!cancelled){setMatches([]);setStats({})}}
      finally{if(!cancelled)setLoading(false)}
    },260)
    return()=>{cancelled=true;clearTimeout(timer)}
  },[drawerStep,propertyId,nameKey,emailKey,phoneKey,guestProfileId])

  useEffect(()=>{
    if(drawerStep!==2||!propertyId||!draft?.start||!draft?.end){setDuplicates([]);return}
    const strongName=nameKey&&nameKey.split(" ").length>=2,emailReady=emailKey.length>=5,phoneReady=phoneKey.length>=6
    if(!guestProfileId&&!strongName&&!emailReady&&!phoneReady){setDuplicates([]);return}
    let cancelled=false
    const timer=setTimeout(async()=>{
      try{
        const{data,error}=await supabase.from("reservas").select("id,numero_reserva,nombre_huesped,email_huesped,telefono_huesped,fecha_entrada,fecha_salida,estado,canal_reserva,guest_profile_id,habitacion_id,habitaciones_ids,no_show").eq("property_id",propertyId).neq("estado","cancelada").lt("fecha_entrada",draft.end).gt("fecha_salida",draft.start).limit(80)
        if(error)throw error
        const found=(data||[]).filter(row=>row.no_show!==true).map(row=>{const sameProfile=guestProfileId&&String(row.guest_profile_id||"")===guestProfileId,sameEmail=emailReady&&cleanEmail(row.email_huesped)===emailKey,samePhone=phoneReady&&cleanPhone(row.telefono_huesped)===phoneKey,sameName=strongName&&cleanName(row.nombre_huesped)===nameKey;if(!sameProfile&&!sameEmail&&!samePhone&&!sameName)return null;const ids=[...(row.habitaciones_ids||[]),row.habitacion_id].filter(Boolean),names=[...new Set(ids.map(id=>roomById?.get(Number(id))?.nombre||String(id)))];return{...row,_score:sameProfile?100:sameEmail?90:samePhone?80:50,_reason:sameProfile||sameEmail||samePhone?"Mismo huésped":"Mismo nombre",_rooms:names.join(", ")}}).filter(Boolean).sort((a,b)=>b._score-a._score||String(a.fecha_entrada).localeCompare(String(b.fecha_entrada))).slice(0,4)
        if(!cancelled)setDuplicates(found)
      }catch{if(!cancelled)setDuplicates([])}
    },280)
    return()=>{cancelled=true;clearTimeout(timer)}
  },[drawerStep,propertyId,draft?.start,draft?.end,nameKey,emailKey,phoneKey,guestProfileId,roomById])

  if(drawerStep!==2||!target)return null
  const selected=guestProfileId?matches.find(profile=>String(profile.id)===guestProfileId)||null:null,showSuggestions=!selected&&matches.length>0
  if(!loading&&!selected&&!showSuggestions&&!duplicates.length)return null
  const box={margin:"0 18px 18px",display:"grid",gap:9},card={padding:"11px 12px",border:"1px solid var(--line)",borderRadius:11,background:"color-mix(in srgb,var(--bg) 48%,var(--panelSolid))"}
  return createPortal(<div style={box} aria-live="polite">
    {loading&&!selected?<div style={{...card,color:"var(--muted)",fontSize:10.5}}>Buscando huéspedes ya registrados…</div>:null}
    {selected?<section style={{...card,borderColor:"color-mix(in srgb,#2d9f62 34%,var(--line))",background:"color-mix(in srgb,#2d9f62 6%,var(--panelSolid))"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}><div><small style={{display:"block",fontSize:9.5,fontWeight:900,letterSpacing:".07em",color:"#2d9f62"}}>HUÉSPED RECONOCIDO</small><b style={{display:"block",marginTop:3,fontSize:12.5}}>{prettyName(selected.full_name)}</b></div><span style={{padding:"4px 7px",borderRadius:999,background:"color-mix(in srgb,#2d9f62 10%,var(--panelSolid))",color:"#2d9f62",fontSize:9,fontWeight:900}}>{(stats[selected.id]?.stays||0)>=2?`FRECUENTE · ${stats[selected.id].stays} ESTADÍAS`:(stats[selected.id]?.stays||0)===1?"YA SE ALOJÓ":"REGISTRADO"}</span></div><div style={{marginTop:7,fontSize:10.5,color:"var(--muted)",lineHeight:1.45}}>{selected.email||selected.phone||"Sin contacto guardado"}{stats[selected.id]?.lastStay?` · Última estadía ${shortDate(stats[selected.id].lastStay)}`:""}</div></section>:null}
    {showSuggestions?<section style={card}><div style={{marginBottom:7}}><b style={{display:"block",fontSize:11.5}}>Huéspedes registrados</b><small style={{display:"block",marginTop:2,color:"var(--muted)",fontSize:10}}>Elegí uno para completar automáticamente sus datos.</small></div><div style={{display:"grid",gap:6}}>{matches.slice(0,4).map(profile=><button key={profile.id} type="button" onClick={()=>applyProfile(profile)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"8px 9px",border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",textAlign:"left",cursor:"pointer"}}><span style={{minWidth:0}}><b style={{display:"block",fontSize:11}}>{prettyName(profile.full_name)}</b><small style={{display:"block",marginTop:2,color:"var(--muted)",fontSize:9.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{profile.email||profile.phone||profile.country||"Huésped registrado"}</small></span><span style={{flex:"0 0 auto",fontSize:9.5,fontWeight:850,color:"var(--accent)"}}>{(stats[profile.id]?.stays||0)>0?`${stats[profile.id].stays} estadía${stats[profile.id].stays===1?"":"s"}`:"Usar datos"}</span></button>)}</div></section>:null}
    {duplicates.length?<section style={{...card,borderColor:"color-mix(in srgb,#d99424 42%,var(--line))",background:"color-mix(in srgb,#d99424 7%,var(--panelSolid))"}}><div><small style={{display:"block",fontSize:9.5,fontWeight:900,letterSpacing:".07em",color:"#b87917"}}>POSIBLE RESERVA DUPLICADA</small><b style={{display:"block",marginTop:3,fontSize:11.5}}>Hay otra reserva del mismo pasajero que se cruza con estas fechas.</b><p style={{margin:"4px 0 8px",fontSize:10,color:"var(--muted)",lineHeight:1.4}}>Revisala antes de continuar. No bloqueamos la creación porque puede ser una segunda habitación intencional.</p></div><div style={{display:"grid",gap:6}}>{duplicates.map(row=><div key={row.id} style={{padding:"8px 9px",border:"1px solid color-mix(in srgb,#d99424 24%,var(--line))",borderRadius:8,background:"color-mix(in srgb,var(--panelSolid) 92%,transparent)"}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><b style={{fontSize:10.5}}>{row.numero_reserva||`Reserva #${row.id}`}</b><span style={{fontSize:9,fontWeight:850,color:"#b87917"}}>{row._reason}</span></div><small style={{display:"block",marginTop:3,fontSize:9.5,color:"var(--muted)"}}>{row.canal_reserva||"Directa"} · {shortDate(row.fecha_entrada)} → {shortDate(row.fecha_salida)} · Hab. {row._rooms||row.habitacion_id||"—"}</small></div>)}</div></section>:null}
  </div>,target)
}

export function CreateReservationDrawer(props){
  const{draft,setDraft,availableRooms=[],propertyId}=props
  const[rateCurrency,setRateCurrency]=useState(null),[effectiveRates,setEffectiveRates]=useState({}),[resolvedPropertyId,setResolvedPropertyId]=useState(propertyId||null)
  const roomIdsKey=useMemo(()=>availableRooms.map(room=>room.id).join(","),[availableRooms])
  const baseRatesKey=useMemo(()=>availableRooms.map(room=>`${room.id}:${Number(room.precio)||0}`).join("|") ,[availableRooms])
  const presentationPolicies=useMemo(()=>(props.cancellationPolicies||[]).map(policy=>({...policy,is_default:false})),[props.cancellationPolicies])
  const pid=propertyId||resolvedPropertyId

  useEffect(()=>{
    if(propertyId){setResolvedPropertyId(propertyId);return}
    const roomId=availableRooms[0]?.id;if(!roomId)return
    let cancelled=false
    supabase.from("habitaciones").select("property_id").eq("id",Number(roomId)).maybeSingle().then(({data})=>{if(!cancelled&&data?.property_id)setResolvedPropertyId(data.property_id)}).catch(()=>{})
    return()=>{cancelled=true}
  },[propertyId,roomIdsKey])

  useEffect(()=>{
    if(!pid)return
    let cancelled=false
    ;(async()=>{
      try{
        const settingsRes=await supabase.from("property_settings").select("settings").eq("property_id",pid).maybeSingle()
        if(settingsRes.error)throw settingsRes.error
        if(cancelled)return
        const code=String(settingsRes.data?.settings?.pricing?.rate_currency||"ARS").toUpperCase()==="USD"?"USD":"ARS"
        setRateCurrency(code);setDraft(current=>current&&current.currency!==code?{...current,currency:code}:current)
      }catch{if(!cancelled)setRateCurrency(current=>current||"ARS")}
    })()
    return()=>{cancelled=true}
  },[pid,setDraft])

  useEffect(()=>{
    if(typeof window==="undefined"||!pid)return
    const handler=event=>{if(String(event.detail?.propertyId)!==String(pid))return;const code=String(event.detail?.settings?.pricing?.rate_currency||"ARS").toUpperCase()==="USD"?"USD":"ARS";setRateCurrency(code);setDraft(current=>current&&current.currency!==code?{...current,currency:code}:current)}
    window.addEventListener("hl:property-settings-updated",handler)
    return()=>window.removeEventListener("hl:property-settings-updated",handler)
  },[pid,setDraft])

  useEffect(()=>{
    const ids=availableRooms.map(room=>Number(room.id)).filter(Number.isFinite),days=stayDays(draft?.start,draft?.end)
    if(!pid||!ids.length||!days.length){setEffectiveRates({});return}
    let cancelled=false
    ;(async()=>{
      try{
        const{data,error}=await supabase.from("hotel_rate_calendar").select("habitacion_id,stay_date,price").eq("property_id",pid).in("habitacion_id",ids).gte("stay_date",draft.start).lt("stay_date",draft.end)
        if(error)throw error
        if(cancelled)return
        const byDay=new Map((data||[]).map(row=>[`${row.habitacion_id}:${row.stay_date}`,row.price])),next={}
        for(const room of availableRooms){const values=days.map(day=>{const value=byDay.get(`${room.id}:${day}`);return value==null?Number(room.precio)||0:Number(value)||0});next[String(room.id)]=values.reduce((sum,value)=>sum+value,0)/values.length}
        setEffectiveRates(next)
        setDraft(current=>{
          if(!current||current.start!==draft.start||current.end!==draft.end)return current
          const idsNow=selectedIds(current),assignments={...(current.roomAssignments||{})}
          for(const id of idsNow)if(next[id]!=null)assignments[id]={...(assignments[id]||{}),rate:next[id]}
          const rate=idsNow.reduce((sum,id)=>sum+Number(next[id]??assignments[id]?.rate??availableRooms.find(room=>String(room.id)===id)?.precio??0),0)
          return{...current,roomAssignments:assignments,rate}
        })
      }catch{if(!cancelled)setEffectiveRates({})}
    })()
    return()=>{cancelled=true}
  },[pid,draft?.start,draft?.end,roomIdsKey,baseRatesKey,setDraft])

  const pricedRooms=useMemo(()=>availableRooms.map(room=>effectiveRates[String(room.id)]==null?room:{...room,precio:effectiveRates[String(room.id)]}),[availableRooms,effectiveRates])
  const pricedRoomById=useMemo(()=>new Map(pricedRooms.map(room=>[Number(room.id),room])),[pricedRooms])
  const forcedDraft=draft&&rateCurrency?{...draft,currency:rateCurrency}:draft
  const forcedSetDraft=updater=>setDraft(current=>{const next=typeof updater==="function"?updater(current):updater;if(!next||!rateCurrency)return next;return next.currency===rateCurrency?next:{...next,currency:rateCurrency}})
  return <><LegacyCreateReservationDrawer {...props} propertyId={pid} draft={forcedDraft} setDraft={forcedSetDraft} availableRooms={pricedRooms} roomById={pricedRoomById} cancellationPolicies={presentationPolicies}/><GuestRecognitionPanel propertyId={pid} draft={forcedDraft} setDraft={forcedSetDraft} drawerStep={props.drawerStep} roomById={pricedRoomById}/></>
}
