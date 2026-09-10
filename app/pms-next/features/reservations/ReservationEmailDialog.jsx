"use client"

import{useEffect,useMemo,useRef,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const fmt=value=>value?new Intl.DateTimeFormat("es-AR",{day:"numeric",month:"long",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):"—"
const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(value)).replace(".",""):"—"
const clean=value=>String(value||"").trim()
function soldCategoryLabel(item,rooms=[]){
  const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]
  let values=details.map(row=>clean(row?.categoria_vendida||row?.categoria_asignada)).filter(Boolean)
  if(!values.length){
    const stored=clean(item?.categoria_vendida||item?.tipo_habitacion_reservada||item?.categoria_habitacion)
    if(stored)values=[stored]
  }
  if(!values.length)values=(rooms||[]).map(room=>clean(room?.tipo)).filter(Boolean)
  if(!values.length){
    const pax=Math.max(1,Number(item?.cantidad_huespedes)||1)
    values=[pax===1?"Single":pax===2?"Doble":pax===3?"Triple":pax===4?"Cuádruple":"Categoría reservada"]
  }
  const counts=new Map()
  values.forEach(value=>counts.set(value,(counts.get(value)||0)+1))
  return[...counts.entries()].map(([value,count])=>count>1?`${count} × ${value}`:value).join(", ")
}
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]))
const inlineHtml=value=>escapeHtml(value).replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")
const textToHtml=value=>String(value||"").split(/\n{2,}/).map(block=>`<p>${inlineHtml(block).replace(/\n/g,"<br>")}</p>`).join("")
const htmlToText=value=>String(value||"").replace(/<br\s*\/?\s*>/gi,"\n").replace(/<\/p>/gi,"\n\n").replace(/<\/div>/gi,"\n").replace(/<li>/gi,"• ").replace(/<\/li>/gi,"\n").replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/\n{3,}/g,"\n\n").trim()
const looksLikeHtml=value=>/<\/?[a-z][\s\S]*>/i.test(String(value||""))

const BUILT_INS=[["preconfirmation","Pre-confirmación de reserva"],["confirmation","Confirmación de reserva"],["cancellation","Cancelación de reserva"],["availability","Disponibilidad"],["budget","Presupuesto"],["payment","Confirmación de pago"],["invoice","Envío de factura"]]
function buildTemplate(key,context){
  const{hotel,guest,reservation,arrival,departure,rooms,pax,total}=context
  const details=`Reserva: **${reservation}**\nEntrada: ${arrival}\nSalida: ${departure}\nHabitación: ${rooms}\nPasajeros: ${pax}\nTotal de la reserva: ${total}`
  const shortDetails=`Reserva: **${reservation}**\nEntrada: ${arrival}\nSalida: ${departure}\nHabitación: ${rooms}`
  if(key==="preconfirmation")return{subject:`${hotel} · Pre-confirmación de reserva ${reservation}`,text:`Hola ${guest},\n\nRecibimos tu solicitud de reserva en ${hotel}. Te compartimos los datos registrados para que puedas revisarlos:\n\n${details}\n\nLa reserva queda pendiente de confirmación final. Si necesitás corregir algún dato, respondé este correo.\n\nSaludos,\n${hotel}`}
  if(key==="cancellation")return{subject:`${hotel} · Cancelación de reserva ${reservation}`,text:`Hola ${guest},\n\nTe informamos que tu reserva en ${hotel} fue cancelada.\n\n${shortDetails}\n\nSi necesitás volver a reservar o tenés alguna consulta, respondé este correo.\n\nSaludos,\n${hotel}`}
  if(key==="availability")return{subject:`${hotel} · Disponibilidad para tu estadía`,text:`Hola ${guest},\n\nTe compartimos la disponibilidad registrada para las fechas consultadas en ${hotel}:\n\n${shortDetails}\nPasajeros: ${pax}\n\nPodemos ajustar esta propuesta antes de confirmar la reserva.\n\nSaludos,\n${hotel}`}
  if(key==="budget")return{subject:`${hotel} · Presupuesto de estadía`,text:`Hola ${guest},\n\nTe enviamos el presupuesto para tu estadía en ${hotel}:\n\n${details}\n\nSaludos,\n${hotel}`}
  if(key==="payment")return{subject:`${hotel} · Confirmación de pago · Reserva ${reservation}`,text:`Hola ${guest},\n\nConfirmamos la recepción del pago asociado a tu reserva en ${hotel}.\n\nResumen de la reserva:\n${details}\n\nSaludos,\n${hotel}`}
  if(key==="invoice")return{subject:`${hotel} · Envío de factura · Reserva ${reservation}`,text:`Hola ${guest},\n\nTe enviamos adjunta la factura correspondiente a tu estadía en ${hotel}.\n\n${shortDetails}\n\nSaludos,\n${hotel}`}
  return{subject:`${hotel} · Confirmación de reserva ${reservation}`,text:`Hola ${guest},\n\nTu reserva en ${hotel} está confirmada.\n\n${details}\n\nSi necesitás hacer algún cambio o agregar una solicitud, respondé este correo.\n\nSaludos,\n${hotel}`}
}

