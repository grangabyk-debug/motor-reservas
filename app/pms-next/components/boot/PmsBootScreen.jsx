"use client"

import{useEffect,useState}from"react"
import s from"./PmsBootScreen.module.css"

const READY_STEPS=["Identidad verificada","Propiedad aislada","Operación sincronizada"]

export default function PmsBootScreen({ready=false,property,onComplete}){
  const[leaving,setLeaving]=useState(false)
  const propertyName=property?.name||"Habitación Llena"
  const city=property?.city||"PMS hotelero"

  useEffect(()=>{
    if(!ready||!onComplete)return
    const leaveTimer=window.setTimeout(()=>setLeaving(true),620)
    const doneTimer=window.setTimeout(()=>onComplete(),980)
    return()=>{window.clearTimeout(leaveTimer);window.clearTimeout(doneTimer)}
  },[ready,onComplete])

  return <div className={`${s.screen} ${leaving?s.leaving:""}`} role="status" aria-live="polite">
    <div className={s.ambient}/><div className={s.horizon}/><div className={s.floorGlow}/>
    <div className={s.grain}/>
    <main className={s.stage}>
      <div className={s.brandLockup}>
        <div className={s.monogram}><span>HL</span><i/></div>
        <div><small>HABITACIÓN LLENA</small><b>PMS</b></div>
      </div>

      <section className={s.hero}>
        <div className={s.eyebrow}><span/>{ready?"SISTEMA LISTO":"INICIANDO OPERACIÓN"}</div>
        <h1>{ready?"Bienvenido a":"Preparando"}<br/><em>{propertyName}</em></h1>
        <p>{ready?`${city} · Todo está listo para operar.`:"Validando accesos, propiedad y datos operativos de forma segura."}</p>
      </section>

      <footer className={s.footer}>
        <div className={s.steps}>{READY_STEPS.map((label,index)=><div key={label} className={`${s.step} ${ready?s.done:index===0?s.active:""}`}><i>{ready?"✓":""}</i><span>{label}</span></div>)}</div>
        <div className={s.progress}><i className={ready?s.progressReady:""}/></div>
        <div className={s.meta}><span>{ready?"Abriendo panel operativo":"Conexión segura multi-tenant"}</span><span>HL · ENTERPRISE</span></div>
      </footer>
    </main>
  </div>
}
