"use client"

import{useMemo,useState}from"react"
import s from"./pipeline-intelligence.module.css"

const HOUR=3600000
const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase()
const cleanPhone=value=>String(value||"").replace(/\D/g,"")
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const when=value=>{if(!value)return"Sin actividad";const ms=Date.now()-new Date(value).getTime();if(!Number.isFinite(ms))return"Sin actividad";const hours=Math.max(0,Math.floor(ms/HOUR));if(hours<1)return"Ahora";if(hours<24)return`Hace ${hours} h`;const days=Math.floor(hours/24);return`Hace ${days} d`}
const date=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):"—"
const reservationState=r=>normalize(r?.estado||r?.status)
const cancelled=r=>{const state=reservationState(r);return state.includes("cancel")||state.includes("no show")||state.includes("no_show")||Boolean(r?.no_show)}
const guestName=r=>r?.nombre_huesped||r?.huesped_nombre||r?.guest_name||r?.nombre||"Huésped"
const reservationCurrency=r=>String(r?.moneda||r?.currency||"ARS").toUpperCase()
const reservationValue=r=>Number(r?.precio_total||r?.total||0)
const contactKey=item=>{const email=normalize(item?.contact_email||item?.email);if(email)return`e:${email}`;const phone=cleanPhone(item?.contact_phone||item?.phone);return phone?`p:${phone.slice(-10)}`:""}
const intentWords=["quiero reservar","hacer la reserva","como reservo","pasame el link","pasame link","confirmar la reserva","quiero avanzar","senar","seña","transferencia","pagar","reservo"]
const qualifiedWords=["disponibilidad","disponible","habitacion","habitación","noche","noches","fecha","fechas","adultos","personas","huespedes","huéspedes","check in","check-in"]
const stageOrder=["new","qualified","quoted","interested","payment","reserved","lost"]
const stages={
  new:{label:"Nueva consulta",short:"Nueva",tone:"slate",hint:"Todavía falta entender la necesidad."},
  qualified:{label:"Calificada",short:"Calificada",tone:"blue",hint:"Ya hay señales suficientes para cotizar."},
  quoted:{label:"Cotizada",short:"Cotizada",tone:"violet",hint:"Existe una propuesta enviada o explícita."},
  interested:{label:"Interesado",short:"Interesado",tone:"cyan",hint:"Hay intención concreta de avanzar."},
  payment:{label:"Pago pendiente",short:"Pago pendiente",tone:"amber",hint:"La reserva está encaminada pero falta resolver el pago."},
  reserved:{label:"Reservada",short:"Reservada",tone:"green",hint:"Oportunidad convertida en reserva."},
  lost:{label:"Perdida",short:"Perdida",tone:"red",hint:"Sólo se marca cuando existe una señal explícita."},
}
const explicitStage=value=>{const v=normalize(value);if(!v)return"";if(["lost","perdida","perdido","cancelled","cancelada","cancelado","declined","rejected"].some(x=>v.includes(x)))return"lost";if(["won","booked","reserved","reservada","confirmada","confirmed"].some(x=>v.includes(x)))return"reserved";if(["payment_pending","pago pendiente","pago_pendiente"].some(x=>v.includes(x)))return"payment";if(["interested","interesado","intent","negotiation","negociacion"].some(x=>v.includes(x)))return"interested";if(["quoted","cotizada","cotizado","proposal","propuesta"].some(x=>v.includes(x)))return"quoted";if(["qualified","calificada","calificado"].some(x=>v.includes(x)))return"qualified";return""}
const stageFromReservation=r=>{if(!r)return"";if(cancelled(r))return"lost";const state=reservationState(r);if(state.includes("pend")||state.includes("tent")||state.includes("hold")||state.includes("opcion"))return"payment";return"reserved"}
const quoteStage=quote=>{const status=normalize(quote?.status);if(status==="accepted"||status.includes("acept"))return"interested";if(status==="sent"||status.includes("envi"))return"quoted";if(status==="rejected"||status.includes("rechaz"))return"lost";return quote?"qualified":""}
const latest=(a,b)=>new Date(a||0).getTime()>new Date(b||0).getTime()?a:b
const firstName=value=>String(value||"Huésped").trim().split(/\s+/)[0]||"Huésped"

