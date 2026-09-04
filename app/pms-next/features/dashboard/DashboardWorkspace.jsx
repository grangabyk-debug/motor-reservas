import s from"./dashboard.module.css"

const shortcuts=[
  {id:"planning",label:"Planning",icon:"▦"},
  {id:"messages",label:"Mensajes",icon:"◌"},
  {id:"cash",label:"Facturación",icon:"▤"},
  {id:"rates",label:"Tarifas y disponibilidad",icon:"↗"},
]

export default function DashboardWorkspace({onNavigate}){
  return <section className={s.page}>
    <header className={s.intro}>
      <div><small>OPERACIÓN DE HOY</small><h1>Hola, Recepción 👋</h1><p>Todo lo importante del hotel, sin ruido y a un toque de distancia.</p></div>
      <div className={s.statusPill}>Hotel operativo</div>
    </header>

    <div className={s.mainGrid}>
      <button className={s.operationCard} type="button" onClick={()=>onNavigate?.("tasks")}>
        <div className={s.operationHead}><small>CHECK-LISTS</small><span>›</span></div>
        <div className={s.operationBody}>
          <div className={s.ring} style={{"--progress":0}}><div className={s.ringContent}><b>0<span>/0</span></b><small>0%</small></div></div>
          <small>completadas hoy</small>
        </div>
      </button>

      <button className={s.operationCard} type="button" onClick={()=>onNavigate?.("maintenance")}>
        <div className={s.operationHead}><small>MANTENIMIENTO</small><span>›</span></div>
        <div className={s.operationBody}>
          <div className={s.bigNumber}>0</div>
          <small className={s.bigNumberNote}>tareas abiertas</small>
        </div>
      </button>
    </div>

    <div className={s.quickGrid}>
      {shortcuts.map(item=><button key={item.id} className={s.quickLink} type="button" onClick={()=>onNavigate?.(item.id)}><span>{item.icon}</span>{item.label}</button>)}
    </div>

    <div className={s.hint}><span><b>Habitación Llena PMS Next</b> · Dashboard reconstruida como módulo independiente.</span><span>Modo día/noche activo · diseño responsive</span></div>
  </section>
}
