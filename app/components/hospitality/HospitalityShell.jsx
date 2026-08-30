import ui from "./hospitality-shell.module.css"

const HOTEL_IMAGE="https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1800&q=88"

export default function HospitalityShell({eyebrow="HABITACIÓN LLENA",title,copy,children,hotelName="Habitación Llena",compact=false,backHref=null,backOnScene=false,hideBrand=false,topAligned=false}){
  return <main className={`${ui.page} ${compact?ui.compact:""} ${topAligned?ui.topAligned:""}`}>
    <div className={ui.ambient}/>
    <section className={ui.frame}>
      {backHref&&backOnScene&&<a href={backHref} className={`${ui.back} ${ui.backOverlay}`} aria-label="Volver"><span aria-hidden="true">←</span><b>Volver</b></a>}
      <aside className={ui.scene} style={{backgroundImage:`linear-gradient(180deg,rgba(11,28,22,.08),rgba(8,22,17,.78)),url(${HOTEL_IMAGE})`}}>
        <div className={ui.sceneLeather}/><div className={ui.sceneGlow}/>
        <div className={ui.sceneCopy}><small>HOSPITALITY OPERATING SYSTEM</small><h2>La tecnología también puede sentirse <em>hospitalaria.</em></h2><p>Un escritorio sereno, cálido y preciso para que el equipo vuelva a mirar al huésped.</p></div>
      </aside>
      <section className={ui.surface}>
        <div className={ui.marble}/>
        <div className={`${ui.content} ${hideBrand?ui.brandless:""}`}>
          {backHref&&!backOnScene&&<a href={backHref} className={ui.back} aria-label="Volver"><span aria-hidden="true">←</span><b>Volver</b></a>}
          {!hideBrand&&<a href="/" className={ui.brand}><span>HL</span><div><b>{hotelName}</b><small>Hotel OS</small></div></a>}
          <div className={ui.heading}><small>{eyebrow}</small><h1>{title}</h1>{copy&&<p>{copy}</p>}</div>
          {children}
        </div>
        <div className={ui.wood}/><div className={ui.led}/>
      </section>
    </section>
  </main>
}