function classify({conversation,group,quote,reservation,messages}){
  const explicit=explicitStage(group?.sales_stage||group?.status),fromReservation=stageFromReservation(reservation),fromQuote=quoteStage(quote)
  if(fromReservation)return fromReservation
  if(explicit)return explicit
  const inbound=messages.filter(m=>normalize(m.direction)==="inbound"),text=normalize(inbound.slice(-8).map(m=>m.text).join(" ")),intent=intentWords.some(word=>text.includes(normalize(word))),qualified=qualifiedWords.some(word=>text.includes(normalize(word)))||/\b\d{1,2}[\/-]\d{1,2}\b/.test(text)
  if(intent&&["quoted","qualified"].includes(fromQuote))return"interested"
  if(fromQuote)return fromQuote
  if(intent)return"interested"
  if(qualified||group)return"qualified"
  return"new"
}
function suggestedAction(stage,awaitingHotel,due){
  if(stage==="reserved")return"Reserva confirmada"
  if(stage==="lost")return"Registrar aprendizaje"
  if(awaitingHotel)return"Responder consulta"
  if(stage==="new")return"Calificar necesidad"
  if(stage==="qualified")return"Preparar cotización"
  if(stage==="quoted")return due?"Retomar cotización":"Esperar respuesta"
  if(stage==="interested")return due?"Facilitar cierre":"Acompañar decisión"
  if(stage==="payment")return"Resolver pago pendiente"
  return"Revisar oportunidad"
}
function followUpDraft(opportunity){
  const name=firstName(opportunity.name)
  if(opportunity.awaitingHotel)return`Hola ${name}, gracias por escribirnos. Retomo tu consulta para darte una respuesta clara y ayudarte con los próximos pasos.`
  if(opportunity.stage==="new")return`Hola ${name}, gracias por contactarnos. Para ayudarte mejor, ¿me confirmás las fechas de estadía y cuántas personas serían?`
  if(opportunity.stage==="qualified")return`Hola ${name}, ya tengo los datos principales de tu consulta. Si querés, revisamos juntos la mejor opción disponible para esas fechas.`
  if(opportunity.stage==="quoted")return`Hola ${name}, ¿cómo estás? Quería saber si pudiste revisar la propuesta. Si te sirve, puedo ayudarte a avanzar con la reserva o resolver cualquier duda.`
  if(opportunity.stage==="interested")return`Hola ${name}, vi que estabas por avanzar con la estadía. Si querés, te acompaño con el próximo paso para dejar la reserva encaminada.`
  if(opportunity.stage==="payment")return`Hola ${name}, tu reserva está encaminada. Si necesitás ayuda con el paso pendiente para confirmarla, decime y lo revisamos juntos.`
  return`Hola ${name}, quedamos a disposición si querés retomar tu consulta.`
}
function dueHours(stage){return stage==="interested"?6:stage==="payment"?8:stage==="new"?12:stage==="qualified"?18:stage==="quoted"?24:72}
function scoreOpportunity(stage,{awaitingHotel=false,due=false,unread=0,ageHours=0,hasValue=false}={}){let score={new:34,qualified:48,quoted:62,interested:78,payment:86,reserved:20,lost:5}[stage]||20;if(awaitingHotel)score+=18;if(due)score+=11;if(unread>0)score+=Math.min(9,unread*3);if(hasValue)score+=5;if(ageHours>72&&stage!=="lost")score-=8;return Math.max(0,Math.min(100,score))}
function stageReason({stage,reservation,quote,group,intent,qualified}){if(reservation)return cancelled(reservation)?"Reserva cancelada/no-show":"Reserva vinculada";if(explicitStage(group?.sales_stage||group?.status))return"Etapa comercial registrada";if(quote)return normalize(quote.status)==="sent"?"Presupuesto enviado":normalize(quote.status)==="accepted"?"Presupuesto aceptado":"Presupuesto existente";if(intent)return"Mensaje con intención de reserva";if(qualified)return"Fechas/necesidad detectadas";return stage==="new"?"Consulta sin calificar":"Señales comerciales detectadas"}

