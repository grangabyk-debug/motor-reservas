"use client"

import{useEffect,useMemo,useState}from"react"
import{money}from"../../core/formatters"
import{createReservationProforma,issueInternalDocument,loadReservationFinanceDocuments}from"../../services/finance"
import s from"./reservation-finance-documents.module.css"

const TYPES={invoice_draft:"Proforma",receipt:"Recibo interno",credit_note:"Nota de crédito",invoice:"Factura"}
const STATUS={draft:"BORRADOR",issued:"EMITIDO",paid:"PAGADO",void:"ANULADO"}
const isParking=item=>item?.resource_category==="parking"||item?.kind==="parking"

export default function ReservationFinanceDocuments({draft,totals}){
  const[documents,setDocuments]=useState([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(""),[message,setMessage]=useState("")
  async function load(){if(!draft?.id)return;setLoading(true);setMessage("");try{setDocuments(await loadReservationFinanceDocuments({reservationId:draft.id}))}catch(error){setMessage(error.message||"No se pudieron cargar los documentos.")}finally{setLoading(false)}}
  useEffect(()=>{load()},[draft?.id])
  const currency=draft?.currency||"ARS"
  const items=useMemo(()=>{const lines=[];if(Number(totals?.stay||0)>0)lines.push({description:draft?.stayType==="day_use"?"Day Use":`Alojamiento · ${Number(totals?.nights||0)} noche(s)`,quantity:1,unit_price:Number(totals.stay),total:Number(totals.stay)});for(const item of draft?.extras||[]){const total=Number(item?.total??item?.amount??0);if(total>0)lines.push({description:item?.name||"Extra",quantity:Number(item?.quantity||1),unit_price:Number(item?.unit_price??total/Math.max(1,Number(item?.quantity||1))),total})}if(!(draft?.extras||[]).some(isParking)&&Number(totals?.parking||0)>0)lines.push({description:"Cochera",quantity:1,unit_price:Number(totals.parking),total:Number(totals.parking)});for(const pet of draft?.pets||[]){const total=Number(pet?.amount||0);if(total>0)lines.push({description:pet?.name?`Mascota · ${pet.name}`:"Mascota",quantity:1,unit_price:total,total})}return lines},[draft?.id,draft?.stayType,draft?.extras,draft?.pets,totals?.stay,totals?.parking,totals?.nights])
  async function createProforma(){if(busy)return;setBusy("create");setMessage("");try{await createReservationProforma({reservationId:draft.id,guestName:draft.guest,currency,items});setMessage("Proforma creada. Quedó vinculada a esta reserva.");await load()}catch(error){setMessage(error.message||"No se pudo crear la proforma.")}finally{setBusy("")}}
  async function issue(document){if(busy)return;setBusy(document.id);setMessage("");try{await issueInternalDocument({propertyId:document.property_id,id:document.id});setMessage("Documento interno emitido.");await load()}catch(error){setMessage(error.message||"No se pudo emitir el documento.")}finally{setBusy("")}}
  if(!draft?.id)return null
  return <section className={s.card}>
    <header><div><small>FACTURA / PROFORMA</small><h4>Documentos de la cuenta</h4><p>La proforma es interna. La factura fiscal se emite por ARCA cuando la integración esté configurada.</p></div><button type="button" onClick={createProforma} disabled={busy==="create"||!items.length}>{busy==="create"?"Creando…":"＋ Proforma"}</button></header>
    {message&&<div className={s.message}>{message}</div>}
    <div className={s.list}>{loading&&<div className={s.empty}>Cargando documentos…</div>}{!loading&&!documents.length&&<div className={s.empty}>Todavía no hay facturas, proformas ni recibos vinculados a esta reserva.</div>}{documents.map(document=><article key={document.id}><div className={s.docIcon}>▤</div><span><b>{document.number||TYPES[document.document_type]||document.document_type}</b><small>{TYPES[document.document_type]||document.document_type} · {document.issued_at?new Date(document.issued_at).toLocaleDateString("es-AR"):"sin emitir"}</small></span><strong>{money(document.total,document.currency)}</strong><em data-status={document.status}>{STATUS[document.status]||String(document.status||"").toUpperCase()}</em>{document.status==="draft"&&<button type="button" onClick={()=>issue(document)} disabled={busy===document.id}>{busy===document.id?"…":"Emitir interno"}</button>}</article>)}</div>
  </section>
}
