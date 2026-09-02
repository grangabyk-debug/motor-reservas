"use client"

import{useMemo,useState}from"react"
import{money,shortDate}from"../../core/formatters"
import gs from"./gap-fill-studio.module.css"

function pressureTone(value){if(value>=85)return"high";if(value>=65)return"medium";return"low"}

export default function GapFillStudio({item,onClose,onOpenReservation}){
  const[copyState,setCopyState]=useState("")
  const currency=item?.after?.moneda||item?.before?.moneda||"ARS"
  const roomType=item?.room?.tipo||"habitación"
  const dateLabel=item?.date?new Date(`${item.date}T12:00:00`).toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"}):""
  const message=useMemo(()=>{
    if(!item)return""
    const price=item.rate?money(item.rate,currency):"consultanos la tarifa"
    return `Se liberó una noche puntual para ${dateLabel}. ${roomType} disponible por ${price}. Si te sirve esa fecha, escribinos y te la reservamos.`
  },[item,currency,dateLabel,roomType])

  if(!item)return null

  async function copy(value,type){
    try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);else window.prompt("Copiar",value);setCopyState(type);setTimeout(()=>setCopyState(""),2200)}catch{window.prompt("Copiar",value)}
  }
  function openWhatsApp(){window.open(`https://wa.me/?text=${encodeURIComponent(message)}`,"_blank","noopener,noreferrer")}

  const tone=pressureTone(item.pressure)
  return <div className={gs.backdrop} role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose?.()}}>
    <section className={gs.studio} role="dialog" aria-modal="true" aria-label="Preparar oferta para hueco vendible">
      <header className={gs.header}>
        <div><small>HL FILL · HUECO VENDIBLE</small><h2>Convertí una noche suelta en una oportunidad.</h2><p>La oferta queda preparada. No cambia precios, disponibilidad ni envía nada sin tu confirmación.</p></div>
        <button className={gs.close} onClick={onClose} aria-label="Cerrar">×</button>
      </header>

      <div className={gs.body}>
        <div className={gs.offerColumn}>
          <div className={gs.heroCard}>
            <div className={gs.heroTop}><span><small>FECHA</small><b>{dateLabel}</b></span><em data-tone={tone}>{item.pressure}% presión</em></div>
            <div className={gs.price}><small>TARIFA SUGERIDA</small><strong>{item.rate?money(item.rate,currency):"Sin tarifa base"}</strong><span>{item.room.nombre||"Habitación"} · {roomType}</span></div>
            <div className={gs.pressureTrack}><i style={{width:`${Math.max(4,Math.min(100,item.pressure||0))}%`}}/></div>
            <div className={gs.contextGrid}><span><small>ANTES</small><b>{shortDate(item.before.fecha_entrada)} → {shortDate(item.before.fecha_salida)}</b></span><span><small>HUECO</small><b>1 noche</b></span><span><small>DESPUÉS</small><b>{shortDate(item.after.fecha_entrada)} → {shortDate(item.after.fecha_salida)}</b></span></div>
          </div>

          <div className={gs.previewCard}>
            <div className={gs.sectionTitle}><div><small>MENSAJE PREPARADO</small><b>Texto listo para venta directa</b></div><span>sin datos de huéspedes</span></div>
            <p className={gs.message}>{message}</p>
            <div className={gs.quickActions}><button onClick={()=>copy(message,"message")}>{copyState==="message"?"✓ Copiado":"Copiar mensaje"}</button><button onClick={openWhatsApp}>Abrir WhatsApp</button></div>
          </div>
        </div>

        <aside className={gs.sideColumn}>
          <div className={gs.sideCard}><small>LECTURA HL</small><h3>{tone==="high"?"Demanda fuerte":tone==="medium"?"Demanda equilibrada":"Demanda suave"}</h3><p>{tone==="high"?"La presión de esa fecha permite defender mejor la tarifa.":tone==="medium"?"La tarifa sugerida busca equilibrio entre conversión e ingreso.":"Conviene priorizar conversión y velocidad para no perder la noche."}</p></div>
          <div className={gs.sideCard}><small>ACCIONES SEGURAS</small><button onClick={()=>item.rate&&copy(String(item.rate),"rate")} disabled={!item.rate}>{copyState==="rate"?"✓ Tarifa copiada":"Copiar tarifa"}</button><button onClick={()=>onOpenReservation?.(item.after)}>Abrir próxima reserva</button></div>
          <div className={gs.safety}><span>✓</span><p><b>Control humano.</b> HL Fill propone y prepara; nunca publica ni cambia tarifas automáticamente desde esta pantalla.</p></div>
        </aside>
      </div>
    </section>
  </div>
}
