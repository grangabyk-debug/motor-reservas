"use client"

import Link from "next/link"
import{useEffect,useMemo,useState}from"react"
import ui from"./stage-now.module.css"

const HERO="https://images.pexels.com/photos/5371676/pexels-photo-5371676.jpeg?auto=compress&cs=tinysrgb&w=1800"
const GUEST="https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg?auto=compress&cs=tinysrgb&w=1600"
const HOUSEKEEPING="https://images.pexels.com/photos/9462786/pexels-photo-9462786.jpeg?auto=compress&cs=tinysrgb&w=1600"
const ROOM="https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1600&q=88"

const scenes={
  Recepción:{label:"TURNO OPERATIVO",title:"Todo lo importante antes de que alguien pregunte.",metric:"12 llegadas",note:"9 salidas · 4 habitaciones por liberar",rows:[["301","Benítez · 14:00","Lista"],["204","Salida 10:18","Priorizar"],["406","Martins · 3 noches","En casa"]]},
  Planning:{label:"PLANNING",title:"Mover una reserva debería sentirse natural.",metric:"84% ocupación",note:"Drag & drop · restricciones · bloqueos",rows:[["STD 01","Directa · 2 noches","Pagada"],["DLX 03","Booking · 4 noches","Garantizada"],["SUP 02","Agencia · 1 noche","Pendiente"]]},
  Housekeeping:{label:"HOUSEKEEPING",title:"La habitación avisa qué necesita primero.",metric:"7 pendientes",note:"3 listas · 2 en inspección · 1 urgente",rows:[["204","Salida reciente","Urgente"],["301","Stayover","En curso"],["406","Inspección","Lista"]]},
  Dirección:{label:"GERENCIA",title:"El hotel resumido sin abrir seis reportes.",metric:"78% ocupación",note:"ADR · producción · canales · pendientes",rows:[["Hoy","Producción estimada","ARS"],["Mes","Reservas directas","↑"],["14 días","Forecast","Visible"]]},
}

const integrations=[
  ["Mercado Pago","Argentina / LatAm","prioridad"],["ARCA","Argentina","prioridad"],["Booking.com","Distribución","roadmap"],["Expedia","Distribución","roadmap"],["Airbnb","Distribución","roadmap"],["Google Hotel","Metabúsqueda","roadmap"],["Stripe","Internacional · según país","global"],["WhatsApp","Mensajería","roadmap"],["Cerraduras","Accesos","roadmap"],["Escáner DNI","Recepción","roadmap"],
]

function ProductScene({active}){const scene=scenes[active];return <div className={ui.productWindow}><header><span/><span/><span/><b>Habitación Llena</b><small>{scene.label}</small></header><div className={ui.productBody}><aside><b>HL</b><i/><i/><i/><i/><i/></aside><section><div className={ui.productTop}><div><small>{scene.label}</small><h3>{scene.title}</h3></div><div><b>{scene.metric}</b><span>{scene.note}</span></div></div><div className={ui.productRows}>{scene.rows.map((row,index)=><div key={`${active}-${index}`}><strong>{row[0]}</strong><span>{row[1]}</span><em>{row[2]}</em></div>)}</div><div className={ui.productBottom}><span>✦ Llena Intelligence</span><b>Ver próxima acción →</b></div></section></div></div>}

function MigrationTimeline(){return <section className={ui.migration} id="migracion"><div className={ui.sectionLead}><small>MIGRACIÓN LLENA</small><h2>Cambiar de PMS sin frenar el hotel.</h2><p>El sistema anterior sigue siendo productivo mientras armamos, importamos, entrenamos y validamos. El cambio de conexiones ocurre recién cuando el hotel está listo.</p></div><div className={ui.weeks}>{[
  ["01","Construimos tu hotel","Habitaciones, categorías, tarifas, impuestos, usuarios, caja, extras, housekeeping y reglas."],
  ["02","Traemos tus datos","Reservas futuras, huéspedes, empresas, agencias y saldos con control de duplicados e inconsistencias."],
  ["03","Trabajamos en paralelo","Capacitación por rol, pruebas reales, reconciliación diaria y shadow mode sin cortar la operación."],
  ["04","Go-live controlado","Importación delta, chequeos finales y cambio de canales sólo cuando todo está conciliado."],
].map(([n,title,text])=><article key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p><small>{n==="04"?"SIN CORTE OPERATIVO":"CHECKLIST + RESPONSABLE"}</small></article>)}</div><div className={ui.migrationBar}><span><i/>Configuración</span><span><i/>Datos</span><span><i/>Capacitación</span><span><i/>Validación</span><b>Go-live</b></div></section>}