const TOKENS=[["guest","Nombre del huésped"],["reservation","Número de reserva"],["arrival","Fecha de entrada"],["departure","Fecha de salida"],["rooms","Categoría de habitación"],["pax","Cantidad de pasajeros"],["total","Total de la reserva"],["hotel","Nombre del alojamiento"]]
const SNIPPETS=[["greeting","Saludo"],["thanks","Agradecimiento"],["reply","Invitación a responder"],["payment","Recordatorio de pago"],["closing","Despedida"]]
function replaceTokens(value,context){const aliases={guest:["guest","guest_name","nombre_huesped","huesped"],reservation:["reservation","reservation_number","numero_reserva"],arrival:["arrival","checkin","fecha_entrada"],departure:["departure","checkout","fecha_salida"],rooms:["rooms","room","habitaciones","habitacion","categoria","room_category"],pax:["pax","guests","pasajeros"],total:["total","reservation_total","precio_total"],hotel:["hotel","hotel_name","alojamiento"]};let out=String(value||"");for(const[key,names]of Object.entries(aliases))for(const name of names)out=out.replace(new RegExp(`{{\\s*${name}\\s*}}`,`gi`),String(context[key]??""));return out}
function readFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error(`No se pudo leer ${file.name}.`));reader.onload=()=>resolve(String(reader.result||"").split(",")[1]||"");reader.readAsDataURL(file)})}

