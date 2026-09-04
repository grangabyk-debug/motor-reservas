"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./recurring-expenses.module.css"

const today=()=>new Date().toISOString().slice(0,10)
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:2}).format(Number(value||0))
const FREQ={weekly:"Semanal",monthly:"Mensual",yearly:"Anual"}
const blank=()=>({name:"",supplier_name:"",supplier_tax_id:"",concept:"",category:"Operación",amount:"",tax_amount:"0",currency:"ARS",payment_method:"Transferencia",frequency:"monthly",interval_count:1,next_due_date:today(),end_date:"",auto_post:true,active:true,notes:""})
function isMissingTable(error){const text=String(error?.message||"").toLowerCase();return error?.code==="42P01"||text.includes("hotel_recurring_expenses")&&text.includes("does not exist")}
function toast(detail){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))}

export default function RecurringExpensesPanel({propertyId}){
  const[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[open,setOpen]=useState(false),[editing,setEditing]=useState(null),[error,setError]=useState(""),[schemaReady,setSchemaReady]=useState(true),[form,setForm]=useState(blank)

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{const{data,error:loadError}=await supabase.from("hotel_recurring_expenses").select("id,name,supplier_name,supplier_tax_id,concept,category,amount,tax_amount,currency,payment_method,frequency,interval_count,next_due_date,end_date,auto_post,active,notes,created_at,updated_at").eq("property_id",propertyId).order("active",{ascending:false}).order("next_due_date").order("name");if(loadError)throw loadError;setRows(data||[]);setSchemaReady(true)}catch(err){if(isMissingTable(err)){setRows([]);setSchemaReady(false)}else setError(err?.message||"No se pudieron cargar los gastos recurrentes.")}finally{setLoading(false)}
  },[propertyId])
  useEffect(()=>{load()},[load])

  const summary=useMemo(()=>{const active=rows.filter(r=>r.active);return{active:active.length,monthly:active.filter(r=>r.frequency==="monthly").reduce((sum,r)=>sum+Number(r.amount||0),0),next:active.filter(r=>r.next_due_date).sort((a,b)=>a.next_due_date.localeCompare(b.next_due_date))[0]||null}},[rows])
  function startCreate(){setEditing(null);setForm(blank());setOpen(true);setError("")}
  function startEdit(row){setEditing(row);setForm({...row,end_date:row.end_date||"",tax_amount:String(row.tax_amount??0),amount:String(row.amount??""),interval_count:Number(row.interval_count)||1});setOpen(true);setError("")}

  async function save(){
    if(!schemaReady)return
    setSaving(true);setError("")
    try{
      if(!form.name.trim()||!form.concept.trim()||Number(form.amount)<=0)throw new Error("Completá nombre, concepto e importe.")
      if(!form.next_due_date)throw new Error("Elegí la próxima fecha de vencimiento.")
      const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError
      const payload={property_id:propertyId,name:form.name.trim(),supplier_name:form.supplier_name.trim()||null,supplier_tax_id:form.supplier_tax_id.trim()||null,concept:form.concept.trim(),category:form.category.trim()||"Operación",amount:Number(form.amount),tax_amount:Math.max(0,Number(form.tax_amount)||0),currency:form.currency,payment_method:form.payment_method,frequency:form.frequency,interval_count:Math.max(1,Number(form.interval_count)||1),next_due_date:form.next_due_date,end_date:form.end_date||null,auto_post:Boolean(form.auto_post),active:Boolean(form.active),notes:form.notes.trim()||null,updated_at:new Date().toISOString()}
      if(editing?.id){const{error:updateError}=await supabase.from("hotel_recurring_expenses").update(payload).eq("id",editing.id).eq("property_id",propertyId);if(updateError)throw updateError}else{const{error:insertError}=await supabase.from("hotel_recurring_expenses").insert({...payload,created_by:userData?.user?.id||null});if(insertError)throw insertError}
      setOpen(false);toast({title:editing?"Obligación actualizada":"Gasto recurrente creado",message:`${form.name.trim()} · ${FREQ[form.frequency]||form.frequency} · ${money(form.amount,form.currency)}`});await load()
    }catch(err){setError(err?.message||"No se pudo guardar el gasto recurrente.")}finally{setSaving(false)}
  }

  async function toggle(row){setError("");try{const{error:updateError}=await supabase.from("hotel_recurring_expenses").update({active:!row.active,updated_at:new Date().toISOString()}).eq("id",row.id).eq("property_id",propertyId);if(updateError)throw updateError;await load()}catch(err){setError(err?.message||"No se pudo actualizar la obligación.")}}
  async function processDue(){
    setSaving(true);setError("")
    try{const{data,error:rpcError}=await supabase.rpc("hl_materialize_recurring_expenses",{p_property_id:propertyId,p_until:today()});if(rpcError)throw rpcError;toast({title:"Vencimientos procesados",message:`${Number(data?.created||0)} gasto${Number(data?.created||0)===1?"":"s"} contabilizado${Number(data?.created||0)===1?"":"s"}.`});await load()}catch(err){setError(err?.message||"No se pudieron procesar los vencimientos.")}finally{setSaving(false)}
  }

  if(!schemaReady)return <article className={s.pending}><span>HL</span><div><small>PREPARADO PARA STAGING</small><h3>Gastos recurrentes listos para activar</h3><p>La interfaz y la migración ya están preparadas. Falta aplicar la estructura aislada en Supabase staging antes de habilitarla en hoteles reales.</p></div></article>
  return <div className={s.wrap}>
    {error&&<div className={s.error}>{error}</div>}
    <div className={s.top}><div className={s.metrics}><article><span>Obligaciones activas</span><b>{summary.active}</b></article><article><span>Mensuales configurados</span><b>{money(summary.monthly)}</b></article><article><span>Próximo vencimiento</span><b>{summary.next?.next_due_date||"—"}</b><small>{summary.next?.name||"Sin vencimientos"}</small></article></div><div className={s.actions}><button type="button" onClick={processDue} disabled={saving||!rows.length}>Procesar vencimientos</button><button type="button" className={s.primary} onClick={startCreate}>＋ Nueva obligación</button></div></div>
    {loading?<div className={s.empty}>Cargando gastos recurrentes…</div>:!rows.length?<div className={s.empty}><b>No hay obligaciones recurrentes</b><span>Cargá alquileres, servicios, abonos, mantenimiento, licencias u otros pagos periódicos.</span><button onClick={startCreate}>Agregar primera obligación</button></div>:<div className={s.table}><div className={s.head}><span>Obligación</span><span>Frecuencia</span><span>Próximo pago</span><span>Importe</span><span>Estado</span><span/></div>{rows.map(row=><article key={row.id} className={!row.active?s.inactive:""}><div><b>{row.name}</b><small>{row.supplier_name||row.category} · {row.concept}</small></div><span>{row.interval_count>1?`Cada ${row.interval_count} · `:""}{FREQ[row.frequency]||row.frequency}</span><span>{row.next_due_date}</span><strong>{money(row.amount,row.currency)}</strong><button className={row.active?s.on:s.off} onClick={()=>toggle(row)}>{row.active?"Activo":"Pausado"}</button><button className={s.edit} onClick={()=>startEdit(row)}>Editar</button></article>)}</div>}
    {open&&<div className={s.backdrop} onMouseDown={e=>e.target===e.currentTarget&&setOpen(false)}><div className={s.modal}><button className={s.close} onClick={()=>setOpen(false)}>×</button><small>GASTO RECURRENTE</small><h2>{editing?"Editar obligación":"Nueva obligación"}</h2><div className={s.form}><label>Nombre<input autoFocus value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ej. Alquiler del hotel"/></label><label>Categoría<input value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}/></label><label className={s.wide}>Concepto<input value={form.concept} onChange={e=>setForm(f=>({...f,concept:e.target.value}))} placeholder="Concepto que aparecerá en Gastos"/></label><label>Proveedor<input value={form.supplier_name} onChange={e=>setForm(f=>({...f,supplier_name:e.target.value}))}/></label><label>CUIT / identificación<input value={form.supplier_tax_id} onChange={e=>setForm(f=>({...f,supplier_tax_id:e.target.value}))}/></label><label>Importe<input type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/></label><label>Impuestos incluidos<input type="number" min="0" step="0.01" value={form.tax_amount} onChange={e=>setForm(f=>({...f,tax_amount:e.target.value}))}/></label><label>Moneda<select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}><option>ARS</option><option>USD</option></select></label><label>Medio de pago<select value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}><option>Transferencia</option><option>Efectivo</option><option>Tarjeta</option><option>Débito automático</option><option>Otro</option></select></label><label>Frecuencia<select value={form.frequency} onChange={e=>setForm(f=>({...f,frequency:e.target.value}))}><option value="weekly">Semanal</option><option value="monthly">Mensual</option><option value="yearly">Anual</option></select></label><label>Intervalo<input type="number" min="1" max="120" value={form.interval_count} onChange={e=>setForm(f=>({...f,interval_count:e.target.value}))}/><small>1 = cada período, 2 = cada dos períodos.</small></label><label>Próximo vencimiento<input type="date" value={form.next_due_date} onChange={e=>setForm(f=>({...f,next_due_date:e.target.value}))}/></label><label>Finaliza<input type="date" min={form.next_due_date} value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))}/></label><label className={`${s.wide} ${s.toggle}`}><input type="checkbox" checked={form.auto_post} onChange={e=>setForm(f=>({...f,auto_post:e.target.checked}))}/><span>Contabilizar automáticamente al llegar el vencimiento</span></label><label className={`${s.wide} ${s.toggle}`}><input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))}/><span>Obligación activa</span></label><label className={s.wide}>Notas<textarea rows="3" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label></div><footer><button onClick={()=>setOpen(false)}>Cancelar</button><button className={s.primary} disabled={saving} onClick={save}>{saving?"Guardando…":"Guardar obligación"}</button></footer></div></div>}
  </div>
}
