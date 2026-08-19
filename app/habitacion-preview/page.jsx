import Link from 'next/link'
import styles from './habitacion-preview.module.css'

export const metadata={title:'Habitación Llena | Preview pequeños alojamientos',description:'Sistema hotelero simple para hosterías, cabañas y hoteles independientes.',robots:{index:false,follow:false}}

const features=[
 ['Calendario claro','Reservas, entradas y salidas en una vista que se entiende sin capacitación eterna.'],
 ['Huéspedes y cobros','Datos, estadías, pagos y saldos unidos a cada reserva.'],
 ['Reservas directas','Tu web y un motor simple para recibir consultas y reservas sin depender sólo de portales.'],
 ['Housekeeping simple','Qué habitación sale, cuál entra y qué hay que preparar hoy.'],
 ['Desde el celular','Revisá ocupación, una reserva o un cobro aunque no estés en recepción.'],
 ['Informes que sirven','Ocupación, ingresos y próximos movimientos sin tableros llenos de métricas innecesarias.'],
]

export default function HabitacionPreview(){return <main className={styles.page}>
 <header className={styles.header}>
  <Link href="/habitacion-preview" className={styles.brand}><img src="/logo-habitacion-llena.png" alt="Habitación Llena"/><span>Habitación Llena</span></Link>
  <nav><a href="#simple">El sistema</a><a href="#crecer">Crecer</a><a href="#planes">Planes</a></nav>
  <div className={styles.headerActions}><Link href="/login">Ingresar</Link><a href="#demo" className={styles.primarySmall}>Ver demo</a></div>
 </header>

 <section className={styles.hero}>
  <div className={styles.heroCopy}>
   <span className={styles.eyebrow}>PARA HOSTERÍAS · CABAÑAS · POSADAS · HOTELES CHICOS</span>
   <h1>Tu alojamiento necesita un sistema simple.<br/><em>No uno imposible.</em></h1>
   <p>Reservas, huéspedes, cobros y venta directa en un solo lugar. Pensado para el dueño que quiere profesionalizar su alojamiento sin convertir su recepción en una oficina de sistemas.</p>
   <div className={styles.heroActions}><a href="#demo" className={styles.primary}>Ver cómo se usa</a><a href="#simple" className={styles.secondary}>Qué incluye</a></div>
   <div className={styles.heroTrust}><span>Arranque guiado</span><span>Uso desde celular</span><span>Sin módulos que no necesitás</span></div>
  </div>
  <div className={styles.heroVisual}>
   <img src="https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1100&q=82" alt="Hostería pequeña rodeada de naturaleza"/>
   <div className={styles.floatCard}><span>HOY</span><b>8 habitaciones</b><small>6 ocupadas · 1 entrada · 2 salidas</small></div>
   <div className={styles.floatReserve}><i/><span><b>Nueva reserva directa</b><small>3 noches · Habitación doble</small></span></div>
  </div>
 </section>

 <section className={styles.statement}><span>MENOS SOFTWARE. MÁS HOTEL.</span><h2>Si hoy manejás reservas entre WhatsApp, una agenda y una planilla, no necesitás empezar con un PMS gigante.</h2><p>Necesitás ordenar lo cotidiano primero. Después el sistema puede acompañar el crecimiento.</p></section>

 <section className={styles.simple} id="simple">
  <div className={styles.sectionTitle}><span>EL PRIMER PASO</span><h2>Todo lo necesario para dejar de improvisar.</h2><p>Una base hotelera seria, pero presentada de forma simple para que el equipo pueda empezar a usarla rápido.</p></div>
  <div className={styles.featureGrid}>{features.map(([title,copy],i)=><article key={title}><i>{String(i+1).padStart(2,'0')}</i><h3>{title}</h3><p>{copy}</p></article>)}</div>
 </section>

 <section className={styles.demo} id="demo">
  <div className={styles.demoCopy}><span>UNA MAÑANA EN RECEPCIÓN</span><h2>El día empieza viendo qué pasa, no buscando información.</h2><p>La pantalla principal prioriza llegadas, salidas, habitaciones ocupadas, pendientes y cobros. Lo urgente aparece primero.</p><ul><li>Quién llega hoy</li><li>Quién se va</li><li>Qué habitación falta preparar</li><li>Qué reserva tiene saldo pendiente</li></ul></div>
  <div className={styles.calendar}>
   <div className={styles.calendarTop}><span>AGOSTO 2026</span><b>Hostería Los Aromos · 8 habitaciones</b><small>Vista semanal</small></div>
   <div className={styles.days}><span>HAB.</span><span>LUN 17</span><span>MAR 18</span><span>MIÉ 19</span><span>JUE 20</span><span>VIE 21</span></div>
   <div className={styles.room}><b>Doble 1</b><i className={styles.in} style={{gridColumn:'2 / 4'}}>L. Suárez · IN</i><i className={styles.out} style={{gridColumn:'4 / 5'}}>OUT</i><i className={styles.future} style={{gridColumn:'5 / 7'}}>M. Ríos</i></div>
   <div className={styles.room}><b>Doble 2</b><i className={styles.future} style={{gridColumn:'3 / 6'}}>Familia Díaz</i></div>
   <div className={styles.room}><b>Triple 3</b><i className={styles.in} style={{gridColumn:'2 / 5'}}>P. Gómez · IN</i><i className={styles.out} style={{gridColumn:'5 / 6'}}>OUT</i></div>
   <div className={styles.room}><b>Suite 4</b><i className={styles.empty} style={{gridColumn:'2 / 4'}}>Disponible</i><i className={styles.future} style={{gridColumn:'4 / 7'}}>A. Molina</i></div>
   <div className={styles.legend}><span><i className={styles.dotIn}/>Hospedado</span><span><i className={styles.dotOut}/>Sale</span><span><i className={styles.dotFuture}/>Reserva futura</span></div>
  </div>
 </section>

 <section className={styles.growth} id="crecer">
  <div className={styles.growthImage}><img src="https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=1000&q=82" alt="Cabaña de alojamiento independiente"/></div>
  <div className={styles.growthCopy}><span>CRECE CUANDO VOS CRECÉS</span><h2>Primero ordenamos el hotel. Después ayudamos a vender mejor.</h2><p>El CRM inicial no depende de Meta ni de una integración compleja. Empieza con información que ya es tuya: huéspedes, estadías, consultas y seguimiento.</p><div className={styles.growthList}><article><b>Base de huéspedes</b><small>Historial, notas y preferencias útiles.</small></article><article><b>Seguimiento de consultas</b><small>Quién preguntó, por qué fecha y si quedó pendiente.</small></article><article><b>Emails y recordatorios</b><small>Pre check-in, post estadía y mensajes reutilizables.</small></article><article><b>Venta directa</b><small>Web, promociones y motor de reservas propio.</small></article></div></div>
 </section>

 <section className={styles.direct}><div><span>NO HACE FALTA TENER 80 HABITACIONES</span><h2>Una hostería de 8 habitaciones también merece operar profesionalmente.</h2></div><img src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=82" alt="Pequeño hotel con recepción cálida"/></section>

 <section className={styles.plans} id="planes">
  <div className={styles.sectionTitle}><span>EMPEZÁ POR LO QUE NECESITÁS</span><h2>Una escalera, no una pared de módulos.</h2><p>La idea comercial es que un alojamiento chico pueda entrar con lo esencial y sumar herramientas cuando realmente las necesite.</p></div>
  <div className={styles.planGrid}><article><span>INICIO</span><h3>Operación simple</h3><p>Para dejar agenda, papel y planillas.</p><ul><li>Calendario y reservas</li><li>Huéspedes</li><li>Cobros y caja</li><li>Housekeeping básico</li><li>Reportes esenciales</li></ul><a href="#demo">Ver sistema</a></article><article className={styles.featured}><span>DIRECTAS</span><h3>Operación + ventas</h3><p>Para empezar a depender menos de intermediarios.</p><ul><li>Todo Inicio</li><li>Web del alojamiento</li><li>Motor de reservas</li><li>Promociones</li><li>Seguimiento de consultas</li></ul><a href="#demo">Más recomendado</a></article><article><span>CRECIMIENTO</span><h3>Más automatización</h3><p>Para el alojamiento que ya dio el primer paso.</p><ul><li>Todo Directas</li><li>CRM hotelero liviano</li><li>Recordatorios</li><li>Más reportes</li><li>Integraciones progresivas</li></ul><a href="#crecer">Ver crecimiento</a></article></div>
  <small className={styles.planNote}>Preview comercial: nombres y estructura de planes sujetos a validación antes de publicarlos.</small>
 </section>

 <section className={styles.final}><img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80" alt="Alojamiento boutique pequeño"/><div><span>HABITACIÓN LLENA</span><h2>Tu primer sistema hotelero puede sentirse fácil desde el primer día.</h2><a href="#demo">Conocer la experiencia</a></div></section>
 <footer className={styles.footer}><b>Habitación Llena</b><span>Preview aislado · no modifica Comanda Llena · no publicado en producción</span></footer>
 </main>}
