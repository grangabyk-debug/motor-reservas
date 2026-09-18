"use client"

import{useCallback,useEffect,useMemo,useRef,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import usePmsAutoRefresh from"../../core/usePmsAutoRefresh"
import{activeReservationRoomIds}from"../reservations/reservationEditUtils"
import{breakfastOccupancy}from"./receptionReportBreakfast"
import ReceptionCustomReportBuilder from"./ReceptionCustomReportBuilder"
import{buildHousekeepingRows}from"./receptionReportHousekeeping"
import useOccupancyReport,{OCCUPANCY_COLUMNS,OCCUPANCY_TOTALS,rangeLabel}from"./useOccupancyReport"
import{ARRIVAL_COLUMNS,BREAKFAST_COLUMNS,DEPARTURE_COLUMNS,HOUSEKEEPING_COLUMNS,HOUSEKEEPING_TOTALS,RESERVATION_TOTALS,confirmedPayment,money}from"./receptionReportDefinitions"
import ReceptionReportSheet,{Metric}from"./ReceptionReportSheet"
import s from"./receptionReports.module.css"

const dateKey=date=>date.toLocaleDateString("en-CA")
const nextDay=value=>{const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+1);return dateKey(date)}
const normalize=value=>String(value||"").trim().toLowerCase()
const cancelled=row=>["cancelada","cancelled","anulada","anulado","fusionada","fusionado","merged"].includes(normalize(row?.estado))
const roomIds=row=>activeReservationRoomIds(row).map(Number)

