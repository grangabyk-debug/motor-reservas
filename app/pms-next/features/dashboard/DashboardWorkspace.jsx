import s from"../../pms-next.module.css"

const cards=[
  ["Llegadas","12","4 pendientes"],
  ["Salidas","9","2 late checkout"],
  ["Ocupación","78%","24 de 31 habitaciones"],
  ["Pendiente","$ 482.300","folios abiertos"],
]

export default function DashboardWorkspace({onPlanning}){
  return <section className={s.dashboardPage}>
    <div className={s.heroPanel}><div><small>VIERNES · OPERACIÓN DE HOY</small><h1>Buen día, recepción.</h1><p>Una vista simple para saber qué necesita atención ahora mismo.</p><button type="button" onClick={onPlanning}>Abrir planning</button></div><aside><span>Hoy</span><b>78%</b><small>ocupación</small></aside></div>
    <div className={s.metricGrid}>{cards.map(([label,value,note])=><article key={label} className={s.metricCard}><small>{label}</small><b>{value}</b><span>{note}</span></article>)}</div>
    <div className={s.dashboardColumns}><article className={s.glassPanel}><header><div><small>PRÓXIMAS ACCIONES</small><h2>Recepción</h2></div><button type="button">Ver todo</button></header><div className={s.actionList}><button type="button"><span><b>Hab. 204</b><small>Check-in de Lucía Fernández</small></span><em>11:30</em></button><button type="button"><span><b>Hab. 101</b><small>Preparar salida y cochera</small></span><em>12:00</em></button><button type="button"><span><b>Hab. 305</b><small>Pago parcial pendiente</small></span><em>14:00</em></button></div></article><article className={s.glassPanel}><header><div><small>ESTADO DEL HOTEL</small><h2>Habitaciones</h2></div></header><div className={s.roomPulse}><span><b>19</b><small>Ocupadas</small></span><span><b>7</b><small>Libres</small></span><span><b>3</b><small>Limpieza</small></span><span><b>2</b><small>Bloqueadas</small></span></div></article></div>
  </section>
}
