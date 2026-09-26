"use client"

import{useState}from"react"
import{normalizeRatePlans,ratePlanBasis,ratePlanBasisLabel,ratePlanSignedAdjustment}from"../../core/ratePlans"
import s from"./settings.module.css"

const money=(value,currency)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)

export default function RatePlansSettings({value,currency="ARS",taxes={},canEdit=false,saving=false,onSave}){
  const[form,setForm]=useState(()=>normalizeRatePlans(value))
  const mode=!taxes?.enabled?"sin IVA":taxes?.price_tax_mode==="tax_excluded"?"neto + IVA":"precio final con IVA incluido"
  function patchPlan(code,patch){setForm(current=>({...current,plans:current.plans.map(plan=>plan.code===code?{...plan,...patch}:plan)}))}
  function save(){const normalized=normalizeRatePlans(form);onSave?.(normalized)}
  return <div className={s.panel}>
    <h2>Planes tarifarios y régimen</h2>
    <p className={s.panelIntro}>La tarifa actual de Habitaciones y Tarifas y disponibilidad es el precio del plan base. Por defecto es Alojamiento + desayuno. Solo alojamiento descuenta por habitación/noche sobre esa tarifa base. Los regímenes de comidas pueden sumar por persona/noche.</p>
    <div style={{padding:"12px 13px",border:"1px solid color-mix(in srgb,var(--accent) 28%,var(--line))",borderRadius:12,background:"color-mix(in srgb,var(--accent) 6%,var(--panelSolid))",marginBottom:14}}>
      <b style={{display:"block",fontSize:12}}>No cambia el contrato de precios</b>
      <small style={{display:"block",marginTop:4,color:"var(--muted)",lineHeight:1.5}}>Los ajustes usan la misma moneda ({currency}) y la misma regla fiscal ({mode}). El IVA, USD y el calendario siguen teniendo una sola fuente de verdad.</small>
    </div>
    <div style={{display:"grid",gap:9}}>
      {form.plans.map(plan=>{const isDefault=plan.code===form.default_code;return <article key={plan.code} style={{padding:"11px 12px",border:"1px solid "+(isDefault?"color-mix(in srgb,var(--accent) 42%,var(--line))":"var(--line)"),borderRadius:11,background:isDefault?"color-mix(in srgb,var(--accent) 5%,var(--panelSolid))":"var(--panelSolid)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div><b style={{fontSize:12}}>{plan.name}</b><small style={{display:"block",marginTop:2,color:"var(--muted)"}}>{plan.code} · {isDefault?"Plan base · la tarifa actual ya incluye este régimen":plan.code==="RO"?"Opcional · se descuenta de Alojamiento + desayuno":"Opcional"}</small></div>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            {isDefault?<span style={{fontSize:9,fontWeight:900,color:"var(--accent)"}}>PREDETERMINADO</span>:null}
            <label style={{display:"flex",alignItems:"center",gap:6,fontSize:10,fontWeight:800,color:"var(--muted)"}}><input type="checkbox" disabled={!canEdit||saving||isDefault} checked={plan.active} onChange={e=>patchPlan(plan.code,{active:e.target.checked,public:e.target.checked})}/> Ofrecer</label>
          </div>
        </div>
        <div className={s.ratePlanFields}>
          <label className={s.settingsField}>
            <span className={s.settingsFieldLabel}>Se aplica por</span>
            <select className={s.settingsControl} disabled={!canEdit||saving||isDefault||!plan.active||plan.code==="RO"} value={ratePlanBasis(plan)} onChange={e=>patchPlan(plan.code,{adjustment_basis:e.target.value})}>
              <option value="per_room">Habitación / noche</option>
              <option value="per_person">Persona / noche</option>
            </select>
          </label>
          <label className={s.settingsField}>
            <span className={s.settingsFieldLabel}>{plan.code==="RO"?"Descuento sobre tarifa base":"Ajuste"}</span>
            <input className={s.settingsControl} type="number" step={currency==="ARS"?"100":"0.5"} disabled={!canEdit||saving||isDefault||!plan.active} value={isDefault?0:plan.adjustment_per_person} onChange={e=>patchPlan(plan.code,{adjustment_per_person:e.target.value})} placeholder={plan.code==="RO"?"Ej. 20000":"Ej. 10000"}/>
            <small className={s.settingsFieldHelp}>{isDefault?"Incluido en la tarifa actual.":plan.code==="RO"?(Number(plan.adjustment_per_person||0)===0?"Este valor se descuenta de Alojamiento + desayuno.":"Se descuenta de Alojamiento + desayuno · resta "+money(Math.abs(Number(plan.adjustment_per_person)||0),currency)+" por habitación / noche."):(Number(plan.adjustment_per_person||0)===0?"Sin diferencia respecto del plan base.":(ratePlanSignedAdjustment(plan)>0?"Suma ":"Resta ")+money(Math.abs(ratePlanSignedAdjustment(plan)),currency)+" por "+ratePlanBasisLabel(plan)+".")}</small>
          </label>
          <label className={s.settingsField}>
            <span className={s.settingsFieldLabel}>Detalle opcional</span>
            <input className={s.settingsControl} disabled={!canEdit||saving} value={plan.description||""} onChange={e=>patchPlan(plan.code,{description:e.target.value})} placeholder="Qué incluye este régimen"/>
          </label>
        </div>
      </article>})}
    </div>
    {!canEdit?<p className={s.panelIntro} style={{marginTop:12}}>Sólo el propietario puede modificar los planes tarifarios.</p>:null}
    <footer><button className={s.primary} disabled={saving||!canEdit} onClick={save}>{saving?"Guardando…":"Guardar planes tarifarios"}</button></footer>
  </div>
}