export default function LandingExperience(){
  const[active,setActive]=useState("Recepción")
  useEffect(()=>{const items=[...document.querySelectorAll("[data-stage-reveal]")];const observer=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle(ui.visible,entry.isIntersecting)),{threshold:.12});items.forEach(item=>observer.observe(item));return()=>observer.disconnect()},[])
  const navItems=useMemo(()=>[["Producto","#producto"],["Soluciones","/soluciones"],["Migración","#migracion"],["Integraciones","#integraciones"]],[])
  return <main className={ui.page}>
    <nav className={ui.nav}><div className={ui.navInner}><Link href="/" className={ui.brand}><span>HL</span><b>Habitación Llena</b><small>Hotel OS</small></Link><div className={ui.navLinks}>{navItems.map(([label,href])=>href.startsWith("/")?<Link key={label} href={href}>{label}</Link>:<a key={label} href={href}>{label}</a>)}</div><div className={ui.navActions}><Link href="/login" className={ui.login}>Ingresar</Link><Link href="/registro" className={ui.primary}>Crear cuenta <span>↗</span></Link></div></div></nav>

    <section className={ui.hero}>
      <div className={ui.heroImage}><img src={HERO} alt="Recepción de hotel con atención humana"/></div><div className={ui.heroShade}/>
      <div className={ui.heroInner}>
        <div className={ui.heroCopy} data-stage-reveal><div className={ui.kicker}><i/>HOTEL OPERATING SYSTEM</div><h1>El software se adapta al hotel.<br/><em>No al revés.</em></h1><p>Recepción, reservas, habitaciones, huéspedes, housekeeping, ingresos y venta directa en una operación clara, rápida y pensada para personas.</p><div className={ui.heroActions}><Link href="/registro" className={ui.heroPrimary}>Quiero verlo en mi hotel <span>→</span></Link><a href="#producto" className={ui.heroSecondary}>Ver el producto</a></div><div className={ui.heroFoot}><span><b>Argentina primero.</b> Diseñado para crecer en Sudamérica.</span><span><b>Web.</b> Sin instalar software pesado.</span></div></div>
        <div className={ui.heroProduct} data-stage-reveal><div className={ui.liveBadge}><i/>OPERACIÓN EN VIVO</div><ProductScene active="Recepción"/><div className={ui.floatCard}><small>PRIORIDAD</small><b>Hab. 204</b><span>Salió hace 18 min · entra 13:30</span><button>Priorizar housekeeping</button></div></div>
      </div>
    </section>

    <section className={ui.valueStrip}><span>Planning rápido</span><i/> <span>Housekeeping conectado</span><i/> <span>Huéspedes con memoria</span><i/> <span>Ingresos en contexto</span><i/> <span>Venta directa</span></section>

    <section className={ui.product} id="producto"><div className={ui.sectionLead} data-stage-reveal><small>UN SOLO PRODUCTO</small><h2>No son veinte módulos pegados.<br/><em>Es el mismo hotel visto por cada rol.</em></h2><p>El dato aparece donde tiene sentido: recepción ve el turno, pisos ve prioridades, dirección ve el negocio y reservas ve inventario.</p></div><div className={ui.sceneTabs}>{Object.keys(scenes).map(name=><button key={name} onClick={()=>setActive(name)} className={active===name?ui.active:""}>{name}</button>)}</div><div className={ui.productStage} data-stage-reveal><ProductScene active={active}/></div></section>

    <section className={ui.human}><div className={ui.humanGrid}><figure data-stage-reveal><img src={GUEST} alt="Huésped disfrutando su estadía"/></figure><div data-stage-reveal><small>HOSPITALIDAD, NO SOFTWARE</small><h2>Que el huésped vea un hotel.<br/><em>No tu sistema interno.</em></h2><p>La tecnología ordena lo complejo atrás para que adelante quede lo importante: recibir, resolver, vender mejor y cuidar cada estancia.</p><div className={ui.journey}>{["Reserva","Antes de llegar","Check-in","Estadía","Servicios","Check-out","Fidelización"].map((item,index)=><span key={item}><i>{String(index+1).padStart(2,"0")}</i>{item}</span>)}</div></div></div></section>

    <section className={ui.widgets}><div className={ui.sectionLead} data-stage-reveal><small>WIDGET LIBRARY</small><h2>El panel cambia según quién lo abre.</h2><p>Recepción, dirección, reservas, administración y housekeeping necesitan distintas prioridades. Por eso el dashboard tiene que ser personalizable, no fijo.</p></div><div className={ui.widgetCanvas} data-stage-reveal><article className={ui.widgetHero}><small>OPERACIÓN · HOY</small><div><span><b>12</b>Llegadas</span><span><b>83</b>En casa</span><span><b>9</b>Salidas</span><span><b>2</b>No-show</span></div></article><article><small>OCUPACIÓN</small><b>78%</b><span>14 días</span></article><article><small>HOUSEKEEPING</small><b>7</b><span>pendientes</span></article><article><small>PRODUCCIÓN</small><b>Hoy</b><span>en contexto</span></article><article><small>MENSAJES</small><b>3</b><span>por responder</span></article><div className={ui.widgetPicker}><span>＋ Agregar widget</span><div>{["Forecast","Caja","Pagos","ADR","Canales","Mantenimiento","Upsells","Tareas"].map(x=><button key={x}>{x}</button>)}</div></div></div></section>

    <MigrationTimeline/>

    <section className={ui.integrations} id="integraciones"><div className={ui.sectionLead} data-stage-reveal><small>INTEGRACIONES</small><h2>Conectar debería sentirse como activar una función.</h2><p>La meta es un marketplace claro: conectado, disponible, requiere configuración o roadmap. Sin fingir integraciones que todavía no existen.</p></div><div className={ui.integrationGrid}>{integrations.map(([name,scope,state])=><article key={name} data-stage-reveal><div><span>{name.slice(0,2).toUpperCase()}</span><b>{name}</b></div><p>{scope}</p><small className={ui[state]}>{state==="prioridad"?"PRIORIDAD LOCAL":state==="global"?"INTERNACIONAL":"ROADMAP"}</small></article>)}</div><div className={ui.paymentNote}><div><small>ARGENTINA</small><h3>Mercado Pago + ARCA primero.</h3><p>Cobros online, links, garantías, suscripciones y facturación local tienen prioridad porque forman parte de la operación real del hotel argentino.</p></div><div><small>INTERNACIONAL</small><h3>Stripe donde esté disponible.</h3><p>La capa global se habilita por país. No mostramos Stripe como opción argentina si el proveedor no ofrece alta local directa.</p></div></div></section>

    <section className={ui.housekeepingStory}><div data-stage-reveal><small>OPERACIÓN REAL</small><h2>Una habitación tiene memoria.</h2><p>Estado, limpieza, inspección, incidencias, objetos perdidos, notas y contexto de la próxima llegada viven juntos.</p><Link href="/registro">Probar Habitación Llena →</Link></div><figure data-stage-reveal><img src={HOUSEKEEPING} alt="Housekeeping preparando una habitación"/><figcaption><span>204</span><b>Lista para inspección</b><small>Próxima llegada 13:30</small></figcaption></figure></section>

    <section className={ui.final}><div className={ui.finalImage}><img src={ROOM} alt="Habitación de hotel contemporánea"/></div><div className={ui.finalShade}/><div className={ui.finalCopy} data-stage-reveal><small>HABITACIÓN LLENA</small><h2>Que se note el hotel.<br/><em>No el software.</em></h2><p>Una operación más clara, un equipo más coordinado y una transición que no interrumpe la venta.</p><div><Link href="/registro" className={ui.heroPrimary}>Crear cuenta <span>→</span></Link><Link href="/soluciones" className={ui.heroSecondary}>Explorar soluciones</Link></div></div></section>

    <footer className={ui.footer}><div className={ui.footerTop}><Link href="/" className={ui.brand}><span>HL</span><b>Habitación Llena</b><small>Hotel OS</small></Link><p>Hospitality software diseñado desde la operación real.</p></div><div className={ui.footerGrid}><div><b>Producto</b><Link href="/soluciones">Soluciones</Link><a href="#producto">PMS</a><a href="#integraciones">Integraciones</a><a href="#migracion">Migración</a></div><div><b>Hotel</b><span>Recepción</span><span>Housekeeping</span><span>Revenue</span><span>Guest CRM</span></div><div><b>Empresa</b><Link href="/login">Ingresar</Link><Link href="/registro">Crear cuenta</Link><a href="mailto:contacto@habitacionllena.com">Contacto</a></div><div><b>Legal</b><a href="#" onClick={e=>{e.preventDefault();window.dispatchEvent(new Event("hl:cookie-settings"))}}>Preferencias de cookies</a><Link href="/privacidad">Privacidad</Link><Link href="/cookies">Cookies</Link><Link href="/terminos">Términos</Link><Link href="/seguridad">Seguridad</Link></div></div><div className={ui.footerBottom}><span>© 2026 HabitaciónLlena.com</span><span>Argentina · Sudamérica · Global ready</span></div></footer>
  </main>
}