function buildOpportunities({conversations,messages,quotes,groups,reservations}){
  const messagesByConversation=new Map();for(const message of messages){const id=String(message.conversation_id),list=messagesByConversation.get(id)||[];list.push(message);messagesByConversation.set(id,list)}
  const reservationsById=new Map(reservations.map(r=>[String(r.id),r])),reservationsByGroup=new Map();for(const r of reservations){if(r.group_id&&!cancelled(r))reservationsByGroup.set(String(r.group_id),r)}
  const quotesByGroup=new Map();for(const q of [...quotes].sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at))){const key=String(q.group_id||"");if(key&&!quotesByGroup.has(key))quotesByGroup.set(key,q)}
  const groupsById=new Map(groups.map(g=>[String(g.id),g])),groupsByContact=new Map();for(const g of groups){const key=contactKey(g);if(key&&!groupsByContact.has(key))groupsByContact.set(key,g)}
  const usedGroups=new Set(),rows=[]
  for(const conversation of conversations){const list=(messagesByConversation.get(String(conversation.id))||[]).sort((a,b)=>new Date(a.occurred_at||a.created_at)-new Date(b.occurred_at||b.created_at)),group=groupsByContact.get(contactKey(conversation))||null;if(group)usedGroups.add(String(group.id));const quote=group?quotesByGroup.get(String(group.id))||null:null,reservation=reservationsById.get(String(conversation.reservation_id||""))||(group?reservationsByGroup.get(String(group.id))||null:null);rows.push(makeOpportunity({conversation,group,quote,reservation,messages:list}))}
  for(const group of groups){if(usedGroups.has(String(group.id)))continue;const quote=quotesByGroup.get(String(group.id))||null,reservation=reservationsByGroup.get(String(group.id))||null;rows.push(makeOpportunity({conversation:null,group,quote,reservation,messages:[]}))}
  return rows.sort((a,b)=>b.score-a.score||new Date(b.lastActivity||0)-new Date(a.lastActivity||0))
}
function makeOpportunity({conversation,group,quote,reservation,messages}){
  const inbound=messages.filter(m=>normalize(m.direction)==="inbound"),outbound=messages.filter(m=>normalize(m.direction)==="outbound"),lastInbound=inbound.at(-1),lastOutbound=outbound.at(-1),lastInboundAt=lastInbound?.occurred_at||lastInbound?.created_at,lastOutboundAt=lastOutbound?.occurred_at||lastOutbound?.created_at,lastActivity=[conversation?.last_message_at,group?.updated_at,quote?.updated_at,quote?.created_at,reservation?.created_at].filter(Boolean).reduce((a,b)=>latest(a,b),"")||conversation?.created_at||group?.created_at||"",awaitingHotel=Boolean(lastInboundAt&&(!lastOutboundAt||new Date(lastInboundAt)>new Date(lastOutboundAt))),text=normalize(inbound.slice(-8).map(m=>m.text).join(" ")),intent=intentWords.some(word=>text.includes(normalize(word))),qualified=qualifiedWords.some(word=>text.includes(normalize(word)))||/\b\d{1,2}[\/-]\d{1,2}\b/.test(text),stage=classify({conversation,group,quote,reservation,messages}),ageHours=lastActivity?Math.max(0,(Date.now()-new Date(lastActivity).getTime())/HOUR):999,due=!['reserved','lost'].includes(stage)&&(awaitingHotel||ageHours>=dueHours(stage)),currency=String(quote?.currency||group?.budget_currency||reservationCurrency(reservation)||"ARS").toUpperCase(),value=Number(quote?.total||group?.budget_total||reservationValue(reservation)||0),name=conversation?.contact_name||group?.contact_name||guestName(reservation),unread=Number(conversation?.unread_count||0),score=scoreOpportunity(stage,{awaitingHotel,due,unread,ageHours,hasValue:value>0})
  return{id:conversation?`conversation:${conversation.id}`:`group:${group?.id||quote?.id}`,conversationId:conversation?.id||null,groupId:group?.id||null,reservationId:reservation?.id||conversation?.reservation_id||null,name,contact:conversation?.contact_phone||conversation?.contact_email||group?.contact_phone||group?.contact_email||"Sin contacto",channel:conversation?.channel||group?.kind||"Comercial",stage,value,currency,lastActivity,awaitingHotel,due,unread,score,action:suggestedAction(stage,awaitingHotel,due),reason:stageReason({stage,reservation,quote,group,intent,qualified}),arrival:reservation?.fecha_entrada||group?.arrival_date||"",departure:reservation?.fecha_salida||group?.departure_date||"",quoteNumber:quote?.quote_number||"",draft:""}
}
function priorityLabel(score){return score>=82?"Crítica":score>=68?"Alta":score>=48?"Media":"Baja"}
function StagePill({stage}){const meta=stages[stage]||stages.new;return <span className={s.stagePill} data-tone={meta.tone}>{meta.label}</span>}
function Meter({value}){return <span className={s.meter} aria-label={`Prioridad ${value} de 100`}><i style={{width:`${value}%`}}/></span>}
function Kpi({label,value,detail,tone}){return <article className={s.kpi} data-tone={tone}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>}

