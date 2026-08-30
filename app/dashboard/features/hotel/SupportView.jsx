"use client"
import{useEffect,useMemo,useState}from"react"
import{closeHumanSupport,loadHumanSupport,sendHumanSupport}from"../../services/support"
import ui from"../../v2.module.css"
import s from"./support.module.css"

const FAQ=[
  ["¿Cómo creo una reserva?","Usá “Nueva reserva” desde Inicio o hacé doble clic en una celda libre del Command Center. La ficha se abre por encima del PMS y podés completar huésped, estadía, garantía, extras, documentos y notas."],
  ["¿Cómo muevo o extiendo una reserva?","En Command Center arrastrá la estadía a otra habitación/fecha. Para extenderla, tomá el borde derecho. El sistema valida disponibilidad y protege contra solapamientos antes de guardar."],
  ["¿Cómo hago check-in y check-out?","Abrí la reserva y usá Check-in o Check-out. El check-out controla el saldo pendiente y, al completarse, manda la habitación a Housekeeping."],
  ["¿Cómo bloqueo una habitación?","Desde Command Center o Habitaciones podés crear un bloqueo por mantenimiento, fuera de servicio, uso interno u otro motivo, con fecha de inicio y fin."],
  ["¿Dónde cambio tarifas y restricciones?","En Comercial → Revenue. Ahí podés editar tarifa diaria, mínimo de estadía, Stop Sell, CTA y CTD, además de aplicar cambios por rango."],
  ["¿Cómo envío Web Check-in?","Abrí una reserva y generá el enlace de Web Check-in. El enlace es privado, vence y queda asociado a esa reserva."],
  ["¿Cómo agrego usuarios y permisos?","En Hotel → Equipo & Roles. El propietario puede invitar usuarios, asignar roles y definir excepciones de permisos."],
  ["¿Qué hago si algo no funciona?","Abrí Ayuda humana. El mensaje llega a la bandeja de Central Gen identificado como Habitación Llena, con tu hotel y usuario, para que el equipo pueda responderte en este mismo chat."],
]
function when(value){if(!value)return"";return new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value))}

export default function SupportView({propertyId,hotelName}){
  const[tab,setTab]=useState("faq"),[openFaq,setOpenFaq]=useState(0),[state,setState]=useState({conversation:null,messages:[]}),[draft,setDraft]=useState(""),[loading,setLoading]=useState(false),[sending,setSending]=useState(false),[error,setError]=useState("")
  const active=tab==="human"
  async function refresh(silent=false){if(!propertyId)return;try{if(!silent)setLoading(true);const next=await loadHumanSupport({propertyId});setState(next);setError("")}catch(e){setError(e?.message||"No se pudo conectar con soporte.")}finally{if(!silent)setLoading(false)}}
  useEffect(()=>{if(!active)return;void refresh();const id=setInterval(()=>{if(document.visibilityState==="visible")void refresh(true)},9000);return()=>clearInterval(id)},[active,propertyId])
  async function send(e){e.preventDefault();const message=draft.trim();if(!message||sending)return;try{setSending(true);const next=await sendHumanSupport({propertyId,message,section:"Dashboard"});setState(next);setDraft("");setError("")}catch(err){setError(err?.message||"No se pudo enviar el mensaje.")}finally{setSending(false)}}
  async function close(){if(!state.conversation)return;try{setSending(true);const next=await closeHumanSupport({propertyId});setState(next)}catch(err){setError(err?.message||"No se pudo cerrar la conversación.")}finally{setSending(false)}}
  const status=useMemo(()=>state.conversation?.status==="pending"?"Esperando respuesta":state.conversation?.status==="in_progress"?"En atención":state.conversation?.status==="resolved"?"Finalizada":"Sin conversación activa",[state.conversation])
  return <div className={ui.content}>
    <section className={s.hero}><div><small>AYUDA & SOPORTE</small><h2>Resolver rápido, sin salir del hotel.</h2><p>Primero encontrá respuestas concretas. Si necesitás una persona, Central Gen recibe el caso con el contexto de {hotelName||"tu hotel"}.</p></div><div className={s.tabs}><button className={tab==="faq"?s.active:""} onClick={()=>setTab("faq")}>Preguntas frecuentes</button><button className={tab==="human"?s.active:""} onClick={()=>setTab("human")}>Ayuda humana</button></div></section>
    {tab==="faq"?<section className={s.faq}>{FAQ.map(([q,a],i)=><article key={q} className={openFaq===i?s.faqOpen:""}><button onClick={()=>setOpenFaq(openFaq===i?-1:i)}><span>{q}</span><b>{openFaq===i?"−":"+"}</b></button>{openFaq===i&&<p>{a}</p>}</article>)}</section>:<section className={s.supportShell}>
      <header className={s.supportHead}><div><span className={s.liveDot}/><div><small>CENTRAL GEN · SOPORTE HUMANO</small><h3>{status}</h3></div></div>{state.conversation&&<button onClick={close} disabled={sending}>Finalizar conversación</button>}</header>
      {error&&<div className={s.error}>{error}</div>}
      <div className={s.messages}>{loading?<div className={s.empty}>Conectando con Central Gen…</div>:state.messages?.length?state.messages.map(m=><div key={m.id} className={`${s.message} ${m.from==="customer"?s.customer:s.agent}`}><small>{m.from==="customer"?(hotelName||"Hotel"):(m.senderName||"Central Gen")} · {when(m.createdAt)}</small><p>{m.content}</p></div>):<div className={s.empty}><b>¿Necesitás ayuda humana?</b><p>Escribí abajo. Se abre un caso real en Central Gen y la respuesta vuelve a aparecer acá.</p></div>}</div>
      <form className={s.composer} onSubmit={send}><textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000} rows={3} placeholder="Contanos qué necesitás o qué error estás viendo…"/><div><small>{draft.length}/2000</small><button disabled={sending||!draft.trim()}>{sending?"Enviando…":"Enviar a soporte"}</button></div></form>
    </section>}
  </div>
}
