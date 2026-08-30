import ui from "../marketing.module.css"
const topics=[
  ["¿Qué es un PMS hotelero?","El núcleo operativo que centraliza reservas, disponibilidad, huéspedes, check-in/out, habitaciones, cobros y reportes. Habitación Llena extiende ese núcleo hacia revenue, housekeeping, mantenimiento y experiencia del huésped."],
  ["¿Por qué integrar motor de reservas y PMS?","Porque una reserva directa debería consumir el mismo inventario y reglas que recepción. Eso reduce carga manual y ayuda a evitar solapamientos."],
  ["¿Qué aporta un CRM hotelero?","Conserva preferencias, historial, incidencias y valor del huésped para que una segunda estadía no empiece desde cero."],
  ["¿Cómo se evita el overbooking?","La disponibilidad no debe depender solo de la pantalla. Habitación Llena protege operaciones críticas también en la base de datos y usa movimientos atómicos."],
]
export default function Authority(){return <section className={ui.authority}><div className={ui.wrap}><div className={ui.sectionHead}><small>GUÍA HOTELERA</small><h2>La tecnología tiene que poder explicarse.</h2><p>Contenido pensado para hoteles que están comparando PMS, motores, channel managers, revenue y herramientas operativas.</p></div><div className={ui.faq}>{topics.map(([q,a])=><article key={q}><h3>{q}</h3><p>{a}</p></article>)}</div></div></section>}
