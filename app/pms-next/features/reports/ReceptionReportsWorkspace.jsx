"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import usePmsAutoRefresh from"../../core/usePmsAutoRefresh"
import{activeReservationRoomIds}from"../reservations/reservationEditUtils"
import{breakfastOccupancy}from"./receptionReportBreakfast"
import{buildHousekeepingRows,reportDateLabel}from"./receptionReportHousekeeping"
import{downloadXlsx,printSheet}from"./reportDocumentExport"
import useReportColumnDrag from"./useReportColumnDrag"
import useReportViewport from"./useReportViewport"
import s from"./receptionReports.module.css"

const dateKey=date=>date.toLocaleDateString("en-CA")
const nextDay=value=>{const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+1);return dateKey(date)}
const normalize=value=>String(value||"").trim().toLowerCase()
const cancelled=row=>["cancelada","cancelled","anulada","anulado","fusionada","fusionado","merged"].includes(normalize(row?.estado))
const roomIds=row=>activeReservationRoomIds(row).map(Number)

const ARRIVAL_COLUMNS=[
  {key:"guest",label:"Huésped",required:true},{key:"room",label:"Habitación",required:true},{key:"pax",label:"Pax",required:true},{key:"note",label:"Notas",required:true},
  {key:"reservation",label:"Reserva"},{key:"time",label:"Hora"},{key:"phone",label:"Teléfono",defaultVisible:false},{key:"status",label:"Estado",defaultVisible:false},{key:"regime",label:"Régimen",defaultVisible:false},{key:"arrival",label:"Llegada",defaultVisible:false},{key:"departure",label:"Salida",defaultVisible:false},
]
const DEPARTURE_COLUMNS=[
  {key:"guest",label:"Huésped",required:true},{key:"room",label:"Habitación",required:true},{key:"pax",label:"Pax",required:true},{key:"note",label:"Notas",required:true},
  {key:"reservation",label:"Reserva"},{key:"time",label:"Hora"},{key:"phone",label:"Teléfono",defaultVisible:false},{key:"status",label:"Estado",defaultVisible:false},{key:"regime",label:"Régimen",defaultVisible:false},{key:"arrival",label:"Llegada",defaultVisible:false},{key:"departure",label:"Salida",defaultVisible:false},
]
const BREAKFAST_COLUMNS=[
  {key:"guest",label:"Huésped",required:true},{key:"room",label:"Habitación",required:true},{key:"pax",label:"Pax",required:true},{key:"composition",label:"Composición"},{key:"note",label:"Notas",required:true},
  {key:"situation",label:"Situación"},{key:"reservation",label:"Reserva",defaultVisible:false},{key:"regime",label:"Régimen"},{key:"departure",label:"Salida",defaultVisible:false},{key:"phone",label:"Teléfono",defaultVisible:false},{key:"status",label:"Estado",defaultVisible:false},
]
const HOUSEKEEPING_COLUMNS=[
  {key:"room",label:"Habitación",required:true},{key:"reservation",label:"Reserva"},{key:"guest",label:"Titular"},
  {key:"type",label:"Tipo",required:true},{key:"bedSetup",label:"Camas",required:true,editable:true},{key:"operation",label:"Operación",required:true},{key:"roomStatus",label:"Estado",required:true},{key:"note",label:"Notas",required:true},
  {key:"task",label:"Tarea"},{key:"taskStatus",label:"Estado tarea",defaultVisible:false},{key:"responsible",label:"Responsable",defaultVisible:false},
]
const RESERVATION_TOTALS=[{key:"pax",label:"Pasajeros",value:rows=>rows.reduce((sum,row)=>sum+(Number(row.pax)||0),0)},{key:"rooms",label:"Habitaciones",value:rows=>rows.reduce((sum,row)=>sum+(Number(row.roomCount)||0),0)},{key:"rows",label:"Reservas",value:rows=>rows.length}]
const HOUSEKEEPING_TOTALS=[{key:"rooms",label:"Habitaciones",value:rows=>rows.length},{key:"tasks",label:"Tareas",value:rows=>rows.filter(row=>row.task&&row.task!=="—").length}]

