"use client"

import{useMemo,useState}from"react"
import s from"./commercial-copilot.module.css"

const HOUR=3600000
const ACTIVE=new Set(["new","qualified","quoted","interested","payment"])
const STAGE_LABEL={new:"Nueva",qualified:"Calificada",quoted:"Cotizada",interested:"Interesado",payment:"Pago pendiente",reserved:"Reservada",lost:"Perdida"}
const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase()
const cleanPhone=value=>String(value||"").replace(/\D/g,"")
const contactKey=item=>{const email=normalize(item?.contact_email||item?.email);if(email)return`e:${email}`;const phone=cleanPhone(item?.contact_phone||item?.phone);return phone?`p:${phone.slice(-10)}`:""}
const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
const shortDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):"—"
const relative=value=>{if(!value)return"Sin actividad";const ms=Math.max(0,Date.now()-new Date(value).getTime()),hours=Math.floor(ms/HOUR);if(hours<1)return"Ahora";if(hours<24)return`Hace ${hours} h`;return`Hace ${Math.floor(hours/24)} d`}
const cancelled=r=>{const v=normalize(r?.estado||r?.status);return v.includes("cancel")||v.includes("no show")||v.includes("no_show")||Boolean(r?.no_show)}
const roomIds=r=>[...new Set([r?.habitacion_id,...(Array.isArray(r?.habitaciones_ids)?r.habitaciones_ids:[])].map(String).filter(Boolean))]
const overlaps=(start,end,a,b)=>Boolean(start&&end&&a&&b&&String(start)<String(b)&&String(end)>String(a))
const roomSellable=room=>room?.activa!==false&&!["fuera_de_servicio","out_of_service"].includes(normalize(room?.estado))
const explicitStage=value=>{const v=normalize(value);if(!v)return"";if(["lost","perdida","perdido","cancelled","cancelada","rechaz"].some(x=>v.includes(x)))return"lost";if(["won","booked","reserved","reservada","confirmada","confirmed"].some(x=>v.includes(x)))return"reserved";if(["payment_pending","pago pendiente","pago_pendiente"].some(x=>v.includes(x)))return"payment";if(["interested","interesado","intent","negotiation","negociacion"].some(x=>v.includes(x)))return"interested";if(["quoted","cotizada","cotizado","proposal","propuesta"].some(x=>v.includes(x)))return"quoted";if(["qualified","calificada","calificado"].some(x=>v.includes(x)))return"qualified";return""}
const quoteStage=q=>{const v=normalize(q?.status);if(v==="accepted"||v.includes("acept"))return"interested";if(v==="sent"||v.includes("envi"))return"quoted";if(v==="rejected"||v.includes("rechaz"))return"lost";return q?"qualified":""}
const reservationStage=r=>{if(!r)return"";if(cancelled(r))return"lost";const v=normalize(r.estado||r.status);if(v.includes("pend")||v.includes("tent")||v.includes("hold")||v.includes("opcion"))return"payment";return"reserved"}
const intentWords=["quiero reservar","hacer la reserva","como reservo","pasame el link","pasame link","confirmar la reserva","quiero avanzar","seña","senar","transferencia","pagar","reservo"]
const qualifiedWords=["disponibilidad","disponible","habitacion","habitación","noche","noches","fecha","fechas","adultos","personas","huespedes","huéspedes","check in","check-in"]

function stageFor({group,quote,reservation,messages}){
  const fromReservation=reservationStage(reservation);if(fromReservation)return fromReservation
  const fromQuote=quoteStage(quote);if(fromQuote==="lost")return"lost"
  const explicit=explicitStage(group?.sales_stage||group?.status);if(explicit)return explicit
  const inbound=messages.filter(m=>normalize(m.direction)==="inbound"),text=normalize(inbound.slice(-8).map(m=>m.text).join(" "))
  const intent=intentWords.some(word=>text.includes(normalize(word))),qualified=qualifiedWords.some(word=>text.includes(normalize(word)))||/\b\d{1,2}[\/-]\d{1,2}\b/.test(text)
  if(intent&&["quoted","qualified"].includes(fromQuote))return"interested"
  if(fromQuote)return fromQuote
  if(intent)return"interested"
  if(qualified||group)return"qualified"
  return"new"
}

