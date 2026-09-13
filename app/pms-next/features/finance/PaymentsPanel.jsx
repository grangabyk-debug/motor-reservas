"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./finance.module.css"

const PAGE=50
function money(value,currency="ARS"){return new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:2}).format(Number(value||0))}
function csvCell(value){const text=String(value??"").replaceAll('"','""');return `"${text}"`}

export default function PaymentsPanel({propertyId}){
  const[rows,setRows]=useState([])
  const[reservations,setReservations]=useState(new Map())
  const[profiles,setProfiles]=useState(new Map())
  const[page,setPage]=useState(0)
  const[count,setCount]=useState(0)
  const[method,setMethod]=useState("all")
  const[from,setFrom]=useState("")
  const[to,setTo]=useState("")
  const[query,setQuery]=useState("")
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      let request=supabase.from("pagos").select("id,reserva_id,monto,metodo,created_at,moneda,estado,source,provider,referencia,external_ref,refunded_amount,created_by",{count:"exact"}).eq("property_id",propertyId).order("created_at",{ascending:false}).range(page*PAGE,page*PAGE+PAGE-1)
      if(method!=="all")request=request.eq("metodo",method)
      if(from)request=request.gte("created_at",`${from}T00:00:00`)
      if(to)request=request.lte("created_at",`${to}T23:59:59`)
      const result=await request;if(result.error)throw result.error
      const data=result.data||[];setRows(data);setCount(result.count||0)
      const reservationIds=[...new Set(data.map(row=>row.reserva_id).filter(Boolean))]
      const profileIds=[...new Set(data.map(row=>row.created_by).filter(Boolean))]
      const[resResult,profileResult]=await Promise.all([
        reservationIds.length?supabase.from("reservas").select("id,nombre_huesped,numero_reserva,habitacion_id").eq("property_id",propertyId).in("id",reservationIds):Promise.resolve({data:[],error:null}),
        profileIds.length?supabase.from("profiles").select("id,full_name").in("id",profileIds):Promise.resolve({data:[],error:null}),
      ])
      if(resResult.error)throw resResult.error;if(profileResult.error)throw profileResult.error
      setReservations(new Map((resResult.data||[]).map(row=>[row.id,row])));setProfiles(new Map((profileResult.data||[]).map(row=>[row.id,row])))
    }catch(err){setError(err?.message||"No se pudieron cargar los pagos.")}
    finally{setLoading(false)}
  },[propertyId,page,method,from,to])
  useEffect(()=>{load()},[load])

  const visible=useMemo(()=>rows.filter(row=>{if(!query)return true;const reservation=reservations.get(row.reserva_id);return `${reservation?.nombre_huesped||""} ${reservation?.numero_reserva||""} ${row.referencia||""} ${row.external_ref||""} ${row.metodo||""}`.toLowerCase().includes(query.toLowerCase())}),[rows,reservations,query])
  const methods=useMemo(()=>[...new Set(rows.map(row=>row.metodo).filter(Boolean))].sort(),[rows])

  function exportCsv(){
    const header=["Fecha","Reserva","Huésped","Registrado por","Monto","Moneda","Método","Estado","Referencia"]
    const lines=visible.map(row=>{const reservation=reservations.get(row.reserva_id);return[row.created_at,reservation?.numero_reserva||row.reserva_id,reservation?.nombre_huesped||"",profiles.get(row.created_by)?.full_name||"",row.monto,row.moneda,row.metodo,row.estado,row.referencia||row.external_ref||""]})
    const csv=[header,...lines].map(line=>line.map(csvCell).join(",")).join("\n");const blob=new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`pagos-${from||"inicio"}-${to||"hoy"}.csv`;a.click();URL.revokeObjectURL(url)
  }

  return <div className={s.financeBody}>
    <div className={s.toolbar}><label className={s.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar huésped, reserva o referencia"/></label><select value={method} onChange={e=>{setMethod(e.target.value);setPage(0)}}><option value="all">Todos los métodos</option>{methods.map(item=><option value={item} key={item}>{item}</option>)}</select><input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(0)}}/><input type="date" value={to} onChange={e=>{setTo(e.target.value);setPage(0)}}/><button onClick={exportCsv} disabled={!visible.length}>Exportar CSV</button></div>
    {error&&<div className={s.alert}>{error}</div>}
    <article className={s.glass}><header><div><small>REGISTRO</small><h2>Pagos</h2><p>{count} resultado{count===1?"":"s"}</p></div></header>{loading?<div className={s.empty}>Cargando pagos…</div>:!visible.length?<div className={s.empty}>No hay pagos para los filtros seleccionados.</div>:<div className={s.paymentTable}><div className={s.paymentHead}><span>Fecha</span><span>Reserva / huésped</span><span>Registrado por</span><span>Monto</span><span>Método</span><span>Estado</span></div>{visible.map(row=>{const reservation=reservations.get(row.reserva_id);return <div className={s.paymentRow} key={row.id}><span>{new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"short"}).format(new Date(row.created_at))}</span><div><b>{reservation?.nombre_huesped||`Reserva #${row.reserva_id}`}</b><small>{reservation?.numero_reserva||row.referencia||"Sin referencia"}</small></div><span>{profiles.get(row.created_by)?.full_name||"—"}</span><b>{money(Number(row.monto)-Number(row.refunded_amount||0),row.moneda||"ARS")}</b><span>{row.metodo}</span><span className={s.status}>{row.estado}</span></div>})}</div>}
      <footer className={s.pagination}><button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>← Anterior</button><span>Página {page+1} de {Math.max(1,Math.ceil(count/PAGE))}</span><button onClick={()=>setPage(p=>p+1)} disabled={(page+1)*PAGE>=count}>Siguiente →</button></footer>
    </article>
  </div>
}
