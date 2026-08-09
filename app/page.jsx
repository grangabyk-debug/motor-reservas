import Link from "next/link"

const faqs = [
  {
    q: "¿Qué es Habitación Llena?",
    a: "Es una plataforma de gestión para alojamientos independientes. Centraliza reservas, calendario, habitaciones, huéspedes, operación diaria y la información que necesitás para manejar tu alojamiento desde un solo lugar.",
  },
  {
    q: "¿Para qué tipo de alojamiento está pensado?",
    a: "Está pensado especialmente para hosterías, cabañas, posadas, hoteles pequeños, complejos turísticos y otros alojamientos independientes que necesitan ordenar su operación sin meterse en un sistema enorme y difícil de usar.",
  },
  {
    q: "¿Pueden usarlo varias personas del equipo?",
    a: "Sí. Habitación Llena contempla usuarios con distintos roles, para que cada persona pueda acceder a las funciones que necesita según su tarea.",
  },
  {
    q: "¿Puedo usarlo desde el celular?",
    a: "Sí. La plataforma está pensada para funcionar desde navegador y adaptarse a pantallas chicas, para que puedas consultar la operación aunque no estés frente a una computadora.",
  },
  {
    q: "¿Puedo gestionar reservas y habitaciones desde el mismo lugar?",
    a: "Sí. El sistema reúne la información de las reservas y las habitaciones para que recepción y administración tengan una visión más clara de lo que está pasando en el alojamiento.",
  },
  {
    q: "¿Necesito saber de tecnología para usarlo?",
    a: "No. La idea de Habitación Llena es justamente simplificar la gestión. La configuración está pensada para que un alojamiento pequeño pueda empezar sin una implementación técnica complicada.",
  },
  {
    q: "¿Qué pasa con mis reservas actuales?",
    a: "Podés comenzar cargando tus reservas en el sistema y, a medida que avancemos con nuevas herramientas de importación, la puesta en marcha será cada vez más simple.",
  },
  {
    q: "¿Tiene Channel Manager y conexión con Booking.com y Airbnb?",
    a: "Estamos incorporando integraciones y herramientas de distribución progresivamente. Si necesitás una conexión específica, podés consultarnos antes de contratar para confirmar si está disponible.",
  },
  {
    q: "¿Tiene motor de reservas para recibir reservas directas?",
    a: "La plataforma está evolucionando hacia una solución cada vez más completa para reservas directas. Las funciones disponibles y las próximas incorporaciones se comunicarán claramente para que sepas qué incluye cada etapa.",
  },
  {
    q: "¿Tiene housekeeping?",
    a: "Sí. Habitación Llena contempla la operación de housekeeping y el seguimiento del estado de las habitaciones, para que recepción y limpieza puedan trabajar con una misma información.",
  },
  {
    q: "¿Hay una prueba gratuita?",
    a: "Sí. La propuesta actual es ofrecer 14 días de prueba para que puedas cargar tu alojamiento, conocer la plataforma y comprobar si se adapta a tu forma de trabajar antes de tomar una decisión.",
  },
  {
    q: "¿Necesito firmar un contrato?",
    a: "La propuesta de Habitación Llena está pensada para que puedas probar el producto y decidir si realmente te sirve. Las condiciones comerciales definitivas se informarán claramente antes de contratar.",
  },
]

const features = [
  ["01", "Reservas", "Creá, editá y cancelá reservas desde un mismo lugar, con la información de cada huésped y alojamiento."],
  ["02", "Calendario", "Visualizá disponibilidad y ocupación sin depender de planillas que se desactualizan."],
  ["03", "Habitaciones", "Tené una vista rápida del estado de tus habitaciones y de la operación diaria."],
  ["04", "Housekeeping", "Coordiná el estado operativo de las habitaciones y facilitá el trabajo del equipo."],
  ["05", "Huéspedes", "Centralizá la información necesaria para atender mejor a quienes se alojan."],
  ["06", "Caja y pagos", "Ordená la información económica de las reservas y avanzá hacia una gestión más clara de cobros."],
  ["07", "Usuarios y roles", "Dale acceso a tu equipo sin tener que compartir una misma cuenta."],
  ["08", "Asistente IA", "Consultá la operación y prepará el camino para tomar decisiones con información del alojamiento."],
]

