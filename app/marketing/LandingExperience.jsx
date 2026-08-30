"use client"

import Link from "next/link"
import {useEffect,useMemo,useState} from "react"
import ui from "./marketing.module.css"

const FRONT_DESK="https://images.pexels.com/photos/5371676/pexels-photo-5371676.jpeg?auto=compress&cs=tinysrgb&w=1800"
const KEY_CARD="https://images.pexels.com/photos/7820357/pexels-photo-7820357.jpeg?auto=compress&cs=tinysrgb&w=1400"
const HOUSEKEEPING="https://images.pexels.com/photos/9462786/pexels-photo-9462786.jpeg?auto=compress&cs=tinysrgb&w=1600"
const LINEN="https://images.pexels.com/photos/3770106/pexels-photo-3770106.jpeg?auto=compress&cs=tinysrgb&w=1400"
const LOBBY="https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1800&q=90"
const ROOM="https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1600&q=88"

const productViews={
  "Recepción":{eyebrow:"COMMAND CENTER",title:"Todo el turno, vivo.",metric:"12 entradas",note:"9 salidas · 4 habitaciones por liberar",accent:"Operación en tiempo real",rows:[["301","Benítez · IN 14:00","Confirmada"],["302","Martins · 3 noches","En casa"],["304","Bloqueo mantenimiento","Bloqueada"],["307","Pereyra · OUT 11:00","Salida"]]},
  "Reservas":{eyebrow:"RESERVAS",title:"Cambiar sin romper nada.",metric:"84% ocupación",note:"Inventario protegido contra solapamientos",accent:"Mover · extender · dividir",rows:[["STD 01","Directo · 2 noches","Pagada"],["DLX 03","Booking · 4 noches","Garantizada"],["SUP 02","Agencia · 1 noche","Pendiente"],["STD 06","Directo · 5 noches","Web check-in"]]},
  "Housekeeping":{eyebrow:"HOUSEKEEPING",title:"La habitación avisa.",metric:"7 por limpiar",note:"3 listas · 2 en inspección · 1 urgente",accent:"Prioridad automática",rows:[["204","Salida 10:42","Urgente"],["301","Stayover","En curso"],["406","Limpieza profunda","Asignada"],["512","Inspección","Lista"]]},
  "Revenue":{eyebrow:"REVENUE",title:"La tarifa deja de ser intuición.",metric:"+12% ADR",note:"Demanda, ritmo, ocupación y restricciones",accent:"Recomendación explicable",rows:[["Vie 04","ADR sugerido $126.000","+8%"],["Sáb 05","ADR sugerido $142.000","+14%"],["Dom 06","Mínimo 2 noches","Activo"],["Lun 07","Liberar restricción","Sugerido"]]},
  "Huéspedes":{eyebrow:"GUEST CRM",title:"La segunda estadía no empieza de cero.",metric:"62 recurrentes",note:"Preferencias, historial y contexto real",accent:"Memoria del huésped",rows:[["Laura V.","Almohada baja · piso alto","VIP"],["Andrés M.","Late check-out habitual","Frecuente"],["Familia Ruiz","Cuna + cochera","Repite"],["Sofía P.","Sin gluten","Nueva"]]},
}

function ProductMock({active}){
  const v=productViews[active]
  return <div className={ui.productMock}>
    <div className={ui.mockChrome}><span/><span/><span/><b>Habitación Llena OS</b><small>{v.eyebrow}</small></div>
    <div className={ui.mockBody}>
      <aside className={ui.mockSide}><b>HL</b><i/><i/><i/><i/><i/></aside>
      <div className={ui.mockContent}>
        <div className={ui.mockHead}><div><small>{v.eyebrow}</small><h3>{v.title}</h3></div><div className={ui.mockMetric}><b>{v.metric}</b><span>{v.note}</span></div></div>
        <div className={ui.mockTimeline}><span>HOY</span><i/><i/><i/><i/><i/><b>{v.accent}</b></div>
        <div className={ui.mockRows}>{v.rows.map((r,i)=><div key={`${active}-${i}`}><strong>{r[0]}</strong><span>{r[1]}</span><em>{r[2]}</em></div>)}</div>
      </div>
    </div>
  </div>
}

