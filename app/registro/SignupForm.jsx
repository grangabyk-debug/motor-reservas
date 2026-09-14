"use client"

import Link from"next/link"
import ui from"./registro.module.css"

export default function SignupForm(){return <section className={ui.card}>
  <div className={ui.note}><small>ACCESO CERRADO</small><h2>Las altas están pausadas.</h2><p>Por el momento Habitación Llena habilita cuentas únicamente de forma interna.</p></div>
  <div className={ui.actions}><Link href="/login" className={ui.secondary}>Acceso clientes</Link></div>
</section>}