function buildOpportunities({conversations,messages,quotes,groups,reservations}){
  const byConversation=new Map();for(const message of messages){const id=String(message.conversation_id),list=byConversation.get(id)||[];list.push(message);byConversation.set(id,list)}
  const reservationById=new Map(reservations.map(r=>[String(r.id),r])),reservationByGroup=new Map()
  reservations.forEach(r=>{if(r.group_id&&!cancelled(r)&&!reservationByGroup.has(String(r.group_id)))reservationByGroup.set(String(r.group_id),r)})
  const quotesByGroup=new Map();[...quotes].sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at)).forEach(q=>{const id=String(q.group_id||"");if(id&&!quotesByGroup.has(id))quotesByGroup.set(id,q)})
  const groupsByContact=new Map();groups.forEach(g=>{const key=contactKey(g);if(key&&!groupsByContact.has(key))groupsByContact.set(key,g)})
  const usedGroups=new Set(),rows=[]
  const make=({conversation,group,quote,reservation,list})=>{
    const sorted=[...list].sort((a,b)=>new Date(a.occurred_at||a.created_at)-new Date(b.occurred_at||b.created_at)),inbound=sorted.filter(m=>normalize(m.direction)==="inbound"),outbound=sorted.filter(m=>normalize(m.direction)==="outbound"),lastInbound=inbound.at(-1),lastOutbound=outbound.at(-1)
    const lastInboundAt=lastInbound?.occurred_at||lastInbound?.created_at,lastOutboundAt=lastOutbound?.occurred_at||lastOutbound?.created_at,awaitingHotel=Boolean(lastInboundAt&&(!lastOutboundAt||new Date(lastInboundAt)>new Date(lastOutboundAt)))
    const stage=stageFor({group,quote,reservation,messages:sorted}),lastActivity=conversation?.last_message_at||group?.updated_at||quote?.updated_at||quote?.created_at||reservation?.created_at||conversation?.created_at||group?.created_at||"",name=conversation?.contact_name||group?.contact_name||reservation?.nombre_huesped||reservation?.huesped_nombre||reservation?.guest_name||"Huésped",contact=conversation?.contact_phone||conversation?.contact_email||group?.contact_phone||group?.contact_email||""
    const currency=String(quote?.currency||group?.budget_currency||reservation?.moneda||"ARS").toUpperCase(),value=Number(quote?.total||group?.budget_total||reservation?.precio_total||0),start=group?.arrival_date||reservation?.fecha_entrada||null,end=group?.departure_date||reservation?.fecha_salida||null,pax=Math.max(1,Number(group?.estimated_pax||reservation?.cantidad_huespedes||1))
    let score={new:42,qualified:58,quoted:72,interested:88,payment:92,reserved:100,lost:0}[stage]||40
    if(awaitingHotel)score+=10
    const age=Math.max(0,Date.now()-new Date(lastActivity||0).getTime())/HOUR;if(ACTIVE.has(stage)&&age>24)score+=6;if(ACTIVE.has(stage)&&age>72)score-=8
    if(value>0)score+=4
    score=Math.max(0,Math.min(100,Math.round(score)))
    return{id:conversation?`conversation:${conversation.id}`:`group:${group?.id||quote?.id}`,conversationId:conversation?.id||null,reservationId:reservation?.id||conversation?.reservation_id||null,groupId:group?.id||quote?.group_id||null,quoteId:quote?.id||null,quoteNumber:quote?.quote_number||null,quoteStatus:quote?.status||null,name,contact,channel:conversation?.channel||"comercial",stage,currency,value,start,end,pax,lastActivity,awaitingHotel,score,lastInboundText:lastInbound?.text||conversation?.last_message_text||"",group,quote,reservation}
  }
  for(const conversation of conversations){const group=groupsByContact.get(contactKey(conversation))||null;if(group)usedGroups.add(String(group.id));const quote=group?quotesByGroup.get(String(group.id))||null:null,reservation=reservationById.get(String(conversation.reservation_id||""))||(group?reservationByGroup.get(String(group.id))||null:null);rows.push(make({conversation,group,quote,reservation,list:byConversation.get(String(conversation.id))||[]}))}
  for(const group of groups){if(usedGroups.has(String(group.id)))continue;const quote=quotesByGroup.get(String(group.id))||null,reservation=reservationByGroup.get(String(group.id))||null;rows.push(make({conversation:null,group,quote,reservation,list:[]}))}
  return rows.sort((a,b)=>{const ar=ACTIVE.has(a.stage)?1:0,br=ACTIVE.has(b.stage)?1:0;if(ar!==br)return br-ar;return b.score-a.score||new Date(b.lastActivity)-new Date(a.lastActivity)})
}

