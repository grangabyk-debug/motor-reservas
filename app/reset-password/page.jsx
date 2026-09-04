"use client"

import{useEffect,useState}from"react"
import Link from"next/link"
import{supabase}from"../../lib/supabase"
import HospitalityShell from"../components/hospitality/HospitalityShell"
import ui from"../login/login.module.css"

export default function ResetPasswordPage(){
  const[password,setPassword]=useState(""),[confirmPassword,setConfirmPassword]=useState(""),[message,setMessage]=useState(""),[kind,setKind]=useState(""),[loading,setLoading]=useState(false),[verifying,setVerifying]=useState(true),[validSession,setValidSession]=useState(false),[completed,setCompleted]=useState(false)

  useEffect(()=>{
    let active=true
    const finish=session=>{if(!active)return;setValidSession(Boolean(session));setVerifying(false);if(!session){setMessage("El enlace de recuperación no es válido o ya venció. Solicitá uno nuevo desde el inicio de sesión.");setKind("error")}}
    supabase.auth.getSession().then(({data})=>{if(data?.session)finish(data.session)})
    const{data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{if((event==="PASSWORD_RECOVERY"||event==="SIGNED_IN")&&session)finish(session)})
    const timer=window.setTimeout(async()=>{if(!active)return;const{data}=await supabase.auth.getSession();finish(data?.session||null)},1500)
    return()=>{active=false;window.clearTimeout(timer);subscription.unsubscribe()}
  },[])

  async function changePassword(e){
    e.preventDefault();setMessage("");setKind("")
    if(password.length<8){setMessage("Usá una contraseña de al menos 8 caracteres.");setKind("error");return}
    if(password!==confirmPassword){setMessage("Las contraseñas no coinciden.");setKind("error");return}
    setLoading(true)
    const{error}=await supabase.auth.updateUser({password})
    if(error){setMessage(error.message);setKind("error");setLoading(false);return}
    await supabase.auth.signOut()
    setCompleted(true);setValidSession(false);setMessage("Contraseña actualizada. Ya podés volver a ingresar al PMS.");setKind("success");setLoading(false)
  }

  return <HospitalityShell eyebrow="RECUPERAR ACCESO" title={verifying?"Verificando tu enlace.":completed?"Acceso actualizado.":"Elegí una nueva contraseña."} copy={verifying?"Estamos validando el enlace de recuperación de forma segura.":completed?"Tu nueva contraseña ya quedó guardada.":"Actualizá la clave de tu cuenta hotelera para volver a operar."} productLabel="PMS Hotelero" sceneEyebrow="HABITACIÓN LLENA · ACCESO SEGURO" compact>
    {verifying?<div className={ui.message}>Validando sesión de recuperación…</div>:validSession?<form onSubmit={changePassword} className={ui.form}>
      <label className={ui.field}>Nueva contraseña<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres"/></label>
      <label className={ui.field}>Repetir contraseña<input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repetí tu contraseña"/></label>
      {message&&<div className={`${ui.message} ${kind==="success"?ui.success:ui.error}`}>{message}</div>}
      <button className={ui.submit} disabled={loading}>{loading?"Actualizando acceso…":"Guardar nueva contraseña"}</button>
    </form>:<><div className={`${ui.message} ${kind==="success"?ui.success:ui.error}`}>{message}</div><Link href="/login" className={ui.submit} style={{display:"grid",placeItems:"center",textDecoration:"none",marginTop:15}}>Volver a iniciar sesión</Link></>}
    <p className={ui.bottom}>¿Recordaste tu contraseña? <Link href="/login">Iniciar sesión</Link></p>
  </HospitalityShell>
}
