"use client"

import Link from"next/link"
import{useEffect,useState}from"react"
import s from"./landing-editorial.module.css"

const RECEPTION="https://images.pexels.com/photos/5371676/pexels-photo-5371676.jpeg?auto=compress&cs=tinysrgb&w=1800"
const HOTEL="https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg?auto=compress&cs=tinysrgb&w=1800"
const HOUSEKEEPING="https://images.pexels.com/photos/9462786/pexels-photo-9462786.jpeg?auto=compress&cs=tinysrgb&w=1600"
const ROOM="https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1600&q=88"

const product={
  dashboard:{label:"Dashboard",title:"Lo importante aparece primero.",copy:"Una vista simple para el turno diario y una vista avanzada cuando dirección necesita más profundidad."},
  planning:{label:"Planning",title:"El calendario donde realmente trabaja recepción.",copy:"Mover, extender, bloquear, asignar y entender una reserva sin convertir el día en una colección de formularios."},
  guest:{label:"Huéspedes",title:"El huésped no empieza de cero cada vez.",copy:"Historial, preferencias útiles, documentos, saldos y próxima estadía en un mismo contexto."},
  housekeeping:{label:"Housekeeping",title:"Pisos ve prioridades, no una lista infinita.",copy:"Limpieza, inspección, recambios y llegadas próximas ordenadas con la realidad operativa del hotel."},
}

function ArgentinaMark(){return <span className={s.argentina}><i><b/></i><span>Hecho en Argentina · pensado para hotelería de la región</span></span>}

function DashboardPreview(){return <div className={s.preview}>
  <aside><b>HL</b>{["⌂","▦","◇","↗","▧","⚙"].map((icon,i)=><i key={i}>{icon}</i>)}</aside>
  <main><header><div><small>PANEL OPERATIVO</small><strong>Hostería Durazno</strong></div><span>Simple&nbsp;&nbsp; Avanzada</span></header><div className={s.previewMetrics}>{[["Ocupación","78%"],["Llegadas","12"],["Salidas","9"],["Housekeeping","7"]].map(([l,v])=><div key={l}><small>{l}</small><b>{v}</b></div>)}</div><section><div><small>PRÓXIMOS 14 DÍAS</small><h4>Ocupación</h4></div><svg viewBox="0 0 760 180" preserveAspectRatio="none"><defs><linearGradient id="landingEditorialFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a68ad" stopOpacity=".17"/><stop offset="1" stopColor="#2a68ad" stopOpacity="0"/></linearGradient></defs><path d="M0 148 C80 138 110 105 180 112 S305 52 380 71 S492 137 565 98 S680 54 760 68 L760 180 L0 180 Z" fill="url(#landingEditorialFill)"/><path d="M0 148 C80 138 110 105 180 112 S305 52 380 71 S492 137 565 98 S680 54 760 68" fill="none" stroke="#2a68ad" strokeWidth="3"/></svg></section><footer><span><b>15:00</b> Elena B. · 204</span><span><b>16:30</b> Raúl Mora · 101</span><span><b>18:10</b> Matteo H. · 301</span></footer></main>
</div>}

function PlanningPreview(){const stays=[["Elena B.",1,3,"direct"],["Raúl Mora",2,4,"booking"],["Matteo H.",4,3,"agency"],["Olivia M.",1,2,"direct"],["Marta R.",5,3,"booking"]];return <div className={s.planningPreview}><header><b>Planning</b><span>Hoy · 14 días · precios</span></header><div className={s.planBody}><aside>{["101 Cosy King","102 Cosy King","201 Deluxe","202 Deluxe","301 Suite"].map(x=><b key={x}>{x}</b>)}</aside><div className={s.planDays}><div className={s.dayHeader}>{["L 30","M 31","X 1","J 2","V 3","S 4","D 5","L 6"].map(x=><span key={x}>{x}</span>)}</div>{[0,1,2,3,4].map(row=><div className={s.planRow} key={row}>{Array.from({length:8},(_,i)=><i key={i}/>)}</div>)}{stays.map(([name,start,width,tone],row)=><em className={s[tone]} key={name} style={{left:`${start*12.5+1}%`,width:`${width*12.5-2}%`,top:`${42+row*50}px`}}>{name}</em>)}</div></div></div>}

