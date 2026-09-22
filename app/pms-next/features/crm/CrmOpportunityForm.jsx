"use client"

import{useEffect,useMemo,useState}from"react"
import s from"./crm.module.css"

const today=()=>new Date().toLocaleDateString("en-CA")
const addDays=(value,days)=>{const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);return d.toLocaleDateString("en-CA")}
const fresh=()=>({guest_profile_id:"",stage:"new",priority:"normal",name:"",email:"",phone:"",source_channel:"direct",desired_check_in:today(),desired_check_out:addDays(today(),1),adults:2,children:0,rooms_count:1,preferred_room_type:"",alternative_room_types:"",flexible_dates:false,flexibility_days:0,max_budget:"",currency:"ARS",waitlist_until:"",next_follow_up_at:"",follow_up_channel:"whatsapp",notes:""})

export default function CrmOpportunityForm({open,guests=[],roomTypes=[],saving=false,onClose,onSave,initial=null}){
  const[draft,setDraft]=useState(fresh)
  useEffect(()=>{if(!open)return;if(initial){setDraft({...fresh(),...initial,alternative_room_types:Array.isArray(initial.alternative_room_types)?initial.alternative_room_types.join(", "):""})}else setDraft(fresh())},[open,initial?.id])
  const selectedGuest=useMemo(()=>guests.find(g=>String(g.id)===String(draft.guest_profile_id))||null,[guests,draft.guest_profile_id])
  if(!open)return null
  const set=(key,value)=>setDraft(current=>({...current,[key]:value}))
  function guestChanged(id){
    const guest=guests.find(row=>String(row.id)===String(id))
    setDraft(current=>({...current,guest_profile_id:id,name:guest?.full_name||current.name,email:guest?.email||current.email,phone:guest?.phone||current.phone}))
  }
  function submit(){
    const payload={...draft,alternative_room_types:String(draft.alternative_room_types||"").split(",").map(v=>v.trim()).filter(Boolean)}
    onSave?.(payload)
  }
  return <div className={s.backdrop} onMouseDown={e=>e.target===e.currentTarget&&onClose?.()}><section className={s.formModal} aria-label="Nueva oportunidad CRM">
    <header className={s.modalHead}><div><small>CRM · OPORTUNIDAD</small><h2>{initial?"Editar oportunidad":"Nueva oportunidad"}</h2><p>Consulta comercial, seguimiento o lista de espera. No bloquea el Planning.</p></div><button type="button" className={s.close} onClick={onClose}>×</button></header>
    <div className={s.formGrid}>
      <label>Vincular huésped<select value={draft.guest_profile_id||""} onChange={e=>guestChanged(e.target.value)}><option value="">Sin perfil vinculado</option>{guests.map(g=><option key={g.id} value={g.id}>{g.full_name}</option>)}</select>{selectedGuest?<small>Usa la ficha existente del Guestbook.</small>:null}</label>
      <label>Estado<select value={draft.stage} onChange={e=>set("stage",e.target.value)}><option value="new">Nueva consulta</option><option value="quote_sent">Presupuesto</option><option value="follow_up">Seguimiento</option><option value="waitlist">Lista de espera</option><option value="won">Ganada</option><option value="lost">Perdida</option></select></label>
      <label>Nombre / contacto<input autoFocus value={draft.name} onChange={e=>set("name",e.target.value)} placeholder="María Pérez / Familia López"/></label>
      <label>Prioridad<select value={draft.priority} onChange={e=>set("priority",e.target.value)}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option></select></label>
      <label>Email<input type="email" value={draft.email||""} onChange={e=>set("email",e.target.value)}/></label>
      <label>Teléfono<input value={draft.phone||""} onChange={e=>set("phone",e.target.value)}/></label>
      <label>Origen<select value={draft.source_channel} onChange={e=>set("source_channel",e.target.value)}><option value="direct">Directo</option><option value="whatsapp">WhatsApp</option><option value="phone">Teléfono</option><option value="email">Email</option><option value="website">Web</option><option value="instagram">Instagram</option><option value="walkin">Walk-in</option><option value="other">Otro</option></select></label>
      <label>Habitación preferida<input list="crm-room-types" value={draft.preferred_room_type||""} onChange={e=>set("preferred_room_type",e.target.value)} placeholder="Ej. Doble"/><datalist id="crm-room-types">{roomTypes.map(type=><option key={type} value={type}/>)}</datalist></label>
      <label>Entrada deseada<input type="date" value={draft.desired_check_in||""} onChange={e=>set("desired_check_in",e.target.value)}/></label>
      <label>Salida deseada<input type="date" min={draft.desired_check_in||undefined} value={draft.desired_check_out||""} onChange={e=>set("desired_check_out",e.target.value)}/></label>
      <label>Adultos<input type="number" min="0" value={draft.adults} onChange={e=>set("adults",e.target.value)}/></label>
      <label>Niños<input type="number" min="0" value={draft.children} onChange={e=>set("children",e.target.value)}/></label>
      <label>Habitaciones<input type="number" min="1" value={draft.rooms_count} onChange={e=>set("rooms_count",e.target.value)}/></label>
      <label>Presupuesto máximo<input type="number" min="0" step="0.01" value={draft.max_budget??""} onChange={e=>set("max_budget",e.target.value)} placeholder="Opcional"/></label>
      <label>Moneda<select value={draft.currency} onChange={e=>set("currency",e.target.value)}><option>ARS</option><option>USD</option></select></label>
      <label>Alternativas aceptadas<input value={draft.alternative_room_types||""} onChange={e=>set("alternative_room_types",e.target.value)} placeholder="Triple, Suite"/></label>
      <label className={s.checkLabel}><input type="checkbox" checked={Boolean(draft.flexible_dates)} onChange={e=>set("flexible_dates",e.target.checked)}/><span>Fechas flexibles</span></label>
      <label>Días de flexibilidad<input type="number" min="0" max="60" disabled={!draft.flexible_dates} value={draft.flexibility_days||0} onChange={e=>set("flexibility_days",e.target.value)}/></label>
      {draft.stage==="waitlist"?<label>Esperar hasta<input type="date" value={draft.waitlist_until||""} onChange={e=>set("waitlist_until",e.target.value)}/><small>Después de esta fecha la oportunidad se considera vencida.</small></label>:<div/>}
      <label>Próximo seguimiento<input type="datetime-local" value={draft.next_follow_up_at||""} onChange={e=>set("next_follow_up_at",e.target.value)}/></label>
      <label>Canal de seguimiento<select value={draft.follow_up_channel||"whatsapp"} onChange={e=>set("follow_up_channel",e.target.value)}><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="phone">Teléfono</option><option value="other">Otro</option></select></label>
      <label className={s.full}>Notas<textarea rows="3" value={draft.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="Preferencias, contexto de la consulta, restricciones…"/></label>
    </div>
    <footer className={s.modalFooter}><button type="button" onClick={onClose} disabled={saving}>Cancelar</button><button type="button" className={s.primary} onClick={submit} disabled={saving||!draft.name.trim()}>{saving?"Guardando…":initial?"Guardar cambios":"Crear oportunidad"}</button></footer>
  </section></div>
}
