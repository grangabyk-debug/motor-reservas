"use client"

import { useEffect,useState } from "react"
import Link from "next/link"
import { supabase } from "../../lib/supabase"
import HospitalityShell from "../components/hospitality/HospitalityShell"
import ui from "./login.module.css"

export default function LoginPage(){
  const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState(""),[kind,setKind]=useState(""),[loading,setLoading]=useState(false),[recovering,setRecovering]=useState(false)
  useEffect(()=>{let active=true;(async()=>{const{data}=await supabase.auth.getUser();if(active&&data?.user)location.href="/dashboard"})();return()=>{active=false}},[])
  async function login(e){e.preventDefault();setMessage("");setLoading(true);const{error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error){setMessage(error.message==="Invalid login credentials"?"Email o contraseña incorrectos.":error.message);setKind("error");setLoading(false);return}location.href="/dashboard"}
  async function recover(){setMessage("");const clean=email.trim();if(!clean){setMessage("Primero ingresá tu email.");setKind("error");return}setRecovering(true);const{error}=await supabase.auth.resetPasswordForEmail(clean,{redirectTo:`${location.origin}/reset-password`});setRecovering(false);if(error){setMessage(error.message);setKind("error");return}setMessage("Te enviamos un email para recuperar tu acceso. Revisá también spam.");setKind("success")}
  const busy=loading||recovering
  return <HospitalityShell eyebrow="ACCESO AL HOTEL" title="Volvé a tu recepción." copy="Tu operación está donde la dejaste: reservas, huéspedes, habitaciones y equipo en un solo escritorio." compact>
    <form onSubmit={login} className={ui.form}><label className={ui.field}>Email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="recepcion@hotel.com"/></label><label className={ui.field}>Contraseña<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tu contraseña"/></label>{message&&<div className={`${ui.message} ${kind==="success"?ui.success:ui.error}`}>{message}</div>}<button className={ui.submit} disabled={busy}>{loading?"Abriendo recepción…":"Ingresar al hotel"}</button><button type="button" className={ui.forgot} onClick={recover} disabled={busy}>{recovering?"Enviando…":"¿Olvidaste tu contraseña?"}</button></form><div className={ui.trust}><span><b>Seguro</b> por propiedad</span><span><b>Tiempo real</b> operativo</span><span><b>Roles</b> por equipo</span></div><p className={ui.bottom}>¿Todavía no tenés cuenta? <Link href="/registro">Solicitar acceso</Link></p>
  </HospitalityShell>
}