function availabilityFor(opportunity,rooms,reservations,blocks){
  if(!opportunity?.start||!opportunity?.end||opportunity.end<=opportunity.start)return{known:false,available:0,total:0,types:[]}
  const sellable=rooms.filter(roomSellable),busy=new Set(),blocked=new Set()
  reservations.filter(r=>!cancelled(r)&&!r.merged_into_id&&String(r.id)!==String(opportunity.reservationId||"")&&overlaps(r.fecha_entrada,r.fecha_salida,opportunity.start,opportunity.end)).forEach(r=>roomIds(r).forEach(id=>busy.add(id)))
  blocks.filter(b=>overlaps(b.fecha_desde,b.fecha_hasta,opportunity.start,opportunity.end)).forEach(b=>blocked.add(String(b.habitacion_id)))
  const free=sellable.filter(room=>!busy.has(String(room.id))&&!blocked.has(String(room.id))),map=new Map()
  for(const room of free){const type=String(room.tipo||"Habitación").trim()||"Habitación",current=map.get(type)||{name:type,count:0,capacity:0};current.count++;current.capacity+=Math.max(1,Number(room.capacidad)||1);map.set(type,current)}
  return{known:true,available:free.length,total:sellable.length,types:[...map.values()].sort((a,b)=>b.count-a.count)}
}

function actionFor(opportunity,availability,engine){
  if(!opportunity)return{title:"Elegí una oportunidad",detail:"OlivIA va a cruzar conversación, presupuesto, inventario y reserva.",tone:"neutral"}
  if(opportunity.stage==="reserved")return{title:"Reserva lograda",detail:"La oportunidad ya está vinculada a una reserva real. Conviene revisar datos y evitar seguimientos comerciales duplicados.",tone:"green"}
  if(opportunity.stage==="lost")return{title:"Oportunidad cerrada",detail:"No se propone contacto automático. Revisá el motivo sólo si necesitás análisis comercial.",tone:"neutral"}
  if(opportunity.awaitingHotel)return{title:"Responder primero",detail:"Hay un mensaje del huésped posterior a la última respuesta del hotel. OlivIA prioriza resolver esa conversación antes de empujar el cierre.",tone:"red"}
  if(opportunity.stage==="new"||opportunity.stage==="qualified")return{title:"Cotizar con disponibilidad real",detail:availability.known?availability.available?`Hay ${availability.available} habitación${availability.available===1?"":"es"} libres para las fechas detectadas. Prepará el presupuesto sin bloquear inventario.`:"No aparece inventario libre para esas fechas. Conviene ofrecer alternativas antes de cotizar.":"Faltan fechas claras. Completalas en Presupuestos antes de avanzar.",tone:availability.known&&availability.available?"blue":"amber"}
  if(opportunity.stage==="quoted")return{title:"Retomar la propuesta",detail:"Ya existe una cotización. El siguiente paso es facilitar decisión, resolver dudas y llevar al motor o a la preparación de reserva.",tone:"violet"}
  if(opportunity.stage==="interested")return{title:engine?.enabled?"Llevar al cierre directo":"Preparar la reserva",detail:engine?.enabled?"La intención es alta y el motor está disponible. Abrilo con fechas y pasajeros precargados, sin confirmar nada por el huésped.":"La intención es alta. Revisá la cotización y prepará la reserva desde el flujo existente.",tone:"green"}
  return{title:"Resolver el paso pendiente",detail:"La reserva está encaminada pero todavía necesita una acción humana antes de considerarla confirmada.",tone:"amber"}
}

function draftFor(opportunity,availability,engine,propertyName){
  if(!opportunity)return""
  const first=String(opportunity.name||"Huésped").trim().split(/\s+/)[0]||"Huésped",hotel=propertyName||"el hotel"
  if(opportunity.awaitingHotel)return`Hola ${first}, gracias por escribirnos. Estoy retomando tu consulta de ${hotel} para darte una respuesta clara y ayudarte con el próximo paso.`
  if(opportunity.stage==="quoted")return`Hola ${first}, ¿cómo estás? Quería saber si pudiste revisar la propuesta para tu estadía. Si querés, te ayudo a resolver cualquier duda y avanzar con la reserva.`
  if(opportunity.stage==="interested"&&engine?.enabled)return`Hola ${first}, veo que ya estás por avanzar con la estadía. Te puedo pasar el acceso directo al motor para que revises disponibilidad y completes la reserva de forma segura.`
  if(opportunity.stage==="payment")return`Hola ${first}, tu reserva está encaminada. Si necesitás ayuda con el paso pendiente para confirmarla, decime y lo revisamos juntos.`
  if(availability.known&&availability.available>0)return`Hola ${first}, revisé las fechas que consultaste y hoy tenemos disponibilidad. Si te parece, preparo la propuesta con las opciones disponibles para que puedas evaluarla.`
  return`Hola ${first}, retomo tu consulta por la estadía. Si querés, revisamos juntos fechas, disponibilidad y la mejor opción para avanzar.`
}

