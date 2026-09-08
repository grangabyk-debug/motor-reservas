"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import usePmsAutoRefresh from"../../core/usePmsAutoRefresh"
import{downloadXlsx,printSheet}from"./reportDocumentExport"
import s from"./receptionReports.module.css"

const dateKey=date=>date.toLocaleDateString("en-CA")
const nextDay=value=>{const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+1);return dateKey(date)}
const normalize=value=>String(value||"").trim().toLowerCase()
const cancelled=row=>["cancelada","cancelled","anulada","anulado"].includes(normalize(row?.estado))
const roomIds=row=>[...new Set([row?.habitacion_id,...(row?.habitaciones_ids||[])].filter(Boolean).map(Number))]

const ARRIVAL_COLUMNS=[
  {key:"guest",label:"Huésped",required:true},{key:"room",label:"Habitación",required:true},{key:"pax",label:"Pax",required:true},{key:"note",label:"Notas",required:true},
  {key:"reservation",label:"Reserva"},{key:"time",label:"Hora"},{key:"phone",label:"Teléfono",defaultVisible:false},{key:"status",label:"Estado",defaultVisible:false},{key:"regime",label:"Régimen",defaultVisible:false},{key:"arrival",label:"Llegada",defaultVisible:false},{key:"departure",label:"Salida",defaultVisible:false},
]
const DEPARTURE_COLUMNS=[
  {key:"guest",label:"Huésped",required:true},{key:"room",label:"Habitación",required:true},{key:"pax",label:"Pax",required:true},{key:"note",label:"Notas",required:true},
  {key:"reservation",label:"Reserva"},{key:"time",label:"Hora"},{key:"phone",label:"Teléfono",defaultVisible:false},{key:"status",label:"Estado",defaultVisible:false},{key:"regime",label:"Régimen",defaultVisible:false},{key:"arrival",label:"Llegada",defaultVisible:false},{key:"departure",label:"Salida",defaultVisible:false},
]
const BREAKFAST_COLUMNS=[
  {key:"guest",label:"Huésped",required:true},{key:"room",label:"Habitación",required:true},{key:"pax",label:"Pax",required:true},{key:"note",label:"Notas",required:true},
  {key:"situation",label:"Situación"},{key:"reservation",label:"Reserva",defaultVisible:false},{key:"regime",label:"Régimen"},{key:"departure",label:"Salida",defaultVisible:false},{key:"phone",label:"Teléfono",defaultVisible:false},{key:"status",label:"Estado",defaultVisible:false},
]
const HOUSEKEEPING_COLUMNS=[
  {key:"room",label:"Habitación",required:true},{key:"operation",label:"Operación",required:true},{key:"note",label:"Notas",required:true},
  {key:"type",label:"Tipo"},{key:"roomStatus",label:"Estado"},{key:"task",label:"Tarea"},{key:"taskStatus",label:"Estado tarea",defaultVisible:false},{key:"responsible",label:"Responsable",defaultVisible:false},
]
const RESERVATION_TOTALS=[{key:"pax",label:"Pasajeros",value:rows=>rows.reduce((sum,row)=>sum+(Number(row.pax)||0),0)},{key:"rooms",label:"Habitaciones",value:rows=>rows.reduce((sum,row)=>sum+(Number(row.roomCount)||0),0)},{key:"rows",label:"Reservas",value:rows=>rows.length}]
const HOUSEKEEPING_TOTALS=[{key:"rooms",label:"Habitaciones",value:rows=>rows.length},{key:"tasks",label:"Tareas",value:rows=>rows.filter(row=>row.task&&row.task!=="—").length}]

