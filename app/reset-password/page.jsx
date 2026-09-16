"use client"

import{useEffect,useState}from"react"
import Link from"next/link"
import{supabase}from"../../lib/supabase"
import HospitalityShell from"../components/hospitality/HospitalityShell"
import ui from"../login/login.module.css"

const safeNext=()=>{if(typeof window==="undefined")return"";const value=new URL(window.location.href).searchParams.get("next");return value&&value.startsWith("/")&&!value.startsWith("//")?value:""}

export default function ResetPasswordPage(){
  const[password,setPassword]=useState(""),[confirmPassword,setConfirmPassword]=useState(""),[message,setMessage]=useState(""),[kind,setKind]=useState(""),[loading,setLoading]=useState(false),[verifying,setVerifying]=useState(true),[validSession,setValidSession]=useState(false),[completed,setCompleted]=useState(false),[nextPath,setNextPath]=useState("")

  useEffect(()=>{
    let active=true
    setNextPath(safeNext())
    const blockContextMenu=(event)=>event.preventDefault()
    document.addEventListener("contextmenu",blockContextMenu)
    const finish=session=>{if(!active)return;setValidSession(Boolean(session));setVerifying(false);if(!session){setMessage("El enlace de recuperación no es válido o ya venció. Solicitá uno nuevo desde el inicio de sesión.");setKind("error")}}
    supabase.auth.getSession().then(({data})=>{if(data?.session)finish(data.session)})
    const{data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{if((event==="PASSWORD_RECOVERY"||event==="SIGNED_IN")&&session)finish(session)})
    const timer=window.setTimeout(async()=>{if(!active)return;const{data}=await supabase.auth.getSession();finish(data?.session||null)},1500)
    return()=>{active=false;document.removeEventListener("contextmenu",blockContextMenu);window.clearTimeout(timer);subscription.unsubscribe()}
  },[])

  async function changePassword(e){
    e.preventDefault();setMessage("");setKind("")
    if(password.length<8){setMessage("Usá una contraseña de al menos 8 caracteres.");setKind("error");return}
    if(password!==confirmPassword){setMessage("Las contraseñas no coinciden.");setKind("error");return}
    setLoading(true)
    const{error}=await supabase.auth.updateUser({password})
    if(error){setMessage(error.message);setKind("error");setLoading(false);return}
    await supabase.auth.signOut()
    setCompleted(true);setValidSession(false);setMessage("Contraseña actualizada. Ya podés ingresar y terminar la puesta en marcha de tu hotel.");setKind("success");setLoading(false)
  }

  const loginHref=nextPath?`/login?next=${encodeURIComponent(nextPath)}`:"/login"
  return <HospitalityShell eyebrow="RECUPERAR ACCESO" title={verifying?"Verificando tu enlace.":completed?"Acceso actualizado.":"Elegí una nueva contraseña."} copy={verifying?"Estamos validando el enlace de recuperación de forma segura.":completed?"Tu nueva contraseña ya quedó guardada.":"Actualizá la clave de tu cuenta hotelera para volver a operar."} productLabel="PMS Hotelero" sceneEyebrow="HABITACIÓN LLENA · ACCESO SEGURO" compact>
    {verifying?<div className={ui.message}>Validando sesión de recuperación…</div>:validSession?<form onSubmit={changePassword} className={ui.form}>
      <label className={ui.field}>Nueva contraseña<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres"/></label>
      <label className={ui.field}>Repetir contraseña<input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repetí tu contraseña"/></label>
      {message&&<div className={`${ui.message} ${kind==="success"?ui.success:ui.error}`}>{message}</div>}
      <button className={ui.submit} disabled={loading}>{loading?"Actualizando acceso…":"Guardar nueva contraseña"}</button>
    </form>:<><div className={`${ui.message} ${kind==="success"?ui.success:ui.error}`}>{message}</div><Link href={loginHref} className={ui.submit} style={{display:"grid",placeItems:"center",textDecoration:"none",marginTop:15}}>Ingresar al PMS</Link></>}
    <p className={ui.bottom}>¿Recordaste tu contraseña? <Link href={loginHref}>Iniciar sesión</Link></p>
  </HospitalityShell>
}