function ProductVisual({active}){if(active==="planning")return <PlanningPreview/>;if(active==="guest")return <div className={s.guestVisual}><div><span>RM</span><section><small>HUÉSPED RECURRENTE</small><h3>Raúl Mora</h3><p>3 estadías · piso alto · desayuno temprano</p></section><b>VIP</b></div><dl><div><dt>Próxima estadía</dt><dd>5 abr → 7 abr</dd></div><div><dt>Valor histórico</dt><dd>ARS 486.000</dd></div><div><dt>Memoria útil</dt><dd>Prefiere piso alto</dd></div></dl></div>;if(active==="housekeeping")return <div className={s.hkVisual}><header><small>HOUSEKEEPING · HOY</small><h3>Qué habitación importa ahora.</h3></header>{[["204","Sucia","Entrada 13:30"],["301","Limpia","Inspeccionar"],["406","En curso","Stayover"],["108","Lista","Sin próxima llegada"]].map(([room,state,note])=><div key={room}><b>{room}</b><span><strong>{state}</strong><small>{note}</small></span><em>→</em></div>)}</div>;return <DashboardPreview/>}

const integrations=[
  ["Mercado Pago","https://cdn.simpleicons.org/mercadopago/009EE3","Argentina / LatAm"],
  ["ARCA",null,"Argentina"],
  ["Stripe","https://cdn.simpleicons.org/stripe/635BFF","Internacional"],
  ["Booking.com","https://cdn.simpleicons.org/bookingdotcom/003580","Distribución"],
  ["Airbnb","https://cdn.simpleicons.org/airbnb/FF5A5F","Distribución"],
]

