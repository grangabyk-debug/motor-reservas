import Link from "next/link"

const HERO = "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1900&q=88"
const LODGE = "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1300&q=86"
const ROOM = "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1300&q=86"
const HOTEL = "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1300&q=86"
const RESORT = "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=86"

const ribbonItems = [
  "Calendario vivo",
  "Reservas",
  "Recepción",
  "Housekeeping",
  "Pagos",
  "Motor de reservas",
  "Canales",
  "Revenue",
  "IA hotelera",
]

const features = [
  ["Calendario operativo", "Reservas, bloqueos, IN, OUT y ocupación en una vista clara y rápida."],
  ["Reservas flexibles", "Una o varias habitaciones, cambios, upgrades y estadías que se adaptan a la operación real."],
  ["Recepción completa", "Pagos divididos, notas, vehículos, cocheras, mascotas, extras y cuenta del huésped."],
  ["Housekeeping", "Estado de habitaciones, limpieza, salidas del día y tareas operativas sin papeles."],
  ["Venta directa", "Motor de reservas y página del alojamiento conectados al inventario del PMS."],
  ["Canales sincronizados", "Arquitectura preparada para centralizar disponibilidad, tarifas y reservas externas."],
  ["Revenue inteligente", "Ocupación, ADR, RevPAR, pickup y reglas de precio para decidir mejor."],
  ["IA hotelera", "Un asistente que entiende fechas, reservas, huéspedes y la información de cada propiedad."],
  ["Reportes simples", "Entradas, salidas, cobros, saldos, ocupación y operación descargables cuando los necesitás."],
]

const plans = [
  {
    name: "Esencial",
    price: "US$ 45",
    text: "Para cabañas, hosterías y alojamientos chicos que quieren ordenar la operación.",
    items: ["PMS + calendario", "Reservas y huéspedes", "Recepción y housekeeping", "Caja y pagos", "Reportes esenciales", "Motor de reservas"],
  },
  {
    name: "Crecimiento",
    price: "US$ 79",
    text: "Para propiedades que quieren vender más directo y automatizar tareas.",
    best: true,
    items: ["Todo Esencial", "Canales sincronizados", "Web del alojamiento", "Automatizaciones", "Upselling y extras", "IA hotelera"],
  },
  {
    name: "Profesional",
    price: "US$ 139",
    text: "Para hoteles con mayor operación, equipos y múltiples sectores.",
    items: ["Todo Crecimiento", "Multi-property", "Revenue avanzado", "API y webhooks", "Roles avanzados", "Reportes personalizados"],
  },
]

function Brand(){
  return <div className="brand">Habitación <strong>llena</strong><span>.com</span></div>
}

function PMSMock(){
  const rows = [
    ["101 · Doble", "Sofía M.", "in", 1, 3],
    ["102 · Doble", "Martín R.", "book", 3, 3],
    ["201 · Triple", "Lucía P.", "in", 2, 4],
    ["202 · Suite", "Familia Díaz", "wait", 4, 3],
    ["Cabaña 1", "Carla + 3", "book", 1, 4],
    ["Cabaña 2", "Libre", "", 0, 0],
  ]

  return <div className="pmsMock">
    <div className="mockTop">
      <Brand />
      <div className="sync"><span /> Sincronizado</div>
      <div className="property">Hostería Los Aromos</div>
    </div>
    <div className="mockBody">
      <aside>
        {["Inicio","Calendario","Reservas","Recepción","Housekeeping","Huéspedes","Caja","Reportes","Integraciones","Asistente IA"].map((x,i)=><div key={x} className={i===1?"active":""}><i />{x}</div>)}
      </aside>
      <section>
        <div className="mockHead">
          <div><small>PLANIFICACIÓN</small><h3>Calendario de ocupación</h3><p>23 — 29 agosto</p></div>
          <div className="mockBtns"><button>Hoy</button><button>14 días</button><button className="mainBtn">+ Reserva</button></div>
        </div>
        <div className="miniStats">
          {[["78%","Ocupación"],["6","IN hoy"],["4","OUT hoy"],["$ 86.400","ADR"]].map(([v,l])=><article key={l}><small>{l}</small><b>{v}</b></article>)}
        </div>
        <div className="calendar">
          <div className="calHead"><b>Habitación</b>{["23 D","24 L","25 M","26 X","27 J","28 V","29 S"].map(d=><b key={d}>{d}</b>)}</div>
          {rows.map(([room,guest,state,start,w])=><div className="calRow" key={room}><strong>{room}</strong>{w>0&&<div className={`reservation ${state}`} style={{gridColumn:`${start+1} / span ${w}`}}><b>{guest}</b><small>{state==="in"?"IN · pagado":state==="wait"?"PENDIENTE":"RESERVA"}</small></div>}</div>)}
        </div>
      </section>
    </div>
  </div>
}