export default function PipelineIntelligence({reservations=[],conversations=[],messages=[],quotes=[],groups=[]}){
  const opportunities=useMemo(()=>buildOpportunities({reservations,conversations,messages,quotes,groups}),[reservations,conversations,messages,quotes,groups]),currencies=useMemo(()=>[...new Set(opportunities.map(o=>o.currency).filter(Boolean))],[opportunities]),[currency,setCurrency]=useState(currencies[0]||"ARS"),[filter,setFilter]=useState("active"),[query,setQuery]=useState(""),[selectedId,setSelectedId]=useState(""),[copied,setCopied]=useState("")
  const selectedCurrency=currencies.includes(currency)?currency:(currencies[0]||"ARS"),active=opportunities.filter(o=>!['reserved','lost'].includes(o.stage)),due=active.filter(o=>o.due),hot=active.filter(o=>o.score>=68),pipelineValue=active.filter(o=>o.currency===selectedCurrency).reduce((sum,o)=>sum+o.value,0),converted=opportunities.filter(o=>o.stage==="reserved").length,conversionBase=opportunities.filter(o=>o.stage!=="lost").length,conversion=conversionBase?converted/conversionBase*100:0
  const counts=Object.fromEntries(stageOrder.map(stage=>[stage,opportunities.filter(o=>o.stage===stage).length]))
  const visible=opportunities.filter(o=>{if(filter==="active"&&['reserved','lost'].includes(o.stage))return false;if(filter==="action"&&!o.due)return false;if(filter==="hot"&&o.score<68)return false;if(stageOrder.includes(filter)&&o.stage!==filter)return false;const term=normalize(query);return !term||normalize(`${o.name} ${o.contact} ${o.channel} ${o.quoteNumber} ${o.action}`).includes(term)})
  const focus=selectedId?opportunities.find(o=>o.id===selectedId):null
  function openConversation(id){if(!id||typeof window==="undefined")return;const url=new URL(window.location.href);url.searchParams.set("view","messages");url.searchParams.set("conversation",String(id));window.history.pushState({pmsView:"messages"},"",url);window.dispatchEvent(new PopStateEvent("popstate"))}
  async function copyDraft(opportunity){const text=followUpDraft(opportunity);try{await navigator.clipboard.writeText(text);setCopied(opportunity.id);window.setTimeout(()=>setCopied(""),1800)}catch{setCopied("")}}
  return <main className={s.page}>
    <header className={s.hero}><div><small>PIPELINE INTELIGENTE · FASE 3</small><h1>La próxima venta ya tiene prioridad.</h1><p>El PMS clasifica oportunidades con señales reales de conversaciones, presupuestos y reservas. No duplica el CRM ni inventa estados.</p></div><div className={s.heroPulse}><span>PIPELINE ACTIVO</span><strong>{active.length}</strong><small>{hot.length} de prioridad alta · {due.length} requieren acción</small></div></header>
    <section className={s.kpis}><Kpi label="Oportunidades activas" value={active.length.toLocaleString("es-AR")} detail={`${due.length} con próxima acción vencida`} tone="violet"/><Kpi label="Valor en juego" value={money(pipelineValue,selectedCurrency)} detail={`Sólo valores reales en ${selectedCurrency}`} tone="blue"/><Kpi label="Prioridad alta" value={hot.length.toLocaleString("es-AR")} detail="Intención, etapa, actividad y mensajes" tone="cyan"/><Kpi label="Conversión visible" value={conversionBase?`${conversion.toFixed(0)}%`:"—"} detail={`${converted} oportunidades ya reservadas`} tone="green"/></section>
    <section className={s.flow} aria-label="Etapas del pipeline">{stageOrder.map((stage,index)=>{const meta=stages[stage],count=counts[stage]||0;return <button type="button" key={stage} data-tone={meta.tone} data-active={filter===stage} onClick={()=>setFilter(filter===stage?"active":stage)}><span>{String(index+1).padStart(2,"0")}</span><b>{meta.short}</b><strong>{count}</strong><i/></button>})}</section>
    <section className={s.commandBar}><div className={s.filters}>{[["active","Activas"],["action","Requieren acción"],["hot","Prioridad alta"],["all","Todas"]].map(([id,label])=><button type="button" key={id} data-active={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div><div className={s.tools}><label>Buscar<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Huésped, canal o acción"/></label>{currencies.length>1?<label>Moneda<select value={selectedCurrency} onChange={e=>setCurrency(e.target.value)}>{currencies.map(c=><option key={c}>{c}</option>)}</select></label>:<span>{selectedCurrency}</span>}</div></section>
    <section className={s.mainGrid}>
      <article className={s.queue}><header><div><small>COLA COMERCIAL</small><h2>Qué conviene hacer ahora</h2></div><b>{visible.length}</b></header><div className={s.queueList}>{visible.slice(0,40).map(o=><button type="button" key={o.id} className={s.opportunity} data-selected={focus?.id===o.id} onClick={()=>setSelectedId(o.id)}><span className={s.avatar}>{String(o.name||"H").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()}</span><span className={s.identity}><b>{o.name}</b><small>{o.channel} · {o.contact}</small></span><span className={s.opStage}><StagePill stage={o.stage}/><small>{o.reason}</small></span><span className={s.value}><b>{o.value?money(o.value,o.currency):"Sin valor"}</b><small>{o.arrival?`${date(o.arrival)} → ${date(o.departure)}`:when(o.lastActivity)}</small></span><span className={s.priority}><b>{priorityLabel(o.score)}</b><Meter value={o.score}/><small>{o.action}</small></span>{o.due?<em>Acción</em>:null}</button>)}{!visible.length?<div className={s.empty}>No hay oportunidades que coincidan con este filtro. El pipeline no fabrica datos para llenar la pantalla.</div>:null}</div></article>
      <aside className={s.focus}>{focus?<><div className={s.focusTop}><span className={s.focusAvatar}>{String(focus.name||"H").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()}</span><div><small>OPORTUNIDAD SELECCIONADA</small><h2>{focus.name}</h2><p>{focus.contact}</p></div></div><StagePill stage={focus.stage}/><div className={s.score}><div><span>Prioridad comercial</span><b>{focus.score}/100</b></div><Meter value={focus.score}/><small>{priorityLabel(focus.score)} · {focus.reason}</small></div><div className={s.factGrid}><div><span>Próxima acción</span><b>{focus.action}</b></div><div><span>Última actividad</span><b>{when(focus.lastActivity)}</b></div><div><span>Valor</span><b>{focus.value?money(focus.value,focus.currency):"Sin valor cargado"}</b></div><div><span>Estado de respuesta</span><b>{focus.awaitingHotel?"Espera al hotel":"Espera al huésped"}</b></div></div>{focus.due&&!['reserved','lost'].includes(focus.stage)?<section className={s.followUp}><small>SEGUIMIENTO SEGURO</small><h3>Borrador, nunca envío automático</h3><p>{followUpDraft(focus)}</p><div><button type="button" onClick={()=>copyDraft(focus)}>{copied===focus.id?"Copiado":"Copiar borrador"}</button>{focus.conversationId?<button type="button" className={s.primary} onClick={()=>openConversation(focus.conversationId)}>Abrir conversación</button>:null}</div></section>:focus.conversationId?<button type="button" className={s.openButton} onClick={()=>openConversation(focus.conversationId)}>Abrir conversación vinculada</button>:null}<div className={s.guard}><b>Clasificación automática y explicable</b><p>La etapa se deriva de vínculos y señales que ya existen. Una oportunidad sólo aparece como perdida cuando hay un estado explícito de pérdida o cancelación.</p></div></>:<div className={s.focusEmpty}><span>HL</span><h2>Seleccioná una oportunidad</h2><p>Vas a ver la señal que determinó su etapa, prioridad, valor y el próximo paso recomendado.</p></div>}</aside>
    </section>
    <section className={s.board}><header><div><small>MAPA DEL PIPELINE</small><h2>Distribución por etapa</h2></div><span>Clasificación en vivo</span></header><div className={s.boardGrid}>{stageOrder.map(stage=>{const meta=stages[stage],rows=opportunities.filter(o=>o.stage===stage).slice(0,6);return <section key={stage} data-tone={meta.tone}><header><div><i/><b>{meta.label}</b></div><strong>{counts[stage]||0}</strong></header><p>{meta.hint}</p><div>{rows.map(o=><button type="button" key={o.id} onClick={()=>setSelectedId(o.id)}><span><b>{o.name}</b><small>{o.action}</small></span><em>{o.score}</em></button>)}{!rows.length?<small className={s.noRows}>Sin oportunidades</small>:null}</div></section>})}</div></section>
  </main>
}
