"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./finance.module.css"

function money(value,currency="ARS"){return new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:2}).format(Number(value||0))}
function todayIso(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
const blankLine=()=>({description:"Alojamiento",quantity:1,unit_price:0,tax_rate:21})

export default function DocumentsPanel({propertyId}){
  const[documents,setDocuments]=useState([])
  const[reservations,setReservations]=useState([])
  const[open,setOpen]=useState(false)
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)
  const[error,setError]=useState("")
  const[form,setForm]=useState({reservation_id:"",name:"",email:"",phone:"",due_at:"",currency:"ARS",notes:"",status:"draft",lines:[blankLine()]})

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[docsRes,resRes]=await Promise.all([
        supabase.from("hotel_finance_documents").select("id,reservation_id,document_type,number,status,currency,subtotal,tax,total,balance,billing_to,items,issued_at,due_at,created_at,notes").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(200),
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,email_huesped,telefono_huesped,precio_total,moneda,fecha_entrada,fecha_salida,estado").eq("property_id",propertyId).neq("estado","cancelada").order("created_at",{ascending:false}).limit(200),
      ])
      if(docsRes.error)throw docsRes.error;if(resRes.error)throw resRes.error
      setDocuments(docsRes.data||[]);setReservations(resRes.data||[])
    }catch(err){setError(err?.message||"No se pudieron cargar los documentos.")}
    finally{setLoading(false)}
  },[propertyId])
  useEffect(()=>{load()},[load])

  const totals=useMemo(()=>{
    const today=todayIso();let collected=0,pending=0,overdue=0,drafts=0
    for(const doc of documents){if(doc.status==="paid")collected+=Number(doc.total||0);if(["issued","partial"].includes(doc.status))pending+=Number(doc.balance||0);if(doc.due_at&&doc.due_at<today&&!(["paid","void"].includes(doc.status)))overdue+=Number(doc.balance||0);if(doc.status==="draft")drafts++}
    return{collected,pending,overdue,drafts}
  },[documents])

  function selectReservation(id){
    const reservation=reservations.find(item=>String(item.id)===String(id));if(!reservation){setForm(current=>({...current,reservation_id:""}));return}
    setForm(current=>({...current,reservation_id:String(reservation.id),name:reservation.nombre_huesped||"",email:reservation.email_huesped||"",phone:reservation.telefono_huesped||"",currency:reservation.moneda||"ARS",lines:[{description:`Estadía ${reservation.fecha_entrada} → ${reservation.fecha_salida}`,quantity:1,unit_price:Number(reservation.precio_total||0),tax_rate:21}]}))
  }
  function updateLine(index,key,value){setForm(current=>({...current,lines:current.lines.map((line,i)=>i===index?{...line,[key]:value}:line)}))}
  const calc=useMemo(()=>{let subtotal=0,tax=0;for(const line of form.lines){const base=Math.max(0,Number(line.quantity||0))*Math.max(0,Number(line.unit_price||0));subtotal+=base;tax+=base*Math.max(0,Number(line.tax_rate||0))/100}return{subtotal,tax,total:subtotal+tax}},[form.lines])

  async function createDocument(){
    setSaving(true);setError("")
    try{
      if(!form.name.trim())throw new Error("Ingresá el nombre o razón social del cliente.")
      if(!form.lines.length||calc.total<=0)throw new Error("Agregá al menos una línea con importe.")
      const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError
      const items=form.lines.map(line=>({description:String(line.description||"").trim(),quantity:Number(line.quantity||0),unit_price:Number(line.unit_price||0),tax_rate:Number(line.tax_rate||0),subtotal:Number(line.quantity||0)*Number(line.unit_price||0)}))
      const payload={property_id:propertyId,reservation_id:form.reservation_id?Number(form.reservation_id):null,document_type:"invoice",number:null,status:form.status,currency:form.currency,subtotal:calc.subtotal,tax:calc.tax,total:calc.total,balance:calc.total,billing_to:{name:form.name.trim(),email:form.email.trim()||null,phone:form.phone.trim()||null},items,issued_at:form.status==="issued"?new Date().toISOString():null,due_at:form.due_at||null,external_ref:null,notes:form.notes.trim()||null,created_by:userData?.user?.id||null}
      const{error:insertError}=await supabase.from("hotel_finance_documents").insert(payload);if(insertError)throw insertError
      setOpen(false);setForm({reservation_id:"",name:"",email:"",phone:"",due_at:"",currency:"ARS",notes:"",status:"draft",lines:[blankLine()]});await load()
    }catch(err){setError(err?.message||"No se pudo crear el documento.")}
    finally{setSaving(false)}
  }

  async function changeStatus(doc,status){
    setError("")
    try{const patch={status,updated_at:new Date().toISOString()};if(status==="issued"&&!doc.issued_at)patch.issued_at=new Date().toISOString();if(status==="paid")patch.balance=0;const{error:updateError}=await supabase.from("hotel_finance_documents").update(patch).eq("id",doc.id).eq("property_id",propertyId);if(updateError)throw updateError;await load()}catch(err){setError(err?.message||"No se pudo actualizar el documento.")}
  }

  return <div className={s.financeBody}>
    <div className={s.docTop}><div className={s.docStats}><article><span>Cobrado</span><b>{money(totals.collected)}</b></article><article><span>Pendiente</span><b>{money(totals.pending)}</b></article><article><span>Vencido</span><b>{money(totals.overdue)}</b></article><article><span>Borradores</span><b>{totals.drafts}</b></article></div><button className={s.primary} onClick={()=>setOpen(true)}>+ Nuevo documento</button></div>
    {error&&<div className={s.alert}>{error}</div>}
    <article className={s.glass}><header><div><small>DOCUMENTOS</small><h2>Facturas y documentos financieros</h2></div></header>{loading?<div className={s.empty}>Cargando documentos…</div>:!documents.length?<div className={s.empty}>Todavía no hay documentos financieros registrados.</div>:<div className={s.documentList}>{documents.map(doc=><article key={doc.id}><div><b>{doc.number||"Sin numerar"}</b><small>{doc.billing_to?.name||"Cliente"} · {new Intl.DateTimeFormat("es-AR").format(new Date(doc.created_at))}</small></div><span>{doc.document_type}</span><strong>{money(doc.total,doc.currency)}</strong><span className={s.status}>{doc.status}</span><select value={doc.status} onChange={e=>changeStatus(doc,e.target.value)}><option value="draft">Borrador</option><option value="issued">Emitido</option><option value="partial">Parcial</option><option value="paid">Pagado</option><option value="void">Anulado</option></select></article>)}</div>}</article>
    {open&&<div className={s.modalBackdrop} onClick={()=>setOpen(false)}><div className={s.modal} onClick={e=>e.stopPropagation()}><button className={s.modalClose} onClick={()=>setOpen(false)}>×</button><small>NUEVO DOCUMENTO</small><h2>Crear factura / documento</h2><div className={s.formGrid}><label className={s.full}><span>Vincular reserva</span><select value={form.reservation_id} onChange={e=>selectReservation(e.target.value)}><option value="">Sin reserva vinculada</option>{reservations.map(r=><option key={r.id} value={r.id}>{r.numero_reserva||`#${r.id}`} · {r.nombre_huesped}</option>)}</select></label><label><span>Cliente</span><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></label><label><span>Email</span><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></label><label><span>Teléfono</span><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></label><label><span>Vencimiento</span><input type="date" value={form.due_at} onChange={e=>setForm(f=>({...f,due_at:e.target.value}))}/></label><label><span>Moneda</span><select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}><option>ARS</option><option>USD</option></select></label><label><span>Estado inicial</span><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}><option value="draft">Borrador</option><option value="issued">Emitido</option></select></label></div><div className={s.lines}><header><h3>Conceptos</h3><button onClick={()=>setForm(f=>({...f,lines:[...f.lines,blankLine()]}))}>+ Agregar línea</button></header>{form.lines.map((line,index)=><div className={s.line} key={index}><input placeholder="Descripción" value={line.description} onChange={e=>updateLine(index,"description",e.target.value)}/><input type="number" min="0" step="1" value={line.quantity} onChange={e=>updateLine(index,"quantity",e.target.value)}/><input type="number" min="0" step="0.01" value={line.unit_price} onChange={e=>updateLine(index,"unit_price",e.target.value)}/><label><span>IVA %</span><input type="number" min="0" max="100" step="0.01" value={line.tax_rate} onChange={e=>updateLine(index,"tax_rate",e.target.value)}/></label><button onClick={()=>setForm(f=>({...f,lines:f.lines.filter((_,i)=>i!==index)}))} disabled={form.lines.length===1}>×</button></div>)}</div><label className={s.notes}><span>Nota interna</span><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label><div className={s.totals}><span>Subtotal <b>{money(calc.subtotal,form.currency)}</b></span><span>Impuestos <b>{money(calc.tax,form.currency)}</b></span><strong>Total {money(calc.total,form.currency)}</strong></div><button className={s.primary} onClick={createDocument} disabled={saving}>{saving?"Guardando…":"Crear documento"}</button></div></div>}
  </div>
}