export default function LandingEditorial(){
  const[active,setActive]=useState("dashboard")
  useEffect(()=>{const nodes=[...document.querySelectorAll("[data-editorial-reveal]")],observer=new IntersectionObserver(entries=>entries.forEach(e=>e.target.classList.toggle(s.visible,e.isIntersecting)),{threshold:.12});nodes.forEach(n=>observer.observe(n));return()=>observer.disconnect()},[])
  return <main className={s.page}>
    <div className={s.topNote}><ArgentinaMark/><a href="#migracion">Migración guiada sin cortar la operación →</a></div>
    <nav className={s.nav}><Link href="/" className={s.brand}><span>HL</span><div><b>Habitación Llena</b><small>HOTEL OPERATING SYSTEM</small></div></Link><div className={s.links}><a href="#producto">Producto</a><a href="#planning">Planning</a><a href="#migracion">Migración</a><a href="#integraciones">Integraciones</a></div><div><Link href="/login">Acceso clientes</Link><Link href="/registro" className={s.demo}>Solicitar demo</Link></div></nav>

    <section className={s.hero}>
      <div className={s.heroCopy} data-editorial-reveal><small>HOTELES · APARTS · HOSTERÍAS · MULTIPROPIEDAD</small><h1>Un PMS que se siente <em>hecho para hoteleros.</em></h1><p>Planning, recepción, huéspedes, housekeeping, caja, facturación, pagos e inteligencia operativa en una interfaz clara, rápida y pensada para trabajar todo el día.</p><div className={s.heroActions}><Link href="/registro">Quiero verlo en mi hotel <span>→</span></Link><a href="#producto">Explorar el producto</a></div><div className={s.heroProof}><span><b>Argentina primero</b><small>Mercado Pago + ARCA</small></span><span><b>Multi-dispositivo</b><small>Desktop, tablet y móvil</small></span><span><b>Migración controlada</b><small>Sin apagar el PMS actual</small></span></div></div>
      <div className={s.heroMedia} data-editorial-reveal><img src={RECEPTION} alt="Recepción de hotel contemporánea"/><div className={s.heroPreview}><DashboardPreview/></div></div>
    </section>

    <section className={s.statement} data-editorial-reveal><small>UNA IDEA SIMPLE</small><h2>Menos paneles.<br/>Más hotel.</h2><p>La información no debería competir por atención. Habitación Llena prioriza lo que cambia el turno y deja la profundidad a un clic.</p></section>

    <section className={s.product} id="producto"><div className={s.productNav}>{Object.entries(product).map(([key,item])=><button key={key} className={active===key?s.active:""} onClick={()=>setActive(key)}><span>{item.label}</span><small>{item.title}</small></button>)}</div><div className={s.productStage} data-editorial-reveal><div><small>{product[active].label.toUpperCase()}</small><h2>{product[active].title}</h2><p>{product[active].copy}</p><Link href="/registro">Verlo con mis datos →</Link></div><ProductVisual active={active}/></div></section>

    <section className={s.planning} id="planning"><div className={s.planningCopy} data-editorial-reveal><small>EL CENTRO DE RECEPCIÓN</small><h2>El Planning tiene que ser el lugar más agradable del PMS.</h2><p>Reservas que se leen rápido, arrastre claro, cambio táctil en móvil, estados visibles, disponibilidad, precios y contexto sin tapar el calendario.</p><ul><li>Drag & drop en desktop.</li><li>Tap para mover en tablet y móvil.</li><li>HL Pulse aparece sólo cuando hay algo útil que decir.</li><li>Operación, Revenue y Housekeeping comparten la misma línea de tiempo.</li></ul></div><div className={s.planningMedia} data-editorial-reveal><img src={HOTEL} alt="Hotel contemporáneo"/><div><PlanningPreview/></div></div></section>

    <section className={s.human}><img src={HOUSEKEEPING} alt="Equipo de housekeeping preparando una habitación"/><div data-editorial-reveal><small>TECNOLOGÍA QUE ACOMPAÑA</small><h2>Cuando cambia algo, el dato aparece donde hace falta.</h2><p>Un check-out mueve la habitación a Housekeeping. Una llegada cercana cambia prioridades. Un huésped recurrente trae consigo las preferencias que realmente sirven.</p><div className={s.humanSteps}><span><b>01</b>Recepción</span><span><b>02</b>Housekeeping</span><span><b>03</b>Administración</span><span><b>04</b>Dirección</span></div></div></section>

    <section className={s.roomStory}><div data-editorial-reveal><small>MEMORIA DEL HUÉSPED</small><h2>Más contexto.<br/>Menos preguntas repetidas.</h2><p>Historial, próxima estadía, saldo, documentos y preferencias útiles —por ejemplo piso alto o desayuno temprano— sin llenar la ficha de etiquetas irrelevantes.</p></div><img src={ROOM} alt="Habitación de hotel moderna"/></section>

    <section className={s.migration} id="migracion"><header data-editorial-reveal><small>MIGRACIÓN LLENA</small><h2>Cambiar de PMS no debería frenar el hotel.</h2><p>El sistema anterior sigue operativo mientras configuramos, importamos, conciliamos y entrenamos al equipo.</p></header><ol>{[["01","Configurar","Habitaciones, tarifas, usuarios e impuestos."],["02","Importar","Reservas, huéspedes, empresas, agencias y saldos."],["03","Entrenar","Recepción, reservas, administración y housekeeping."],["04","Go-live","Importación delta y cambio controlado de conexiones."]].map(([n,t,d])=><li key={n}><b>{n}</b><span><strong>{t}</strong><small>{d}</small></span></li>)}</ol><Link href="/registro">Planificar mi migración →</Link></section>

    <section className={s.integrations} id="integraciones"><header data-editorial-reveal><small>INTEGRACIONES</small><h2>Argentina donde corresponde.<br/>El mundo donde suma.</h2><p>La operación regional no se mezcla con proveedores que no aplican al hotel. Cada propiedad usa su moneda, fiscalidad y medios de pago.</p></header><div className={s.logoStrip}>{integrations.map(([name,logo,meta])=><div key={name}>{logo?<img src={logo} alt={`Logo ${name}`}/>:<span className={s.arcaLogo}>ARCA</span>}<b>{name}</b><small>{meta}</small></div>)}</div></section>

    <section className={s.final}><ArgentinaMark/><h2>Un PMS argentino con ambición global.</h2><p>Diseñado para que recepción trabaje más rápido, dirección entienda mejor y el huésped sienta menos fricción.</p><Link href="/registro">Solicitar demo <span>→</span></Link></section>

    <footer className={s.footer}><div><b>Habitación Llena</b><span>Hospitality OS</span></div><ArgentinaMark/><div><Link href="/privacidad">Privacidad</Link><Link href="/terminos">Términos</Link><span>© 2026</span></div></footer>
  </main>
}