function SectionTitle({eyebrow,title,text,dark=false}){
  return <div className={`sectionTitle ${dark?"dark":""}`}><small>{eyebrow}</small><h2>{title}</h2>{text&&<p>{text}</p>}</div>
}

export default function PMSNext(){
  return <main>
    <style>{`
      :root{--ink:#14201d;--forest:#173d38;--forest2:#0d2f2b;--moss:#55766d;--sage:#aabdb4;--ivory:#f5f0e7;--paper:#fbf8f2;--sand:#dfcfba;--brass:#b58962;--clay:#a56850;--white:#ffffff;--line:rgba(20,32,29,.12)}
      *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{width:min(1200px,calc(100% - 36px));margin:auto}.nav{position:sticky;top:0;z-index:80;background:rgba(251,248,242,.76);backdrop-filter:blur(22px);border-bottom:1px solid rgba(20,32,29,.08)}.navin{height:76px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:18px}.brand{font-family:Georgia,"Times New Roman",serif;font-size:21px;letter-spacing:-.045em;white-space:nowrap}.brand strong{font-weight:700}.brand span{font-family:Inter,sans-serif;font-size:11px;letter-spacing:.04em;margin-left:1px;color:var(--moss);font-weight:750}.nav .brand{justify-self:start}.navlinks{display:flex;align-items:center;justify-content:center;gap:24px}.navlinks a{text-decoration:none;color:#41504c;font-size:12px;font-weight:720;transition:.25s}.navlinks a:hover{color:var(--forest)}.navactions{justify-self:end;display:flex;gap:9px}.navbtn{padding:10px 14px;border-radius:999px;text-decoration:none;font-size:12px;font-weight:800;transition:.25s}.navbtn.login{border:1px solid rgba(20,32,29,.16);color:var(--forest);background:rgba(255,255,255,.55)}.navbtn.trial{background:var(--forest);color:#fff;box-shadow:0 10px 24px rgba(23,61,56,.18)}.navbtn:hover{transform:translateY(-1px)}
      .hero{position:relative;min-height:780px;overflow:hidden;background:var(--ivory)}.hero:before{content:"";position:absolute;inset:0;background-image:radial-gradient(circle at 18% 15%,rgba(181,137,98,.15),transparent 23%),radial-gradient(circle at 80% 18%,rgba(85,118,109,.14),transparent 25%),linear-gradient(rgba(255,255,255,.22) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.18) 1px,transparent 1px);background-size:auto,auto,56px 56px,56px 56px;mask-image:linear-gradient(to bottom,#000 0%,transparent 88%)}.heroGrid{position:relative;z-index:2;display:grid;grid-template-columns:.94fr 1.06fr;gap:58px;align-items:center;padding:78px 0 90px}.kicker{display:flex;align-items:center;gap:10px;color:var(--forest);font-size:11px;font-weight:850;letter-spacing:.13em;text-transform:uppercase}.kicker:before{content:"";width:34px;height:1px;background:var(--brass)}.hero h1{font-family:Georgia,"Times New Roman",serif;font-weight:500;font-size:76px;line-height:.93;letter-spacing:-.064em;margin:18px 0 24px;max-width:650px}.hero h1 em{font-style:italic;color:var(--forest)}.heroCopy>p{font-size:17px;line-height:1.72;color:#52615c;max-width:590px;margin:0}.heroActions{display:flex;gap:10px;flex-wrap:wrap;margin-top:29px}.cta{display:inline-flex;align-items:center;justify-content:center;padding:14px 19px;border-radius:999px;text-decoration:none;font-size:13px;font-weight:830;transition:.28s}.cta.primary{background:var(--forest);color:white;box-shadow:0 15px 34px rgba(23,61,56,.2)}.cta.secondary{color:var(--forest);border:1px solid rgba(23,61,56,.2);background:rgba(255,255,255,.45);backdrop-filter:blur(10px)}.cta:hover{transform:translateY(-2px)}.heroMeta{display:flex;gap:24px;flex-wrap:wrap;margin-top:22px;font-size:11px;color:#6d7874}.heroMeta b{color:var(--forest)}
      .visual{position:relative;min-height:610px}.heroPhoto{position:absolute;right:0;top:0;width:78%;height:560px;border-radius:180px 26px 26px 26px;overflow:hidden;box-shadow:0 35px 90px rgba(30,44,40,.2);animation:photoFloat 8s ease-in-out infinite}.heroPhoto img{width:100%;height:100%;object-fit:cover;filter:saturate(.9) contrast(.98)}.heroPhoto:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 48%,rgba(13,47,43,.42))}.floatingCard{position:absolute;left:0;bottom:15px;width:310px;padding:22px;border-radius:24px;background:rgba(255,255,255,.78);backdrop-filter:blur(22px);border:1px solid rgba(255,255,255,.72);box-shadow:0 20px 50px rgba(28,43,39,.16);animation:cardFloat 7s ease-in-out infinite}.floatingCard small{font-size:9px;letter-spacing:.16em;color:var(--moss);font-weight:850}.floatingCard b{display:block;font-family:Georgia,serif;font-size:25px;font-weight:500;margin-top:7px}.floatingCard p{font-size:11px;line-height:1.5;color:#60706a;margin:8px 0 0}.roomPill{position:absolute;right:-5px;bottom:80px;background:rgba(23,61,56,.88);color:white;border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(18px);padding:12px 15px;border-radius:999px;font-size:10px;letter-spacing:.05em;box-shadow:0 16px 36px rgba(13,47,43,.2)}
      .ribbon{background:var(--forest);color:white;overflow:hidden;border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08)}.ribbonTrack{display:flex;width:max-content;animation:marquee 24s linear infinite;will-change:transform}.ribbonGroup{display:flex;align-items:center;justify-content:space-around;gap:45px;min-width:100vw;flex-shrink:0;padding:15px 45px 15px 0}.ribbonTrack span{font-family:Georgia,serif;font-size:14px;font-style:italic;opacity:.88;white-space:nowrap}.ribbonTrack i{display:block;width:5px;height:5px;border-radius:50%;background:var(--brass);flex:0 0 5px}
      .section{padding:104px 0}.sectionTitle{max-width:760px;margin-bottom:46px}.sectionTitle small{font-size:10px;font-weight:900;letter-spacing:.16em;color:var(--brass);text-transform:uppercase}.sectionTitle h2{font-family:Georgia,serif;font-size:51px;line-height:1.02;letter-spacing:-.05em;font-weight:500;margin:12px 0 15px}.sectionTitle p{color:#68746f;font-size:15px;line-height:1.7;max-width:650px}.sectionTitle.dark h2,.sectionTitle.dark p{color:white}.sectionTitle.dark p{opacity:.65}
      .experience{background:var(--paper)}.experienceGrid{display:grid;grid-template-columns:1.04fr .96fr;gap:30px;align-items:stretch}.editorialPhoto{position:relative;min-height:650px;border-radius:28px;overflow:hidden}.editorialPhoto img{width:100%;height:100%;object-fit:cover;transition:transform .8s ease}.editorialPhoto:hover img{transform:scale(1.035)}.editorialPhoto:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(13,47,43,.78))}.editorialCopy{position:absolute;z-index:2;left:28px;right:28px;bottom:28px;color:white}.editorialCopy small{font-size:9px;letter-spacing:.17em}.editorialCopy h3{font-family:Georgia,serif;font-weight:500;font-size:34px;letter-spacing:-.04em;margin:9px 0}.editorialCopy p{font-size:12px;line-height:1.55;max-width:460px;opacity:.82}.sideStack{display:grid;grid-template-rows:1fr 1fr;gap:18px}.sidePhoto{position:relative;border-radius:24px;overflow:hidden;min-height:300px}.sidePhoto img{width:100%;height:100%;object-fit:cover;transition:transform .8s ease}.sidePhoto:hover img{transform:scale(1.04)}.sidePhoto:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 46%,rgba(13,47,43,.62))}.sidePhoto span{position:absolute;z-index:2;left:20px;bottom:18px;color:white;font-family:Georgia,serif;font-size:23px}
      .platform{position:relative;background:var(--forest2);color:white;overflow:hidden}.platform:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 10%,rgba(181,137,98,.18),transparent 22%),radial-gradient(circle at 85% 85%,rgba(170,189,180,.12),transparent 25%)}.platform .wrap{position:relative;z-index:2}.mockShell{position:relative;margin-top:48px}.glassNote{position:absolute;right:18px;top:-28px;z-index:5;background:rgba(255,255,255,.12);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:12px 15px;font-size:10px;color:#dce8e3;animation:cardFloat 6s ease-in-out infinite}.pmsMock{background:#fdfbf7;color:#18231f;border:1px solid rgba(255,255,255,.12);border-radius:26px;box-shadow:0 38px 100px rgba(0,0,0,.34);overflow:hidden;transform:perspective(1300px) rotateX(1deg)}.mockTop{height:62px;display:flex;align-items:center;padding:0 18px;border-bottom:1px solid #e8e2d8;gap:14px}.mockTop .brand{font-size:13px}.mockTop .brand span{font-size:6px}.sync{margin-left:auto;font-size:7px;color:#55766d;font-weight:750}.sync span{display:inline-block;width:5px;height:5px;background:#5f8f74;border-radius:50%;box-shadow:0 0 0 4px rgba(95,143,116,.12);margin-right:5px}.property{font-size:8px;font-weight:800;padding:7px 9px;border:1px solid #ded8ce;border-radius:8px}.mockBody{display:grid;grid-template-columns:145px 1fr;min-height:465px}.mockBody aside{background:#153833;padding:13px 9px;color:#bfd0c9}.mockBody aside div{display:flex;gap:7px;align-items:center;font-size:7px;padding:10px 9px;border-radius:8px;margin-bottom:2px}.mockBody aside i{width:6px;height:6px;border:1px solid #77938a;border-radius:2px}.mockBody aside .active{background:rgba(255,255,255,.11);color:white}.mockBody aside .active i{background:#c4a27f;border-color:#c4a27f}.mockBody section{padding:18px}.mockHead{display:flex;align-items:center;justify-content:space-between}.mockHead small{font-size:6px;letter-spacing:.18em;color:#9c968c}.mockHead h3{font-size:15px;margin:3px 0}.mockHead p{font-size:6px;color:#aaa39a;margin:0}.mockBtns button{font-size:6px;padding:6px 8px;border:1px solid #ddd7cd;background:white;border-radius:7px;margin-left:4px;color:#35443f}.mockBtns .mainBtn{background:#173d38;color:white;border-color:#173d38}.miniStats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:14px 0}.miniStats article{padding:9px;border:1px solid #e8e2d8;border-radius:9px;background:#fff}.miniStats small{display:block;font-size:5px;color:#9c968c}.miniStats b{display:block;font-size:12px;margin-top:4px}.calendar{border:1px solid #e7e1d7;border-radius:11px;overflow:hidden;background:#fff}.calHead,.calRow{display:grid;grid-template-columns:105px repeat(7,1fr);position:relative}.calHead{background:#f7f3ec;min-height:30px}.calHead b{font-size:5px;padding:9px 4px;text-align:center;border-right:1px solid #ebe5db;color:#857f76}.calHead b:first-child{text-align:left;padding-left:10px}.calRow{min-height:48px;border-top:1px solid #eee8df}.calRow>strong{font-size:6px;padding:16px 9px;border-right:1px solid #eee8df}.calRow:after{content:"";position:absolute;left:105px;right:0;top:0;bottom:0;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(14.285% - 1px),#eee8df calc(14.285% - 1px),#eee8df 14.285%);pointer-events:none}.reservation{z-index:2;align-self:center;border-radius:8px;padding:6px 7px;color:white;margin:4px 2px;min-width:0;box-shadow:0 4px 12px rgba(24,36,32,.22);border:1px solid rgba(255,255,255,.28)}.reservation b{font-size:6px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reservation small{font-size:5px;opacity:.76}.reservation.in{background:#1f7a5c}.reservation.book{background:#a8652a}.reservation.wait{background:#b07b22}
      .featuresSection{background:#eee6d9}.featureGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.feature{position:relative;background:rgba(255,255,255,.66);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.72);border-radius:22px;padding:24px;min-height:190px;transition:.32s;overflow:hidden}.feature:before{content:"";position:absolute;width:90px;height:90px;border-radius:50%;background:rgba(181,137,98,.08);right:-30px;top:-30px}.feature:hover{transform:translateY(-5px);box-shadow:0 20px 45px rgba(48,54,49,.10);background:rgba(255,255,255,.82)}.featureNo{font-family:Georgia,serif;font-style:italic;color:var(--brass);font-size:12px}.feature h3{font-family:Georgia,serif;font-size:24px;font-weight:500;letter-spacing:-.035em;margin:24px 0 9px}.feature p{font-size:12px;line-height:1.6;color:#68746f;margin:0}
      .flow{background:var(--paper)}.flowGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.flowItem{padding:27px 24px;border-right:1px solid var(--line)}.flowItem:last-child{border-right:none}.flowItem small{font-size:9px;color:var(--brass);font-weight:900}.flowItem h3{font-family:Georgia,serif;font-size:22px;font-weight:500;margin:13px 0 8px}.flowItem p{font-size:11px;line-height:1.55;color:#6a7772}.flowArrow{margin-top:18px;font-size:16px;color:var(--moss)}
      .pricing{background:#f3ede3}.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.plan{background:rgba(255,255,255,.72);backdrop-filter:blur(12px);border:1px solid rgba(20,32,29,.10);border-radius:25px;padding:28px;position:relative;transition:.3s}.plan:hover{transform:translateY(-4px);box-shadow:0 22px 50px rgba(37,48,43,.10)}.plan.best{background:var(--forest);color:white;box-shadow:0 25px 60px rgba(23,61,56,.18)}.planTag{position:absolute;right:18px;top:18px;padding:6px 9px;border-radius:999px;background:#d9c6ae;color:#173d38;font-size:8px;font-weight:900;letter-spacing:.08em}.plan h3{font-family:Georgia,serif;font-size:29px;font-weight:500;margin:4px 0}.price{font-size:37px;font-weight:850;letter-spacing:-.05em;margin:17px 0 6px}.price span{font-size:11px;font-weight:600;opacity:.55}.plan>p{font-size:12px;line-height:1.6;color:#68746f;min-height:58px}.plan.best>p{color:#d4dfda}.plan ul{list-style:none;padding:0;margin:23px 0;display:grid;gap:11px}.plan li{font-size:11px}.plan li:before{content:"✓";margin-right:8px;color:#8b735b;font-weight:900}.plan.best li:before{color:#d8bc9a}.plan a{display:block;text-align:center;padding:12px;border-radius:999px;text-decoration:none;background:#173d38;color:white;font-size:12px;font-weight:850}.plan.best a{background:#f4eadf;color:#173d38}.trialNote{text-align:center;margin-top:20px;color:#6f7a76;font-size:11px}
      .closing{position:relative;min-height:560px;display:grid;place-items:center;overflow:hidden;color:white}.closing img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.closing:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(12,39,35,.9),rgba(12,39,35,.62))}.closingInner{position:relative;z-index:2;width:min(820px,calc(100% - 36px));text-align:center}.closingInner small{font-size:10px;letter-spacing:.17em;text-transform:uppercase;color:#ddc4a7}.closingInner h2{font-family:Georgia,serif;font-size:58px;line-height:1;letter-spacing:-.05em;font-weight:500;margin:15px 0}.closingInner p{max-width:620px;margin:0 auto 25px;line-height:1.7;color:#dbe5e1}.closingInner .cta.primary{background:#f4eadf;color:#173d38}.closingInner .cta.secondary{border-color:rgba(255,255,255,.27);color:white;background:rgba(255,255,255,.08)}
      footer{background:#0c2925;color:#9fb4ad;padding:34px 0}.footerIn{display:flex;align-items:center;justify-content:space-between;gap:20px}.footerIn .brand{color:white}.footerIn .brand span{color:#bfcfc8}.footerIn p{font-size:10px;margin:0}.footerLinks{display:flex;gap:16px}.footerLinks a{font-size:10px;color:#b9cac4;text-decoration:none}
      @keyframes photoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes cardFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@keyframes marquee{to{transform:translateX(-50%)}}
      @media(max-width:980px){.navin{grid-template-columns:1fr auto}.navlinks{display:none}.hero{min-height:0}.heroGrid{grid-template-columns:1fr;padding:62px 0 72px}.hero h1{font-size:64px;max-width:760px}.visual{min-height:570px}.heroPhoto{width:86%;right:0}.experienceGrid{grid-template-columns:1fr}.editorialPhoto{min-height:520px}.sideStack{grid-template-columns:1fr 1fr;grid-template-rows:auto}.mockBody{grid-template-columns:120px 1fr}.featureGrid{grid-template-columns:repeat(2,1fr)}.flowGrid{grid-template-columns:repeat(2,1fr)}.flowItem:nth-child(2){border-right:none}.flowItem:nth-child(-n+2){border-bottom:1px solid var(--line)}.plans{grid-template-columns:1fr}.plan>p{min-height:0}}
      @media(max-width:680px){.wrap{width:min(100% - 24px,1200px)}.navin{height:66px}.nav .brand{font-size:18px}.navactions .login{display:none}.navbtn{padding:9px 12px;font-size:10px}.heroGrid{padding-top:46px;gap:34px}.kicker{font-size:9px}.hero h1{font-size:49px;line-height:.98}.heroCopy>p{font-size:15px}.heroActions{display:grid;grid-template-columns:1fr}.cta{width:100%}.heroMeta{gap:10px;font-size:10px}.visual{min-height:440px}.heroPhoto{width:94%;height:405px;border-radius:110px 20px 20px 20px}.floatingCard{left:0;bottom:-6px;width:245px;padding:16px;border-radius:19px}.floatingCard b{font-size:20px}.roomPill{display:none}.section{padding:76px 0}.sectionTitle h2{font-size:40px}.experienceGrid{gap:12px}.editorialPhoto{min-height:460px;border-radius:21px}.sideStack{grid-template-columns:1fr;gap:12px}.sidePhoto{min-height:260px;border-radius:20px}.platform{overflow:hidden}.mockShell{margin-top:35px;overflow-x:auto;padding-bottom:10px}.pmsMock{width:760px;transform:none;border-radius:20px}.glassNote{display:none}.featureGrid{grid-template-columns:1fr}.feature{min-height:165px}.flowGrid{grid-template-columns:1fr}.flowItem{border-right:none;border-bottom:1px solid var(--line)}.flowItem:last-child{border-bottom:none}.closing{min-height:520px}.closingInner h2{font-size:44px}.footerIn{align-items:flex-start;flex-direction:column}.footerLinks{flex-wrap:wrap}}
      @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
    `}</style>

    <nav className="nav">
      <div className="wrap navin">
        <Brand />
        <div className="navlinks">
          <a href="#producto">Producto</a>
          <a href="#funciones">Funciones</a>
          <a href="#planes">Planes</a>
          <a href="#nosotros">Nosotros</a>
        </div>
        <div className="navactions">
          <Link href="/login" className="navbtn login">Iniciar sesión</Link>
          <Link href="/registro" className="navbtn trial">Probar 30 días</Link>
        </div>
      </div>
    </nav>

    <section className="hero">
      <div className="wrap heroGrid">
        <div className="heroCopy">
          <div className="kicker">PMS para alojamientos independientes</div>
          <h1>Tu alojamiento, <em>mucho más simple</em> de gestionar.</h1>
          <p>Calendario, reservas, huéspedes, recepción, housekeeping, pagos, venta directa y automatizaciones en una experiencia pensada para trabajar rápido y sin llenar la operación de pantallas.</p>
          <div className="heroActions">
            <Link href="/registro" className="cta primary">Empezar 30 días gratis</Link>
            <a href="#producto" className="cta secondary">Ver cómo funciona</a>
          </div>
          <div className="heroMeta"><span><b>✓</b> Sin tarjeta</span><span><b>✓</b> Mobile first</span><span><b>✓</b> Startup argentina</span></div>
        </div>
        <div className="visual">
          <div className="heroPhoto"><img src={HERO} alt="Hotel boutique moderno" /></div>
          <div className="floatingCard"><small>TODO EN UN MISMO LUGAR</small><b>Menos administración. Más hospitalidad.</b><p>Una plataforma clara para que la tecnología acompañe al equipo sin complicarlo.</p></div>
          <div className="roomPill">● disponibilidad actualizada</div>
        </div>
      </div>
    </section>

    <div className="ribbon" aria-label="Funciones de Habitación Llena"><div className="ribbonTrack">
      {[0, 1].map((grupo) => <div className="ribbonGroup" key={grupo} aria-hidden={grupo === 1}>
        {ribbonItems.map((item, indice) => <div key={`${grupo}-${item}`} style={{display:"contents"}}><span>{item}</span>{indice < ribbonItems.length - 1 && <i />}</div>)}
      </div>)}
    </div></div>

    <section className="section experience" id="nosotros">
      <div className="wrap">
        <SectionTitle eyebrow="Sobre Habitación Llena" title="Creada en Argentina junto a quienes trabajan en hotelería." text="Habitación Llena es un proyecto argentino que nace de la operación hotelera real. Diseñamos cada función para hosterías, cabañas, posadas y hoteles independientes que necesitan trabajar con claridad, sin adaptar su día a sistemas rígidos." />
        <div className="experienceGrid">
          <div className="editorialPhoto"><img src={LODGE} alt="Cabaña moderna" /><div className="editorialCopy"><small>HECHO EN ARGENTINA</small><h3>Un sistema pensado desde la operación real.</h3><p>Escuchamos cómo trabaja cada alojamiento y convertimos esas necesidades en herramientas simples, cercanas y concretas.</p></div></div>
          <div className="sideStack">
            <div className="sidePhoto"><img src={ROOM} alt="Habitación moderna" /><span>Operación clara</span></div>
            <div className="sidePhoto"><img src={HOTEL} alt="Recepción hotelera" /><span>Experiencia profesional</span></div>
          </div>
        </div>
      </div>
    </section>

    <section className="section platform" id="producto">
      <div className="wrap">
        <SectionTitle dark eyebrow="El corazón del sistema" title="Un calendario que organiza todo lo demás." text="La disponibilidad, las reservas, los cambios y la operación diaria parten de una vista central que el equipo entiende en segundos." />
        <div className="mockShell"><div className="glassNote">Reserva nueva · notificación activa</div><PMSMock /></div>
      </div>
    </section>

    <section className="section featuresSection" id="funciones">
      <div className="wrap">
        <SectionTitle eyebrow="Funciones" title="Todo lo importante, sin hacerte perder tiempo." text="Cada módulo está pensado para resolver una tarea concreta y mantener la información conectada." />
        <div className="featureGrid">
          {features.map(([title,text],i)=><article className="feature" key={title}><span className="featureNo">0{i+1}</span><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </div>
    </section>

    <section className="section flow">
      <div className="wrap">
        <SectionTitle eyebrow="Una sola operación" title="De la consulta a la salida, todo conectado." text="El sistema acompaña el ciclo completo del huésped sin duplicar datos ni obligarte a saltar entre herramientas." />
        <div className="flowGrid">
          {[
            ["01","Reserva","Entra por venta directa, recepción o un canal conectado."],
            ["02","Estadía","Check-in, pagos, extras, cambios, vehículos, mascotas y notas."],
            ["03","Operación","Recepción y housekeeping ven el mismo estado en tiempo real."],
            ["04","Salida","Check-out, saldo, reporte y disponibilidad actualizada al instante."],
          ].map(([n,t,p])=><div className="flowItem" key={n}><small>{n}</small><h3>{t}</h3><p>{p}</p><div className="flowArrow">→</div></div>)}
        </div>
      </div>
    </section>

    <section className="section pricing" id="planes">
      <div className="wrap">
        <SectionTitle eyebrow="Planes simples" title="Empezá chico. Crecé cuando lo necesites." text="30 días para probar el sistema con tu operación real y decidir con tranquilidad." />
        <div className="plans">
          {plans.map(plan=><article className={`plan ${plan.best?"best":""}`} key={plan.name}>{plan.best&&<span className="planTag">MÁS ELEGIDO</span>}<h3>{plan.name}</h3><div className="price">{plan.price} <span>/ mes</span></div><p>{plan.text}</p><ul>{plan.items.map(x=><li key={x}>{x}</li>)}</ul><Link href="/registro">Probar 30 días</Link></article>)}
        </div>
        <div className="trialNote">Sin permanencia. Podés empezar con lo esencial y ampliar cuando la operación lo pida.</div>
      </div>
    </section>

    <section className="closing">
      <img src={RESORT} alt="Hotel boutique al atardecer" />
      <div className="closingInner">
        <small>Habitación llena.com</small>
        <h2>Un sistema a la altura de la experiencia que querés ofrecer.</h2>
        <p>Profesionalizá la operación de tu alojamiento sin perder cercanía, identidad ni tiempo con herramientas difíciles.</p>
        <div className="heroActions" style={{justifyContent:"center"}}><Link href="/registro" className="cta primary">Empezar 30 días gratis</Link><Link href="/login" className="cta secondary">Ya tengo cuenta</Link></div>
      </div>
    </section>

    <footer><div className="wrap footerIn"><Brand /><p>Hecho en Argentina · PMS para alojamientos independientes.</p><div className="footerLinks"><a href="#producto">Producto</a><a href="#funciones">Funciones</a><a href="#planes">Planes</a></div></div></footer>
  </main>
}
