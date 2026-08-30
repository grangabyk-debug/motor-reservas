import Link from "next/link"
import Hero from "./sections/Hero"
import ProductStory from "./sections/ProductStory"
import HotelierStory from "./sections/HotelierStory"
import Authority from "./sections/Authority"
import HotelPotentialCalculator from "./HotelPotentialCalculator"
import ui from "./marketing.module.css"

const capabilities=[
  ["Recepción","Command Center, reservas, check-in/out, huéspedes, pagos y llaves."],
  ["Operación","Habitaciones, housekeeping, mantenimiento y recursos bajo el mismo turno."],
  ["Revenue","Tarifas diarias, restricciones, forecast, ritmo, ocupación y recomendaciones explicables."],
  ["Comercial","Empresas, agencias, grupos, upselling, motor directo y distribución."],
  ["Administración","Caja, folios, facturación, reportes y trazabilidad por propiedad."],
  ["Llena Intelligence","Una inteligencia que entiende el contexto real del hotel y propone acciones seguras."],
]

export default function MarketingHome(){
  const schema={"@context":"https://schema.org","@type":"SoftwareApplication",name:"Habitación Llena",applicationCategory:"BusinessApplication",operatingSystem:"Web",description:"Hospitality Operating System y PMS hotelero para operación, reservas, huéspedes, revenue y housekeeping."}
  return <main className={ui.page}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>
    <nav className={ui.nav}><div className={ui.wrap}><Link className={ui.brand} href="/"><span>HL</span><b>Habitación Llena</b><small>Hotel OS</small></Link><div className={ui.links}><a href="#producto">Producto</a><a href="#sistema">Sistema</a><a href="#oportunidad">Diagnóstico</a><a href="#hotelero">Por qué nosotros</a></div><div className={ui.navActions}><Link className={ui.ghost} href="/login">Ingresar</Link><Link className={ui.primary} href="/registro">Solicitar acceso</Link></div></div></nav>
    <Hero/>
    <div className={ui.ribbon}><div><span>PMS hotelero</span><i/><span>Command Center</span><i/><span>Guest CRM</span><i/><span>Revenue Intelligence</span><i/><span>Housekeeping</span><i/><span>Web Check-in</span><i/><span>Motor directo</span></div></div>
    <ProductStory/>
    <section className={ui.capabilities} id="sistema"><div className={ui.wrap}><div className={ui.sectionHead}><small>UNA SOLA OPERACIÓN</small><h2>Profundo por dentro.<br/><em>Simple por fuera.</em></h2><p>No queremos un menú con quince destinos compitiendo por atención. El hotel se organiza como trabaja: Recepción, Operación, Comercial, Administración y Hotel.</p></div><div className={ui.capGrid}>{capabilities.map((item,i)=><article key={item[0]}><span>0{i+1}</span><h3>{item[0]}</h3><p>{item[1]}</p></article>)}</div></div></section>
    <HotelPotentialCalculator/>
    <HotelierStory/>
    <Authority/>
    <section className={ui.final}><div className={ui.wrap}><div><small>EL PRÓXIMO ESCRITORIO DEL HOTEL</small><h2>Que el sistema acompañe.<br/>Que la hospitalidad se note.</h2><p>Habitación Llena está diseñado para que recepción, operación y dirección compartan el mismo contexto sin convertir el hotel en una planilla.</p></div><div><Link className={ui.gold} href="/registro">Solicitar acceso</Link><Link className={ui.finalGhost} href="/preview/pms-next">Ver experiencia</Link></div></div></section>
    <footer className={ui.footer}><div className={ui.wrap}><span>© 2026 Habitación Llena · Hospitality Operating System</span><div><Link href="/login">Ingresar</Link><Link href="/registro">Acceso</Link></div></div></footer>
  </main>
}
