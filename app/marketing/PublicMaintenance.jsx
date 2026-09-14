import Link from"next/link"
import s from"./public-maintenance.module.css"

export default function PublicMaintenance(){return <main className={s.page}>
  <div className={s.glowOne}/><div className={s.glowTwo}/>
  <section className={s.card}>
    <h1>Estamos preparando<br/><em>la próxima versión.</em></h1>
    <p>Habitación Llena todavía no está disponible públicamente. Estamos terminando detalles de producto, seguridad y experiencia antes de abrir el acceso.</p>
    <div className={s.progress}><span/><span/><span/><span/></div>
    <div className={s.actions}><Link href="/login">Acceso clientes <span>→</span></Link></div>
  </section>
</main>}