export default function ReceptionReportsWorkspace({propertyId,property}){
  const[day,setDay]=useState(()=>dateKey(new Date()))
  const[activeReport,setActiveReport]=useState("")
  const[rooms,setRooms]=useState([]),[reservations,setReservations]=useState([]),[tasks,setTasks]=useState([]),[profiles,setProfiles]=useState(new Map())
  const[sheetPrefs,setSheetPrefs]=useState({}),[sheetRows,setSheetRows]=useState({})
  const[loading,setLoading]=useState(true),[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const tomorrow=nextDay(day)
      const[roomRes,reservationRes,taskRes,prefRes,rowStateRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,estado,sort_order").eq("property_id",propertyId).eq("activa",true).order("sort_order").order("nombre"),
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,telefono_huesped,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,no_show,cantidad_huespedes,regimen,hora_llegada_estimada,hora_salida_estimada,notas").eq("property_id",propertyId).lte("fecha_entrada",day).gte("fecha_salida",day).order("fecha_entrada"),
        supabase.from("hotel_housekeeping_tasks").select("id,room_id,task_type,status,assigned_to,scheduled_for,notes,updated_at").eq("property_id",propertyId).gte("scheduled_for",`${day}T00:00:00`).lt("scheduled_for",`${tomorrow}T00:00:00`).order("updated_at",{ascending:false}),
        supabase.from("hotel_report_sheet_preferences").select("report_key,settings").eq("property_id",propertyId),
        supabase.from("hotel_report_sheet_rows").select("report_key,row_key,note,hidden").eq("property_id",propertyId).eq("report_date",day),
      ])
      for(const result of[roomRes,reservationRes,taskRes,prefRes,rowStateRes])if(result.error)throw result.error
      const taskRows=taskRes.data||[],profileIds=[...new Set(taskRows.map(row=>row.assigned_to).filter(Boolean))]
      const profileRes=profileIds.length?await supabase.from("profiles").select("id,full_name").in("id",profileIds):{data:[],error:null}
      if(profileRes.error)throw profileRes.error
      setRooms(roomRes.data||[]);setReservations(reservationRes.data||[]);setTasks(taskRows);setProfiles(new Map((profileRes.data||[]).map(row=>[row.id,row.full_name])))
      setSheetPrefs(Object.fromEntries((prefRes.data||[]).map(row=>[row.report_key,row.settings||{}])))
      setSheetRows(Object.fromEntries((rowStateRes.data||[]).map(row=>[`${row.report_key}:${row.row_key}`,row])))
    }catch(err){setError(err?.message||"No se pudieron cargar los informes de recepción.")}
    finally{setLoading(false)}
  },[propertyId,day])
  useEffect(()=>{load()},[load])
  useEffect(()=>{setActiveReport("")},[propertyId])
  usePmsAutoRefresh(propertyId,load,["reservas","habitaciones","hotel_housekeeping_tasks"])

  const savePreference=useCallback((reportKey,settings)=>{
    setSheetPrefs(current=>({...current,[reportKey]:settings}))
    supabase.from("hotel_report_sheet_preferences").upsert({property_id:propertyId,report_key:reportKey,settings,updated_at:new Date().toISOString()},{onConflict:"property_id,report_key"}).then(({error:saveError})=>saveError&&setError(saveError.message))
  },[propertyId])
  const saveRowState=useCallback((reportKey,rowKey,patch)=>{
    const key=`${reportKey}:${rowKey}`,current=sheetRows[key]||{},next={...current,...patch}
    setSheetRows(state=>({...state,[key]:next}))
    supabase.from("hotel_report_sheet_rows").upsert({property_id:propertyId,report_key:reportKey,report_date:day,row_key:rowKey,note:String(next.note||""),hidden:Boolean(next.hidden),updated_at:new Date().toISOString()},{onConflict:"property_id,report_key,report_date,row_key"}).then(({error:saveError})=>saveError&&setError(saveError.message))
  },[propertyId,day,sheetRows])

  const roomMap=useMemo(()=>new Map(rooms.map(room=>[Number(room.id),room])),[rooms])
  const activeReservations=useMemo(()=>reservations.filter(row=>!cancelled(row)&&!row.no_show),[reservations])
  const roomLabel=useCallback(row=>roomIds(row).map(id=>roomMap.get(id)?.nombre).filter(Boolean).join(", ")||"Sin asignar",[roomMap])
  const arrivals=useMemo(()=>activeReservations.filter(row=>row.fecha_entrada===day),[activeReservations,day])
  const departures=useMemo(()=>activeReservations.filter(row=>row.fecha_salida===day),[activeReservations,day])
  const continuingInHouse=useMemo(()=>activeReservations.filter(row=>normalize(row.estado)==="alojado"&&row.fecha_entrada<day&&row.fecha_salida>day),[activeReservations,day])
  const breakfasts=useMemo(()=>{const map=new Map();for(const row of departures)if(row.fecha_entrada<day)map.set(row.id,row);for(const row of continuingInHouse)map.set(row.id,row);return[...map.values()]},[departures,continuingInHouse])
  const reservationsByRoom=useMemo(()=>{const map=new Map();for(const reservation of activeReservations){for(const id of roomIds(reservation)){if(!map.has(id))map.set(id,[]);map.get(id).push(reservation)}}return map},[activeReservations])
  const taskByRoom=useMemo(()=>{const map=new Map();for(const task of tasks){const id=Number(task.room_id);if(id&&!map.has(id))map.set(id,task)}return map},[tasks])
  const housekeeping=useMemo(()=>rooms.map(room=>{const stays=reservationsByRoom.get(Number(room.id))||[],task=taskByRoom.get(Number(room.id)),arrival=stays.some(row=>row.fecha_entrada===day),departure=stays.some(row=>row.fecha_salida===day),inHouse=stays.some(row=>row.fecha_entrada<day&&row.fecha_salida>day),operation=arrival&&departure?"Salida + llegada":departure?"Salida":arrival?"Llegada":inHouse?"Permanencia":"Libre";return{...room,operation,task,responsible:task?.assigned_to?profiles.get(task.assigned_to)||"Asignado":"—"}}),[rooms,reservationsByRoom,taskByRoom,profiles,day])

  const reservationRow=useCallback(row=>({id:`res-${row.id}`,reservation:row.numero_reserva||row.id,guest:row.nombre_huesped||"—",room:roomLabel(row),roomCount:Math.max(roomIds(row).length,1),pax:Number(row.cantidad_huespedes)||1,phone:row.telefono_huesped||"—",status:row.estado||"—",regime:row.regimen||"—",arrival:row.fecha_entrada,departure:row.fecha_salida,note:row.notas||""}),[roomLabel])
  const arrivalRows=useMemo(()=>arrivals.map(row=>({...reservationRow(row),time:row.hora_llegada_estimada||"—"})),[arrivals,reservationRow])
  const departureRows=useMemo(()=>departures.map(row=>({...reservationRow(row),time:row.hora_salida_estimada||"—"})),[departures,reservationRow])
  const breakfastRows=useMemo(()=>breakfasts.map(row=>({...reservationRow(row),situation:row.fecha_salida===day?"Sale hoy":"Continúa"})),[breakfasts,reservationRow,day])
  const housekeepingRows=useMemo(()=>housekeeping.map(row=>({id:`room-${row.id}`,room:row.nombre,type:row.tipo||"—",roomStatus:row.estado||"—",operation:row.operation,task:row.task?.task_type?.replaceAll("_"," ")||"—",taskStatus:row.task?.status||"—",responsible:row.responsible,note:row.task?.notes||""})),[housekeeping])
  const breakfastPax=breakfastRows.reduce((sum,row)=>sum+Number(row.pax||0),0),breakfastDepartures=breakfastRows.filter(row=>row.situation==="Sale hoy").length
  const definitions=[
    {key:"arrivals",title:"Llegadas / check-in",subtitle:"Quién llega, a qué habitación y a qué hora.",columns:ARRIVAL_COLUMNS,rows:arrivalRows,totals:RESERVATION_TOTALS,defaultTotals:["pax","rooms"],summary:`${arrivalRows.length} reservas · ${arrivalRows.reduce((sum,row)=>sum+row.pax,0)} pasajeros`,fileName:`informe-llegadas-${day}`},
    {key:"departures",title:"Salidas / check-out",subtitle:"Salidas previstas y horario estimado.",columns:DEPARTURE_COLUMNS,rows:departureRows,totals:RESERVATION_TOTALS,defaultTotals:["pax","rooms"],summary:`${departureRows.length} reservas · ${departureRows.reduce((sum,row)=>sum+row.pax,0)} pasajeros`,fileName:`informe-salidas-${day}`},
    {key:"breakfasts",title:"Desayunos",subtitle:"Check-out del día y huéspedes in-house que continúan su estadía.",columns:BREAKFAST_COLUMNS,rows:breakfastRows,totals:RESERVATION_TOTALS,defaultTotals:["pax","rooms"],summary:`${breakfastPax} desayunos · ${breakfastDepartures} salen hoy`,fileName:`informe-desayunos-${day}`},
    {key:"housekeeping",title:"Housekeeping",subtitle:"Estado de habitaciones, rotación y tareas del día.",columns:HOUSEKEEPING_COLUMNS,rows:housekeepingRows,totals:HOUSEKEEPING_TOTALS,defaultTotals:["rooms","tasks"],summary:`${housekeepingRows.length} habitaciones · ${tasks.length} tareas`,fileName:`informe-housekeeping-${day}`},
  ]
  const selected=definitions.find(item=>item.key===activeReport)

  return <section className={s.page}>
    <header className={s.header}><div><small>RECEPCIÓN · INFORMES</small><h1>{selected?selected.title:"Informes de recepción"}</h1><p>{selected?selected.subtitle:`${property?.name||"Propiedad activa"} · elegí un informe para abrirlo, editarlo y prepararlo para imprimir o Excel.`}</p></div><div className={s.actions}>{selected?<button type="button" onClick={()=>setActiveReport("")}>← Volver a informes</button>:null}<input type="date" value={day} onChange={event=>setDay(event.target.value)}/><button type="button" onClick={load}>↻ Actualizar</button></div></header>
    {error?<div className={s.notice}>{error}</div>:null}{loading?<div className={s.notice}>Actualizando informes…</div>:null}
    {!selected?<><div className={s.metrics}><Metric label="Llegadas" value={arrivals.length} note="Check-in previstos"/><Metric label="Salidas" value={departures.length} note="Check-out previstos"/><Metric label="Desayunos" value={breakfastPax} note={`${breakfastRows.length} reservas`}/><Metric label="Housekeeping" value={housekeeping.length} note={`${tasks.length} tareas programadas`}/></div><div className={s.reportList}>{definitions.map(item=><button type="button" className={s.reportCard} key={item.key} onClick={()=>setActiveReport(item.key)}><div><small>INFORME OPERATIVO</small><h2>{item.title}</h2><p>{item.subtitle}</p></div><div className={s.reportCardMeta}><span>{item.summary}</span><b>Abrir informe →</b></div></button>)}</div></>:<div className={s.detailWorkspace}><Sheet reportKey={selected.key} title={selected.title} subtitle={selected.subtitle} day={day} propertyName={property?.name||"Propiedad activa"} fileName={selected.fileName} columns={selected.columns} rows={selected.rows} totalOptions={selected.totals} defaultTotals={selected.defaultTotals} preference={sheetPrefs[selected.key]} rowState={sheetRows} onPreferenceChange={savePreference} onRowStateChange={saveRowState}/></div>}
  </section>
}