function latin1(value){return String(value??"").replace(/–|—/g,"-").replace(/“|”/g,'"').replace(/‘|’/g,"'").replace(/[^\x20-\xFF]/g,"?")}
function pdfEscape(value){return latin1(value).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")}
function wrapPdf(value,max=82){const words=latin1(value).split(/\s+/),lines=[];let line="";for(const word of words){const next=line?`${line} ${word}`:word;if(next.length>max&&line){lines.push(line);line=word}else line=next}if(line)lines.push(line);return lines.length?lines:[""]}
function bytesToBase64(bytes){let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary)}
function invoicePdf(doc,context){
  const invoiceNo=doc?.number||`#${doc?.id||""}`,billing=doc?.billing_to||{},rows=Array.isArray(doc?.items)?doc.items:[]
  const lines=[{text:context.hotel,bold:true,size:15},{text:`FACTURA ${invoiceNo}`,bold:true,size:13},{text:`Reserva: ${context.reservation}`},{text:`Cliente: ${billing.name||context.guest}`},{text:`Fecha: ${fmtDateTime(doc?.issued_at||doc?.created_at)}`},{text:`Habitación: ${context.rooms}`},{text:""},{text:"Conceptos",bold:true}]
  rows.slice(0,22).forEach(row=>{const qty=Math.max(0,Number(row?.quantity)||1),unit=Number(row?.unit_price||0),rowTotal=Number(row?.total);const total=Number.isFinite(rowTotal)?rowTotal:qty*unit;wrapPdf(`${row?.description||"Concepto"}${row?.detail?` · ${row.detail}`:""} · ${qty} × ${money(unit,doc?.currency)} = ${money(total,doc?.currency)}`,76).forEach(text=>lines.push({text}))})
  lines.push({text:""},{text:`Subtotal: ${money(doc?.subtotal,doc?.currency)}`},{text:`IVA / impuestos: ${money(doc?.tax,doc?.currency)}`},{text:`TOTAL: ${money(doc?.total,doc?.currency)}`,bold:true,size:12})
  const ops=lines.slice(0,48).map(row=>`/${row.bold?"F2":"F1"} ${row.size||10} Tf (${pdfEscape(row.text)}) Tj T*`).join("\n")
  const stream=`BT\n48 792 Td\n14 TL\n${ops}\nET`
  const objects=[
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`,
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`,
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`,
    `6 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ]
  let pdf="%PDF-1.4\n%HL\n",offsets=[0]
  for(const object of objects){offsets.push(pdf.length);pdf+=object}
  const xref=pdf.length
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  const bytes=new Uint8Array(pdf.length);for(let i=0;i<pdf.length;i++)bytes[i]=pdf.charCodeAt(i)&255
  return bytes
}
const safeFile=value=>latin1(value||"factura").replace(/[^A-Za-z0-9._-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"")||"factura"

export default function ReservationEmailDialog({item,rooms=[],propertyId,onClose,onSent}){
  const[hotel,setHotel]=useState("Habitación Llena"),[fromName,setFromName]=useState(""),[fromEmail,setFromEmail]=useState(""),[subject,setSubject]=useState(""),[templates,setTemplates]=useState([]),[invoices,setInvoices]=useState([]),[activeTemplate,setActiveTemplate]=useState("confirmation"),[selectedInvoiceId,setSelectedInvoiceId]=useState(""),[attachments,setAttachments]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState("")
  const editorRef=useRef(null),editorHtmlRef=useRef(""),fileRef=useRef(null),initialized=useRef(false)
  const context=useMemo(()=>({hotel,guest:item?.nombre_huesped||"huésped",reservation:item?.numero_reserva||item?.id||"—",arrival:fmt(item?.fecha_entrada),departure:fmt(item?.fecha_salida),rooms:soldCategoryLabel(item,rooms),pax:Number(item?.cantidad_huespedes)||1,total:money(item?.precio_total,item?.moneda)}),[hotel,item,rooms])

  useEffect(()=>{
    let active=true
    Promise.all([
      supabase.from("hotel_os_settings").select("hotel_name,operational_settings").eq("property_id",propertyId).maybeSingle(),
      supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
      supabase.from("hotel_message_templates").select("id,code,name,subject,body,channel,sort_order").eq("property_id",propertyId).eq("enabled",true).order("sort_order").order("name"),
      supabase.from("hotel_finance_documents").select("id,number,status,currency,subtotal,tax,total,billing_to,items,issued_at,created_at").eq("property_id",propertyId).eq("reservation_id",Number(item?.id)).eq("document_type","invoice").neq("status","void").order("created_at",{ascending:false}),
    ]).then(([hotelRes,propertyRes,templateRes,invoiceRes])=>{
      if(!active)return
      const h=hotelRes.data?.hotel_name||"Habitación Llena",ops=hotelRes.data?.operational_settings||{},mail=propertyRes.data?.settings?.email||{},opsMail=ops?.email||{}
      setHotel(h);setFromName(mail.sender_name||opsMail.from_name||h);setFromEmail(mail.sender_email||opsMail.from_email||opsMail.reply_to||"")
      setTemplates((templateRes.data||[]).filter(row=>!row.channel||String(row.channel).toLowerCase()==="email"))
      setInvoices((invoiceRes.data||[]).filter(row=>String(row.status||"").toLowerCase()==="issued"))
    }).catch(()=>{})
    return()=>{active=false}
  },[propertyId,item?.id])

  function setEditor(next){const value=String(next||"");editorHtmlRef.current=value;if(editorRef.current&&editorRef.current.innerHTML!==value)editorRef.current.innerHTML=value}
  function syncEditor(){if(editorRef.current)editorHtmlRef.current=editorRef.current.innerHTML}
  useEffect(()=>{if(initialized.current||!hotel)return;const template=buildTemplate("confirmation",context);setSubject(template.subject);setEditor(textToHtml(template.text));initialized.current=true},[hotel,context])

  function command(name,value=null){editorRef.current?.focus();document.execCommand(name,false,value);syncEditor()}
  function insertHtml(value){editorRef.current?.focus();document.execCommand("insertHTML",false,value);syncEditor()}
  function chooseInvoice(id){
    const value=String(id||"");setSelectedInvoiceId(value);setError("")
    const base=attachments.filter(row=>row.kind!=="invoice")
    if(!value){setAttachments(base);return}
    const doc=invoices.find(row=>String(row.id)===value);if(!doc)return
    if(base.length>=5){setError("Podés adjuntar hasta 5 archivos por correo.");return}
    const bytes=invoicePdf(doc,context),filename=`Factura-${safeFile(doc.number||doc.id)}.pdf`
    setAttachments([...base,{kind:"invoice",documentId:doc.id,name:filename,size:bytes.length,type:"application/pdf",content:bytesToBase64(bytes)}])
  }
  function applyBuiltIn(key){
    if(!key)return
    setActiveTemplate(key);setError("")
    const template=buildTemplate(key,context);setSubject(template.subject);setEditor(textToHtml(template.text))
    if(key!=="invoice"){setSelectedInvoiceId("");setAttachments(list=>list.filter(row=>row.kind!=="invoice"))}
    else if(invoices.length===1)chooseInvoice(invoices[0].id)
  }
  function applySavedTemplate(id){if(!id)return;const template=templates.find(row=>String(row.id)===String(id));if(!template)return;setActiveTemplate("saved");setSelectedInvoiceId("");setAttachments(list=>list.filter(row=>row.kind!=="invoice"));const nextSubject=replaceTokens(template.subject||subject,context),body=replaceTokens(template.body||"",context);setSubject(nextSubject);setEditor(looksLikeHtml(body)?body:textToHtml(body))}
  function insertToken(key){if(key)insertHtml(key==="reservation"?`<strong>${escapeHtml(String(context[key]??""))}</strong>`:escapeHtml(String(context[key]??"")))}
  function insertSnippet(key){if(!key)return;const values={greeting:`Hola ${escapeHtml(context.guest)},`,thanks:`Muchas gracias por elegir ${escapeHtml(context.hotel)}.`,reply:"Si necesitás hacer algún cambio o tenés una consulta, podés responder directamente este correo.",payment:`Te recordamos que el total registrado de la reserva es ${escapeHtml(context.total)}.`,closing:`Saludos,<br>${escapeHtml(context.hotel)}`};insertHtml(`<p>${values[key]||""}</p>`)}
  async function addFiles(event){const files=[...(event.target.files||[])];event.target.value="";if(!files.length)return;const next=[...attachments];let total=next.reduce((sum,row)=>sum+row.size,0);for(const file of files){if(next.length>=5){setError("Podés adjuntar hasta 5 archivos por correo.");break}if(file.size>2*1024*1024){setError(`${file.name} supera el límite de 2 MB por archivo.`);continue}if(total+file.size>3*1024*1024){setError("Los adjuntos no pueden superar 3 MB en total.");break}next.push({kind:"file",file,name:file.name,size:file.size,type:file.type||"application/octet-stream"});total+=file.size}setAttachments(next)}
  async function send(){
    if(busy)return
    syncEditor();const currentHtml=editorRef.current?.innerHTML||editorHtmlRef.current,currentText=htmlToText(currentHtml)
    if(!item?.email_huesped)return setError("La reserva no tiene email cargado.")
    if(!subject.trim()||!currentText.trim())return setError("Completá el asunto y el mensaje antes de enviar.")
    if(activeTemplate==="invoice"&&!attachments.some(row=>row.kind==="invoice"))return setError("Elegí una factura emitida para adjuntar.")
    setBusy(true);setError("")
    try{
      const prepared=[]
      for(const row of attachments)prepared.push({filename:row.name,content_type:row.type,content:row.content||await readFile(row.file)})
      const{data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("La sesión no está disponible.")
      const response=await fetch("/api/hotel/email",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({reservation_id:item.id,subject:subject.trim(),html:currentHtml,text:currentText,from_name:fromName.trim(),from_email:fromEmail.trim(),attachments:prepared})})
      const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result?.error||"No se pudo enviar el email.")
      if(result.mode==="mailto"&&result.mailto){onSent?.("Abrí tu aplicación de correo con el mensaje preparado.");window.location.href=result.mailto;return}
      onSent?.("Email enviado al huésped.");onClose?.()
    }catch(err){setError(err?.message||"No se pudo enviar el email.")}finally{setBusy(false)}
  }

  const field={minHeight:38,border:0,borderBottom:"1px solid var(--line)",background:"transparent",color:"var(--text)",font:"inherit",fontSize:12,outline:"none",padding:"8px 3px"},tool={height:30,minWidth:30,padding:"0 8px",border:"1px solid transparent",borderRadius:7,background:"transparent",color:"var(--text)",font:"inherit",fontSize:11,fontWeight:800,cursor:"pointer"},select={height:34,border:"1px solid var(--line)",borderRadius:8,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:11,padding:"0 8px",maxWidth:210}
  return <div style={{position:"fixed",inset:0,zIndex:290,display:"grid",placeItems:"center",padding:14,background:"rgba(12,20,38,.34)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)"}} onMouseDown={event=>event.target===event.currentTarget&&!busy&&onClose?.()}>
    <section style={{width:"min(900px,calc(100vw - 24px))",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",border:"1px solid color-mix(in srgb,#fff 36%,var(--line))",borderRadius:20,background:"color-mix(in srgb,var(--panelSolid) 96%,transparent)",boxShadow:"0 34px 100px rgba(20,30,55,.32)",backdropFilter:"blur(30px) saturate(1.4)"}} role="dialog" aria-modal="true" aria-label="Nuevo correo al huésped">
      <header style={{minHeight:48,padding:"0 14px 0 17px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--line)",background:"color-mix(in srgb,var(--accent) 4%,var(--panelSolid))"}}><div><b style={{fontSize:12}}>Nuevo mensaje</b><small style={{marginLeft:8,color:"var(--muted)",fontSize:10}}>Reserva <b style={{color:"var(--text)"}}>{item?.numero_reserva||item?.id}</b></small></div><button type="button" onClick={onClose} disabled={busy} style={{...tool,fontSize:18}}>×</button></header>
      <div style={{padding:"3px 18px 0",overflow:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"62px 1fr",alignItems:"center"}}><span style={{fontSize:11,color:"var(--muted)"}}>Desde</span><div style={{display:"grid",gridTemplateColumns:"minmax(140px,.6fr) minmax(180px,1fr)",gap:8}}><input value={fromName} onChange={e=>setFromName(e.target.value)} placeholder={hotel} style={field}/><input type="email" value={fromEmail} onChange={e=>setFromEmail(e.target.value)} placeholder="reservas@tu-alojamiento.com" style={field}/></div></div>
        <div style={{display:"grid",gridTemplateColumns:"62px 1fr",alignItems:"center"}}><span style={{fontSize:11,color:"var(--muted)"}}>Para</span><input readOnly value={item?.email_huesped||"Sin email cargado"} style={{...field,color:item?.email_huesped?"var(--text)":"var(--red)"}}/></div>
        <div style={{display:"grid",gridTemplateColumns:"62px 1fr",alignItems:"center"}}><span style={{fontSize:11,color:"var(--muted)"}}>Asunto</span><input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={200} placeholder="Asunto" style={field}/></div>
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",padding:"10px 0 8px",borderBottom:"1px solid var(--line)"}}>
          <select defaultValue="" onChange={e=>{insertSnippet(e.target.value);e.target.value=""}} style={select} aria-label="Mensajes rápidos"><option value="">Mensajes</option>{SNIPPETS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
          <select defaultValue="" onChange={e=>{const value=e.target.value;if(value.startsWith("saved:"))applySavedTemplate(value.slice(6));else applyBuiltIn(value);e.target.value=""}} style={{...select,maxWidth:240}} aria-label="Plantilla de correo"><option value="">Plantilla de correo</option><optgroup label="Habitación Llena">{BUILT_INS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</optgroup>{templates.length?<optgroup label="Plantillas del alojamiento">{templates.map(row=><option key={row.id} value={`saved:${row.id}`}>{row.name}</option>)}</optgroup>:null}</select>
          <select defaultValue="" onChange={e=>{insertToken(e.target.value);e.target.value=""}} style={select} aria-label="Contenido dinámico"><option value="">Contenido dinámico</option>{TOKENS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><span style={{width:1,height:22,background:"var(--line)",margin:"0 2px"}}/>
          <button type="button" style={tool} onClick={()=>command("bold")} title="Negrita"><b>B</b></button><button type="button" style={tool} onClick={()=>command("italic")} title="Cursiva"><i>I</i></button><button type="button" style={tool} onClick={()=>command("underline")} title="Subrayado"><u>U</u></button><button type="button" style={tool} onClick={()=>command("strikeThrough")} title="Tachado"><s>S</s></button><button type="button" style={tool} onClick={()=>command("insertUnorderedList")} title="Lista">• ≡</button><button type="button" style={tool} onClick={()=>command("insertOrderedList")} title="Lista numerada">1. ≡</button><button type="button" style={tool} onClick={()=>command("justifyLeft")} title="Alinear izquierda">≡</button><button type="button" style={tool} onClick={()=>command("justifyCenter")} title="Centrar">≡↔</button><button type="button" style={tool} onClick={()=>{const url=window.prompt("Pegá el enlace");if(url)command("createLink",url)}} title="Insertar enlace">↗</button><button type="button" style={tool} onClick={()=>command("removeFormat")} title="Quitar formato">Tx</button>
        </div>
        {activeTemplate==="invoice"?<div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",padding:"9px 0",borderBottom:"1px solid var(--line)"}}><b style={{fontSize:11}}>Factura a adjuntar</b>{invoices.length?<><select value={selectedInvoiceId} onChange={e=>chooseInvoice(e.target.value)} style={{...select,maxWidth:360,minWidth:220}}><option value="">Elegir factura emitida…</option>{invoices.map(doc=><option key={doc.id} value={doc.id}>{doc.number||`Factura #${doc.id}`} · {money(doc.total,doc.currency)} · {fmtDateTime(doc.issued_at||doc.created_at)}</option>)}</select><small style={{fontSize:10,color:"var(--muted)"}}>Se adjunta como PDF.</small></>:<small style={{fontSize:10,color:"var(--red)",fontWeight:800}}>Esta reserva todavía no tiene una factura emitida.</small>}</div>:null}
        <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={syncEditor} data-placeholder="Escribí tu mensaje…" style={{minHeight:320,padding:"18px 5px 26px",outline:"none",fontSize:13,lineHeight:1.58,color:"var(--text)",whiteSpace:"normal",caretColor:"var(--accent)"}}/>
        {attachments.length?<div style={{display:"flex",gap:6,flexWrap:"wrap",padding:"0 0 10px"}}>{attachments.map((row,index)=><span key={`${row.name}-${index}`} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 8px",border:"1px solid var(--line)",borderRadius:9,background:"color-mix(in srgb,var(--accent) 4%,var(--panelSolid))",fontSize:10.5}}>{row.kind==="invoice"?"Factura":"Adjunto"} · {row.name}<button type="button" onClick={()=>{if(row.kind==="invoice")setSelectedInvoiceId("");setAttachments(list=>list.filter((_,i)=>i!==index))}} style={{border:0,background:"transparent",color:"var(--muted)",cursor:"pointer"}}>×</button></span>)}</div>:null}
        {error?<div role="alert" style={{marginBottom:10,padding:"9px 10px",border:"1px solid color-mix(in srgb,var(--red) 30%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--red) 7%,var(--panelSolid))",color:"var(--red)",fontSize:10.5,fontWeight:800}}>{error}</div>:null}
      </div>
      <footer style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 16px 12px",borderTop:"1px solid var(--line)",flexWrap:"wrap"}}><div style={{display:"flex",alignItems:"center",gap:5}}><button type="button" onClick={()=>fileRef.current?.click()} style={{...tool,borderColor:"var(--line)"}} title="Adjuntar archivos">＋ Adjuntar</button><input ref={fileRef} type="file" multiple hidden onChange={addFiles}/><small style={{color:"var(--muted)",fontSize:10}}>Hasta 5 archivos · 3 MB total</small></div><div style={{display:"flex",alignItems:"center",gap:8}}><button type="button" onClick={onClose} disabled={busy} style={{height:38,padding:"0 13px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10.5,fontWeight:850}}>Cancelar</button><button type="button" disabled={busy||!item?.email_huesped} onClick={send} style={{height:38,padding:"0 20px",border:0,borderRadius:10,background:"linear-gradient(145deg,var(--accent),var(--accent2))",color:"#fff",font:"inherit",fontSize:11,fontWeight:900,boxShadow:"0 8px 20px color-mix(in srgb,var(--accent) 24%,transparent)",opacity:(busy||!item?.email_huesped)?0.62:1}}>{busy?"Enviando…":"Enviar"}</button></div></footer>
    </section>
  </div>
}
