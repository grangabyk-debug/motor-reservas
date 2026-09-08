"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import usePmsAutoRefresh from"../../core/usePmsAutoRefresh"
import s from"./receptionReports.module.css"

const dateKey=date=>date.toLocaleDateString("en-CA")
const nextDay=value=>{const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+1);return dateKey(date)}
const normalize=value=>String(value||"").trim().toLowerCase()
const cancelled=row=>["cancelada","cancelled","anulada","anulado"].includes(normalize(row?.estado))
const roomIds=row=>[...new Set([row?.habitacion_id,...(row?.habitaciones_ids||[])].filter(Boolean).map(Number))]
const xmlClean=value=>String(value??"").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"")
const xmlEscape=value=>xmlClean(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")
const htmlEscape=value=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")
const columnName=index=>{let n=index+1,out="";while(n){const r=(n-1)%26;out=String.fromCharCode(65+r)+out;n=Math.floor((n-1)/26)}return out}
const textEncoder=typeof TextEncoder!=="undefined"?new TextEncoder():null
const crcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0}return table})()
const crc32=bytes=>{let c=0xffffffff;for(const byte of bytes)c=crcTable[(c^byte)&255]^(c>>>8);return(c^0xffffffff)>>>0}
const u16=n=>new Uint8Array([n&255,(n>>>8)&255])
const u32=n=>new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])
const joinBytes=parts=>{const length=parts.reduce((sum,part)=>sum+part.length,0),out=new Uint8Array(length);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length}return out}
function zipStore(entries){const locals=[],centrals=[];let offset=0;for(const entry of entries){const name=textEncoder.encode(entry.name),data=textEncoder.encode(entry.content),crc=crc32(data),local=joinBytes([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);locals.push(local);centrals.push(joinBytes([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]));offset+=local.length}const body=joinBytes(locals),directory=joinBytes(centrals),end=joinBytes([u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(directory.length),u32(body.length),u16(0)]);return joinBytes([body,directory,end])}
function excelCell(ref,value,style=0){if(typeof value==="number"&&Number.isFinite(value))return`<c r="${ref}" t="n" s="${style}"><v>${value}</v></c>`;return`<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`}
function downloadXlsx({fileName,title,subtitle,day,propertyName,columns,rows,totalText}){
  if(!textEncoder)return
  const last=columnName(Math.max(columns.length-1,0)),headerRow=5,dataStart=6,totalRow=dataStart+rows.length
  const widths=columns.map(column=>{const values=rows.slice(0,80).map(row=>String(row[column.key]??"")),max=Math.max(column.label.length,...values.map(value=>value.length));const preferred=column.key==="note"?34:column.key==="guest"?24:column.key==="room"?20:Math.max(12,max+3);return Math.min(40,preferred)})
  const sheetRows=[
    `<row r="1" ht="26" customHeight="1">${excelCell("A1",title,3)}</row>`,
    `<row r="2" ht="20" customHeight="1">${excelCell("A2",subtitle,4)}</row>`,
    `<row r="3" ht="20" customHeight="1">${excelCell("A3",`${propertyName||"Propiedad"} · ${day}`,4)}</row>`,
    `<row r="${headerRow}" ht="23" customHeight="1">${columns.map((column,index)=>excelCell(`${columnName(index)}${headerRow}`,column.label,1)).join("")}</row>`,
  ]
  rows.forEach((row,index)=>{const excelRow=dataStart+index;sheetRows.push(`<row r="${excelRow}" ht="22" customHeight="1">${columns.map((column,columnIndex)=>excelCell(`${columnName(columnIndex)}${excelRow}`,row[column.key]??"",0)).join("")}</row>`)})
  if(totalText)sheetRows.push(`<row r="${totalRow}" ht="24" customHeight="1">${excelCell(`A${totalRow}`,"TOTAL",2)}${columns.length>1?excelCell(`B${totalRow}`,totalText,2):""}</row>`)
  const mergeRefs=[`A1:${last}1`,`A2:${last}2`,`A3:${last}3`]
  if(totalText&&columns.length>2)mergeRefs.push(`B${totalRow}:${last}${totalRow}`)
  const cols=widths.map((width,index)=>`<col min="${index+1}" max="${index+1}" width="${width}" customWidth="1"/>`).join("")
  const finalDataRow=Math.max(headerRow,dataStart+rows.length-1)
  const worksheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${sheetRows.join("")}</sheetData><mergeCells count="${mergeRefs.length}">${mergeRefs.map(ref=>`<mergeCell ref="${ref}"/>`).join("")}</mergeCells><autoFilter ref="A${headerRow}:${last}${finalDataRow}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="10"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Calibri"/></font><font><b/><color rgb="FF1F2A44"/><sz val="16"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF5B5FEF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF1FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFDCE1EC"/></left><right style="thin"><color rgb="FFDCE1EC"/></right><top style="thin"><color rgb="FFDCE1EC"/></top><bottom style="thin"><color rgb="FFDCE1EC"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
  const entries=[
    {name:"[Content_Types].xml",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
    {name:"_rels/.rels",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:"xl/workbook.xml",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Informe" sheetId="1" r:id="rId1"/></sheets></workbook>`},
    {name:"xl/_rels/workbook.xml.rels",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:"xl/styles.xml",content:styles},{name:"xl/worksheets/sheet1.xml",content:worksheet},
  ]
  const blob=new Blob([zipStore(entries)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=`${fileName}.xlsx`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function printSheet({title,subtitle,day,propertyName,columns,rows,totalText}){
  const frame=document.createElement("iframe");frame.style.position="fixed";frame.style.width="1px";frame.style.height="1px";frame.style.right="0";frame.style.bottom="0";frame.style.opacity="0";frame.style.pointerEvents="none";document.body.appendChild(frame)
  const documentRef=frame.contentWindow?.document;if(!documentRef){frame.remove();return}
  const small=columns.length>7?"8px":"9.5px",bodyRows=rows.map(row=>`<tr>${columns.map(column=>`<td>${htmlEscape(row[column.key]??"")}</td>`).join("")}</tr>`).join("")
  documentRef.open();documentRef.write(`<!doctype html><html><head><meta charset="utf-8"><title>${htmlEscape(title)}</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;color:#1f2a44;font-family:Arial,sans-serif}header{margin-bottom:14px}small{display:block;color:#5b5fef;font-weight:800;letter-spacing:.08em;font-size:9px}h1{margin:4px 0 3px;font-size:20px}p{margin:0;color:#67728a;font-size:10px}.meta{margin-top:5px;color:#4d5870;font-size:9px}table{width:100%;border-collapse:collapse;table-layout:auto;font-size:${small}}thead{display:table-header-group}th{background:#5b5fef;color:white;text-align:left;font-weight:700;padding:7px 6px;border:1px solid #dce1ec}td{padding:6px;border:1px solid #dce1ec;vertical-align:top;word-break:break-word}tbody tr:nth-child(even){background:#f7f8fc}.total{margin-top:9px;padding:8px 10px;border:1px solid #cfd5f7;background:#eff1ff;font-size:10px;font-weight:800}.footer{margin-top:8px;color:#7b8498;font-size:8px;text-align:right}</style></head><body><header><small>HABITACIÓN LLENA · INFORME DE RECEPCIÓN</small><h1>${htmlEscape(title)}</h1><p>${htmlEscape(subtitle)}</p><div class="meta">${htmlEscape(propertyName||"Propiedad")} · ${htmlEscape(day)}</div></header><table><thead><tr>${columns.map(column=>`<th>${htmlEscape(column.label)}</th>`).join("")}</tr></thead><tbody>${bodyRows||`<tr><td colspan="${columns.length}">No hay datos para esta fecha.</td></tr>`}</tbody></table>${totalText?`<div class="total">TOTAL · ${htmlEscape(totalText)}</div>`:""}<div class="footer">Generado desde Habitación Llena</div></body></html>`);documentRef.close()
  const cleanup=()=>setTimeout(()=>frame.remove(),300);frame.contentWindow.onafterprint=cleanup;setTimeout(()=>{frame.contentWindow?.focus();frame.contentWindow?.print();setTimeout(cleanup,3000)},180)
}

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
  const hasSavedPreference=Array.isArray(preference?.order)||Array.isArray(preference?.hidden)
  const allKeys=columns.map(column=>column.key),savedOrder=Array.isArray(preference?.order)?preference.order.filter(key=>allKeys.includes(key)):[],order=[...savedOrder,...allKeys.filter(key=>!savedOrder.includes(key))]
  const defaultHidden=columns.filter(column=>!column.required&&column.defaultVisible===false).map(column=>column.key),hidden=new Set(hasSavedPreference?(preference?.hidden||[]):defaultHidden)
  const ordered=order.map(key=>columns.find(column=>column.key===key)).filter(Boolean),visibleColumns=ordered.filter(column=>column.required||!hidden.has(column.key))
  const totalsEnabled=preference?.totals?.enabled!==false,totalKeys=Array.isArray(preference?.totals?.keys)?preference.totals.keys:defaultTotals
  useEffect(()=>{const next={};for(const row of rows){const saved=rowState[`${reportKey}:${row.id}`];next[row.id]=saved?.note??row.note??""}setNoteDrafts(next)},[rows,rowState,reportKey])
  const hiddenRows=rows.filter(row=>Boolean(rowState[`${reportKey}:${row.id}`]?.hidden)),shownRows=rows.filter(row=>!rowState[`${reportKey}:${row.id}`]?.hidden)
  const normalizedQuery=normalize(query),filteredRows=normalizedQuery?shownRows.filter(row=>visibleColumns.some(column=>normalize(column.key==="note"?(noteDrafts[row.id]??row.note):row[column.key]).includes(normalizedQuery))):shownRows
  const displayRows=filteredRows.map(row=>({...row,note:noteDrafts[row.id]??row.note??""}))
  const gridTemplate=`repeat(${visibleColumns.length},minmax(128px,1fr)) 38px`,minWidth=Math.max(760,visibleColumns.length*138+38)
  const totalParts=totalsEnabled?totalOptions.filter(option=>totalKeys.includes(option.key)).map(option=>`${option.label}: ${option.value(displayRows)}`):[],totalText=totalParts.join(" · ")
  const saveSettings=patch=>onPreferenceChange(reportKey,{...(preference||{}),...patch})
  const persistLayout=(nextOrder,nextHidden)=>saveSettings({order:nextOrder,hidden:nextHidden})
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
    <div className={s.tableShell}>
      <div className={s.table} style={{"--sheet-grid":gridTemplate,"--sheet-min":`${minWidth}px`}}>
        <div className={s.head}>{visibleColumns.map(column=><span key={column.key}>{column.label}</span>)}<span className={s.rowActionHead}/></div>
        {filteredRows.length?filteredRows.map(row=><div className={s.row} key={row.id}>{visibleColumns.map(column=>column.key==="note"?<input key={column.key} className={s.noteInput} value={noteDrafts[row.id]??""} onChange={event=>setNoteDrafts(current=>({...current,[row.id]:event.target.value}))} onBlur={()=>saveNote(row)} placeholder="Escribir nota…"/>:<span key={column.key} title={String(row[column.key]??"")}>{row[column.key]??"—"}</span>)}<button type="button" className={s.removeRow} title="Quitar de este informe" onClick={()=>onRowStateChange(reportKey,row.id,{hidden:true,note:noteDrafts[row.id]??row.note??""})}>×</button></div>):<div className={s.empty}>No hay datos para esta fecha con los filtros actuales.</div>}
      </div>
    </div>
    {totalsEnabled&&totalParts.length?<div className={s.totalBar}><strong>TOTAL</strong>{totalParts.map(part=><span key={part}>{part}</span>)}</div>:null}
    <footer><span>{filteredRows.length} fila{filteredRows.length===1?"":"s"} · {visibleColumns.length} columnas visibles</span><span>Las notas, columnas, filas ocultas y totales quedan guardados.</span></footer>
  </article>
}