export default function ReceptionReportsWorkspace({propertyId,property}){
  const[day,setDay]=useState(()=>dateKey(new Date()))
  const[activeReport,setActiveReport]=useState("")
  const[rooms,setRooms]=useState([]),[floors,setFloors]=useState([]),[reservations,setReservations]=useState([]),[reservationGuests,setReservationGuests]=useState([]),[tasks,setTasks]=useState([]),[profiles,setProfiles]=useState(new Map())
  const[sheetPrefs,setSheetPrefs]=useState({}),[sheetRows,setSheetRows]=useState({})
  const[loading,setLoading]=useState(true),[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const tomorrow=nextDay(day)
      const[roomRes,floorRes,reservationRes,taskRes,prefRes,rowStateRes]=await Promise.all([
        supabase.from("habitaciones").select("id,nombre,tipo,estado,sort_order,floor_id,bed_configuration,capacidad").eq("property_id",propertyId).eq("activa",true),
        supabase.from("hotel_floors").select("id,name,sort_order,active").eq("property_id",propertyId).eq("active",true).order("sort_order").order("name"),
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,telefono_huesped,habitacion_id,habitaciones_ids,habitaciones_detalle,room_checkout_dates,fecha_entrada,fecha_salida,estado,no_show,cantidad_huespedes,regimen,hora_llegada_estimada,hora_salida_estimada,notas").eq("property_id",propertyId).lte("fecha_entrada",day).gte("fecha_salida",day).order("fecha_entrada").order("id"),
        supabase.from("hotel_housekeeping_tasks").select("id,room_id,task_type,status,assigned_to,scheduled_for,notes,updated_at").eq("property_id",propertyId).gte("scheduled_for",`${day}T00:00:00`).lt("scheduled_for",`${tomorrow}T00:00:00`).order("updated_at",{ascending:false}),
        supabase.from("hotel_report_sheet_preferences").select("report_key,settings").eq("property_id",propertyId),
        supabase.from("hotel_report_sheet_rows").select("report_key,row_key,note,hidden,overrides").eq("property_id",propertyId).eq("report_date",day),
      ])
      for(const result of[roomRes,floorRes,reservationRes,taskRes,prefRes,rowStateRes])if(result.error)throw result.error
      const taskRows=taskRes.data||[],reservationRows=reservationRes.data||[],profileIds=[...new Set(taskRows.map(row=>row.assigned_to).filter(Boolean))],reservationIds=reservationRows.map(row=>row.id).filter(Boolean)
      const[profileRes,guestRes]=await Promise.all([
        profileIds.length?supabase.from("profiles").select("id,full_name").in("id",profileIds):Promise.resolve({data:[],error:null}),
        reservationIds.length?supabase.from("hotel_reservation_guests").select("id,reservation_id,room_id,guest_profile_id,role,sort_order,full_name,birth_date,stay_from,stay_to,checked_out_at").in("reservation_id",reservationIds):Promise.resolve({data:[],error:null}),
      ])
      if(profileRes.error)throw profileRes.error
      if(guestRes.error)throw guestRes.error
      setRooms(roomRes.data||[]);setFloors(floorRes.data||[]);setReservations(reservationRows);setReservationGuests(guestRes.data||[]);setTasks(taskRows);setProfiles(new Map((profileRes.data||[]).map(row=>[row.id,row.full_name])))
      setSheetPrefs(Object.fromEntries((prefRes.data||[]).map(row=>[row.report_key,row.settings||{}])))
      setSheetRows(Object.fromEntries((rowStateRes.data||[]).map(row=>[`${row.report_key}:${row.row_key}`,row])))
    }catch(err){setError(err?.message||"No se pudieron cargar los informes de recepción.")}
    finally{setLoading(false)}
  },[propertyId,day])
  useEffect(()=>{load()},[load])
  useEffect(()=>{setActiveReport("")},[propertyId])
  usePmsAutoRefresh(propertyId,load,["reservas","habitaciones","hotel_housekeeping_tasks","hotel_reservation_guests"])

  const savePreference=useCallback((reportKey,settings)=>{
    setSheetPrefs(current=>({...current,[reportKey]:settings}))
    supabase.from("hotel_report_sheet_preferences").upsert({property_id:propertyId,report_key:reportKey,settings,updated_at:new Date().toISOString()},{onConflict:"property_id,report_key"}).then(({error:saveError})=>saveError&&setError(saveError.message))
  },[propertyId])
  const saveRowState=useCallback((reportKey,rowKey,patch)=>{
    const key=`${reportKey}:${rowKey}`,current=sheetRows[key]||{},next={...current,...patch}
    setSheetRows(state=>({...state,[key]:next}))
    supabase.from("hotel_report_sheet_rows").upsert({property_id:propertyId,report_key:reportKey,report_date:day,row_key:rowKey,note:String(next.note||""),hidden:Boolean(next.hidden),overrides:next.overrides&&typeof next.overrides==="object"?next.overrides:{},updated_at:new Date().toISOString()},{onConflict:"property_id,report_key,report_date,row_key"}).then(({error:saveError})=>saveError&&setError(saveError.message))
  },[propertyId,day,sheetRows])

  const roomMap=useMemo(()=>new Map(rooms.map(room=>[Number(room.id),room])),[rooms])
  const activeReservations=useMemo(()=>reservations.filter(row=>!cancelled(row)&&!row.no_show),[reservations])
  const roomLabel=useCallback(row=>roomIds(row).map(id=>roomMap.get(id)?.nombre).filter(Boolean).join(", ")||"Sin asignar",[roomMap])
  const arrivals=useMemo(()=>activeReservations.filter(row=>row.fecha_entrada===day),[activeReservations,day])
  const departures=useMemo(()=>activeReservations.filter(row=>row.fecha_salida===day),[activeReservations,day])
  const breakfasts=useMemo(()=>activeReservations.filter(row=>row.fecha_entrada<day&&row.fecha_salida>=day),[activeReservations,day])
  const reservationsByRoom=useMemo(()=>{const map=new Map();for(const reservation of activeReservations){for(const id of roomIds(reservation)){if(!map.has(id))map.set(id,[]);map.get(id).push(reservation)}}return map},[activeReservations])
  const taskByRoom=useMemo(()=>{const map=new Map();for(const task of tasks){const id=Number(task.room_id);if(id&&!map.has(id))map.set(id,task)}return map},[tasks])
  const guestsByReservation=useMemo(()=>{const map=new Map();for(const guest of reservationGuests){const id=Number(guest.reservation_id);if(!map.has(id))map.set(id,[]);map.get(id).push(guest)}return map},[reservationGuests])
  const housekeepingRows=useMemo(()=>buildHousekeepingRows({rooms,floors,reservationsByRoom,taskByRoom,profiles,day}),[rooms,floors,reservationsByRoom,taskByRoom,profiles,day])

  const reservationRow=useCallback(row=>({id:`res-${row.id}`,reservation:row.numero_reserva||row.id,guest:row.nombre_huesped||"—",room:roomLabel(row),roomCount:Math.max(roomIds(row).length,1),pax:Number(row.cantidad_huespedes)||1,phone:row.telefono_huesped||"—",status:row.estado||"—",regime:row.regimen||"—",arrival:row.fecha_entrada,departure:row.fecha_salida,note:row.notas||""}),[roomLabel])
  const arrivalRows=useMemo(()=>arrivals.map(row=>({...reservationRow(row),time:row.hora_llegada_estimada||"—"})),[arrivals,reservationRow])
  const departureRows=useMemo(()=>departures.map(row=>({...reservationRow(row),time:row.hora_salida_estimada||"—"})),[departures,reservationRow])
  const breakfastRows=useMemo(()=>breakfasts.map(row=>{const occupancy=breakfastOccupancy({reservation:row,day,roomMap,guests:guestsByReservation.get(Number(row.id))||[]});return{...reservationRow(row),pax:occupancy.pax,composition:occupancy.composition,adults:occupancy.adults,minors:occupancy.minors,paxSource:occupancy.source,situation:row.fecha_salida===day?"Sale hoy":"Continúa"}}),[breakfasts,reservationRow,day,roomMap,guestsByReservation])
  const breakfastPax=breakfastRows.reduce((sum,row)=>sum+Number(row.pax||0),0),breakfastDepartures=breakfastRows.filter(row=>row.situation==="Sale hoy").length
  const definitions=[
    {key:"arrivals",title:"Llegadas / check-in",subtitle:"Quién llega, a qué habitación y a qué hora.",columns:ARRIVAL_COLUMNS,rows:arrivalRows,totals:RESERVATION_TOTALS,defaultTotals:["pax","rooms"],summary:`${arrivalRows.length} reservas · ${arrivalRows.reduce((sum,row)=>sum+row.pax,0)} pasajeros`,fileName:`informe-llegadas-${day}`},
    {key:"departures",title:"Salidas / check-out",subtitle:"Salidas previstas y horario estimado.",columns:DEPARTURE_COLUMNS,rows:departureRows,totals:RESERVATION_TOTALS,defaultTotals:["pax","rooms"],summary:`${departureRows.length} reservas · ${departureRows.reduce((sum,row)=>sum+row.pax,0)} pasajeros`,fileName:`informe-salidas-${day}`},
    {key:"breakfasts",title:"Desayunos",subtitle:"Pasajeros previstos para desayunar según la ficha de cada reserva; si falta el dato, usa la capacidad configurada.",columns:BREAKFAST_COLUMNS,rows:breakfastRows,totals:RESERVATION_TOTALS,defaultTotals:["pax","rooms"],summary:`${breakfastPax} desayunos · ${breakfastDepartures} salen hoy`,fileName:`informe-desayunos-${day}`,layoutVersion:2},
    {key:"housekeeping",title:"Housekeeping",subtitle:"Estado de habitaciones, camas, reservas y tareas del día.",columns:HOUSEKEEPING_COLUMNS,rows:housekeepingRows,totals:HOUSEKEEPING_TOTALS,defaultTotals:["rooms","tasks"],summary:`${housekeepingRows.length} habitaciones · ${tasks.length} tareas`,fileName:`informe-housekeeping-${day}`,layoutVersion:3},
  ]
  const selected=definitions.find(item=>item.key===activeReport)

  return <section className={s.page}>
    <header className={s.header}><div><small>RECEPCIÓN · INFORMES</small><h1>{selected?selected.title:"Informes de recepción"}</h1><p>{selected?selected.subtitle:`${property?.name||"Propiedad activa"} · elegí un informe para abrirlo, editarlo y prepararlo para imprimir o Excel.`}</p></div><div className={s.actions}>{selected?<button type="button" onClick={()=>setActiveReport("")}>← Volver a informes</button>:null}<input type="date" value={day} onChange={event=>setDay(event.target.value)}/><button type="button" onClick={load}>↻ Actualizar</button></div></header>
    {error?<div className={s.notice}>{error}</div>:null}{loading?<div className={s.notice}>Actualizando informes…</div>:null}
    {!selected?<><div className={s.metrics}><Metric label="Llegadas" value={arrivals.length} note="Check-in previstos"/><Metric label="Salidas" value={departures.length} note="Check-out previstos"/><Metric label="Desayunos" value={breakfastPax} note={`${breakfastRows.length} reservas`}/><Metric label="Housekeeping" value={housekeepingRows.length} note={`${tasks.length} tareas programadas`}/></div><div className={s.reportList}>{definitions.map(item=><button type="button" className={s.reportCard} key={item.key} onClick={()=>setActiveReport(item.key)}><div><small>INFORME OPERATIVO</small><h2>{item.title}</h2><p>{item.subtitle}</p></div><div className={s.reportCardMeta}><span>{item.summary}</span><b>Abrir informe →</b></div></button>)}</div></>:<div className={s.detailWorkspace}><Sheet reportKey={selected.key} title={selected.title} subtitle={selected.subtitle} day={day} propertyName={property?.name||"Propiedad activa"} fileName={selected.fileName} columns={selected.columns} rows={selected.rows} totalOptions={selected.totals} defaultTotals={selected.defaultTotals} preference={sheetPrefs[selected.key]} rowState={sheetRows} layoutVersion={selected.layoutVersion} onPreferenceChange={savePreference} onRowStateChange={saveRowState}/></div>}
  </section>
}