export default function ReceptionReportsWorkspace({propertyId,property}){
  const[day,setDay]=useState(()=>dateKey(new Date()))
  const[rangeStart,setRangeStart]=useState(()=>{const date=new Date();date.setDate(1);return dateKey(date)}),[rangeEnd,setRangeEnd]=useState(()=>dateKey(new Date()))
  const[activeReport,setActiveReport]=useState(""),[builderOpen,setBuilderOpen]=useState(false)
  const previousPropertyId=useRef(propertyId)
  const[rooms,setRooms]=useState([]),[floors,setFloors]=useState([]),[reservations,setReservations]=useState([]),[reservationGuests,setReservationGuests]=useState([]),[payments,setPayments]=useState([]),[tasks,setTasks]=useState([]),[profiles,setProfiles]=useState(new Map())
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
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,telefono_huesped,habitacion_id,habitaciones_ids,habitaciones_detalle,room_checkout_dates,fecha_entrada,fecha_salida,estado,no_show,cantidad_huespedes,regimen,hora_llegada_estimada,hora_salida_estimada,notas,moneda,precio_total,subtotal,canal_reserva,codigo_canal").eq("property_id",propertyId).lte("fecha_entrada",day).gte("fecha_salida",day).order("fecha_entrada").order("id"),
        supabase.from("hotel_housekeeping_tasks").select("id,room_id,task_type,status,assigned_to,scheduled_for,notes,updated_at").eq("property_id",propertyId).gte("scheduled_for",`${day}T00:00:00`).lt("scheduled_for",`${tomorrow}T00:00:00`).order("updated_at",{ascending:false}),
        supabase.from("hotel_report_sheet_preferences").select("report_key,settings").eq("property_id",propertyId),
        supabase.from("hotel_report_sheet_rows").select("report_key,row_key,note,hidden,overrides").eq("property_id",propertyId).eq("report_date",day),
      ])
      for(const result of[roomRes,floorRes,reservationRes,taskRes,prefRes,rowStateRes])if(result.error)throw result.error
      const taskRows=taskRes.data||[],reservationRows=reservationRes.data||[],profileIds=[...new Set(taskRows.map(row=>row.assigned_to).filter(Boolean))],reservationIds=reservationRows.map(row=>row.id).filter(Boolean)
      const[profileRes,guestRes,paymentRes]=await Promise.all([
        profileIds.length?supabase.from("profiles").select("id,full_name").in("id",profileIds):Promise.resolve({data:[],error:null}),
        reservationIds.length?supabase.from("hotel_reservation_guests").select("id,reservation_id,room_id,guest_profile_id,role,sort_order,full_name,birth_date,stay_from,stay_to,checked_out_at").in("reservation_id",reservationIds):Promise.resolve({data:[],error:null}),
        reservationIds.length?supabase.from("pagos").select("id,reserva_id,monto,moneda,estado,refunded_amount").in("reserva_id",reservationIds):Promise.resolve({data:[],error:null}),
      ])
      if(profileRes.error)throw profileRes.error
      if(guestRes.error)throw guestRes.error
      if(paymentRes.error)throw paymentRes.error
      setRooms(roomRes.data||[]);setFloors(floorRes.data||[]);setReservations(reservationRows);setReservationGuests(guestRes.data||[]);setPayments(paymentRes.data||[]);setTasks(taskRows);setProfiles(new Map((profileRes.data||[]).map(row=>[row.id,row.full_name])))
      setSheetPrefs(Object.fromEntries((prefRes.data||[]).map(row=>[row.report_key,row.settings||{}])))
      setSheetRows(Object.fromEntries((rowStateRes.data||[]).map(row=>[`${row.report_key}:${row.row_key}`,row])))
    }catch(err){setError(err?.message||"No se pudieron cargar los informes de recepción.")}
    finally{setLoading(false)}
  },[propertyId,day])
  useEffect(()=>{load()},[load])
  useEffect(()=>{
    const read=()=>{if(typeof window==="undefined")return"";const value=new URL(window.location.href).searchParams.get("report")||"";return["arrivals","departures","breakfasts","housekeeping","occupancy"].includes(value)||value.startsWith("custom:")?value:""}
    const sync=()=>setActiveReport(read())
    const home=()=>setActiveReport("")
    sync()
    window.addEventListener("popstate",sync)
    window.addEventListener("hl:reception-reports-home",home)
    return()=>{window.removeEventListener("popstate",sync);window.removeEventListener("hl:reception-reports-home",home)}
  },[])
  useEffect(()=>{if(previousPropertyId.current===propertyId)return;previousPropertyId.current=propertyId;setActiveReport("");if(typeof window!=="undefined"){const url=new URL(window.location.href);url.searchParams.delete("report");window.history.replaceState({...window.history.state,pmsView:"receptionreports"},"",url)}},[propertyId])
  usePmsAutoRefresh(propertyId,load,["reservas","habitaciones","hotel_housekeeping_tasks","hotel_reservation_guests","pagos"])

  const savePreference=useCallback((reportKey,settings)=>{
    setSheetPrefs(current=>({...current,[reportKey]:settings}))
    supabase.from("hotel_report_sheet_preferences").upsert({property_id:propertyId,report_key:reportKey,settings,updated_at:new Date().toISOString()},{onConflict:"property_id,report_key"}).then(({error:saveError})=>saveError&&setError(saveError.message))
  },[propertyId])
  const createCustomReport=useCallback(({name,baseKey,columnKeys})=>{
    const reportKey=`custom:${crypto.randomUUID()}`,settings={kind:"custom_report",name,baseKey,columnKeys,createdAt:new Date().toISOString()}
    setSheetPrefs(current=>({...current,[reportKey]:settings}))
    supabase.from("hotel_report_sheet_preferences").upsert({property_id:propertyId,report_key:reportKey,settings,updated_at:new Date().toISOString()},{onConflict:"property_id,report_key"}).then(({error:saveError})=>saveError?setError(saveError.message):setBuilderOpen(false))
  },[propertyId])
  const deleteCustomReport=useCallback(reportKey=>{
    setSheetPrefs(current=>{const next={...current};delete next[reportKey];return next})
    Promise.all([
      supabase.from("hotel_report_sheet_preferences").delete().eq("property_id",propertyId).eq("report_key",reportKey),
      supabase.from("hotel_report_sheet_rows").delete().eq("property_id",propertyId).eq("report_key",reportKey),
    ]).then(results=>{const failed=results.find(result=>result.error);if(failed?.error)setError(failed.error.message);if(activeReport===reportKey)setActiveReport("")})
  },[propertyId,activeReport])
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
  const paidByReservation=useMemo(()=>{const map=new Map();for(const payment of payments){if(!confirmedPayment(payment))continue;const id=Number(payment.reserva_id),net=Math.max(0,(Number(payment.monto)||0)-(Number(payment.refunded_amount)||0));map.set(id,(map.get(id)||0)+net)}return map},[payments])
  const housekeepingRows=useMemo(()=>buildHousekeepingRows({rooms,floors,reservationsByRoom,taskByRoom,profiles,day}),[rooms,floors,reservationsByRoom,taskByRoom,profiles,day])

  const reservationRow=useCallback(row=>{const currency=String(row.moneda||"ARS").toUpperCase(),total=Math.max(0,Number(row.precio_total??row.subtotal)||0),paid=Math.max(0,paidByReservation.get(Number(row.id))||0),balance=Math.max(0,total-paid);return{id:`res-${row.id}`,reservation:row.numero_reserva||row.id,guest:row.nombre_huesped||"—",room:roomLabel(row),roomCount:Math.max(roomIds(row).length,1),pax:Number(row.cantidad_huespedes)||1,phone:row.telefono_huesped||"—",status:row.estado||"—",regime:row.regimen||"—",arrival:row.fecha_entrada,departure:row.fecha_salida,note:"",currency,total:money(total,currency),paid:money(paid,currency),balance:balance>.005?`${money(balance,currency)} · Pendiente`:`${money(0,currency)} · Pagado`,channel:row.canal_reserva||row.codigo_canal||"Directa"}} ,[roomLabel,paidByReservation])
  const arrivalRows=useMemo(()=>arrivals.map(row=>({...reservationRow(row),time:row.hora_llegada_estimada||"—"})),[arrivals,reservationRow])
  const departureRows=useMemo(()=>departures.map(row=>({...reservationRow(row),time:row.hora_salida_estimada||"—"})),[departures,reservationRow])
  const breakfastRows=useMemo(()=>breakfasts.map(row=>{const occupancy=breakfastOccupancy({reservation:row,day,roomMap,guests:guestsByReservation.get(Number(row.id))||[]});return{...reservationRow(row),pax:occupancy.pax,composition:occupancy.composition,adults:occupancy.adults,minors:occupancy.minors,paxSource:occupancy.source,situation:row.fecha_salida===day?"Sale hoy":"Continúa"}}),[breakfasts,reservationRow,day,roomMap,guestsByReservation])
  const breakfastPax=breakfastRows.reduce((sum,row)=>sum+Number(row.pax||0),0),breakfastDepartures=breakfastRows.filter(row=>row.situation==="Sale hoy").length
  const customSettings=Object.entries(sheetPrefs).filter(([key,value])=>key.startsWith("custom:")&&value?.kind==="custom_report"),selectedCustom=sheetPrefs[activeReport]?.kind==="custom_report"?sheetPrefs[activeReport]:null,occupancyEnabled=activeReport==="occupancy"||selectedCustom?.baseKey==="occupancy",occupancy=useOccupancyReport({propertyId,startDate:rangeStart,endDate:rangeEnd,enabled:occupancyEnabled})
  const definitions=[
    {key:"arrivals",title:"Llegadas / check-in",subtitle:"Quién llega, a qué habitación y a qué hora, con saldo operativo de la reserva.",columns:ARRIVAL_COLUMNS,rows:arrivalRows,totals:RESERVATION_TOTALS,defaultTotals:["pax","rooms"],summary:`${arrivalRows.length} reservas · ${arrivalRows.reduce((sum,row)=>sum+row.pax,0)} pasajeros`,fileName:`informe-llegadas-${day}`,layoutVersion:3},
    {key:"departures",title:"Salidas / check-out",subtitle:"Salidas previstas, estado de cuenta, canal y moneda de cada reserva.",columns:DEPARTURE_COLUMNS,rows:departureRows,totals:RESERVATION_TOTALS,defaultTotals:["pax","rooms"],summary:`${departureRows.length} reservas · ${departureRows.reduce((sum,row)=>sum+row.pax,0)} pasajeros`,fileName:`informe-salidas-${day}`,layoutVersion:3},
    {key:"breakfasts",title:"Desayunos",subtitle:"Pasajeros previstos para desayunar según la ficha de cada reserva; si falta el dato, usa la capacidad configurada.",columns:BREAKFAST_COLUMNS,rows:breakfastRows,totals:RESERVATION_TOTALS,defaultTotals:["pax","rooms"],summary:`${breakfastPax} desayunos · ${breakfastDepartures} salen hoy`,fileName:`informe-desayunos-${day}`,layoutVersion:2},
    {key:"housekeeping",title:"Housekeeping",subtitle:"Estado de habitaciones, camas, reservas y tareas del día.",columns:HOUSEKEEPING_COLUMNS,rows:housekeepingRows,totals:HOUSEKEEPING_TOTALS,defaultTotals:["rooms","tasks"],summary:`${housekeepingRows.length} habitaciones · ${tasks.length} tareas`,fileName:`informe-housekeeping-${day}`,layoutVersion:3},
    {key:"occupancy",title:"Ocupación · ADR · RevPAR",subtitle:"Ocupación diaria, tarifa promedio e ingreso por habitación disponible, con rango de fechas.",columns:OCCUPANCY_COLUMNS,rows:occupancy.rows,totals:OCCUPANCY_TOTALS,defaultTotals:["occupied","guests","revenue"],summary:`Rango · ADR · RevPAR · ${occupancy.currency}`,fileName:`informe-ocupacion-${rangeStart}-${rangeEnd}`,layoutVersion:1,range:true,dateLabel:rangeLabel(rangeStart,rangeEnd),allowRowHide:false},
  ]
  const baseByKey=new Map(definitions.map(item=>[item.key,item])),customReports=customSettings.map(([key,settings])=>{const base=baseByKey.get(settings.baseKey);return{key,name:settings.name||"Informe personalizado",baseTitle:base?.title||settings.baseKey,settings}}),customDefinitions=customReports.map(custom=>{const base=baseByKey.get(custom.settings.baseKey);if(!base)return null;const selectedKeys=Array.isArray(custom.settings.columnKeys)?custom.settings.columnKeys:[],columns=base.columns.filter(column=>selectedKeys.includes(column.key)).map((column,index)=>({...column,required:index===0}));return{...base,key:custom.key,title:custom.name,subtitle:`Informe personalizado basado en ${base.title}.`,columns,summary:`${base.rows.length} filas · ${columns.length} columnas`,fileName:`informe-personalizado-${custom.name.toLowerCase().replace(/[^a-z0-9]+/gi,"-")}`,layoutVersion:undefined}})
  .filter(Boolean),allDefinitions=[...definitions,...customDefinitions]
  const selected=allDefinitions.find(item=>item.key===activeReport)
  const openReport=useCallback(key=>{setActiveReport(key);if(typeof window!=="undefined"){const url=new URL(window.location.href);url.searchParams.set("view","receptionreports");url.searchParams.set("report",key);window.history.pushState({pmsView:"receptionreports",report:key},"",url);window.scrollTo({top:0,behavior:"auto"})}},[])
  const closeReport=useCallback(()=>{setActiveReport("");if(typeof window!=="undefined"){const url=new URL(window.location.href);url.searchParams.set("view","receptionreports");url.searchParams.delete("report");window.history.pushState({pmsView:"receptionreports"},"",url);window.scrollTo({top:0,behavior:"auto"})}},[])

  return <section className={s.page}>
    <header className={s.header}><div><small>RECEPCIÓN · INFORMES</small><h1>{selected?selected.title:"Informes de recepción"}</h1><p>{selected?selected.subtitle:`${property?.name||"Propiedad activa"} · elegí un informe para abrirlo, editarlo y prepararlo para imprimir o Excel.`}</p></div><div className={s.actions}>{selected?<button type="button" className={s.backButton} onClick={closeReport}>← Volver a informes</button>:<button type="button" className={s.createReportButton} onClick={()=>setBuilderOpen(value=>!value)}>＋ Crear mi informe</button>}{selected?.range?<><input type="date" value={rangeStart} max={rangeEnd} onChange={event=>setRangeStart(event.target.value)}/><span className={s.rangeSep}>→</span><input type="date" value={rangeEnd} min={rangeStart} onChange={event=>setRangeEnd(event.target.value)}/></>:<input type="date" value={day} onChange={event=>setDay(event.target.value)}/>}<button type="button" onClick={selected?.range?occupancy.reload:load}>↻ Actualizar</button></div></header>
    {error||occupancy.error?<div className={s.notice}>{error||occupancy.error}</div>:null}{loading||occupancy.loading?<div className={s.notice}>Actualizando informes…</div>:null}
    {!selected&&builderOpen?<ReceptionCustomReportBuilder sources={definitions} customReports={customReports} onCreate={createCustomReport} onDelete={deleteCustomReport} onClose={()=>setBuilderOpen(false)}/>:null}
    {!selected?<><div className={s.metrics}><Metric label="Llegadas" value={arrivals.length} note="Check-in previstos"/><Metric label="Salidas" value={departures.length} note="Check-out previstos"/><Metric label="Desayunos" value={breakfastPax} note={`${breakfastRows.length} reservas`}/><Metric label="Housekeeping" value={housekeepingRows.length} note={`${tasks.length} tareas programadas`}/></div><div className={s.reportList}>{allDefinitions.map(item=><button type="button" className={s.reportCard} key={item.key} onClick={()=>openReport(item.key)}><div><small>INFORME OPERATIVO</small><h2>{item.title}</h2><p>{item.subtitle}</p></div><div className={s.reportCardMeta}><span>{item.summary}</span><b>Abrir informe →</b></div></button>)}</div></>:<div className={s.detailWorkspace}><ReceptionReportSheet reportKey={selected.key} title={selected.title} subtitle={selected.subtitle} day={selected.range?rangeStart:day} dateLabel={selected.dateLabel} propertyName={property?.name||"Propiedad activa"} fileName={selected.fileName} columns={selected.columns} rows={selected.rows} totalOptions={selected.totals} defaultTotals={selected.defaultTotals} preference={sheetPrefs[selected.key]} rowState={sheetRows} layoutVersion={selected.layoutVersion} allowRowHide={selected.allowRowHide!==false} onPreferenceChange={savePreference} onRowStateChange={saveRowState}/></div>}
  </section>
}
