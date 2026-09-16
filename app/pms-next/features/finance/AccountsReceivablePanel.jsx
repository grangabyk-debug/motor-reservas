"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./accountsReceivable.module.css"

const KIND_LABELS={company:"Empresa",agency:"Agencia",wholesaler:"Mayorista",corporate:"Corporativa"}
const OPEN_STATUSES=new Set(["issued","partial"])
const emptyPartner=()=>({id:null,kind:"company",name:"",tax_id:"",contact_name:"",email:"",phone:"",commission_percent:0,credit_limit:0,billing_terms:"",negotiated_rate_label:"",notes:"",active:true})
const localIso=date=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10)
const todayIso=()=>localIso(new Date())
const plusDays=days=>{const date=new Date();date.setDate(date.getDate()+days);return localIso(date)}
function money(value,currency="ARS"){try{return new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)}catch{return`${currency} ${Number(value)||0}`}}
function dueDateFor(partner){const text=String(partner?.billing_terms||"").toLowerCase();if(text.includes("contado"))return todayIso();const match=text.match(/\d+/);return plusDays(match?Math.max(0,Number(match[0])||0):30)}
function groupedMoney(rows,valueKey="balance"){
  const map=new Map()
  for(const row of rows){const currency=row.currency||"ARS";map.set(currency,(map.get(currency)||0)+Math.max(0,Number(row[valueKey])||0))}
  return[...map.entries()].filter(([,value])=>value>.009).map(([currency,value])=>money(value,currency)).join(" · ")||money(0,"ARS")
}

