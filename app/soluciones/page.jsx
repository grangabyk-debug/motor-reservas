import Link from"next/link"
import ui from"./soluciones.module.css"

export const metadata={
  title:"Soluciones hoteleras | Habitación Llena",
  description:"Operación, reservas, ingresos y experiencia del huésped conectados en un solo PMS hotelero.",
  alternates:{canonical:"https://www.habitacionllena.com/soluciones"},
}

const pillars=[
  {
    id:"operacion",
    number:"01",
    eyebrow:"OPERACIÓN",
    title:"El turno completo, en contexto.",
    copy:"Recepción, Planning, habitaciones, Housekeeping, mantenimiento, llaves y equipo trabajan sobre la misma estadía.",
    features:["Planning y calendario operativo","Reservas y asignación de habitaciones","Housekeeping e inspecciones","Mantenimiento e incidencias","Llaves y accesos","Equipo, roles y permisos"],
  },
  {
    id:"ventas",
    number:"02",
    eyebrow:"RESERVAS & DISTRIBUCIÓN",
    title:"Vender sin perder el control del inventario.",
    copy:"Tarifas, disponibilidad, paquetes, agencias y grupos viven alrededor del mismo inventario que usa recepción.",
    features:["Tarifas y restricciones","Packs y adicionales","Agencias y empresas","Grupos y rooming list","Motor de reserva directa","Llena Connect / conectividad"],
  },
  {
    id:"ingresos",
    number:"03",
    eyebrow:"INGRESOS & CONTROL",
    title:"Entender qué entra, qué falta y qué conviene mover.",
    copy:"Caja, pagos, folios, reportes y lectura comercial sin separar la información de la reserva que la originó.",
    features:["Caja y movimientos","Pagos y garantías","Facturación y folios","Reportes operativos","Contabilidad hotelera","Revenue y lectura de demanda"],
  },
  {
    id:"huesped",
    number:"04",
    eyebrow:"EXPERIENCIA DEL HUÉSPED",
    title:"Menos trámites delante del huésped.",
    copy:"Identidad, documentos, preferencias, web check-in, mensajes y accesos quedan asociados al mismo perfil y a su estadía.",
    features:["Guest CRM e historial","Web check-in","Documentos del huésped","Mensajería y plantillas","Preferencias y memoria","Upselling y servicios"],
  },
]

export default function SolucionesPage(){return <main className={ui.page}>
  <nav className={ui.nav}><Link className={ui.brand} href="/">HabitaciónLlena.com</Link><div><Link href="/">Inicio</Link><a href="#pilares">Soluciones</a><Link className={ui.login} href="/login">Ingresar</Link><Link className={ui.primary} href="/registro">Crear cuenta</Link></div></nav>

  <header className={ui.hero}>
    <span>HOSPITALITY OPERATING SYSTEM</span>
    <h1>Un hotel no necesita más módulos.<br/><em>Necesita que todo se entienda.</em></h1>
    <p>Habitación Llena organiza el producto alrededor de cuatro trabajos reales del hotel: operar, vender, controlar ingresos y cuidar la experiencia del huésped.</p>
    <div className={ui.heroActions}><Link className={ui.primary} href="/registro">Quiero verlo en mi hotel →</Link><a href="#pilares">Ver soluciones</a></div>
    <section className={ui.overview} aria-label="Resumen de soluciones">
      <article><small>HOY</small><b>12</b><span>Llegadas</span></article>
      <article><small>EN CASA</small><b>83</b><span>Huéspedes</span></article>
      <article><small>POR LIBERAR</small><b>4</b><span>Habitaciones</span></article>
      <article><small>OCUPACIÓN</small><b>78%</b><span>Operación viva</span></article>
    </section>
  </header>

  <section className={ui.pillars} id="pilares">
    <div className={ui.sectionHead}><small>CUATRO PILARES</small><h2>La misma información,<br/>vista por quien la necesita.</h2><p>No son productos separados: cada área comparte reservas, habitaciones, huéspedes y reglas de la propiedad.</p></div>
    {pillars.map((pillar,index)=><article className={`${ui.pillar} ${index%2?ui.reverse:""}`} id={pillar.id} key={pillar.id}>
      <div className={ui.copy}><small>{pillar.number} · {pillar.eyebrow}</small><h3>{pillar.title}</h3><p>{pillar.copy}</p><div className={ui.features}>{pillar.features.map(feature=><span key={feature}>✓ {feature}</span>)}</div></div>
      <div className={ui.mock} aria-hidden="true">
        <header><i/><i/><i/><b>Habitación Llena</b><small>{pillar.eyebrow}</small></header>
        <div className={ui.mockBody}>
          <aside><b>HL</b><i/><i/><i/><i/></aside>
          <section><div className={ui.mockTop}><span>{pillar.eyebrow}</span><b>{index===0?"Turno de hoy":index===1?"Inventario y venta":index===2?"Control del hotel":"Perfil del huésped"}</b></div>{pillar.features.slice(0,4).map((feature,i)=><div className={ui.mockRow} key={feature}><strong>{String(i+1).padStart(2,"0")}</strong><span>{feature}</span><em>{i===0?"Ahora":i===1?"Conectado":"Listo"}</em></div>)}</section>
        </div>
      </div>
    </article>)}
  </section>

  <section className={ui.principle}><small>UNA SOLA OPERACIÓN</small><h2>La reserva no debería cambiar de sistema cada vez que cambia de responsable.</h2><p>Ese es el criterio de Habitación Llena: recepción, pisos, administración y dirección trabajan sobre el mismo contexto, con permisos y vistas distintas.</p></section>

  <section className={ui.cta}><small>HABITACIÓN LLENA</small><h2>Que el equipo aprenda el hotel.<br/><em>No dónde está cada dato.</em></h2><p>Probá una operación hotelera más simple y coherente, desde la primera reserva hasta el check-out.</p><div><Link className={ui.primary} href="/registro">Crear cuenta →</Link><Link href="/login">Ya tengo acceso</Link></div></section>

  <footer><Link className={ui.brand} href="/">HabitaciónLlena.com</Link><span>Hospitality Operating System · 2026</span><div><Link href="/">Inicio</Link><Link href="/login">Ingresar</Link></div></footer>
</main>}
