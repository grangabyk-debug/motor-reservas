import MarketingHome from "./marketing/MarketingHome"

export const metadata={
  title:"Habitación Llena | PMS hotelero y Hospitality Operating System",
  description:"PMS hotelero para gestionar reservas, huéspedes, habitaciones, housekeeping, tarifas, revenue y venta directa desde una sola operación.",
  keywords:["PMS hotelero","software hotelero","sistema para hoteles","motor de reservas","housekeeping hotel","revenue management hotel"],
  alternates:{canonical:"https://www.habitacionllena.com/"},
  openGraph:{title:"Habitación Llena · Hospitality Operating System",description:"El sistema hotelero que llena habitaciones y libera a recepción.",type:"website"},
}

const headerPolish=`
main nav a[href="/"]>span,
main nav a[href="/"]>small{display:none!important}
main nav a[href="/"]>b{font-size:0!important;line-height:1!important}
main nav a[href="/"]>b::after{
  content:"HabitaciónLlena.com";
  display:block;
  font:600 24px/1 Georgia,"Times New Roman",serif;
  letter-spacing:-.025em;
  color:#fff;
  text-shadow:0 2px 18px rgba(0,0,0,.25)
}
main nav a[href="/login"]{
  display:inline-flex!important;
  align-items:center;
  justify-content:center;
  min-height:46px;
  padding:0 20px!important;
  border:1px solid rgba(255,255,255,.48)!important;
  border-radius:999px;
  background:rgba(5,24,18,.44)!important;
  color:#fff!important;
  font-size:15px!important;
  font-weight:750!important;
  letter-spacing:.01em;
  text-decoration:none;
  text-shadow:0 1px 8px rgba(0,0,0,.3);
  box-shadow:inset 0 1px rgba(255,255,255,.08),0 10px 28px rgba(0,0,0,.16);
  backdrop-filter:blur(14px)
}
main nav a[href="/login"]:hover{
  background:rgba(255,255,255,.12)!important;
  border-color:rgba(255,255,255,.72)!important;
  transform:translateY(-1px)
}
main nav a[href="/registro"]{
  min-height:48px;
  padding:0 24px!important;
  background:#f2cf8d!important;
  color:#10241c!important;
  border:1px solid rgba(255,238,196,.92)!important;
  font-size:15px!important;
  font-weight:900!important;
  letter-spacing:.005em;
  box-shadow:0 10px 30px rgba(0,0,0,.22),0 0 24px rgba(240,207,148,.18)!important
}
main nav a[href="/registro"]:hover{
  background:#ffe1a5!important;
  transform:translateY(-2px) scale(1.015)
}

main>section:first-of-type a[href="/registro"]{
  min-height:58px!important;
  padding:0 30px!important;
  background:#0d3a2c!important;
  color:#fff4df!important;
  border:1px solid #f0c97d!important;
  font-size:16px!important;
  font-weight:900!important;
  letter-spacing:.01em!important;
  text-shadow:0 1px 8px rgba(0,0,0,.28)!important;
  box-shadow:0 16px 40px rgba(0,0,0,.34),0 0 0 1px rgba(240,201,125,.14) inset,0 0 28px rgba(231,182,91,.18)!important
}
main>section:first-of-type a[href="/registro"]:hover{
  background:#14513e!important;
  color:#fff9ee!important;
  transform:translateY(-2px) scale(1.015)!important
}

main section[id="oportunidad"] h2{color:#102d23!important}
main section[id="oportunidad"] h2 em{color:#9a6629!important;text-shadow:0 1px 0 rgba(255,255,255,.4)}
main section[id="oportunidad"] p{color:#40554c!important;font-weight:520!important}
main section[id="oportunidad"] small{color:#7b674e!important}
main section[id="oportunidad"] [class*="bigMoney"]>span{color:#6f583d!important;font-weight:750!important;letter-spacing:.08em!important}
main section[id="oportunidad"] [class*="bigMoney"]>b{color:#11392c!important;text-shadow:0 1px 0 #fff!important}
main section[id="oportunidad"] [class*="controls"]{color:#17382d!important}
main section[id="oportunidad"] [class*="controls"] label span{color:#314d42!important;font-weight:750!important}
main section[id="oportunidad"] [class*="controls"] label b{color:#102e24!important;font-weight:900!important}
main section[id="oportunidad"] [class*="opportunity"]{background:#123b2e!important;border:1px solid #315b4c!important;box-shadow:0 22px 50px rgba(20,52,42,.16)!important}
main section[id="oportunidad"] [class*="opportunity"] span,
main section[id="oportunidad"] [class*="opportunity"] small{color:#f6e9d2!important}
main section[id="oportunidad"] [class*="opportunity"] b{color:#ffd98f!important;font-weight:800!important}

main section[class*="finalCta"] a[href="/registro"]{
  min-height:58px!important;
  padding:0 30px!important;
  background:#0d3a2c!important;
  color:#fff4df!important;
  border:1px solid #f0c97d!important;
  font-size:16px!important;
  font-weight:900!important;
  letter-spacing:.01em!important;
  text-shadow:0 1px 8px rgba(0,0,0,.28)!important;
  box-shadow:0 16px 40px rgba(0,0,0,.34),0 0 0 1px rgba(240,201,125,.15) inset,0 0 28px rgba(231,182,91,.18)!important
}
main section[class*="finalCta"] a[href="/registro"]:hover{
  background:#14513e!important;
  color:#fff9ee!important;
  transform:translateY(-2px) scale(1.015)!important
}
main section[class*="finalCta"] a[href="/login"]{
  min-height:58px!important;
  padding:0 28px!important;
  background:rgba(4,24,18,.58)!important;
  color:#fff!important;
  border:1px solid rgba(255,236,195,.68)!important;
  font-size:15px!important;
  font-weight:800!important;
  text-shadow:0 1px 8px rgba(0,0,0,.36)!important;
  box-shadow:0 12px 34px rgba(0,0,0,.23)!important
}
main section[class*="finalCta"] a[href="/login"]:hover{background:rgba(11,55,41,.82)!important;border-color:#f3ce89!important}

@media(max-width:700px){
  main nav a[href="/"]>b::after{font-size:18px}
  main nav a[href="/login"]{min-height:40px;font-size:12px!important;padding:0 12px!important}
  main nav a[href="/registro"]{min-height:42px;font-size:12px!important;padding:0 13px!important}
  main>section:first-of-type a[href="/registro"]{min-height:52px!important;font-size:14px!important;padding:0 22px!important}
  main section[class*="finalCta"] a[href="/registro"],main section[class*="finalCta"] a[href="/login"]{min-height:52px!important;font-size:14px!important;padding:0 20px!important}
}
@media(max-width:480px){
  main nav a[href="/login"]{display:none!important}
  main nav a[href="/"]>b::after{font-size:17px}
}
`

export default function Home(){return <><style dangerouslySetInnerHTML={{__html:headerPolish}}/><MarketingHome/></>}