const steps = [
  ["1", "Creá tu cuenta", "Empezá en minutos y configurá los datos básicos de tu alojamiento."],
  ["2", "Cargá tus habitaciones", "Definí tus unidades y dejá lista la estructura con la que vas a trabajar."],
  ["3", "Empezá a gestionar", "Cargá reservas, organizá la operación y centralizá la información de tu equipo."],
]

export default function LandingPage() {
  return (
    <main style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; background: #f7f9fc; }
        a { -webkit-tap-highlight-color: transparent; }
        .hl-container { width: min(1180px, calc(100% - 40px)); margin: 0 auto; }
        .hl-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .hl-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .hl-hero-grid { display: grid; grid-template-columns: 1.02fr .98fr; gap: 58px; align-items: center; }
        .hl-step-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .hl-dark-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
        .hl-ai-box { display: grid; grid-template-columns: 1fr 420px; gap: 50px; align-items: center; }
        .hl-nav-links { display: flex; align-items: center; gap: 8px; }
        .hl-mobile-hide { display: block; }
        .hl-dashboard { transform: rotate(1deg); transition: transform .3s ease, box-shadow .3s ease; }
        .hl-dashboard:hover { transform: rotate(0deg) translateY(-4px); box-shadow: 0 35px 90px rgba(0,45,110,.22) !important; }
        .hl-faq details { background: #fff; border: 1px solid #e3e8f0; border-radius: 14px; padding: 0 20px; }
        .hl-faq details + details { margin-top: 10px; }
        .hl-faq summary { cursor: pointer; list-style: none; padding: 20px 28px 20px 0; font-weight: 800; position: relative; }
        .hl-faq summary::-webkit-details-marker { display: none; }
        .hl-faq summary:after { content: "+"; position: absolute; right: 2px; top: 15px; font-size: 24px; font-weight: 400; color: #006ce4; }
        .hl-faq details[open] summary:after { content: "−"; }
        .hl-faq details p { color: #667085; line-height: 1.7; margin: 0 0 20px; max-width: 850px; }
        .hl-btn { transition: transform .2s ease, box-shadow .2s ease; }
        .hl-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0,108,228,.2); }
        .hl-feature:hover { transform: translateY(-3px); border-color: #cbd8ea !important; box-shadow: 0 14px 35px rgba(16,34,68,.07); }
        .hl-feature { transition: .2s ease; }
        @media (max-width: 920px) {
          .hl-hero-grid { grid-template-columns: 1fr; }
          .hl-grid-4 { grid-template-columns: repeat(2, 1fr); }
          .hl-dashboard { transform: none; }
          .hl-dark-grid, .hl-ai-box { grid-template-columns: 1fr; }
        }
        @media (max-width: 720px) {
          .hl-container { width: min(100% - 28px, 1180px); }
          .hl-nav-links .hl-secondary { display: none; }
          .hl-grid-3, .hl-step-grid { grid-template-columns: 1fr; }
          .hl-grid-4 { grid-template-columns: 1fr 1fr; }
          .hl-mobile-hide { display: none; }
          .hl-hero { padding-top: 58px !important; }
        }
        @media (max-width: 460px) {
          .hl-grid-4 { grid-template-columns: 1fr; }
        }
      `}</style>

      <header style={styles.header}>
        <div style={styles.headerInner}>
          <Link href="/" style={styles.logo}>
            <span style={styles.logoMark}>H</span>
            <span>Habitación Llena</span>
          </Link>

          <nav className="hl-nav-links">
            <a href="#funciones" className="hl-secondary" style={styles.navLink}>Funciones</a>
            <a href="#como-funciona" className="hl-secondary" style={styles.navLink}>Cómo funciona</a>
            <a href="#preguntas" className="hl-secondary" style={styles.navLink}>Preguntas</a>
            <Link href="/login" style={styles.login}>Ingresar</Link>
            <Link href="/registro" className="hl-btn" style={styles.headerCta}>Probar gratis</Link>
          </nav>
        </div>
      </header>

      <section className="hl-hero hl-hero-grid hl-container" style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>
            <span style={styles.liveDot} /> PMS para alojamientos independientes
          </div>

          <h1 style={styles.heroTitle}>
            Tu alojamiento.
            <br />
            <span style={styles.gradientText}>Todo bajo control.</span>
          </h1>

          <p style={styles.heroText}>
            Reservas, calendario, habitaciones, huéspedes y operación diaria en una sola plataforma.
            <strong> Menos planillas. Menos mensajes. Más control.</strong>
          </p>

          <div style={styles.heroActions}>
            <Link href="/registro" className="hl-btn" style={styles.primaryCta}>
              Empezar prueba gratuita →
            </Link>
            <a href="#funciones" style={styles.secondaryCta}>Ver qué incluye</a>
          </div>

          <div style={styles.trustRow}>
            <span>✓ Sin instalación</span>
            <span>✓ Desde cualquier dispositivo</span>
            <span>✓ Pensado para equipos chicos</span>
          </div>
        </div>

        <div className="hl-dashboard" style={styles.dashboard}>
          <div style={styles.browserBar}>
            <span style={{...styles.browserDot, background:"#ff6b6b"}} />
            <span style={{...styles.browserDot, background:"#ffd166"}} />
            <span style={{...styles.browserDot, background:"#35c76f"}} />
            <div style={styles.browserAddress}>app.habitacionllena.com/dashboard</div>
          </div>
          <div style={styles.dashboardTop}>
            <div>
              <div style={styles.miniLabel}>HABITACIÓN LLENA</div>
              <div style={styles.dashboardTitle}>Buenas noches, Hosteria Durazno 👋</div>
              <div style={styles.dashboardSub}>Gestioná reservas y ocupación desde un solo lugar.</div>
            </div>
            <span style={styles.statusPill}>● Operativo</span>
          </div>
          <div style={styles.metricGrid}>
            {[
              ["Alojamientos","1","Propiedades cargadas"],
              ["Habitaciones","3","Habitaciones activas"],
              ["Ocupadas hoy","1","Reservas activas"],
              ["Próximas entradas","3","Próximos 7 días"],
            ].map(([label,value,sub]) => (
              <div key={label} style={styles.metric}>
                <div style={styles.metricLabel}>{label}</div>
                <strong style={styles.metricValue}>{value}</strong>
                <div style={styles.metricSub}>{sub}</div>
              </div>
            ))}
          </div>
          <div style={styles.operation}>
            <div style={styles.operationHeader}>
              <div>
                <strong>Operación de hoy</strong>
                <span>09/08/2026</span>
              </div>
              <span style={styles.operationButton}>Housekeeping</span>
            </div>
            <div style={styles.operationGrid}>
              <div style={{...styles.operationCard, background:"#e9f9f1"}}>
                <strong style={{color:"#00875a"}}>IN DEL DÍA · 0</strong>
                <span>Sin entradas hoy.</span>
              </div>
              <div style={{...styles.operationCard, background:"#fff0f0"}}>
                <strong style={{color:"#d92d20"}}>OUT DEL DÍA · 0</strong>
                <span>Sin salidas hoy.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.trialStrip}>
        <div className="hl-container" style={styles.trialInner}>
          <div>
            <div style={styles.trialKicker}>EMPEZÁ SIN RIESGO</div>
            <h2 style={styles.trialTitle}>Probalo gratis durante 14 días.</h2>
            <p style={styles.trialText}>Conocé la plataforma, cargá tu alojamiento y comprobá si encaja con tu forma de trabajar.</p>
          </div>
          <Link href="/registro" className="hl-btn" style={styles.trialCta}>Crear mi cuenta gratis →</Link>
        </div>
      </section>

      <section id="funciones" style={styles.section}>
        <div className="hl-container">
          <div style={styles.sectionHeading}>
            <div style={styles.sectionEyebrow}>TODO EN UN SOLO LUGAR</div>
            <h2 style={styles.sectionTitle}>Menos herramientas. Más claridad.</h2>
            <p style={styles.sectionText}>
              Una operación hotelera no debería depender de una planilla para una cosa, WhatsApp para otra y cinco pestañas abiertas para saber qué pasa.
            </p>
          </div>

          <div className="hl-grid-4">
            {features.map(([number,title,text]) => (
              <div className="hl-feature" key={title} style={styles.feature}>
                <div style={styles.featureNumber}>{number}</div>
                <h3 style={styles.featureTitle}>{title}</h3>
                <p style={styles.featureText}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={styles.darkSection}>
        <div className="hl-container hl-dark-grid" style={styles.darkGrid}>
          <div>
            <div style={styles.darkEyebrow}>HECHO PARA ALOJAMIENTOS REALES</div>
            <h2 style={styles.darkTitle}>La tecnología de un hotel grande, sin la complejidad.</h2>
            <p style={styles.darkText}>
              Habitación Llena nace pensando en el alojamiento independiente: donde muchas veces una misma persona recibe reservas, atiende huéspedes, coordina limpieza y mira la caja.
            </p>
            <Link href="/registro" className="hl-btn" style={styles.darkCta}>Quiero probarlo</Link>
          </div>
          <div className="hl-grid-3" style={{gap:12}}>
            {["Cabañas","Hosterías","Posadas","Hoteles pequeños","Complejos turísticos","Apartamentos"].map((item) => (
              <div key={item} style={styles.typeCard}>✓ {item}</div>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" style={styles.section}>
        <div className="hl-container">
          <div style={styles.sectionHeading}>
            <div style={styles.sectionEyebrow}>EMPEZÁ EN POCOS PASOS</div>
            <h2 style={styles.sectionTitle}>De cero a operativo sin vueltas.</h2>
          </div>
          <div className="hl-step-grid">
            {steps.map(([number,title,text]) => (
              <div key={number} style={styles.step}>
                <div style={styles.stepNumber}>{number}</div>
                <h3 style={styles.stepTitle}>{title}</h3>
                <p style={styles.featureText}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={styles.comparisonSection}>
        <div className="hl-container">
          <div style={styles.sectionHeading}>
            <div style={styles.sectionEyebrow}>¿TE SUENA CONOCIDO?</div>
            <h2 style={styles.sectionTitle}>De esto...</h2>
          </div>
          <div className="hl-grid-3">
            {[
              ["📱", "“¿Me confirmás si hay lugar?”", "Buscar una conversación vieja para saber qué habitación estaba disponible."],
              ["📊", "“¿Cuánto ocupamos este mes?”", "Abrir planillas, sumar datos y cruzar información de distintos lugares."],
              ["🧹", "“¿Qué habitaciones están listas?”", "Mandar mensajes al equipo para averiguar qué ya está limpio."],
            ].map(([icon,title,text]) => (
              <div key={title} style={styles.problemCard}>
                <div style={{fontSize:30}}>{icon}</div>
                <h3 style={styles.featureTitle}>{title}</h3>
                <p style={styles.featureText}>{text}</p>
              </div>
            ))}
          </div>

          <div style={styles.arrowStatement}>↓</div>

          <div style={styles.solutionBox}>
            <div style={styles.sectionEyebrow}>A ESTO</div>
            <h2 style={{...styles.sectionTitle, marginBottom:10}}>“Abrí Habitación Llena y lo veo.”</h2>
            <p style={{...styles.sectionText, margin:"0 auto", maxWidth:700}}>
              La información importante tiene que estar donde la necesitás, cuando la necesitás.
            </p>
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <div className="hl-container hl-ai-box" style={styles.aiBox}>
          <div>
            <div style={styles.sectionEyebrow}>PRÓXIMO PASO</div>
            <h2 style={styles.sectionTitle}>Tu operación también puede hablar con vos.</h2>
            <p style={styles.sectionText}>
              Estamos preparando un asistente que pueda responder preguntas sobre la operación de tu alojamiento y ayudarte a detectar información importante sin tener que buscarla manualmente.
            </p>
            <span style={styles.comingSoon}>✦ Próximamente</span>
          </div>
          <div style={styles.chatMock}>
            <div style={styles.chatHeader}>✦ Asistente IA</div>
            <div style={styles.chatBubble}>¿Cómo viene la ocupación esta semana?</div>
            <div style={styles.chatBubbleAnswer}>Tu ocupación actual es del 68%. Tenés 2 entradas próximas y 1 habitación disponible.</div>
          </div>
        </div>
      </section>

      <section id="preguntas" style={styles.faqSection}>
        <div className="hl-container">
          <div style={styles.sectionHeading}>
            <div style={styles.sectionEyebrow}>PREGUNTAS FRECUENTES</div>
            <h2 style={styles.sectionTitle}>Lo que probablemente quieras saber antes de empezar.</h2>
            <p style={styles.sectionText}>Si algo no está acá, podés consultarnos antes de crear tu cuenta.</p>
          </div>

          <div className="hl-faq">
            {faqs.map((faq) => (
              <details key={faq.q}>
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section style={styles.finalCta}>
        <div className="hl-container">
          <div style={styles.finalBadge}>14 DÍAS DE PRUEBA</div>
          <h2 style={styles.finalTitle}>Tu alojamiento merece algo mejor que una planilla.</h2>
          <p style={styles.finalText}>Probá Habitación Llena y empezá a ordenar tu operación desde hoy.</p>
          <div style={{display:"flex", justifyContent:"center", gap:12, flexWrap:"wrap"}}>
            <Link href="/registro" className="hl-btn" style={styles.finalButton}>Empezar gratis →</Link>
            <Link href="/login" style={styles.finalLogin}>Ya tengo una cuenta</Link>
          </div>
        </div>
      </section>

      <footer style={styles.footer}>
        <div className="hl-container" style={styles.footerInner}>
          <div>
            <div style={styles.logo}><span style={styles.logoMark}>H</span> Habitación Llena</div>
            <p style={{margin:"10px 0 0", color:"#8b98aa", fontSize:13}}>Gestión hotelera simple y profesional.</p>
          </div>
          <div style={styles.footerLinks}>
            <a href="#funciones" style={styles.footerLink}>Funciones</a>
            <a href="#como-funciona" style={styles.footerLink}>Cómo funciona</a>
            <a href="#preguntas" style={styles.footerLink}>Preguntas</a>
            <Link href="/login" style={styles.footerLink}>Ingresar</Link>
          </div>
        </div>
        <div className="hl-container" style={styles.footerBottom}>© {new Date().getFullYear()} Habitación Llena. Todos los derechos reservados.</div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Habitación Llena",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description: "Plataforma de gestión para hoteles, hosterías, cabañas y alojamientos independientes.",
          }),
        }}
      />
    </main>
  )
}

const styles = {
  page: { minHeight:"100vh", background:"#f7f9fc", color:"#172033", fontFamily:"Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  header: { position:"sticky", top:0, zIndex:20, height:76, background:"rgba(255,255,255,.92)", backdropFilter:"blur(14px)", borderBottom:"1px solid #e8edf3" },
  headerInner: { width:"min(1180px, calc(100% - 40px))", height:"100%", margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", gap:20 },
  logo: { display:"flex", alignItems:"center", gap:9, color:"#123b7a", textDecoration:"none", fontWeight:900, fontSize:19, letterSpacing:-.5 },
  logoMark: { display:"grid", placeItems:"center", width:31, height:31, borderRadius:9, background:"linear-gradient(135deg,#073b95,#006ce4)", color:"#fff", fontSize:15, fontWeight:900, boxShadow:"0 6px 15px rgba(0,80,180,.2)" },
  navLink: { textDecoration:"none", color:"#536176", fontWeight:700, fontSize:14, padding:"9px 10px" },
  login: { textDecoration:"none", color:"#123b7a", fontWeight:800, fontSize:14, padding:"10px 12px" },
  headerCta: { textDecoration:"none", background:"#006ce4", color:"#fff", fontWeight:850, borderRadius:10, padding:"11px 16px", boxShadow:"0 8px 20px rgba(0,108,228,.18)" },
  hero: { padding:"92px 0 82px" },
  eyebrow: { display:"inline-flex", alignItems:"center", gap:8, color:"#006ce4", fontWeight:850, fontSize:12, letterSpacing:1.15, textTransform:"uppercase" },
  liveDot: { width:8, height:8, borderRadius:99, background:"#22c55e", boxShadow:"0 0 0 5px rgba(34,197,94,.12)" },
  heroTitle: { fontSize:"clamp(46px,6.5vw,76px)", lineHeight:.99, margin:"17px 0 23px", letterSpacing:"-4px", fontWeight:900 },
  gradientText: { background:"linear-gradient(90deg,#006ce4,#0a4ca8)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" },
  heroText: { fontSize:19, lineHeight:1.65, color:"#5f6c80", maxWidth:650, margin:0 },
  heroActions: { display:"flex", gap:12, marginTop:30, flexWrap:"wrap", alignItems:"center" },
  primaryCta: { textDecoration:"none", background:"#006ce4", color:"#fff", fontWeight:850, borderRadius:11, padding:"15px 21px", boxShadow:"0 13px 30px rgba(0,108,228,.22)" },
  secondaryCta: { textDecoration:"none", color:"#24344d", fontWeight:800, border:"1px solid #dce3ec", background:"#fff", borderRadius:11, padding:"14px 19px" },
  trustRow: { display:"flex", gap:16, flexWrap:"wrap", marginTop:22, color:"#6d798a", fontSize:12, fontWeight:700 },
  dashboard: { background:"#fff", border:"1px solid #dbe3ee", borderRadius:20, padding:12, boxShadow:"0 25px 75px rgba(0,45,110,.15)" },
  browserBar: { height:28, display:"flex", alignItems:"center", gap:6, padding:"0 7px" },
  browserDot: { width:7, height:7, borderRadius:99 },
  browserAddress: { flex:1, marginLeft:8, background:"#f5f7fa", borderRadius:6, color:"#a1aab8", fontSize:8, padding:"5px 8px" },
  dashboardTop: { background:"linear-gradient(135deg,#063887,#0758c5)", color:"#fff", borderRadius:13, padding:20, display:"flex", justifyContent:"space-between", gap:12 },
  miniLabel: { fontSize:9, letterSpacing:1.5, opacity:.7, fontWeight:800 },
  dashboardTitle: { fontSize:18, fontWeight:850, marginTop:5 },
  dashboardSub: { fontSize:10, opacity:.78, marginTop:4 },
  statusPill: { alignSelf:"flex-start", background:"rgba(255,255,255,.13)", border:"1px solid rgba(255,255,255,.2)", borderRadius:99, padding:"6px 9px", fontSize:8, whiteSpace:"nowrap" },
  metricGrid: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginTop:10 },
  metric: { border:"1px solid #e9edf3", borderRadius:10, padding:11 },
  metricLabel: { color:"#7b8797", fontSize:8 },
  metricValue: { display:"block", fontSize:21, marginTop:5 },
  metricSub: { color:"#98a1ae", fontSize:7, marginTop:3 },
  operation: { border:"1px solid #e9edf3", borderRadius:10, marginTop:10, padding:12 },
  operationHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:9 },
  operationButton: { border:"1px solid #dfe5ec", borderRadius:7, padding:"6px 8px", fontSize:7 },
  operationGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:7, marginTop:9 },
  operationCard: { borderRadius:8, padding:9 },
  operationCardStrong: { fontSize:8 },
  operationCardSpan: { display:"block", color:"#667085", fontSize:7, marginTop:4 },
  trialStrip: { background:"#052f78", color:"#fff", padding:"28px 0" },
  trialInner: { display:"flex", justifyContent:"space-between", alignItems:"center", gap:30 },
  trialKicker: { color:"#8fc4ff", fontSize:10, fontWeight:900, letterSpacing:1.3 },
  trialTitle: { fontSize:25, margin:"5px 0 5px", letterSpacing:-.5 },
  trialText: { color:"#bfd5f2", margin:0, fontSize:13, lineHeight:1.5 },
  trialCta: { flexShrink:0, background:"#fff", color:"#063887", textDecoration:"none", fontWeight:900, borderRadius:10, padding:"13px 18px" },
  section: { padding:"94px 0" },
  sectionHeading: { maxWidth:760, margin:"0 auto 42px", textAlign:"center" },
  sectionEyebrow: { color:"#006ce4", fontSize:11, fontWeight:900, letterSpacing:1.4 },
  sectionTitle: { fontSize:"clamp(32px,4vw,46px)", lineHeight:1.08, letterSpacing:-2, margin:"10px 0 13px", fontWeight:900 },
  sectionText: { color:"#667085", lineHeight:1.7, fontSize:16, margin:0 },
  feature: { background:"#fff", border:"1px solid #e2e8f0", borderRadius:16, padding:22 },
  featureNumber: { color:"#9aa7b9", fontSize:10, fontWeight:900, letterSpacing:1 },
  featureTitle: { margin:"13px 0 7px", fontSize:18, letterSpacing:-.4 },
  featureText: { color:"#6b7789", lineHeight:1.6, fontSize:13, margin:0 },
  darkSection: { background:"linear-gradient(135deg,#052f78,#063b92)", color:"#fff", padding:"88px 0" },
  darkGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:60, alignItems:"center" },
  darkEyebrow: { color:"#8fc4ff", fontSize:11, fontWeight:900, letterSpacing:1.4 },
  darkTitle: { fontSize:"clamp(32px,4vw,48px)", lineHeight:1.05, letterSpacing:-2, margin:"12px 0 17px", fontWeight:900 },
  darkText: { color:"#c5d7ef", lineHeight:1.7, maxWidth:570, margin:0, fontSize:16 },
  darkCta: { display:"inline-block", marginTop:26, textDecoration:"none", background:"#fff", color:"#063887", fontWeight:900, borderRadius:10, padding:"13px 18px" },
  typeCard: { background:"rgba(255,255,255,.08)", border:"1px solid rgba(255,255,255,.12)", borderRadius:11, padding:"15px 13px", color:"#e5effc", fontSize:13, fontWeight:750 },
  step: { background:"#fff", border:"1px solid #e2e8f0", borderRadius:16, padding:25 },
  stepNumber: { width:39, height:39, display:"grid", placeItems:"center", borderRadius:12, background:"#e8f2ff", color:"#006ce4", fontWeight:900, fontSize:15 },
  stepTitle: { fontSize:19, margin:"16px 0 7px" },
  comparisonSection: { padding:"92px 0", background:"#eef3f9" },
  problemCard: { background:"#fff", border:"1px solid #e1e7ef", borderRadius:15, padding:24 },
  arrowStatement: { textAlign:"center", color:"#006ce4", fontSize:28, fontWeight:900, margin:"28px 0" },
  solutionBox: { background:"linear-gradient(135deg,#fff,#f3f8ff)", border:"1px solid #cfe0f5", borderRadius:20, padding:"45px 25px", textAlign:"center", boxShadow:"0 15px 45px rgba(18,59,122,.08)" },
  aiBox: { display:"grid", gridTemplateColumns:"1fr 420px", gap:50, alignItems:"center", background:"#fff", border:"1px solid #dfe6ef", borderRadius:22, padding:"42px 46px", boxShadow:"0 18px 55px rgba(16,34,68,.06)" },
  comingSoon: { display:"inline-block", marginTop:20, background:"#eef6ff", color:"#006ce4", borderRadius:99, padding:"8px 12px", fontSize:11, fontWeight:900 },
  chatMock: { background:"#f6f8fb", border:"1px solid #e1e7ef", borderRadius:16, padding:16 },
  chatHeader: { fontWeight:900, fontSize:13, paddingBottom:12, borderBottom:"1px solid #e1e7ef" },
  chatBubble: { margin:"16px 0 8px auto", maxWidth:"82%", background:"#006ce4", color:"#fff", borderRadius:"12px 12px 3px 12px", padding:12, fontSize:11, lineHeight:1.45 },
  chatBubbleAnswer: { maxWidth:"90%", background:"#fff", border:"1px solid #e1e7ef", borderRadius:"12px 12px 12px 3px", padding:12, color:"#667085", fontSize:11, lineHeight:1.5 },
  faqSection: { background:"#fff", padding:"94px 0" },
  finalCta: { background:"linear-gradient(135deg,#006ce4,#063b92)", color:"#fff", textAlign:"center", padding:"90px 0" },
  finalBadge: { display:"inline-block", background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.2)", borderRadius:99, padding:"7px 12px", fontSize:10, fontWeight:900, letterSpacing:1.2 },
  finalTitle: { fontSize:"clamp(35px,5vw,58px)", lineHeight:1.02, letterSpacing:-2.5, maxWidth:820, margin:"16px auto 14px", fontWeight:900 },
  finalText: { color:"#d1e2f8", fontSize:17, margin:"0 auto 28px" },
  finalButton: { display:"inline-block", textDecoration:"none", background:"#fff", color:"#063b92", fontWeight:900, borderRadius:11, padding:"15px 22px" },
  finalLogin: { display:"inline-block", textDecoration:"none", color:"#fff", border:"1px solid rgba(255,255,255,.3)", borderRadius:11, padding:"14px 19px", fontWeight:800 },
  footer: { background:"#071a38", color:"#fff", padding:"38px 0 18px" },
  footerInner: { display:"flex", justifyContent:"space-between", alignItems:"center", gap:30, paddingBottom:28 },
  footerLinks: { display:"flex", gap:18, flexWrap:"wrap" },
  footerLink: { color:"#aebbd0", textDecoration:"none", fontSize:12, fontWeight:700 },
  footerBottom: { borderTop:"1px solid rgba(255,255,255,.08)", paddingTop:15, color:"#71809a", fontSize:11 },
}
