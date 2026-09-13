"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../../../lib/supabase"
import s from "./finance.module.css"

async function accessToken(){
  const { data, error } = await supabase.auth.getSession()
  if(error)throw error
  const token=data?.session?.access_token
  if(!token)throw new Error("Tu sesión venció. Volvé a iniciar sesión.")
  return token
}
async function request(path,options={}){
  const token=await accessToken()
  const response=await fetch(path,{...options,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...(options.headers||{})},cache:"no-store"})
  const data=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(data?.error||"No se pudo completar la operación.")
  return data
}

export default function OnlinePaymentsPanel({propertyId}){
  const[status,setStatus]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("")
  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{setStatus(await request(`/api/hotel/mercadopago/config?property_id=${encodeURIComponent(propertyId)}`))}
    catch(err){setError(err?.message||"No se pudo consultar Mercado Pago.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{load()},[load])
  useEffect(()=>{
    if(typeof window==="undefined"||!propertyId)return
    const url=new URL(window.location.href),code=url.searchParams.get("mp_code"),state=url.searchParams.get("mp_state"),oauthError=url.searchParams.get("mp_error")
    if(oauthError){setError(`Mercado Pago: ${oauthError}`);url.searchParams.delete("mp_error");window.history.replaceState({},"",url);return}
    if(!code||!state)return
    let active=true
    ;(async()=>{setBusy("complete");setError("");try{await request("/api/hotel/mercadopago/oauth/complete",{method:"POST",body:JSON.stringify({code,state})});if(active){setNotice("Mercado Pago quedó conectado correctamente.");await load()}}catch(err){if(active)setError(err?.message||"No se pudo completar la conexión.")}finally{if(active)setBusy("");const clean=new URL(window.location.href);["mp_code","mp_state","mp_error"].forEach(key=>clean.searchParams.delete(key));window.history.replaceState({},"",clean)}})()
    return()=>{active=false}
  },[propertyId,load])

  async function connect(){
    setBusy("connect");setError("");setNotice("")
    try{const data=await request("/api/hotel/mercadopago/oauth/start",{method:"POST",body:JSON.stringify({property_id:propertyId})});if(!data?.url)throw new Error("Mercado Pago no devolvió una dirección de autorización.");window.location.assign(data.url)}
    catch(err){setError(err?.message||"No se pudo iniciar la conexión.");setBusy("")}
  }
  async function disconnect(){
    if(!window.confirm("¿Desconectar Mercado Pago de este hotel? El motor volverá automáticamente a pago en el hotel."))return
    setBusy("disconnect");setError("");setNotice("")
    try{await request("/api/hotel/mercadopago/config",{method:"DELETE",body:JSON.stringify({property_id:propertyId})});setNotice("Mercado Pago fue desconectado. El motor quedó en pago en el hotel.");await load()}
    catch(err){setError(err?.message||"No se pudo desconectar Mercado Pago.")}
    finally{setBusy("")}
  }

  const connection=status?.connection||{},connected=connection.connected===true,canManage=status?.can_manage===true,platformReady=status?.platform_ready===true
  if(loading)return <div className={s.empty}>Consultando configuración de cobros online…</div>
  return <div className={s.financeBody}>
    {error&&<div className={s.alert}>{error}</div>}{notice&&<div className={s.alert} style={{borderColor:"color-mix(in srgb,var(--green) 35%,var(--line))",color:"var(--green)"}}>{notice}</div>}
    <article className={s.glass}><header><div><small>COBROS ONLINE</small><h2>Mercado Pago</h2><p>La cuenta pertenece al hotel. Habitación Llena sólo usa la autorización para generar y conciliar cobros de sus reservas.</p></div><span className={s.status}>{connected?"Conectado":"Sin conectar"}</span></header>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10,marginTop:14}}>
        <div style={{padding:14,border:"1px solid var(--line)",borderRadius:13,background:"var(--panelSolid)"}}><small style={{display:"block",color:"var(--muted)"}}>Estado</small><b style={{display:"block",marginTop:4,color:connected?"var(--green)":"var(--text)"}}>{connected?"Cuenta vinculada":"Pendiente"}</b></div>
        <div style={{padding:14,border:"1px solid var(--line)",borderRadius:13,background:"var(--panelSolid)"}}><small style={{display:"block",color:"var(--muted)"}}>Modo</small><b style={{display:"block",marginTop:4}}>{connected?(connection.live_mode?"Cobros reales":"Cuenta conectada · revisar modo"):"—"}</b></div>
        <div style={{padding:14,border:"1px solid var(--line)",borderRadius:13,background:"var(--panelSolid)"}}><small style={{display:"block",color:"var(--muted)"}}>Actualizado</small><b style={{display:"block",marginTop:4}}>{connection.updated_at?new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"short"}).format(new Date(connection.updated_at)):"—"}</b></div>
      </div>
      {!platformReady?<div className={s.alert} style={{marginTop:14}}>La integración está construida, pero todavía faltan las credenciales de la aplicación Mercado Pago de Habitación Llena en el servidor. Hasta entonces el hotel puede registrar pagos normalmente, pero no conectar una cuenta nueva.</div>:null}
      <div style={{display:"flex",gap:9,marginTop:16,flexWrap:"wrap"}}>{connected?<button disabled={!canManage||!!busy} onClick={disconnect}>{busy==="disconnect"?"Desconectando…":"Desconectar cuenta"}</button>:<button disabled={!canManage||!platformReady||!!busy} onClick={connect}>{busy==="connect"||busy==="complete"?"Conectando…":"Conectar Mercado Pago"}</button>}<button disabled={!!busy} onClick={load}>Actualizar estado</button></div>
      {!canManage?<p style={{fontSize:12,color:"var(--muted)",marginTop:12}}>Sólo propietario, gerencia o administración pueden modificar esta conexión.</p>:null}
    </article>
    <article className={s.glass}><header><div><small>CÓMO SE USA</small><h2>Motor y reservas</h2></div></header><div style={{display:"grid",gap:10,fontSize:12,lineHeight:1.55,color:"var(--muted)"}}><p style={{margin:0}}><b style={{color:"var(--text)"}}>1.</b> El hotel conecta su propia cuenta una sola vez.</p><p style={{margin:0}}><b style={{color:"var(--text)"}}>2.</b> En Integraciones → Motor web puede elegir pago en hotel, seña o pago total. Las opciones online sólo se habilitan cuando esta conexión está activa.</p><p style={{margin:0}}><b style={{color:"var(--text)"}}>3.</b> Si la cuenta se desconecta, Habitación Llena fuerza automáticamente el motor a “Pago en el hotel” para no publicar un checkout que no puede cobrar.</p></div></article>
  </div>
}
