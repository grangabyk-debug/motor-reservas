"use client"
import Link from "next/link"

export default function LandingPage() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#f7f9fc",
      color: "#172033",
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <header style={{
        height: 76,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 6vw",
        background: "#fff",
        borderBottom: "1px solid #e7ebf0",
      }}>
        <div style={{fontWeight: 850, fontSize: 22, color: "#003b95"}}>Habitación Llena</div>
        <nav style={{display:"flex", gap:10, alignItems:"center"}}>
          <Link href="/login" style={{textDecoration:"none", color:"#003b95", fontWeight:700, padding:"10px 14px"}}>Ingresar</Link>
          <Link href="/registro" style={{textDecoration:"none", background:"#006ce4", color:"#fff", fontWeight:750, borderRadius:8, padding:"11px 16px"}}>Crear cuenta</Link>
        </nav>
      </header>

      <section style={{
        maxWidth: 1180,
        margin: "0 auto",
        padding: "90px 28px 70px",
        display:"grid",
        gridTemplateColumns:"1.1fr .9fr",
        gap:50,
        alignItems:"center",
      }}>
        <div>
          <div style={{color:"#006ce4", fontWeight:800, fontSize:12, letterSpacing:1.5, textTransform:"uppercase"}}>
            PMS para alojamientos
          </div>
          <h1 style={{fontSize:"clamp(42px,6vw,68px)", lineHeight:1.02, margin:"14px 0 20px", letterSpacing:"-2.5px"}}>
            Gestioná tu alojamiento. <span style={{color:"#006ce4"}}>Sin complicarte.</span>
          </h1>
          <p style={{fontSize:19, lineHeight:1.6, color:"#5d6675", maxWidth:650}}>
            Reservas, calendario, habitaciones, ventas y canales en una sola plataforma pensada para hoteles, hosterías, cabañas y alojamientos independientes.
          </p>
          <div style={{display:"flex", gap:12, marginTop:28, flexWrap:"wrap"}}>
            <Link href="/registro" style={{textDecoration:"none", background:"#006ce4", color:"#fff", fontWeight:800, borderRadius:9, padding:"14px 20px"}}>
              Empezar gratis
            </Link>
            <Link href="/login" style={{textDecoration:"none", background:"#fff", color:"#172033", border:"1px solid #dfe5ec", fontWeight:750, borderRadius:9, padding:"14px 20px"}}>
              Ya soy cliente
            </Link>
          </div>
        </div>

        <div style={{
          background:"#fff",
          border:"1px solid #e1e7ef",
          borderRadius:18,
          padding:18,
          boxShadow:"0 20px 55px rgba(0,48,120,.10)",
        }}>
          <div style={{display:"flex", gap:8, marginBottom:15}}>
            <span style={{width:8,height:8,borderRadius:99,background:"#ff6b6b"}} />
            <span style={{width:8,height:8,borderRadius:99,background:"#ffd166"}} />
            <span style={{width:8,height:8,borderRadius:99,background:"#35c76f"}} />
          </div>
          <div style={{background:"#003b95",borderRadius:12,padding:20,color:"#fff"}}>
            <div style={{fontSize:11,opacity:.7}}>HABITACIÓN LLENA</div>
            <div style={{fontSize:24,fontWeight:800,marginTop:6}}>Panel de gestión</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginTop:12}}>
            {["Reservas","Calendario","Ventas","Ocupación"].map((x,i)=>(
              <div key={x} style={{border:"1px solid #e8edf3",borderRadius:10,padding:16}}>
                <div style={{fontSize:12,color:"#758092"}}>{x}</div>
                <strong style={{display:"block",fontSize:22,marginTop:7}}>{["24","78%","$1,8M","+12%"][i]}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{background:"#fff",borderTop:"1px solid #e7ebf0",borderBottom:"1px solid #e7ebf0",padding:"70px 28px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{textAlign:"center",maxWidth:700,margin:"0 auto 38px"}}>
            <h2 style={{fontSize:34,margin:0}}>Todo lo que necesitás para operar mejor</h2>
            <p style={{color:"#667085",lineHeight:1.6}}>Una plataforma simple para dejar de trabajar con planillas, mensajes y sistemas desconectados.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
            {[
              ["📅","Calendario de ocupación","Visualizá disponibilidad y reservas de un vistazo."],
              ["📊","Ventas y rendimiento","Entendé ocupación, noches vendidas y evolución comercial."],
              ["🔗","Canales y WhatsApp","Centralizá tus canales y facilitá el contacto con huéspedes."],
              ["🏨","Alojamientos y habitaciones","Administrá múltiples propiedades y unidades."],
              ["🤖","Asistente inteligente","Consultá la operación y obtené recomendaciones."],
              ["⚡","Menos trabajo manual","Todo en un panel pensado para equipos chicos."],
            ].map(([icon,title,text])=>(
              <div key={title} style={{border:"1px solid #e5eaf0",borderRadius:12,padding:22}}>
                <div style={{fontSize:25}}>{icon}</div>
                <h3 style={{margin:"13px 0 7px"}}>{title}</h3>
                <p style={{color:"#687386",lineHeight:1.5,fontSize:14,margin:0}}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{padding:"35px 28px",textAlign:"center",color:"#7a8493",fontSize:13}}>
        Habitación Llena · Gestión hotelera simple y profesional
      </footer>

      <style jsx global>{`
        @media (max-width: 800px) {
          section { grid-template-columns: 1fr !important; }
          header { padding: 0 20px !important; }
        }
      `}</style>
    </main>
  )
}
