import Link from"next/link"
import s from"./public-maintenance.module.css"

export default function PublicMaintenance(){return <main className={s.page}>
  <div className={s.glowOne}/><div className={s.glowTwo}/>
  <section className={s.card}>
    <div className={s.brand}><span>HL</span><div><b>Habitación Llena</b><small>HOTEL OPERATING SYSTEM</small></div></div>
    <div className={s.status}><i/>EN PREPARACIÓN</div>
    <h1>Estamos preparando<br/><em>la próxima versión.</em></h1>
    <p>Habitación Llena todavía no está disponible públicamente. Estamos terminando detalles de producto, seguridad y experiencia antes de abrir el acceso.</p>
    <div className={s.progress}><span/><span/><span/><span/></div>
    <div className={s.actions}><Link href="/login">Acceso clientes <span>→</span></Link></div>
    <footer><span>Hecho para hotelería</span><span>Buenos Aires · Argentina</span></footer>
  </section>
</main>}
