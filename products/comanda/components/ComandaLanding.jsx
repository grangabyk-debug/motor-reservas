import Link from "next/link";
import styles from "../styles/comanda-v1.module.css";

const features = [
  ["🪑","Salón y mesas","Diseñá sectores, ubicá mesas y controlá ocupación, mozo y comensales desde una sola pantalla."],
  ["🍽️","Comandas en tiempo real","El pedido llega a cocina al instante, con aviso sonoro y estados Pendiente → En preparación → Listo."],
  ["💵","Caja y cobros","Abrí y cerrá caja, registrá movimientos, pagos, propinas y evitá cerrar una mesa con saldo pendiente."],
  ["📋","Carta visual","Categorías y productos claros para cargar pedidos rápido con mouse y teclado, sin depender de una pantalla táctil."],
  ["👥","Roles y auditoría","Mozo, cajero, cocina y administración con permisos distintos. Cada acción importante queda registrada."],
  ["🏨","Integración hotelera","Preparado para cargar consumos del restaurante directamente a una habitación de Habitación Llena."],
];

const faqs = [
  ["¿Necesito instalar un programa?","No. Comanda Llena funciona desde el navegador. La primera versión está pensada principalmente para PC de escritorio con mouse y teclado."],
  ["¿La cocina necesita impresora?","No. Cocina puede trabajar con su monitor de comandas en tiempo real. La impresora térmica queda en caja/restaurante para cuentas y tickets."],
  ["¿Puedo tener más de una sucursal o caja?","Sí. La arquitectura contempla múltiples sucursales, sectores, cajas, funcionarios y puestos de trabajo."],
  ["¿Qué pasa si un camarero intenta borrar un producto?","Los permisos se configuran por rol. Las anulaciones sensibles requieren autorización y motivo, y quedan auditadas."],
  ["¿Cuánto dura la prueba?","La prueba inicial es de 14 días. Durante el onboarding te guiamos para dejar configurados negocio, equipo, mesas, carta y caja."],
  ["¿Dan ayuda para configurarlo?","Sí. La landing incluye acceso a soporte técnico para acompañar la puesta en marcha cuando haga falta."],
];

export default function ComandaLanding(){
  return <main className={`${styles.page} ${styles.marketing}`}>
    <nav className={styles.nav}>
      <Link href="/comanda" className={styles.brand}><span className={styles.brandMark}>C</span>Comanda Llena</Link>
      <div className={styles.navLinks}>
        <a href="#funciones" className={styles.navLink}>Funciones</a>
        <a href="#hotel" className={styles.navLink}>Para hoteles</a>
        <a href="#preguntas" className={styles.navLink}>Preguntas frecuentes</a>
        <Link href="/comanda/login" className={styles.ghost}>Ingresar</Link>
        <Link href="/comanda/registro" className={styles.primary}>Probar 14 días</Link>
      </div>
    </nav>

    <section className={styles.hero}>
      <div>
        <span className={styles.eyebrow}>● Gestión gastronómica simple y auditable</span>
        <h1>Tu salón, cocina y caja trabajando juntos.</h1>
        <p>Comanda Llena organiza mesas, camareros, comandas, cocina, caja y carta en un sistema online pensado para restaurantes, bares y gastronomía hotelera.</p>
        <div className={styles.heroActions}>
          <Link href="/comanda/registro" className={styles.primary}>Empezar prueba gratis</Link>
          <Link href="/comanda/login" className={styles.ghost}>Ya tengo cuenta</Link>
        </div>
        <div className={styles.fine}>14 días de prueba · Sin tarjeta para empezar · Onboarding guiado</div>
      </div>
      <div className={styles.heroPanel} aria-label="Vista previa de salón">
        <div className={styles.mockTop}><b>Comanda Llena · Salón</b><span>Caja activa ●</span></div>
        <div className={styles.mockGrid}>
          {[1,2,3,4,5,6,7,8].map((n)=><div key={n} className={`${styles.mockTable} ${n===3||n===6?styles.mockTableBusy:""}`}>Mesa {n}</div>)}
          <div className={styles.mockTicket}><b>Cocina · Mesa 6</b><div className={styles.mockLine}/><div className={styles.mockLine}/><div className={styles.mockLine}/></div>
          <div className={styles.mockTicket}><b>Estado: En preparación</b><div className={styles.mockLine}/><div className={styles.mockLine}/></div>
        </div>
      </div>
    </section>

    <section id="funciones" className={styles.section}>
      <div className={styles.sectionTitle}><h2>Todo el circuito del restaurante, en un solo lugar.</h2><p>Basado en un flujo real de operación: abrir mesa, tomar pedido, enviar a cocina, preparar, cobrar, imprimir y cerrar.</p></div>
      <div className={styles.features}>{features.map(([icon,title,text])=><article className={styles.feature} key={title}><div className={styles.featureIcon}>{icon}</div><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>

    <section id="hotel" className={styles.hospitality}>
      <div className={styles.hospitalityInner}>
        <div><span className={styles.eyebrow}>Hospitalidad conectada</span><h2>Restaurante + PMS, sin duplicar trabajo.</h2><p>Comanda Llena comparte ecosistema con Habitación Llena, pero mantiene código y datos gastronómicos separados. Eso permite integrarlos de forma controlada cuando conviene.</p><p>La idea es que un hotel pueda usar PMS y restaurante juntos y, por ejemplo, enviar un consumo de restaurante a la cuenta de una habitación.</p></div>
        <div className={styles.integrationCard}><div className={styles.integrationFlow}><span className={styles.integrationPill}>Habitación Llena</span><b>＋</b><span className={styles.integrationPill}>Comanda Llena</span><b>→</b><span className={styles.integrationPill}>Cuenta del huésped</span></div></div>
      </div>
    </section>

    <section id="preguntas" className={styles.section}>
      <div className={styles.sectionTitle}><h2>Preguntas frecuentes</h2><p>Lo necesario para empezar sin depender de una instalación compleja.</p></div>
      <div className={styles.faq}>{faqs.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
    </section>

    <section className={styles.cta}><div><h2>Configurá tu restaurante en una tarde.</h2><p>Creá la cuenta, revisá mesas, equipo, carta y caja con el onboarding guiado.</p></div><div className={styles.heroActions}><Link href="/comanda/registro" className={styles.darkButton}>Probar 14 días</Link><a className={styles.ghost} href="https://wa.me/5491159609135?text=Hola%2C%20necesito%20ayuda%20con%20Comanda%20Llena" target="_blank" rel="noreferrer">Soporte técnico</a></div></section>
    <footer className={styles.footer}>Comanda Llena · Gestión gastronómica del ecosistema Llena</footer>
  </main>
}