function Metric({label,value,note}){return <article className={s.metric}><span>{label}</span><b>{value}</b><small>{note}</small></article>}

function Sheet({reportKey,title,subtitle,day,propertyName,fileName,columns,rows,totalOptions,defaultTotals,preference,rowState,onPreferenceChange,onRowStateChange}){
  const[columnsOpen,setColumnsOpen]=useState(false),[filterOpen,setFilterOpen]=useState(false),[totalsOpen,setTotalsOpen]=useState(false),[query,setQuery]=useState(""),[noteDrafts,setNoteDrafts]=useState({})
  const hasSavedPreference=Array.isArray(preference?.order)||Array.isArray(preference?.hidden),allKeys=columns.map(column=>column.key),savedOrder=Array.isArray(preference?.order)?preference.order.filter(key=>allKeys.includes(key)):[],order=[...savedOrder,...allKeys.filter(key=>!savedOrder.includes(key))]
  const defaultHidden=columns.filter(column=>!column.required&&column.defaultVisible===false).map(column=>column.key),hidden=new Set(hasSavedPreference?(preference?.hidden||[]):defaultHidden),ordered=order.map(key=>columns.find(column=>column.key===key)).filter(Boolean),visibleColumns=ordered.filter(column=>column.required||!hidden.has(column.key))
  const totalsEnabled=preference?.totals?.enabled!==false,totalKeys=Array.isArray(preference?.totals?.keys)?preference.totals.keys:defaultTotals
  useEffect(()=>{const next={};for(const row of rows){const saved=rowState[`${reportKey}:${row.id}`];next[row.id]=saved?.note??row.note??""}setNoteDrafts(next)},[rows,rowState,reportKey])
  const hiddenRows=rows.filter(row=>Boolean(rowState[`${reportKey}:${row.id}`]?.hidden)),shownRows=rows.filter(row=>!rowState[`${reportKey}:${row.id}`]?.hidden),normalizedQuery=normalize(query),filteredRows=normalizedQuery?shownRows.filter(row=>visibleColumns.some(column=>normalize(column.key==="note"?(noteDrafts[row.id]??row.note):row[column.key]).includes(normalizedQuery))):shownRows
  const displayRows=filteredRows.map(row=>({...row,note:noteDrafts[row.id]??row.note??""})),gridTemplate=`repeat(${visibleColumns.length},minmax(128px,1fr)) 38px`,minWidth=Math.max(760,visibleColumns.length*138+38),totalParts=totalsEnabled?totalOptions.filter(option=>totalKeys.includes(option.key)).map(option=>`${option.label}: ${option.value(displayRows)}`):[],totalText=totalParts.join(" · ")
  const saveSettings=patch=>onPreferenceChange(reportKey,{...(preference||{}),...patch}),persistLayout=(nextOrder,nextHidden)=>saveSettings({order:nextOrder,hidden:nextHidden})
  function toggleColumn(key){const column=columns.find(item=>item.key===key);if(column?.required)return;const next=new Set(hidden);next.has(key)?next.delete(key):next.add(key);persistLayout(order,[...next])}
  function moveColumn(key,direction){const index=order.indexOf(key),target=index+direction;if(index<0||target<0||target>=order.length)return;const next=[...order],[item]=next.splice(index,1);next.splice(target,0,item);persistLayout(next,[...hidden])}
  function toggleTotal(key){const next=new Set(totalKeys);next.has(key)?next.delete(key):next.add(key);saveSettings({totals:{enabled:totalsEnabled,keys:[...next]}})}
  function setTotalsEnabled(enabled){saveSettings({totals:{enabled,keys:totalKeys}})}
  function saveNote(row){const note=noteDrafts[row.id]??"";onRowStateChange(reportKey,row.id,{note,hidden:Boolean(rowState[`${reportKey}:${row.id}`]?.hidden)})}
  function exportExcel(){downloadXlsx({fileName,title,subtitle,day,propertyName,columns:visibleColumns,rows:displayRows,totalText})}
  function printCurrent(){printSheet({title,subtitle,day,propertyName,columns:visibleColumns,rows:displayRows,totalText})}
  return <article className={s.report}>
    <header><div><small>INFORME EDITABLE</small><h2>{title}</h2><p>{subtitle}</p></div><span className={s.count}>{filteredRows.length}</span></header>
    <div className={s.sheetToolbar}>
      <button type="button" onClick={()=>setFilterOpen(value=>!value)} className={filterOpen?s.activeTool:undefined}>⌕ Filtrar</button>
      <div className={s.columnWrap}><button type="button" onClick={()=>setColumnsOpen(value=>!value)} className={columnsOpen?s.activeTool:undefined}>▦ Columnas</button>{columnsOpen?<div className={s.columnPanel}><strong>Columnas del informe</strong>{ordered.map((column,index)=><div className={s.columnOption} key={column.key}><label><input type="checkbox" checked={column.required||!hidden.has(column.key)} disabled={column.required} onChange={()=>toggleColumn(column.key)}/><span>{column.label}</span>{column.required?<small>Fija</small>:null}</label><div><button type="button" disabled={!index} onClick={()=>moveColumn(column.key,-1)}>←</button><button type="button" disabled={index===ordered.length-1} onClick={()=>moveColumn(column.key,1)}>→</button></div></div>)}</div>:null}</div>
      <div className={s.totalWrap}><button type="button" onClick={()=>setTotalsOpen(value=>!value)} className={totalsOpen?s.activeTool:undefined}>Σ Totales</button>{totalsOpen?<div className={s.totalPanel}><label className={s.totalMaster}><input type="checkbox" checked={totalsEnabled} onChange={event=>setTotalsEnabled(event.target.checked)}/><span>Mostrar totales abajo</span></label>{totalOptions.map(option=><label key={option.key}><input type="checkbox" checked={totalKeys.includes(option.key)} disabled={!totalsEnabled} onChange={()=>toggleTotal(option.key)}/><span>{option.label}</span></label>)}</div>:null}</div>
      {hiddenRows.length?<button type="button" onClick={()=>hiddenRows.forEach(row=>onRowStateChange(reportKey,row.id,{hidden:false,note:noteDrafts[row.id]??row.note??""}))}>↶ Restaurar {hiddenRows.length}</button>:null}
      <span className={s.toolbarSpacer}/><button type="button" onClick={exportExcel}>↓ Excel</button><button type="button" className={s.printButton} onClick={printCurrent}>⎙ Imprimir / PDF</button>
    </div>
    {filterOpen?<div className={s.filterBar}><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar en este informe…"/><span>{filteredRows.length} de {shownRows.length} filas</span>{query?<button type="button" onClick={()=>setQuery("")}>Limpiar</button>:null}</div>:null}
    <div className={s.tableShell}><div className={s.table} style={{"--sheet-grid":gridTemplate,"--sheet-min":`${minWidth}px`}}><div className={s.head}>{visibleColumns.map(column=><span key={column.key}>{column.label}</span>)}<span className={s.rowActionHead}/></div>{filteredRows.length?filteredRows.map(row=><div className={s.row} key={row.id}>{visibleColumns.map(column=>column.key==="note"?<input key={column.key} className={s.noteInput} value={noteDrafts[row.id]??""} onChange={event=>setNoteDrafts(current=>({...current,[row.id]:event.target.value}))} onBlur={()=>saveNote(row)} placeholder="Escribir nota…"/>:<span key={column.key} title={String(row[column.key]??"")}>{row[column.key]??"—"}</span>)}<button type="button" className={s.removeRow} title="Quitar de este informe" onClick={()=>onRowStateChange(reportKey,row.id,{hidden:true,note:noteDrafts[row.id]??row.note??""})}>×</button></div>):<div className={s.empty}>No hay datos para esta fecha con los filtros actuales.</div>}</div></div>
    {totalsEnabled&&totalParts.length?<div className={s.totalBar}><strong>TOTAL</strong>{totalParts.map(part=><span key={part}>{part}</span>)}</div>:null}
    <footer><span>{filteredRows.length} fila{filteredRows.length===1?"":"s"} · {visibleColumns.length} columnas visibles</span><span>Las notas, columnas, filas ocultas y totales quedan guardados.</span></footer>
  </article>
}
