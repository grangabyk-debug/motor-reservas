import s from"../../pms-next.module.css"

export default function PmsTopbar({title,theme,onToggleTheme,onNewReservation}){
  return <header className={s.topbar}>
    <div className={s.topbarTitle}><small>HABITACIÓN LLENA</small><b>{title}</b></div>
    <button className={s.globalSearch} type="button"><span>⌕</span><span>Buscar huésped, reserva o habitación…</span><kbd>Ctrl K</kbd></button>
    <div className={s.topbarActions}>
      <button className={s.iconButton} type="button" onClick={onToggleTheme} aria-label={theme==="dark"?"Activar modo día":"Activar modo noche"}>{theme==="dark"?"☀":"☾"}</button>
      <button className={s.iconButton} type="button" aria-label="Notificaciones">◇</button>
      <button className={s.primaryButton} type="button" onClick={onNewReservation}>＋ Reserva</button>
    </div>
  </header>
}