function Signal({label,value,detail,tone="neutral"}){return <article className={s.signal} data-tone={tone}><small>{label}</small><strong>{value}</strong><span>{detail}</span></article>}

export default function CommercialCopilot({property,rooms=[],reservations=[],blocks=[],conversations=[],messages=[],quotes=[],groups=[],bookingEngine=null}){
  const opportunities=useMemo(()=>buildOpportunities({conversations,messages,quotes,groups,reservations}),[conversations,messages,quotes,groups,reservations]),active=opportunities.filter(item=>ACTIVE.has(item.stage)),[selectedId,setSelectedId]=useState(""),[copied,setCopied]=useState(false)
  const selected=opportunities.find(item=>item.id===selectedId)||active[0]||opportunities[0]||null,availability=useMemo(()=>availabilityFor(selected,rooms,reservations,blocks),[selected,rooms,reservations,blocks]),recommendation=actionFor(selected,availability,bookingEngine),draft=draftFor(selected,availability,bookingEngine,property?.name)
  const quoteReady=active.filter(item=>["qualified","quoted","interested"].includes(item.stage)&&item.start&&item.end).length,highIntent=active.filter(item=>item.score>=80).length,activeValue=active.reduce((sum,item)=>sum+Number(item.value||0),0),currency=active.find(item=>item.value>0)?.currency||"ARS"

  function nav(view,params={}){if(typeof window==="undefined")return;const url=new URL(window.location.href);url.searchParams.set("view",view);url.searchParams.delete("intelligence");Object.entries(params).forEach(([key,value])=>{if(value!=null&&value!=="")url.searchParams.set(key,String(value));else url.searchParams.delete(key)});window.history.pushState({pmsView:view},"",url);window.dispatchEvent(new PopStateEvent("popstate"))}
  function openMessages(){if(!selected?.conversationId)return;nav("messages",{conversation:selected.conversationId})}
  function openQuote(){nav("quotes")}
  function prepareQuote(){nav("quotes")}
  function openMotor(){if(!bookingEngine?.enabled||!bookingEngine?.slug||typeof window==="undefined")return;const qs=new URLSearchParams({source:"olivia_commercial"});if(selected?.start)qs.set("check_in",selected.start);if(selected?.end)qs.set("check_out",selected.end);if(selected?.pax)qs.set("guests",String(selected.pax));window.open(`/book/${encodeURIComponent(bookingEngine.slug)}?${qs}`,"_blank","noopener,noreferrer")}
  async function copyDraft(){if(!draft)return;try{await navigator.clipboard.writeText(draft);setCopied(true);window.setTimeout(()=>setCopied(false),1800)}catch{}}
  return <main className={s.page}>
    <header className={s.hero}><div><small>OLIVIA COMERCIAL · FASE 5</small><h1 style={{color:"#fff"}}>Del dato a la próxima acción.</h1><p>OlivIA cruza intención, cotización, inventario, motor y reserva para ayudar al equipo a cerrar mejor, sin actuar por su cuenta.</p></div><div className={s.guard}><span>CONTROL HUMANO</span><strong>Asiste, no ejecuta</strong><small>No envía mensajes, no cobra y no confirma reservas sola.</small></div></header>
    <section className={s.kpis}><Signal label="Oportunidades activas" value={active.length} detail={`${highIntent} con intención alta`} tone="violet"/><Signal label="Listas para cotizar" value={quoteReady} detail="Con fechas detectadas y flujo de presupuesto" tone="blue"/><Signal label="Valor comercial visible" value={money(activeValue,currency)} detail="Sólo importes registrados en el PMS" tone="cyan"/><Signal label="Motor directo" value={bookingEngine?.enabled?"Disponible":"No activo"} detail={bookingEngine?.enabled?"Handoff seguro con búsqueda precargada":"Se mantiene el flujo interno"} tone={bookingEngine?.enabled?"green":"neutral"}/></section>
    <section className={s.workspace}>
      <div className={s.queue}>
        <header><div><small>PRIORIDAD COMERCIAL</small><h2>Qué debería mirar el equipo ahora</h2></div><span>{active.length} activas</span></header>
        <div className={s.queueList}>{opportunities.slice(0,18).map(item=><button type="button" key={item.id} className={s.lead} data-active={selected?.id===item.id} onClick={()=>setSelectedId(item.id)}><div className={s.score} data-high={item.score>=80}><strong>{item.score}</strong><small>score</small></div><div className={s.leadBody}><div><b>{item.name}</b><span>{STAGE_LABEL[item.stage]||item.stage}</span></div><small>{item.start&&item.end?`${shortDate(item.start)} → ${shortDate(item.end)} · ${item.pax} pax`:item.contact||"Sin fechas detectadas"}</small><em>{item.awaitingHotel?"Respuesta pendiente del hotel":relative(item.lastActivity)}</em></div><strong className={s.value}>{item.value?money(item.value,item.currency):"—"}</strong></button>)}</div>
        {!opportunities.length?<div className={s.empty}><b>No hay oportunidades comerciales todavía</b><span>Cuando entren consultas o presupuestos, OlivIA los va a priorizar acá sin crear un CRM paralelo.</span></div>:null}
      </div>
      <aside className={s.copilot}>
        {selected?<><header className={s.copilotHead}><div><small>OLIVIA PROPONE</small><h2>{selected.name}</h2><span>{STAGE_LABEL[selected.stage]||selected.stage} · score {selected.score} · {relative(selected.lastActivity)}</span></div><i data-tone={recommendation.tone}/></header>
          <section className={s.recommendation} data-tone={recommendation.tone}><small>PRÓXIMA MEJOR ACCIÓN</small><h3>{recommendation.title}</h3><p>{recommendation.detail}</p></section>
          <div className={s.facts}><div><small>Estadía</small><b>{selected.start&&selected.end?`${shortDate(selected.start)} → ${shortDate(selected.end)}`:"Sin fechas"}</b><span>{selected.pax} huésped{selected.pax===1?"":"es"}</span></div><div><small>Disponibilidad</small><b>{availability.known?`${availability.available}/${availability.total} libres`:"Por definir"}</b><span>{availability.known&&availability.types.length?availability.types.slice(0,2).map(x=>`${x.name} ${x.count}`).join(" · "):"Se valida antes de cotizar"}</span></div><div><small>Cotización</small><b>{selected.quoteNumber||"Sin presupuesto"}</b><span>{selected.quoteId?`${selected.quoteStatus||"registrada"} · ${money(selected.value,selected.currency)}`:"Puede prepararse sin bloquear Planning"}</span></div><div><small>Canal</small><b>{selected.channel||"Comercial"}</b><span>{selected.contact||"Contacto no identificado"}</span></div></div>
          <section className={s.closingPath}><small>RUTA DE CIERRE</small><div><i data-state={availability.known&&availability.available>0?"ok":"wait"}/><p><b>1. Inventario</b><span>{availability.known?availability.available>0?"Hay inventario visible para avanzar.":"No hay inventario libre visible; ofrecer alternativas.":"Faltan fechas para validar inventario."}</span></p></div><div><i data-state={selected.quoteId?"ok":"wait"}/><p><b>2. Cotización</b><span>{selected.quoteId?`Presupuesto ${selected.quoteNumber} registrado.`:"Preparar presupuesto con disponibilidad real."}</span></p></div><div><i data-state={bookingEngine?.enabled?"ok":"wait"}/><p><b>3. Cierre</b><span>{bookingEngine?.enabled?"Motor directo listo para abrir con fechas precargadas.":"Usar Presupuestos / Planning según el caso."}</span></p></div></section>
          <section className={s.draft}><header><div><small>MENSAJE SUGERIDO</small><h3>Texto listo para revisar</h3></div><button type="button" onClick={copyDraft}>{copied?"Copiado":"Copiar"}</button></header><textarea readOnly value={draft} aria-label="Borrador sugerido por OlivIA"/><span>Nunca se envía desde esta pantalla.</span></section>
          <div className={s.actions}>{selected.conversationId?<button type="button" onClick={openMessages}>Abrir conversación</button>:null}{selected.quoteId?<button type="button" onClick={openQuote}>Ver presupuesto</button>:!selected.reservationId?<button type="button" onClick={prepareQuote}>Preparar cotización</button>:null}{bookingEngine?.enabled&&selected.stage!=="reserved"?<button type="button" onClick={openMotor}>Abrir motor seguro</button>:null}{selected.reservationId?<button type="button" onClick={()=>nav("reservations")}>Ver reserva</button>:null}</div>
          <div className={s.safety}><b>Guardas activas</b><span>Los importes vienen del PMS. La disponibilidad se calcula con habitaciones, reservas y bloqueos actuales. Un handoff al motor sólo abre la búsqueda; el huésped o el equipo deben confirmar.</span></div>
        </>:<div className={s.focusEmpty}><b>Sin oportunidad seleccionada</b><span>Cuando exista actividad comercial, OlivIA va a mostrar el contexto y la próxima acción acá.</span></div>}
      </aside>
    </section>
  </main>
}
