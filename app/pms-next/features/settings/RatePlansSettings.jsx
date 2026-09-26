"use client"

import{useState}from"react"
import{normalizeRatePlans}from"../../core/ratePlans"
import s from"./settings.module.css"

const money=(value,currency)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)

export default function RatePlansSettings({value,currency="ARS",taxes={},canEdit=false,saving=false,onSave}){
  const[form,setForm]=useState(()=>normalizeRatePlans(value))
  const mode=!taxes?.enabled?"sin IVA":taxes?.price_tax_mode==="tax_excluded"?"neto + IVA":"precio final con IVA incluido"
  function patchPlan(code,patch){setForm(current=>({...current,plans:current.plans.map(plan=>plan.code===code?{...plan,...patch}:plan)}))}
  function save(){const normalized=normalizeRatePlans(form);onSave?.(normalized)}
  return <div className={s.panel}>
    <h2>Planes tarifarios y régimen</h2>
    <p className={s.panelIntro}>La tarifa actual de Habitaciones y Tarifas y disponibilidad es el precio del plan base. Por defecto es Alojamiento + desayuno. Los demás planes sólo aplican un ajuste por persona y noche.</p>
    <div style={{padding:"12px 13px",border:"1px solid color-mix(in srgb,var(--accent) 28%,var(--line))",borderRadius:12,background:"color-mix(in srgb,var(--accent) 6%,var(--panelSolid))",marginBottom:14}}>
      <b style={{display:"block",fontSize:12}}>No cambia el contrato de precios</b>
      <small style={{display:"block",marginTop:4,color:"var(--muted)",lineHeight:1.5}}>Los ajustes usan la misma moneda ({currency}) y la misma regla fiscal ({mode}). El IVA, USD y el calendario siguen teniendo una sola fuente de verdad.</small>
    </div>
    <div style={{display:"grid",gap:9}}>
      {form.plans.map(plan=>{const isDefault=plan.code===form.default_code;return <article key={plan.code} style={{padding:"11px 12px",border:"1px solid "+(isDefault?"color-mix(in srgb,var(--accent) 42%,var(--line))":"var(--line)"),borderRadius:11,background:isDefault?"color-mix(in srgb,var(--accent) 5%,var(--panelSolid))":"var(--panelSolid)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div><b style={{fontSize:12}}>{plan.name}</b><small style={{display:"block",marginTop:2,color:"var(--muted)"}}>{plan.code} · {isDefault?"Plan base · la tarifa actual ya incluye este régimen":"Opcional"}</small></div>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            {isDefault?<span style={{fontSize:9,fontWeight:900,color:"var(--accent)"}}>PREDETERMINADO</span>:null}
            <label style={{display:"flex",alignItems:"center",gap:6,fontSize:10,fontWeight:800,color:"var(--muted)"}}><input type="checkbox" disabled={!canEdit||saving||isDefault} checked={plan.active} onChange={e=>patchPlan(plan.code,{active:e.target.checked,public:e.target.checked?plan.public:false})}/> Ofrecer</label>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"minmax(150px,.7fr) minmax(220px,1.3fr)",gap:8,marginTop:9,alignItems:"start"}}>
          <label style={{display:"flex",flexDirection:"column",gap:5,fontSize:10,fontWeight:800,color:"var(--muted)"}}>Ajuste por persona / noche
            <input style={{height:40,minHeight:40,width:"100%",boxSizing:"border-box"}} type="number" step={currency==="ARS"?"100":"0.5"} disabled={!canEdit||saving||isDefault||!plan.active} value={isDefault?0:plan.adjustment_per_person} onChange={e=>patchPlan(plan.code,{adjustment_per_person:Number(e.target.value)||0})}/>
            <small style={{fontWeight:600,lineHeight:1.35}}>{isDefault?"Incluido en la tarifa actual.":plan.adjustment_per_person===0?"Sin diferencia respecto del plan base.":(plan.adjustment_per_person>0?"Suma ":"Resta ")+money(Math.abs(plan.adjustment_per_person),currency)+" por huésped/noche."}</small>
          </label>
          <label style={{display:"flex",flexDirection:"column",gap:5,fontSize:10,fontWeight:800,color:"var(--muted)"}}>Detalle opcional
            <input style={{height:40,minHeight:40,width:"100%",boxSizing:"border-box"}} disabled={!canEdit||saving} value={plan.description||""} onChange={e=>patchPlan(plan.code,{description:e.target.value})} placeholder="Qué incluye este régimen"/>
          </label>
        </div>
      </article>})}
    </div>
    {!canEdit?<p className={s.panelIntro} style={{marginTop:12}}>Sólo el propietario puede modificar los planes tarifarios.</p>:null}
    <footer><button className={s.primary} disabled={saving||!canEdit} onClick={save}>{saving?"Guardando…":"Guardar planes tarifarios"}</button></footer>
  </div>
}