export default function AccountsReceivablePanel({propertyId,onNavigate}){
  const[partners,setPartners]=useState([]),[documents,setDocuments]=useState([]),[reservations,setReservations]=useState([]),[baseCurrency,setBaseCurrency]=useState("ARS")
  const[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("")
  const[partnerOpen,setPartnerOpen]=useState(false),[partnerDraft,setPartnerDraft]=useState(emptyPartner)
  const[accountOpen,setAccountOpen]=useState(false),[accountDraft,setAccountDraft]=useState({partner_id:"",reservation_id:"",due_at:"",notes:""})
  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const[partnerRes,docRes,resRes,settingsRes]=await Promise.all([
        supabase.from("hotel_partners").select("id,kind,name,tax_id,contact_name,email,phone,commission_percent,credit_limit,billing_terms,negotiated_rate_label,notes,active,created_at,updated_at").eq("property_id",propertyId).order("active",{ascending:false}).order("name"),
        supabase.from("hotel_finance_documents").select("id,partner_id,reservation_id,folio_id,document_type,number,status,currency,total,balance,billing_to,due_at,issued_at,created_at").eq("property_id",propertyId).not("partner_id","is",null).order("created_at",{ascending:false}).limit(300),
        supabase.from("reservas").select("id,numero_reserva,nombre_huesped,partner_id,precio_total,precio_sin_impuestos_nacionales,iva_importe,iva_porcentaje,impuestos_desglosados,moneda,fecha_entrada,fecha_salida,estado").eq("property_id",propertyId).not("partner_id","is",null).neq("estado","cancelada").neq("estado","fusionada").order("created_at",{ascending:false}).limit(300),
        supabase.from("property_settings").select("settings").eq("property_id",propertyId).maybeSingle(),
      ])
      for(const result of[partnerRes,docRes,resRes,settingsRes])if(result.error)throw result.error
      setPartners(partnerRes.data||[]);setDocuments(docRes.data||[]);setReservations(resRes.data||[]);setBaseCurrency(settingsRes.data?.settings?.preferences?.currency||"ARS")
    }catch(err){setError(err?.message||"No se pudieron cargar empresas y cuentas.")}
    finally{setLoading(false)}
  },[propertyId])
  useEffect(()=>{load()},[load])
  useEffect(()=>{if(typeof window==="undefined")return;let timer=null;const refresh=()=>{if(timer)clearTimeout(timer);timer=setTimeout(load,120)};window.addEventListener("hl:pms-payment-updated",refresh);window.addEventListener("hl:pms-data-updated",refresh);return()=>{if(timer)clearTimeout(timer);window.removeEventListener("hl:pms-payment-updated",refresh);window.removeEventListener("hl:pms-data-updated",refresh)}},[load])

  const openDocs=useMemo(()=>documents.filter(doc=>OPEN_STATUSES.has(String(doc.status||"").toLowerCase())&&Number(doc.balance||0)>.009),[documents])
  const overdueDocs=useMemo(()=>{const today=todayIso();return openDocs.filter(doc=>doc.due_at&&doc.due_at<today)},[openDocs])
  const reservationsByPartner=useMemo(()=>{const map=new Map();for(const reservation of reservations){const key=String(reservation.partner_id||"");if(!key)continue;if(!map.has(key))map.set(key,[]);map.get(key).push(reservation)}return map},[reservations])
  const docsByPartner=useMemo(()=>{const map=new Map();for(const doc of documents){const key=String(doc.partner_id||"");if(!key)continue;if(!map.has(key))map.set(key,[]);map.get(key).push(doc)}return map},[documents])
  const activePartners=partners.filter(row=>row.active!==false)

  function openPartner(row=null){setError("");setNotice("");setPartnerDraft(row?{...row}:emptyPartner());setPartnerOpen(true)}
  async function savePartner(){
    if(!partnerDraft.name.trim()||saving)return
    setSaving(true);setError("");setNotice("")
    try{
      const payload={property_id:propertyId,kind:partnerDraft.kind||"company",name:partnerDraft.name.trim(),tax_id:partnerDraft.tax_id?.trim()||null,contact_name:partnerDraft.contact_name?.trim()||null,email:partnerDraft.email?.trim()||null,phone:partnerDraft.phone?.trim()||null,commission_percent:Math.max(0,Number(partnerDraft.commission_percent)||0),credit_limit:Math.max(0,Number(partnerDraft.credit_limit)||0),billing_terms:partnerDraft.billing_terms?.trim()||null,negotiated_rate_label:partnerDraft.negotiated_rate_label?.trim()||null,notes:partnerDraft.notes?.trim()||null,active:partnerDraft.active!==false,updated_at:new Date().toISOString()}
      const result=partnerDraft.id?await supabase.from("hotel_partners").update(payload).eq("id",partnerDraft.id).eq("property_id",propertyId):await supabase.from("hotel_partners").insert(payload)
      if(result.error)throw result.error
      setPartnerOpen(false);setNotice(partnerDraft.id?"Cuenta comercial actualizada.":"Empresa o agencia creada.");await load()
    }catch(err){setError(err?.message||"No se pudo guardar la cuenta comercial.")}
    finally{setSaving(false)}
  }
  async function togglePartner(row){
    setError("");setNotice("")
    const next=row.active===false
    try{const{error:updateError}=await supabase.from("hotel_partners").update({active:next,updated_at:new Date().toISOString()}).eq("id",row.id).eq("property_id",propertyId);if(updateError)throw updateError;setNotice(next?"Cuenta reactivada.":"Cuenta archivada.");await load()}catch(err){setError(err?.message||"No se pudo actualizar la cuenta.")}
  }
  function openAccount(partner){
    const linked=reservationsByPartner.get(String(partner.id))||[]
    setError("");setNotice("");setAccountDraft({partner_id:partner.id,reservation_id:linked[0]?String(linked[0].id):"",due_at:dueDateFor(partner),notes:""});setAccountOpen(true)
  }
  async function ensureCommercialFolio(partner,reservation){
    const payerType=partner.kind==="agency"||partner.kind==="wholesaler"?"agency":"company"
    const ensure=await supabase.rpc("hl_ensure_reservation_folios",{p_reservation_id:Number(reservation.id)});if(ensure.error)throw ensure.error
    const{data:folios,error:folioError}=await supabase.from("hotel_folios").select("id,payer_type,payer_name,status").eq("property_id",propertyId).eq("reservation_id",Number(reservation.id)).neq("status","void");if(folioError)throw folioError
    const existing=(folios||[]).find(row=>row.payer_type===payerType&&String(row.payer_name||"").trim().toLowerCase()===String(partner.name||"").trim().toLowerCase())
    if(existing)return existing.id
    const{data,error:createError}=await supabase.rpc("hl_create_reservation_folio",{p_reservation_id:Number(reservation.id),p_label:`${payerType==="agency"?"Agencia":"Empresa"} · ${partner.name}`,p_payer_type:payerType,p_payer_name:partner.name});if(createError)throw createError
    if(!data?.id)throw new Error("No se pudo resolver el folio comercial de la reserva.")
    return data.id
  }
  async function createAccount(){
    if(saving)return
    const partner=partners.find(row=>String(row.id)===String(accountDraft.partner_id)),reservation=reservations.find(row=>String(row.id)===String(accountDraft.reservation_id))
    if(!partner||!reservation){setError("Elegí una empresa/agencia y una reserva vinculada.");return}
    if(documents.some(doc=>String(doc.partner_id)===String(partner.id)&&Number(doc.reservation_id)===Number(reservation.id)&&doc.document_type==="invoice"&&doc.status!=="void")){setError("Esta reserva ya tiene una factura/cuenta asociada a esta empresa o agencia.");return}
    setSaving(true);setError("");setNotice("")
    try{
      const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError
      const total=Math.max(0,Number(reservation.precio_total)||0),storedTax=Math.max(0,Number(reservation.iva_importe)||0),storedNet=Number(reservation.precio_sin_impuestos_nacionales),subtotal=Number.isFinite(storedNet)&&storedNet>0?storedNet:Math.max(0,total-storedTax),tax=Math.max(0,total-subtotal),rate=Math.max(0,Number(reservation.iva_porcentaje)||0)
      if(total<=0)throw new Error("La reserva no tiene un total facturable.")
      const folioId=await ensureCommercialFolio(partner,reservation)
      const payload={property_id:propertyId,reservation_id:Number(reservation.id),folio_id:folioId,partner_id:partner.id,document_type:"invoice",number:null,status:"issued",currency:reservation.moneda||baseCurrency,subtotal,tax,total,balance:total,billing_to:{name:partner.name,tax_id:partner.tax_id||null,email:partner.email||null,phone:partner.phone||null,contact_name:partner.contact_name||null},items:[{description:`Estadía ${reservation.fecha_entrada} → ${reservation.fecha_salida} · ${reservation.nombre_huesped||"Huésped"}`,quantity:1,unit_price:subtotal,tax_rate:rate,subtotal,tax,total}],folio_item_ids:[],issued_at:new Date().toISOString(),due_at:accountDraft.due_at||null,notes:accountDraft.notes?.trim()||null,created_by:userData?.user?.id||null,billing_mode:"manual"}
      const{error:insertError}=await supabase.from("hotel_finance_documents").insert(payload);if(insertError)throw insertError
      setAccountOpen(false);setNotice(`Cuenta creada para ${partner.name} y vinculada a su folio comercial.`);await load()
    }catch(err){setError(err?.message||"No se pudo crear la cuenta por cobrar.")}
    finally{setSaving(false)}
  }
  function openDocuments(){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-finance-tab",{detail:"documents"}))}
  function openReservation(id){if(!id)return;if(onNavigate)return onNavigate("reservations",{reservationId:Number(id),restoreScroll:false});if(typeof window!=="undefined"){const url=new URL(window.location.href);url.searchParams.set("view","reservations");url.searchParams.set("reservation",String(id));window.history.pushState({pmsView:"reservations"},"",url);window.dispatchEvent(new PopStateEvent("popstate"))}}

  return <div className={s.body}>
    <div className={s.metrics}><article><span>Empresas y agencias activas</span><b>{activePartners.length}</b><small>{partners.length-activePartners.length} archivada{partners.length-activePartners.length===1?"":"s"}</small></article><article><span>Por cobrar</span><b>{groupedMoney(openDocs)}</b><small>{openDocs.length} documento{openDocs.length===1?"":"s"} abierto{openDocs.length===1?"":"s"}</small></article><article><span>Vencido</span><b>{groupedMoney(overdueDocs)}</b><small>{overdueDocs.length} documento{overdueDocs.length===1?"":"s"}</small></article><article><span>Reservas vinculadas</span><b>{reservations.length}</b><small>Con cuenta comercial asignada</small></article></div>
    <div className={s.actions}><button type="button" className={s.primary} onClick={()=>openPartner()}>+ Empresa o agencia</button><button type="button" onClick={openDocuments}>Abrir facturación</button></div>
    {error?<div className={s.error}>{error}</div>:null}{notice?<div className={s.notice}>{notice}</div>:null}
    {loading?<div className={s.empty}>Cargando empresas y cuentas…</div>:!partners.length?<div className={s.empty}><b>Todavía no hay empresas ni agencias.</b><span>Creá la primera cuenta comercial para vincular reservas, condiciones de crédito y facturación.</span><button type="button" onClick={()=>openPartner()}>Crear cuenta comercial</button></div>:<div className={s.grid}>{partners.map(partner=>{
      const partnerDocs=docsByPartner.get(String(partner.id))||[],pending=partnerDocs.filter(doc=>OPEN_STATUSES.has(String(doc.status||"").toLowerCase())&&Number(doc.balance||0)>.009),overdue=pending.filter(doc=>doc.due_at&&doc.due_at<todayIso()),linked=reservationsByPartner.get(String(partner.id))||[],basePending=pending.filter(doc=>(doc.currency||baseCurrency)===baseCurrency).reduce((sum,doc)=>sum+Number(doc.balance||0),0),available=Number(partner.credit_limit)>0?Math.max(0,Number(partner.credit_limit)-basePending):null
      return <article key={partner.id} className={s.partner} data-inactive={partner.active===false}><header><div><small>{KIND_LABELS[partner.kind]||"Cuenta"}</small><h3>{partner.name}</h3><p>{partner.tax_id||partner.contact_name||"Sin identificación fiscal"}</p></div><span className={partner.active===false?s.archived:s.active}>{partner.active===false?"Archivada":"Activa"}</span></header><div className={s.partnerStats}><div><span>Por cobrar</span><b>{groupedMoney(pending)}</b></div><div><span>Vencido</span><b>{groupedMoney(overdue)}</b></div><div><span>Reservas</span><b>{linked.length}</b></div><div><span>Límite</span><b>{Number(partner.credit_limit)>0?money(partner.credit_limit,baseCurrency):"Sin límite"}</b>{available!=null?<small>Disponible {money(available,baseCurrency)}</small>:null}</div></div><div className={s.meta}>{partner.billing_terms?<span>{partner.billing_terms}</span>:null}{Number(partner.commission_percent)>0?<span>Comisión {Number(partner.commission_percent)}%</span>:null}{partner.negotiated_rate_label?<span>{partner.negotiated_rate_label}</span>:null}</div>{pending.length?<div style={{display:"grid",gap:6,margin:"10px 0",padding:"9px",border:"1px solid var(--line)",borderRadius:11,background:"color-mix(in srgb,var(--panelSolid) 72%,transparent)"}}>{pending.slice(0,3).map(doc=><div key={doc.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,fontSize:10}}><span style={{minWidth:0}}><b style={{display:"block"}}>{doc.number||"Cuenta abierta"} · {money(doc.balance,doc.currency)}</b><small style={{color:"var(--muted)"}}>{doc.due_at?`Vence ${doc.due_at}`:"Sin vencimiento"}</small></span><button type="button" onClick={()=>openReservation(doc.reservation_id)} disabled={!doc.reservation_id} style={{height:30,padding:"0 9px",border:"1px solid var(--line)",borderRadius:8,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:9.5,fontWeight:850}}>Abrir reserva</button></div>)}{pending.length>3?<small style={{color:"var(--muted)"}}>+ {pending.length-3} cuenta{pending.length-3===1?"":"s"} abierta{pending.length-3===1?"":"s"}</small>:null}</div>:null}<footer><button type="button" onClick={()=>openPartner(partner)}>Editar</button><button type="button" onClick={()=>openAccount(partner)} disabled={partner.active===false||!linked.length}>Nueva cuenta</button><button type="button" onClick={()=>togglePartner(partner)}>{partner.active===false?"Reactivar":"Archivar"}</button></footer>{!linked.length&&partner.active!==false?<p className={s.hint}>Vinculá esta cuenta desde una reserva para poder generar crédito.</p>:null}</article>
    })}</div>}

    {partnerOpen?<div className={s.backdrop} onClick={()=>setPartnerOpen(false)}><div className={s.modal} onClick={event=>event.stopPropagation()}><button className={s.close} type="button" onClick={()=>setPartnerOpen(false)}>×</button><small>CUENTA COMERCIAL</small><h2>{partnerDraft.id?"Editar empresa o agencia":"Nueva empresa o agencia"}</h2><div className={s.form}><label>Tipo<select value={partnerDraft.kind} onChange={e=>setPartnerDraft({...partnerDraft,kind:e.target.value})}><option value="company">Empresa</option><option value="agency">Agencia</option><option value="wholesaler">Mayorista</option><option value="corporate">Corporativa</option></select></label><label>Razón social / nombre<input value={partnerDraft.name} onChange={e=>setPartnerDraft({...partnerDraft,name:e.target.value})}/></label><label>CUIT / identificación fiscal<input value={partnerDraft.tax_id||""} onChange={e=>setPartnerDraft({...partnerDraft,tax_id:e.target.value})}/></label><label>Contacto<input value={partnerDraft.contact_name||""} onChange={e=>setPartnerDraft({...partnerDraft,contact_name:e.target.value})}/></label><label>Email<input type="email" value={partnerDraft.email||""} onChange={e=>setPartnerDraft({...partnerDraft,email:e.target.value})}/></label><label>Teléfono<input value={partnerDraft.phone||""} onChange={e=>setPartnerDraft({...partnerDraft,phone:e.target.value})}/></label><label>Límite de crédito ({baseCurrency})<input type="number" min="0" step="0.01" value={partnerDraft.credit_limit||0} onChange={e=>setPartnerDraft({...partnerDraft,credit_limit:e.target.value})}/></label><label>Comisión %<input type="number" min="0" step="0.01" value={partnerDraft.commission_percent||0} onChange={e=>setPartnerDraft({...partnerDraft,commission_percent:e.target.value})}/></label><label>Condición de pago<input placeholder="Ej. 30 días" value={partnerDraft.billing_terms||""} onChange={e=>setPartnerDraft({...partnerDraft,billing_terms:e.target.value})}/></label><label>Tarifa negociada<input placeholder="Ej. Corporativa 2026" value={partnerDraft.negotiated_rate_label||""} onChange={e=>setPartnerDraft({...partnerDraft,negotiated_rate_label:e.target.value})}/></label><label className={s.wide}>Notas<textarea rows="3" value={partnerDraft.notes||""} onChange={e=>setPartnerDraft({...partnerDraft,notes:e.target.value})}/></label></div><button className={s.primary} type="button" disabled={saving||!partnerDraft.name.trim()} onClick={savePartner}>{saving?"Guardando…":"Guardar cuenta"}</button></div></div>:null}

    {accountOpen?<div className={s.backdrop} onClick={()=>setAccountOpen(false)}><div className={s.modal} onClick={event=>event.stopPropagation()}><button className={s.close} type="button" onClick={()=>setAccountOpen(false)}>×</button><small>CUENTA POR COBRAR</small><h2>Generar crédito</h2>{(()=>{const partner=partners.find(row=>String(row.id)===String(accountDraft.partner_id)),linked=reservationsByPartner.get(String(accountDraft.partner_id))||[];return <><div className={s.accountIntro}><b>{partner?.name||"Cuenta comercial"}</b><span>{partner?.billing_terms||"Definí el vencimiento de esta cuenta."}</span></div><div className={s.form}><label className={s.wide}>Reserva<select value={accountDraft.reservation_id} onChange={e=>setAccountDraft({...accountDraft,reservation_id:e.target.value})}><option value="">Elegir reserva</option>{linked.map(row=><option key={row.id} value={row.id}>{row.numero_reserva||`#${row.id}`} · {row.nombre_huesped} · {money(row.precio_total,row.moneda||baseCurrency)}</option>)}</select></label><label>Vencimiento<input type="date" value={accountDraft.due_at} onChange={e=>setAccountDraft({...accountDraft,due_at:e.target.value})}/></label><label className={s.wide}>Nota<textarea rows="3" value={accountDraft.notes} onChange={e=>setAccountDraft({...accountDraft,notes:e.target.value})}/></label></div><button type="button" className={s.primary} disabled={saving||!accountDraft.reservation_id} onClick={createAccount}>{saving?"Creando…":"Crear cuenta por cobrar"}</button></>})()}</div></div>:null}
  </div>
}
