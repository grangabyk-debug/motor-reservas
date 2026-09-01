"use client"

import{openReservationDocument}from"../../services/reservationDocuments"
import d from"./guest-documents.module.css"

const KIND={documento:"Documento",dni:"DNI",pasaporte:"Pasaporte",licencia:"Licencia",voucher:"Voucher",autorizacion:"Autorización",otro:"Otro"}
const ROLE={primary:"Huésped principal",companion:"Acompañante",company:"Empresa / agencia",reservation:"Reserva"}
const fileSize=value=>{const n=Number(value||0);return n>1048576?`${(n/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(n/1024))} KB`}
const dateLabel=value=>{if(!value)return"";try{return new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(value))}catch{return""}}

export default function GuestDocumentLibrary({documents=[]}){
  const rows=[...documents].sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||"")))
  return <div className={d.library}><div className={d.summary}><span><b>Documentación reutilizable</b><small>Los documentos personales vinculados a la ficha quedan disponibles entre estadías sin duplicar archivos.</small></span><em>{rows.length} {rows.length===1?"archivo":"archivos"}</em></div>{rows.length?<div className={d.list}>{rows.map(doc=><div className={d.row} key={doc.id}><span className={d.file}><b>{doc.file_name}</b><small>{KIND[doc.kind]||doc.kind||"Documento"} · {fileSize(doc.stored_size_bytes)} · {dateLabel(doc.created_at)}</small></span><span className={d.meta}><b>{doc.holder_name||ROLE[doc.holder_role]||"Huésped"}</b><small>{ROLE[doc.holder_role]||"Documento de reserva"}{doc.reserva_id?` · Reserva ${doc.reserva_id}`:""}</small></span><button type="button" className={d.open} onClick={()=>openReservationDocument(doc)}>Abrir</button></div>)}</div>:<div className={d.empty}>Todavía no hay DNI, pasaporte u otra documentación personal vinculada a esta ficha. Los próximos documentos personales cargados desde una reserva se asociarán automáticamente al huésped.</div>}</div>
}
