"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "../../lib/supabase"

export default function RegistroPage() {
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [cargando, setCargando] = useState(false)

  async function registrar(e) {
    e.preventDefault()
    setMensaje("")

    if (password.length < 6) {
      setMensaje("La contraseña debe tener al menos 6 caracteres.")
      return
    }

    setCargando(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre },
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined,
      },
    })

    if (error) {
      setMensaje(error.message)
      setCargando(false)
      return
    }

    if (data?.session) {
      window.location.href = "/dashboard"
      return
    }

    setMensaje("Cuenta creada. Revisá tu email para confirmar la cuenta.")
    setCargando(false)
  }

  return (
    <main style={page}>
      <div style={card}>
        <Link href="/" style={brand}>Habitación Llena</Link>
        <h1 style={title}>Crear cuenta</h1>
        <p style={muted}>Empezá a administrar tu alojamiento.</p>

        <form onSubmit={registrar} style={{display:"grid",gap:14,marginTop:24}}>
          <label style={label}>Nombre<input required value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Tu nombre" style={input}/></label>
          <label style={label}>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" style={input}/></label>
          <label style={label}>Contraseña<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={input}/></label>
          {mensaje && <div style={message}>{mensaje}</div>}
          <button disabled={cargando} style={button}>{cargando ? "Creando..." : "Crear cuenta"}</button>
        </form>

        <p style={bottom}>¿Ya tenés cuenta? <Link href="/login" style={link}>Ingresar</Link></p>
      </div>
    </main>
  )
}

const page={minHeight:"100vh",background:"#f5f7fa",display:"grid",placeItems:"center",padding:20,fontFamily:"Inter,system-ui,sans-serif"}
const card={width:"min(420px,100%)",background:"#fff",border:"1px solid #e5e7eb",borderRadius:16,padding:32,boxShadow:"0 20px 50px rgba(0,40,100,.08)"}
const brand={color:"#003b95",fontWeight:850,fontSize:22,textDecoration:"none"}
const title={fontSize:30,margin:"32px 0 6px"}
const muted={color:"#6b7280",margin:0}
const label={display:"grid",gap:7,fontSize:13,fontWeight:700}
const input={padding:"12px 13px",border:"1px solid #dfe4ea",borderRadius:8,fontSize:14}
const button={border:"none",background:"#006ce4",color:"#fff",borderRadius:8,padding:13,fontWeight:800,cursor:"pointer"}
const message={background:"#eef7ff",color:"#003b95",padding:11,borderRadius:8,fontSize:13}
const bottom={textAlign:"center",color:"#6b7280",fontSize:13,marginTop:22}
const link={color:"#006ce4",fontWeight:800}