function Metric({label,value,note}){return <article className={s.metric}><span>{label}</span><b>{value}</b><small>{note}</small></article>}

function Sheet({reportKey,title,subtitle,day,propertyName,fileName,columns,rows,totalOptions,defaultTotals,preference,rowState,layoutVersion,onPreferenceChange,onRowStateChange}){
  const[columnsOpen,setColumnsOpen]=useState(false),[filterOpen,setFilterOpen]=useState(false),[totalsOpen,setTotalsOpen]=useState(false),[query,setQuery]=useState(""),[noteDrafts,setNoteDrafts]=useState({}),[cellDrafts,setCellDrafts]=useState({})
  const effectivePreference=layoutVersion&&preference?.layoutVersion!==layoutVersion?{}:(preference||{}),hasSavedPreference=Array.isArray(effectivePreference?.order)||Array.isArray(effectivePreference?.hidden),allKeys=columns.map(column=>column.key),savedOrder=Array.isArray(effectivePreference?.order)?effectivePreference.order.filter(key=>allKeys.includes(key)):[],order=[...savedOrder,...allKeys.filter(key=>!savedOrder.includes(key))]
  const defaultHidden=columns.filter(column=>!column.required&&column.defaultVisible===false).map(column=>column.key),hidden=new Set(hasSavedPreference?(effectivePreference?.hidden||[]):defaultHidden),ordered=order.map(key=>columns.find(column=>column.key===key)).filter(Boolean),visibleColumns=ordered.filter(column=>column.required||!hidden.has(column.key))
  const totalsEnabled=effectivePreference?.totals?.enabled!==false,totalKeys=Array.isArray(effectivePreference?.totals?.keys)?effectivePreference.totals.keys:defaultTotals
  useEffect(()=>{const notes={},cells={};for(const row of rows){const saved=rowState[`${reportKey}:${row.id}`];notes[row.id]=saved?.note??row.note??"";for(const column of columns)if(column.editable)cells[`${row.id}:${column.key}`]=saved?.overrides?.[column.key]??row[column.key]??""}setNoteDrafts(notes);setCellDrafts(cells)},[rows,rowState,reportKey,columns])
  const hiddenRows=rows.filter(row=>Boolean(rowState[`${reportKey}:${row.id}`]?.hidden)),shownRows=rows.filter(row=>!rowState[`${reportKey}:${row.id}`]?.hidden),normalizedQuery=normalize(query),cellValue=(row,column)=>column.key==="note"?(noteDrafts[row.id]??row.note):column.editable?(cellDrafts[`${row.id}:${column.key}`]??row[column.key]):row[column.key],filteredRows=normalizedQuery?shownRows.filter(row=>visibleColumns.some(column=>normalize(cellValue(row,column)).includes(normalizedQuery))):shownRows
  const displayRows=filteredRows.map(row=>{const next={...row,note:noteDrafts[row.id]??row.note??""};for(const column of columns)if(column.editable)next[column.key]=cellDrafts[`${row.id}:${column.key}`]??row[column.key]??"";return next}),viewport=useReportViewport(visibleColumns.length),gridTemplate=`repeat(${visibleColumns.length},minmax(${viewport.cellWidth}px,1fr)) 38px`,minWidth=viewport.minWidth,totalParts=totalsEnabled?totalOptions.filter(option=>totalKeys.includes(option.key)).map(option=>`${option.label}: ${option.value(displayRows)}`):[],totalText=totalParts.join(" · ")
  const saveSettings=patch=>onPreferenceChange(reportKey,{...effectivePreference,...patch,...(layoutVersion?{layoutVersion}: {})}),persistLayout=(nextOrder,nextHidden)=>saveSettings({order:nextOrder,hidden:nextHidden})
  const dragProps=useReportColumnDrag(order,nextOrder=>persistLayout(nextOrder,[...hidden]))
  function toggleColumn(key){const column=columns.find(item=>item.key===key);if(column?.required)return;const next=new Set(hidden);next.has(key)?next.delete(key):next.add(key);persistLayout(order,[...next])}
  function toggleTotal(key){const next=new Set(totalKeys);next.has(key)?next.delete(key):next.add(key);saveSettings({totals:{enabled:totalsEnabled,keys:[...next]}})}
  function setTotalsEnabled(enabled){saveSettings({totals:{enabled,keys:totalKeys}})}
  function saveNote(row){const note=noteDrafts[row.id]??"";onRowStateChange(reportKey,row.id,{note,hidden:Boolean(rowState[`${reportKey}:${row.id}`]?.hidden),overrides:rowState[`${reportKey}:${row.id}`]?.overrides||{}})}
  function saveCell(row,column){const key=`${row.id}:${column.key}`,value=String(cellDrafts[key]??"").trim(),saved=rowState[`${reportKey}:${row.id}`]||{},overrides={...(saved.overrides||{})};if(!value||value===String(row[column.key]??"").trim())delete overrides[column.key];else overrides[column.key]=value;const resolved=overrides[column.key]??row[column.key]??"";setCellDrafts(current=>({...current,[key]:resolved}));onRowStateChange(reportKey,row.id,{note:noteDrafts[row.id]??row.note??"",hidden:Boolean(saved.hidden),overrides})}
  function exportExcel(){downloadXlsx({fileName,title,subtitle,day,propertyName,columns:visibleColumns,rows:displayRows,totalText})}
  function printCurrent(){printSheet({title,subtitle,day,propertyName,columns:visibleColumns,rows:displayRows,totalText})}
  return <article className={s.report}>
    <header><div><small>INFORME EDITABLE</small><h2>{title}</h2><p>{subtitle}</p></div><div className={s.reportHeaderMeta}><b>FECHA · {reportDateLabel(day)}</b><span className={s.count}>{filteredRows.length}</span></div></header>
    <div className={s.sheetToolbar}>
      <button type="button" onClick={()=>setFilterOpen(value=>!value)} className={filterOpen?s.activeTool:undefined}>⌕ Filtrar</button>
      <div className={s.columnWrap}><button type="button" onClick={()=>setColumnsOpen(value=>!value)} className={columnsOpen?s.activeTool:undefined}>▦ Columnas</button>{columnsOpen?<div className={s.columnPanel}><strong>Columnas del informe</strong><small className={s.dragHint}>El orden se cambia arrastrando los títulos de la tabla.</small>{ordered.map(column=><div className={s.columnOption} key={column.key}><label><input type="checkbox" checked={column.required||!hidden.has(column.key)} disabled={column.required} onChange={()=>toggleColumn(column.key)}/><span>{column.label}</span>{column.required?<small>Fija</small>:null}</label></div>)}</div>:null}</div>
      <div className={s.totalWrap}><button type="button" onClick={()=>setTotalsOpen(value=>!value)} className={totalsOpen?s.activeTool:undefined}>Σ Totales</button>{totalsOpen?<div className={s.totalPanel}><label className={s.totalMaster}><input type="checkbox" checked={totalsEnabled} onChange={event=>setTotalsEnabled(event.target.checked)}/><span>Mostrar totales abajo</span></label>{totalOptions.map(option=><label key={option.key}><input type="checkbox" checked={totalKeys.includes(option.key)} disabled={!totalsEnabled} onChange={()=>toggleTotal(option.key)}/><span>{option.label}</span></label>)}</div>:null}</div>
      <div className={s.zoomControls}><span>Vista</span><button type="button" onClick={viewport.zoomOut} aria-label="Achicar informe">−</button><b>{viewport.zoomPercent}%</b><button type="button" onClick={viewport.zoomIn} aria-label="Agrandar informe">+</button><button type="button" onClick={viewport.fitToWidth}>Ajustar</button></div>
      {hiddenRows.length?<button type="button" onClick={()=>hiddenRows.forEach(row=>onRowStateChange(reportKey,row.id,{hidden:false,note:noteDrafts[row.id]??row.note??"",overrides:rowState[`${reportKey}:${row.id}`]?.overrides||{}}))}>↶ Restaurar {hiddenRows.length}</button>:null}
      <span className={s.toolbarSpacer}/><button type="button" onClick={exportExcel}>↓ Excel</button><button type="button" className={s.printButton} onClick={printCurrent}>⎙ Imprimir / PDF</button>
    </div>
    {filterOpen?<div className={s.filterBar}><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar en este informe…"/><span>{filteredRows.length} de {shownRows.length} filas</span>{query?<button type="button" onClick={()=>setQuery("")}>Limpiar</button>:null}</div>:null}
    <div className={s.tableShell} ref={viewport.shellRef} onScroll={viewport.onShellScroll}><div className={s.table} style={{"--sheet-grid":gridTemplate,"--sheet-min":`${minWidth}px`}}><div className={s.head}>{visibleColumns.map(column=><span key={column.key} className={s.draggableHead} title="Arrastrá para cambiar la posición" {...dragProps(column.key)}><i aria-hidden="true">⋮⋮</i>{column.label}</span>)}<span className={s.rowActionHead}/></div>{filteredRows.length?filteredRows.map(row=><div className={s.row} key={row.id}>{visibleColumns.map(column=>column.key==="note"?<input key={column.key} className={s.noteInput} value={noteDrafts[row.id]??""} onChange={event=>setNoteDrafts(current=>({...current,[row.id]:event.target.value}))} onBlur={()=>saveNote(row)} placeholder="Escribir nota…"/>:column.editable?<input key={column.key} className={s.cellInput} value={cellDrafts[`${row.id}:${column.key}`]??row[column.key]??""} title={row.bedSetupSource||"Editable"} onChange={event=>setCellDrafts(current=>({...current,[`${row.id}:${column.key}`]:event.target.value}))} onBlur={()=>saveCell(row,column)} placeholder="Configurar…"/>:<span key={column.key} title={String(row[column.key]??"")}>{row[column.key]??"—"}</span>)}<button type="button" className={s.removeRow} title="Quitar de este informe" onClick={()=>onRowStateChange(reportKey,row.id,{hidden:true,note:noteDrafts[row.id]??row.note??"",overrides:rowState[`${reportKey}:${row.id}`]?.overrides||{}})}>×</button></div>):<div className={s.empty}>No hay datos para esta fecha con los filtros actuales.</div>}</div></div>
    <div className={s.bottomScroller} ref={viewport.bottomRef} onScroll={viewport.onBottomScroll} aria-label="Desplazamiento horizontal del informe"><div style={{width:`${minWidth}px`}}/></div>
    {totalsEnabled&&totalParts.length?<div className={s.totalBar}><strong>TOTAL</strong>{totalParts.map(part=><span key={part}>{part}</span>)}</div>:null}
    <footer><span>{filteredRows.length} fila{filteredRows.length===1?"":"s"} · {visibleColumns.length} columnas visibles</span><span>Las notas, columnas, filas ocultas y totales quedan guardados.</span></footer>
  </article>
}