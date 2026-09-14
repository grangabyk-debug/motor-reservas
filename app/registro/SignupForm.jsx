"use client"

import{useState}from"react"
import Link from"next/link"
import{supabase}from"../../lib/supabase"
import ui from"./registro.module.css"

const PMS_HOME="/pms-next"

export default function SignupForm(){
  const[name,setName]=useState(""),[hotel,setHotel]=useState(""),[city,setCity]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState(""),[kind,setKind]=useState(""),[loading,setLoading]=useState(false)
  async function submit(e){
    e.preventDefault();setMessage("");setKind("")
    if(password.length<8){setMessage("Usá una contraseña de al menos 8 caracteres.");setKind("error");return}
    setLoading(true)
    const{data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:`${location.origin}/login`,data:{account_type:"habitacion_llena_hotel",full_name:name.trim(),hotel_name:hotel.trim(),city:city.trim()}}})
    setLoading(false)
    if(error){setMessage(error.message);setKind("error");return}
    if(data?.session){location.replace(PMS_HOME);return}
    setMessage("Cuenta creada. Revisá tu email para confirmar el acceso y después ingresá al PMS.");setKind("success")
  }
  return <section className={ui.card}>
    <div className={ui.note}><small>CREAR HOTEL</small><h2>Tu recepción empieza acá.</h2><p>Creá la cuenta propietaria. El hotel queda aislado por propiedad desde el primer acceso y después podés sumar a tu equipo con sus roles.</p></div>
    <form className={ui.form} onSubmit={submit}>
      <label><span>Tu nombre</span><input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre y apellido"/></label>
      <div className={ui.split}><label><span>Hotel</span><input required value={hotel} onChange={e=>setHotel(e.target.value)} placeholder="Nombre del hotel"/></label><label><span>Ciudad</span><input value={city} onChange={e=>setCity(e.target.value)} placeholder="Ciudad"/></label></div>
      <label><span>Email</span><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="direccion@hotel.com"/></label>
      <label><span>Contraseña</span><input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres"/></label>
      {message&&<div className={`${ui.message} ${kind==="success"?ui.success:ui.error}`}>{message}</div>}
      <button className={ui.primary} disabled={loading}>{loading?"Preparando tu hotel…":"Crear cuenta"}</button>
    </form>
    <div className={ui.actions}><Link href="/login" className={ui.secondary}>Ya tengo acceso</Link></div>
    <p className={ui.small}>Al crear la cuenta se genera una propiedad independiente con vos como propietario. Los datos de un hotel no se comparten con otro.</p>
  </section>
}