function RevenuePulse(){
  const [rooms,setRooms]=useState(30)
  const [occupancy,setOccupancy]=useState(65)
  const [adr,setAdr]=useState(90000)
  const [ota,setOta]=useState(55)
  const [commission,setCommission]=useState(17)
  const values=useMemo(()=>{
    const nights=rooms*30*(occupancy/100)
    const revenue=nights*adr
    const otaRevenue=revenue*(ota/100)
    const cost=otaRevenue*(commission/100)
    return {nights:Math.round(nights),revenue,cost,opportunity:cost*.2}
  },[rooms,occupancy,adr,ota,commission])
  const money=n=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n)
  return <section className={ui.revenuePulse} id="oportunidad">
    <div className={ui.pulseGlow}/>
    <div className={ui.wrap}>
      <div className={ui.pulseIntro} data-reveal>
        <small>DIAGNÓSTICO VIVO</small>
        <h2>No llenes casilleros.<br/><em>Mové el hotel.</em></h2>
        <p>Deslizá las variables de tu operación y mirá cómo cambia el peso estimado de la intermediación en tiempo real.</p>
        <div className={ui.bigMoney}><span>Comisiones OTA estimadas / mes</span><b>{money(values.cost)}</b><small>{values.nights} noches vendidas · {money(values.revenue)} de alojamiento</small></div>
      </div>
      <div className={ui.controls} data-reveal>
        {[
          ["Habitaciones",rooms,setRooms,5,150,1,rooms],
          ["Ocupación",occupancy,setOccupancy,10,100,1,`${occupancy}%`],
          ["ADR",adr,setAdr,30000,300000,5000,money(adr)],
          ["Venta por OTA",ota,setOta,0,100,1,`${ota}%`],
          ["Comisión OTA",commission,setCommission,5,30,1,`${commission}%`],
        ].map(([label,value,setter,min,max,step,display])=><label key={label}>
          <div><span>{label}</span><b>{display}</b></div>
          <input type="range" min={min} max={max} step={step} value={value} onChange={e=>setter(Number(e.target.value))}/>
        </label>)}
        <div className={ui.opportunity}><span>20% de ese costo, solo como escenario</span><b>{money(values.opportunity)}</b><small>Orientativo. No es una promesa de ahorro.</small></div>
      </div>
    </div>
  </section>
}

