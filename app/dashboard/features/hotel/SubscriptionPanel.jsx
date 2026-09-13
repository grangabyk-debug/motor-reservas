"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./subscription-panel.module.css"

const statusLabel={active:"Activo",trialing:"Prueba Pro",grace:"Período de gracia",past_due:"Pago pendiente",inactive:"Inactivo",canceled:"Cancelado"}
const daysLeft=value=>value?Math.max(0,Math.ceil((new Date(value).getTime()-Date.now())/86400000)):null

export default function SubscriptionPanel({propertyId,role="reception"}){
 const[state,setState]=useState({subscription:null,entitlements:[],modules:[],plans:[],planModules:[],requests:[]}),[loading,setLoading]=useState(true),[error,setError]=useState(""),[draft,setDraft]=useState({plan_code:"pro",billing_cycle:"monthly",room_tier:"",requested_modules:[],trial_requested:false,note:""}),[saving,setSaving]=useState(false)
 const owner=role==="owner"
 async function load(){if(!propertyId)return;setLoading(true);setError("");const results=await Promise.all([
  supabase.from("hotel_subscriptions").select("*").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(1).maybeSingle(),
  supabase.from("hotel_feature_entitlements").select("*").eq("property_id",propertyId),
  supabase.from("hotel_module_catalog").select("*").eq("active",true).order("sort_order"),
  supabase.from("hotel_plan_catalog").select("*").eq("active",true).order("sort_order"),
  supabase.from("hotel_plan_modules").select("*"),
  owner?supabase.from("hotel_subscription_requests").select("*").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(20):Promise.resolve({data:[],error:null}),
 ]);const failed=results.find(x=>x.error);if(failed?.error){setError(failed.error.message);setLoading(false);return}setState({subscription:results[0].data||null,entitlements:results[1].data||[],modules:results[2].data||[],plans:results[3].data||[],planModules:results[4].data||[],requests:results[5].data||[]});setLoading(false)}
 useEffect(()=>{load()},[propertyId,owner])
 const activeModules=useMemo(()=>{const enabled=new Set(),sub=state.subscription,now=Date.now(),trial=sub?.status==="trialing"&&(!sub.trial_ends_at||new Date(sub.trial_ends_at).getTime()>now);state.modules.filter(m=>m.base_required).forEach(m=>enabled.add(m.module_code));if(!sub&&!state.entitlements.length){state.modules.forEach(m=>enabled.add(m.module_code));return enabled}if(trial){state.modules.forEach(m=>enabled.add(m.module_code));return enabled}if(["active","grace"].includes(sub?.status))state.planModules.filter(x=>x.plan_code===sub.plan_code&&x.enabled!==false).forEach(x=>enabled.add(x.module_code));state.entitlements.forEach(x=>x.enabled?enabled.add(x.feature_code):enabled.delete(x.feature_code));return enabled},[state])
 const pending=state.requests.find(r=>r.status==="pending"),trialDays=daysLeft(state.subscription?.trial_ends_at),plan=state.plans.find(p=>p.plan_code===state.subscription?.plan_code)
 async function requestChange(e){e.preventDefault();if(!owner||saving||pending)return;setSaving(true);setError("");const modules=draft.plan_code==="custom"?draft.requested_modules:[];const{error}=await supabase.rpc("hl_request_subscription_change",{p_property_id:propertyId,p_plan_code:draft.plan_code,p_billing_cycle:draft.billing_cycle,p_room_tier:draft.room_tier||null,p_requested_modules:modules,p_trial_requested:draft.trial_requested,p_note:draft.note||null});if(error)setError(error.message==="pending_request_exists"?"Ya existe una solicitud pendiente.":error.message);else await load();setSaving(false)}
 async function cancel(id){setSaving(true);const{error}=await supabase.rpc("hl_cancel_subscription_request",{p_request_id:id});if(error)setError(error.message);else await load();setSaving(false)}
 if(loading)return <div className={s.loading}>Preparando tu plan…</div>
 return <div className={s.page}>
  <section className={s.hero}><div><small>MI PLAN</small><h2>Tu Habitación Llena, armado a medida.</h2><p>Consultá qué módulos tiene habilitados esta propiedad, el estado de la suscripción y cualquier prueba activa.</p></div><div className={s.planBadge}><span>{plan?.label||state.subscription?.plan_code||"Acceso actual"}</span><b>{statusLabel[state.subscription?.status]||(!state.subscription?"Legacy completo":"Sin activar")}</b></div></section>
  {error&&<div className={s.error}>{error}</div>}
  <section className={s.summary}>
   <article><small>PLAN</small><b>{plan?.label||(!state.subscription?"Acceso completo existente":"—")}</b><span>{state.subscription?.billing_cycle==="annual"?"Facturación anual":state.subscription?.billing_cycle==="monthly"?"Facturación mensual":"Sin ciclo definido"}</span></article>
   <article><small>HABITACIONES</small><b>{state.subscription?.room_limit||"Sin límite"}</b><span>{state.subscription?.room_tier||"Tier sin definir"}</span></article>
   <article><small>PRUEBA</small><b>{state.subscription?.status==="trialing"?`${trialDays??"—"} días`:"—"}</b><span>{state.subscription?.status==="trialing"?"Acceso Pro temporal":"Sin prueba activa"}</span></article>
   <article><small>MÓDULOS ACTIVOS</small><b>{activeModules.size}</b><span>de {state.modules.length} disponibles</span></article>
  </section>
  <section className={s.card}><header><div><small>MÓDULOS</small><h3>Lo que tiene habilitado este hotel</h3></div></header><div className={s.moduleGrid}>{state.modules.map(m=><article key={m.module_code} data-active={activeModules.has(m.module_code)}><span>{activeModules.has(m.module_code)?"✓":"○"}</span><div><b>{m.label}</b><small>{m.description}</small></div><em>{activeModules.has(m.module_code)?"Activo":"No incluido"}</em></article>)}</div></section>
  {owner&&<section className={s.card}><header><div><small>CAMBIOS</small><h3>Solicitar una configuración</h3><p>La solicitud no cambia el plan automáticamente. Queda pendiente de aprobación de Habitación Llena.</p></div></header>{pending?<div className={s.pending}><div><b>Solicitud pendiente · {state.plans.find(p=>p.plan_code===pending.plan_code)?.label||pending.plan_code}</b><span>{pending.requested_modules?.length?`${pending.requested_modules.length} módulos seleccionados · `:""}{new Date(pending.created_at).toLocaleDateString("es-AR")}</span></div><button disabled={saving} onClick={()=>cancel(pending.id)}>Cancelar solicitud</button></div>:<form className={s.form} onSubmit={requestChange}><label>Plan<select value={draft.plan_code} onChange={e=>setDraft(x=>({...x,plan_code:e.target.value}))}>{state.plans.map(p=><option key={p.plan_code} value={p.plan_code}>{p.label}</option>)}</select></label><label>Ciclo<select value={draft.billing_cycle} onChange={e=>setDraft(x=>({...x,billing_cycle:e.target.value}))}><option value="monthly">Mensual</option><option value="annual">Anual</option></select></label><label>Tier / tamaño<input value={draft.room_tier} onChange={e=>setDraft(x=>({...x,room_tier:e.target.value}))} placeholder="Ej. hasta 20 habitaciones"/></label><label className={s.check}><input type="checkbox" checked={draft.trial_requested} onChange={e=>setDraft(x=>({...x,trial_requested:e.target.checked}))}/><span>Solicitar prueba Pro de 14 días</span></label>{draft.plan_code==="custom"&&<div className={s.custom}><b>Elegí los módulos</b><div>{state.modules.filter(m=>!m.base_required).map(m=><label key={m.module_code}><input type="checkbox" checked={draft.requested_modules.includes(m.module_code)} onChange={e=>setDraft(x=>({...x,requested_modules:e.target.checked?[...x.requested_modules,m.module_code]:x.requested_modules.filter(v=>v!==m.module_code)}))}/><span>{m.label}</span></label>)}</div></div>}<label className={s.wide}>Comentario<textarea value={draft.note} onChange={e=>setDraft(x=>({...x,note:e.target.value}))} placeholder="Contanos qué necesitás o qué querés sumar…"/></label><footer><button disabled={saving}>{saving?"Enviando…":"Enviar solicitud"}</button></footer></form>}</section>}
  {!owner&&<div className={s.info}>La administración comercial del plan está disponible para el propietario de la propiedad.</div>}
 </div>
}
