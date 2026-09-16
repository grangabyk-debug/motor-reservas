"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import RecurringExpensesPanel from"./RecurringExpensesPanel"
import s from"./finance.module.css"

function monthValue(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function money(value,currency="ARS"){try{return new Intl.NumberFormat("es-AR",{style:"currency",currency:String(currency||"ARS").toUpperCase(),maximumFractionDigits:2}).format(Number(value||0))}catch{return`${currency||"ARS"} ${Number(value||0).toFixed(2)}`}}
function monthBounds(value){const[y,m]=value.split("-").map(Number);const from=`${y}-${String(m).padStart(2,"0")}-01`;const last=new Date(y,m,0).getDate();const to=`${y}-${String(m).padStart(2,"0")}-${String(last).padStart(2,"0")}`;return{from,to}}
function groupedMoney(map,key="total"){const entries=[...map.entries()].filter(([,value])=>Math.abs(Number(value?.[key]??value)||0)>.009);return entries.length?entries.map(([currency,value])=>money(value?.[key]??value,currency)).join(" · "):money(0,"ARS")}

export default function ExpensesPanel({propertyId}){
  const[mode,setMode]=useState("expenses")
  const[month,setMonth]=useState(monthValue())
  const[rows,setRows]=useState([])
  const[baseCurrency,setBaseCurrency]=useState("ARS")
  const[open,setOpen]=useState(false)
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)
  const[error,setError]=useState("")
  const[form,setForm]=useState({occurred_on:new Date().toISOString().slice(0,10),supplier_name:"",supplier_tax_id:"",concept:"",category:"Operación",amount:"",tax_amount:"0",currency:"ARS",payment_method:"cash",document_number:"",reference:"",notes:""})

  const load=useCallback(async()=>{
    if(!propertyId||mode!=="expenses")return
    const{from,to}=monthBounds(month);setLoading(true);setError("")
    try{
      const[expenseRes,settingsRes]=await Promise.all([
        supabase.from("hotel_accounting_expenses").select("id,occurred_on,supplier_name,supplier_tax_id,concept,category,amount,tax_amount,currency,payment_method,document_number,reference,status,notes,created_at").eq("property_id",propertyId).gte("occurred_on",from).lte("occurred_on",to).order("occurred_on",{ascending:false}).order("created_at",{ascending:false}),
        supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
      ])
      if(expenseRes.error)throw expenseRes.error;if(settingsRes.error)throw settingsRes.error
      const configured=String(settingsRes.data?.settings?.preferences?.currency||"ARS").toUpperCase();setRows(expenseRes.data||[]);setBaseCurrency(configured);setForm(current=>({...current,currency:current.amount?current.currency:configured}))
    }catch(err){setError(err?.message||"No se pudieron cargar los gastos.")}
    finally{setLoading(false)}
  },[propertyId,month,mode])
  useEffect(()=>{load()},[load])

  const posted=useMemo(()=>rows.filter(row=>row.status==="posted"),[rows])
  const totals=useMemo(()=>{const map=new Map();for(const row of posted){const code=String(row.currency||baseCurrency).toUpperCase(),current=map.get(code)||{total:0,tax:0};current.total+=Number(row.amount||0);current.tax+=Number(row.tax_amount||0);map.set(code,current)}return map},[posted,baseCurrency])
  const categoryGroups=useMemo(()=>{const currencies=new Map();for(const row of posted){const code=String(row.currency||baseCurrency).toUpperCase();if(!currencies.has(code))currencies.set(code,new Map());const map=currencies.get(code);map.set(row.category,(map.get(row.category)||0)+Number(row.amount||0))}return[...currencies.entries()].map(([code,map])=>({currency:code,total:[...map.values()].reduce((sum,value)=>sum+value,0),rows:[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5)}))},[posted,baseCurrency])

  async function createExpense(){
    setSaving(true);setError("")
    try{
      if(!form.concept.trim()||Number(form.amount)<=0)throw new Error("Ingresá concepto e importe del gasto.")
      if(Number(form.tax_amount)<0||Number(form.tax_amount)>Number(form.amount))throw new Error("El impuesto no puede superar el importe total.")
      const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError
      const payload={property_id:propertyId,occurred_on:form.occurred_on,supplier_name:form.supplier_name.trim()||null,supplier_tax_id:form.supplier_tax_id.trim()||null,concept:form.concept.trim(),category:form.category.trim()||"Operación",account_id:null,amount:Number(form.amount),tax_amount:Number(form.tax_amount||0),currency:String(form.currency||baseCurrency).toUpperCase(),payment_method:form.payment_method,document_number:form.document_number.trim()||null,reference:form.reference.trim()||null,status:"posted",notes:form.notes.trim()||null,created_by:userData?.user?.id||null}
      const{error:insertError}=await supabase.from("hotel_accounting_expenses").insert(payload);if(insertError)throw insertError
      setOpen(false);setForm(current=>({...current,concept:"",supplier_name:"",supplier_tax_id:"",amount:"",tax_amount:"0",document_number:"",reference:"",notes:""}));await load()
    }catch(err){setError(err?.message||"No se pudo registrar el gasto.")}
    finally{setSaving(false)}
  }

  async function voidExpense(id){setError("");try{const{error:updateError}=await supabase.from("hotel_accounting_expenses").update({status:"void",updated_at:new Date().toISOString()}).eq("id",id).eq("property_id",propertyId);if(updateError)throw updateError;await load()}catch(err){setError(err?.message||"No se pudo anular el gasto.")}}

  return <div className={s.financeBody}>
    <div className={s.tabs} style={{alignSelf:"flex-start"}}><button className={mode==="expenses"?s.active:""} onClick={()=>setMode("expenses")}>Gastos contabilizados</button><button className={mode==="recurring"?s.active:""} onClick={()=>setMode("recurring")}>Gastos recurrentes</button></div>
    {mode==="recurring"?<RecurringExpensesPanel propertyId={propertyId}/>:<>
      <div className={s.expenseTop}><label><span>Mes</span><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><button className={s.primary} onClick={()=>setOpen(true)}>+ Registrar gasto</button></div>
      {error&&<div className={s.alert}>{error}</div>}
      <div className={s.expenseStats}><article><span>Gastos contabilizados</span><b style={{fontSize:totals.size>1?20:28}}>{groupedMoney(totals,"total")}</b></article><article><span>Impuestos incluidos</span><b style={{fontSize:totals.size>1?20:28}}>{groupedMoney(totals,"tax")}</b></article><article><span>Movimientos</span><b>{posted.length}</b></article></div>
      <div className={s.cashColumns}><article className={s.glass}><header><div><small>CATEGORÍAS</small><h2>Distribución del mes</h2><p>Cada moneda se calcula por separado.</p></div></header>{!categoryGroups.length?<div className={s.empty}>Sin gastos registrados en este período.</div>:<div style={{display:"grid",gap:16}}>{categoryGroups.map(group=><div key={group.currency}><small style={{display:"block",marginBottom:8,color:"var(--accent)",fontWeight:850}}>{group.currency} · {money(group.total,group.currency)}</small><div className={s.categoryList}>{group.rows.map(([category,total])=><div key={`${group.currency}-${category}`}><span>{category}</span><b>{money(total,group.currency)}</b><i style={{width:`${Math.max(6,Math.round(total/Math.max(group.total,.01)*100))}%`}}/></div>)}</div></div>)}</div>}</article><article className={s.glass}><header><div><small>AUTOMATIZACIÓN</small><h2>Obligaciones recurrentes</h2></div></header><div className={s.snapshot}><div><span>Seguimiento periódico</span><b>Activo</b></div><button className={s.primary} onClick={()=>setMode("recurring")}>Abrir recurrentes</button></div></article></div>
      <article className={s.glass}><header><div><small>REGISTRO</small><h2>Gastos del período</h2></div></header>{loading?<div className={s.empty}>Cargando gastos…</div>:!rows.length?<div className={s.empty}>No hay gastos en el mes seleccionado.</div>:<div className={s.expenseList}>{rows.map(row=><div key={row.id} className={row.status==="void"?s.voidRow:""}><div><b>{row.concept}</b><small>{row.occurred_on} · {row.supplier_name||"Sin proveedor"}</small></div><span>{row.category}</span><span>{row.payment_method}</span><strong>{money(row.amount,row.currency)}</strong><span className={s.status}>{row.status}</span>{row.status!=="void"?<button onClick={()=>voidExpense(row.id)}>Anular</button>:<span>—</span>}</div>)}</div>}</article>
      {open&&<div className={s.modalBackdrop} onClick={()=>setOpen(false)}><div className={s.modal} onClick={e=>e.stopPropagation()}><button className={s.modalClose} onClick={()=>setOpen(false)}>×</button><small>NUEVO EGRESO</small><h2>Registrar gasto</h2><div className={s.formGrid}><label><span>Fecha</span><input type="date" value={form.occurred_on} onChange={e=>setForm(f=>({...f,occurred_on:e.target.value}))}/></label><label><span>Categoría</span><input value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}/></label><label className={s.full}><span>Concepto</span><input value={form.concept} onChange={e=>setForm(f=>({...f,concept:e.target.value}))}/></label><label><span>Proveedor</span><input value={form.supplier_name} onChange={e=>setForm(f=>({...f,supplier_name:e.target.value}))}/></label><label><span>CUIT / identificación</span><input value={form.supplier_tax_id} onChange={e=>setForm(f=>({...f,supplier_tax_id:e.target.value}))}/></label><label><span>Importe total</span><input type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/></label><label><span>Impuestos incluidos</span><input type="number" min="0" step="0.01" value={form.tax_amount} onChange={e=>setForm(f=>({...f,tax_amount:e.target.value}))}/></label><label><span>Moneda</span><select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}><option>ARS</option><option>USD</option><option>EUR</option><option>GBP</option></select></label><label><span>Medio de pago</span><select value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="card">Tarjeta</option><option value="other">Otro</option></select></label><label><span>Comprobante</span><input value={form.document_number} onChange={e=>setForm(f=>({...f,document_number:e.target.value}))}/></label><label><span>Referencia</span><input value={form.reference} onChange={e=>setForm(f=>({...f,reference:e.target.value}))}/></label></div><label className={s.notes}><span>Notas</span><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label><button className={s.primary} onClick={createExpense} disabled={saving}>{saving?"Guardando…":"Registrar gasto"}</button></div></div>}
    </>}
  </div>
}