export default function LandingExperience(){
  const [active,setActive]=useState("Recepción")

  useEffect(()=>{
    const nodes=[...document.querySelectorAll("[data-reveal]")]
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle(ui.revealed,entry.isIntersecting)),{threshold:.14})
    nodes.forEach(node=>observer.observe(node))
    return ()=>observer.disconnect()
  },[])

  const move=e=>{
    const rect=e.currentTarget.getBoundingClientRect()
    const x=((e.clientX-rect.left)/rect.width-.5)*2
    const y=((e.clientY-rect.top)/rect.height-.5)*2
    e.currentTarget.style.setProperty("--ry",`${x*6}deg`)
    e.currentTarget.style.setProperty("--rx",`${y*-4}deg`)
  }

  return <main className={ui.page}>
    <nav className={ui.nav}>
      <div className={ui.wrap}>
        <Link className={ui.brand} href="/"><span>HL</span><b>Habitación Llena</b><small>Hotel OS</small></Link>
        <div className={ui.links}><a href="#producto">Producto</a><a href="#sistema">Cómo se siente</a><a href="#oportunidad">Diagnóstico</a><a href="#hotelero">Hotelería real</a></div>
        <div className={ui.navActions}><Link className={ui.navLogin} href="/login">Ingresar</Link><Link className={ui.primary} href="/registro">Solicitar acceso <span>↗</span></Link></div>
      </div>
    </nav>

    <section className={ui.hero} onMouseMove={move}>
      <div className={ui.heroPhoto}><img src={FRONT_DESK} alt="Recepcionista de hotel atendiendo en el front desk"/></div>
      <div className={ui.heroShade}/>
      <div className={ui.heroNoise}/>
      <div className={`${ui.wrap} ${ui.heroInner}`}>
        <div className={ui.heroCopy} data-reveal>
          <div className={ui.kicker}><i/>HOSPITALITY OPERATING SYSTEM</div>
          <h1>Menos pantalla.<br/><em>Más hotel.</em></h1>
          <p>El sistema que conecta recepción, reservas, huéspedes, habitaciones, housekeeping, revenue y venta directa sin convertir tu hotel en una planilla.</p>
          <div className={ui.heroActions}><Link className={ui.heroPrimary} href="/registro">Quiero verlo en mi hotel <span>→</span></Link><Link className={ui.heroGhost} href="/preview/pms-next"><i/> Ver el sistema en acción</Link></div>
        </div>

        <div className={ui.heroStage} aria-hidden="true">
          <div className={ui.device3d}>
            <div className={ui.deviceTop}><b>Habitación Llena</b><span>Command Center · ahora</span><i/></div>
            <div className={ui.deviceStats}><div><small>OCUPACIÓN</small><b>78%</b></div><div><small>LLEGAN</small><b>12</b></div><div><small>SALEN</small><b>9</b></div></div>
            <div className={ui.deviceDiary}>
              {[
                ["301","Benítez","in"],["302","Martins","stay"],["303","Libre","free"],["304","Mantenimiento","block"],["305","Pereyra","out"]
              ].map(r=><div key={r[0]}><span>{r[0]}</span><b className={ui[r[2]]}>{r[1]}</b><i/></div>)}
            </div>
            <div className={ui.deviceFoot}><span><i/>Todo sincronizado</span><b>Llena Intelligence ✦</b></div>
          </div>
          <div className={ui.floatArrival}><small>HUÉSPED LLEGANDO</small><b>Laura Vidal</b><span>Web check-in completo · Hab. 301</span></div>
          <div className={ui.floatRoom}><span>301</span><div><b>Lista para recibir</b><small>Housekeeping · 10:48</small></div></div>
        </div>
      </div>
      <div className={ui.scrollCue}><span>SCROLL</span><i/></div>
    </section>

    <div className={ui.marquee}><div><span>Recepción sin fricción</span><i/> <span>Inventario protegido</span><i/> <span>Huéspedes con memoria</span><i/> <span>Housekeeping conectado</span><i/> <span>Revenue explicado</span><i/> <span>Venta directa</span><i/> <span>Recepción sin fricción</span><i/> <span>Inventario protegido</span></div></div>

    <section className={ui.moments} id="sistema">
      <div className={ui.wrap}>
        <div className={ui.momentsHead} data-reveal><small>UN HOTEL NO SON MÓDULOS</small><h2>Son momentos que<br/><em>tienen que salir bien.</em></h2></div>
        <div className={ui.momentCanvas}>
          <figure className={`${ui.momentPhoto} ${ui.momentOne}`} data-reveal><img src={KEY_CARD} alt="Entrega de tarjeta de habitación en recepción"/><figcaption><span>10:52</span><b>La llegada</b><p>Reserva, identidad, pago, habitación y llave en el mismo contexto.</p></figcaption></figure>
          <figure className={`${ui.momentPhoto} ${ui.momentTwo}`} data-reveal><img src={HOUSEKEEPING} alt="Equipo de housekeeping preparando una habitación"/><figcaption><span>11:18</span><b>La habitación</b><p>Housekeeping ve qué urge porque conoce la salida real.</p></figcaption></figure>
          <div className={ui.momentQuote} data-reveal><p>“Que el recepcionista no tenga que aprender dónde está la información. <em>Que aparezca cuando la necesita.</em>”</p><span>Principio de producto · Habitación Llena</span></div>
        </div>
      </div>
    </section>

    <section className={ui.productStage} id="producto">
      <div className={ui.wrap}>
        <div className={ui.productIntro} data-reveal><small>EL PRODUCTO ES EL PROTAGONISTA</small><h2>Un escritorio que <em>cambia con el turno.</em></h2><p>No seis cajas explicando funciones. Tocá una escena y mirá cómo responde el mismo sistema.</p></div>
        <div className={ui.productTabs}>{Object.keys(productViews).map(name=><button key={name} className={active===name?ui.active:""} onClick={()=>setActive(name)}>{name}</button>)}</div>
        <div className={ui.productPerspective} data-reveal><ProductMock active={active}/><div className={ui.productHalo}/></div>
      </div>
    </section>

    <section className={ui.human} id="hotelero">
      <div className={`${ui.wrap} ${ui.humanGrid}`}>
        <div className={ui.humanCopy} data-reveal>
          <small>HECHO DESDE HOTELERÍA</small>
          <h2>La tecnología no recibe al huésped.<br/><em>La persona sí.</em></h2>
          <p>Por eso Habitación Llena no intenta ocupar el centro de la escena. Ordena lo complejo atrás para que adelante quede lo importante: mirar, escuchar, resolver y recibir bien.</p>
          <div className={ui.humanLine}><i/><span><b>Recepción</b> ve el contexto.</span><span><b>Housekeeping</b> ve la prioridad.</span><span><b>Dirección</b> ve el negocio.</span></div>
        </div>
        <div className={ui.humanVisual} data-reveal>
          <div className={ui.humanMain}><img src={LINEN} alt="Personal de hotel preparando una habitación"/></div>
          <div className={ui.humanInset}><img src={LOBBY} alt="Lobby de hotel"/></div>
          <div className={ui.humanBadge}><span>✦</span><b>Diseñado para<br/>el ritmo real</b></div>
        </div>
      </div>
    </section>

    <RevenuePulse/>

    <section className={ui.intelligence}>
      <div className={ui.intelligencePhoto}><img src={ROOM} alt="Habitación de hotel contemporánea"/></div>
      <div className={ui.intelligenceShade}/>
      <div className={`${ui.wrap} ${ui.intelligenceInner}`}>
        <div className={ui.intelligenceCopy} data-reveal><small>LLENA INTELLIGENCE</small><h2>No otro chatbot.<br/><em>Un operador que entiende el hotel.</em></h2><p>Lee ocupación, llegadas, salidas, tarifas y operación para explicar qué está pasando y proponer la próxima acción sin esconder el criterio.</p></div>
        <div className={ui.aiScene} data-reveal>
          <div className={ui.aiPrompt}><span>Vos</span><p>¿Qué necesita atención antes de las 14?</p></div>
          <div className={ui.aiAnswer}><span>✦ Llena Intelligence</span><p>Priorizaría la 204: salió hace 18 minutos y entra una reserva directa a las 13:30. La 406 puede esperar porque su llegada es después de las 17.</p><div><b>Priorizar 204</b><small>Ver por qué →</small></div></div>
          <i className={ui.orbitOne}/><i className={ui.orbitTwo}/>
        </div>
      </div>
    </section>

    <section className={ui.finalCta}>
      <div className={ui.finalPhoto}><img src={FRONT_DESK} alt="Recepción de hotel"/></div><div className={ui.finalShade}/>
      <div className={ui.wrap} data-reveal><small>HABITACIÓN LLENA</small><h2>Que se note el hotel.<br/><em>No el software.</em></h2><p>Una operación más clara, un equipo más coordinado y más tiempo para recibir personas.</p><div><Link className={ui.heroPrimary} href="/registro">Solicitar acceso <span>→</span></Link><Link className={ui.heroGhost} href="/login">Ya tengo cuenta</Link></div></div>
    </section>

    <footer className={ui.footer}><div className={ui.wrap}><Link className={ui.brand} href="/"><span>HL</span><b>Habitación Llena</b></Link><p>Hospitality Operating System · 2026</p><div><Link href="/login">Ingresar</Link><Link href="/registro">Solicitar acceso</Link></div></div></footer>
  </main>
}
