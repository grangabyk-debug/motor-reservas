"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../lib/supabase"
import HospitalityShell from"../components/hospitality/HospitalityShell"
import ui from"./login.module.css"

const PMS_HOME="/pms-next"

export default function LoginPage(){
  const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState(""),[kind,setKind]=useState(""),[loading,setLoading]=useState(false),[recovering,setRecovering]=useState(false)
  useEffect(()=>{let active=true;const blockContextMenu=(event)=>event.preventDefault();document.addEventListener("contextmenu",blockContextMenu);(async()=>{const{data}=await supabase.auth.getUser();if(active&&data?.user)location.replace(PMS_HOME)})();return()=>{active=false;document.removeEventListener("contextmenu",blockContextMenu)}},[])
  async function login(e){e.preventDefault();setMessage("");setLoading(true);const{error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error){setMessage(error.message==="Invalid login credentials"?"Email o contraseña incorrectos.":error.message);setKind("error");setLoading(false);return}location.replace(PMS_HOME)}
  async function recover(){setMessage("");const clean=email.trim();if(!clean){setMessage("Primero ingresá tu email.");setKind("error");return}setRecovering(true);const{error}=await supabase.auth.resetPasswordForEmail(clean,{redirectTo:`${location.origin}/reset-password`});setRecovering(false);if(error){setMessage(error.message);setKind("error");return}setMessage("Te enviamos un email para recuperar tu acceso. Revisá también spam.");setKind("success")}
  const busy=loading||recovering
  return <HospitalityShell eyebrow="ACCESO SEGURO" title="Entrá a tu hotel." copy="Acceso exclusivo para clientes habilitados de Habitación Llena." productLabel="PMS Hotelero" sceneEyebrow="HABITACIÓN LLENA · PMS">
    <form onSubmit={login} className={ui.form}><label className={ui.field}>Email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="recepcion@hotel.com"/></label><label className={ui.field}>Contraseña<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tu contraseña"/></label>{message&&<div className={`${ui.message} ${kind==="success"?ui.success:ui.error}`}>{message}</div>}<button className={ui.submit} disabled={busy}>{loading?"Preparando tu hotel…":"Ingresar al PMS"}</button><button type="button" className={ui.forgot} onClick={recover} disabled={busy}>{recovering?"Enviando…":"¿Olvidaste tu contraseña?"}</button></form><div className={ui.trust}><span><b>Aislado</b> por propiedad</span><span><b>Seguro</b> por roles</span><span><b>Actualizado</b> en la nube</span></div>
  </HospitalityShell>
}
