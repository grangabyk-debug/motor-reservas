import c from"./reservationChannelLogo.module.css"

const BOOKING_PATH="M24 0H0v24h24ZM8.575 6.563h2.658c2.108 0 3.473 1.15 3.473 2.898 0 1.15-.575 1.82-.91 2.108l-.287.263.335.192c.815.479 1.318 1.389 1.318 2.395 0 1.988-1.51 3.257-3.857 3.257H7.449V7.713c0-.623.503-1.126 1.126-1.15zm1.7 1.868c-.479.024-.694.264-.694.79v1.893h1.676c.958 0 1.294-.743 1.294-1.365 0-.815-.503-1.318-1.318-1.318zm-.096 4.36c-.407.071-.598.31-.598.79v2.251h1.868c.934 0 1.509-.55 1.509-1.533 0-.934-.599-1.509-1.51-1.509zm7.737 2.394c.743 0 1.341.599 1.341 1.342a1.34 1.34 0 0 1-1.341 1.341 1.355 1.355 0 0 1-1.341-1.341c0-.743.598-1.342 1.34-1.342z"
const AIRBNB_PATH="M12.001 18.275c-1.353-1.697-2.148-3.184-2.413-4.457-.263-1.027-.16-1.848.291-2.465.477-.71 1.188-1.056 2.121-1.056s1.643.345 2.12 1.063c.446.61.558 1.432.286 2.465-.291 1.298-1.085 2.785-2.412 4.458zm9.601 1.14c-.185 1.246-1.034 2.28-2.2 2.783-2.253.98-4.483-.583-6.392-2.704 3.157-3.951 3.74-7.028 2.385-9.018-.795-1.14-1.933-1.695-3.394-1.695-2.944 0-4.563 2.49-3.927 5.382.37 1.565 1.352 3.343 2.917 5.332-.98 1.085-1.91 1.856-2.732 2.333-.636.344-1.245.558-1.828.609-2.679.399-4.778-2.2-3.825-4.88.132-.345.395-.98.845-1.961l.025-.053c1.464-3.178 3.242-6.79 5.285-10.795l.053-.132.58-1.116c.45-.822.635-1.19 1.351-1.643.346-.21.77-.315 1.246-.315.954 0 1.698.558 2.016 1.007.158.239.345.557.582.953l.558 1.089.08.159c2.041 4.004 3.821 7.608 5.279 10.794l.026.025.533 1.22.318.764c.243.613.294 1.222.213 1.858zm1.22-2.39c-.186-.583-.505-1.271-.9-2.094v-.03c-1.889-4.006-3.642-7.608-5.307-10.844l-.111-.163C15.317 1.461 14.468 0 12.001 0c-2.44 0-3.476 1.695-4.535 3.898l-.081.16c-1.669 3.236-3.421 6.843-5.303 10.847v.053l-.559 1.22c-.21.504-.317.768-.345.847C-.172 20.74 2.611 24 5.98 24c.027 0 .132 0 .265-.027h.372c1.75-.213 3.554-1.325 5.384-3.317 1.829 1.989 3.635 3.104 5.382 3.317h.372c.133.027.239.027.265.027 3.37.003 6.152-3.261 4.802-6.975z"
const EXPEDIA_PATH="M19.067 0H4.933A4.94 4.94 0 0 0 0 4.933v14.134A4.932 4.932 0 0 0 4.933 24h14.134A4.932 4.932 0 0 0 24 19.067V4.933C24.01 2.213 21.797 0 19.067 0ZM7.336 19.341c0 .19-.148.337-.337.337h-2.33a.333.333 0 0 1-.337-.337v-2.33c0-.189.148-.336.337-.336H7c.19 0 .337.147.337.337zm12.121-1.486-2.308 2.298c-.169.168-.422.053-.422-.2V9.57l-6.44 6.44a.533.533 0 0 1-.421.17H8.169a.32.32 0 0 1-.338-.338v-1.697c0-.2.053-.316.169-.422l6.44-6.44H4.058c-.253 0-.369-.253-.2-.421l2.297-2.309c.137-.137.285-.232.517-.232H18.15c.854 0 1.539.686 1.539 1.54v11.478c-.01.231-.095.368-.232.516z"
const WHATSAPP_PATH="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"

export function channelMeta(value){
  const raw=String(value||"Walk-in"),key=raw.toLowerCase()
  if(key.includes("booking"))return{key:"booking",label:"Booking.com"}
  if(key.includes("airbnb"))return{key:"airbnb",label:"Airbnb"}
  if(key.includes("expedia"))return{key:"expedia",label:"Expedia"}
  if(key.includes("despegar"))return{key:"despegar",label:"Despegar"}
  if(key.includes("whatsapp"))return{key:"whatsapp",label:"WhatsApp"}
  if(key.includes("telef"))return{key:"phone",label:"Telefónica"}
  if(key.includes("motor"))return{key:"motor",label:"Motor de reservas"}
  if(key.includes("agencia"))return{key:"agency",label:"Agencia"}
  if(key.includes("walk")||key.includes("direct"))return{key:"walkin",label:"Walk-in"}
  return{key:"other",label:raw}
}

function BrandIcon({path,className}){return <svg viewBox="0 0 24 24" className={`${c.logo} ${className||""}`} aria-hidden="true"><path d={path} fill="currentColor"/></svg>}
function WalkInIcon(){return <svg viewBox="0 0 24 24" className={c.logo} aria-hidden="true"><path d="M4.5 3.5h8.4v17H4.5z" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M13.2 12h6.3m-2.6-2.7L19.6 12l-2.7 2.7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/><circle cx="10.2" cy="12" r=".8" fill="currentColor"/></svg>}
function PhoneIcon(){return <svg viewBox="0 0 24 24" className={c.logo} aria-hidden="true"><path d="M7.3 3.8 10 8.1 8.2 9.9c1.2 2.5 3.3 4.6 5.8 5.8l1.8-1.8 4.3 2.7-.8 3.2c-.2.7-.8 1.2-1.6 1.2C9.7 20.5 3.5 14.3 3 6.3c-.1-.8.4-1.4 1.2-1.6z" fill="currentColor"/></svg>}
function MotorIcon(){return <svg viewBox="0 0 24 24" className={c.logo} aria-hidden="true"><circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M3.8 12h16.4M12 3.6c2.1 2.2 3.2 5 3.2 8.4S14.1 18.2 12 20.4C9.9 18.2 8.8 15.4 8.8 12S9.9 5.8 12 3.6Z" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>}
function AgencyIcon(){return <svg viewBox="0 0 24 24" className={c.logo} aria-hidden="true"><path d="M5 7.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M9 7.5V5.8c0-1 .8-1.8 1.8-1.8h2.4c1 0 1.8.8 1.8 1.8v1.7M3.5 12.3h17" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M10.4 11.3h3.2v2.1h-3.2z" fill="currentColor"/></svg>}
function OtherIcon(){return <svg viewBox="0 0 24 24" className={c.logo} aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M8.8 12h6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}

export default function ReservationChannelLogo({value}){
  const meta=channelMeta(value)
  let icon=null
  if(meta.key==="booking")icon=<BrandIcon path={BOOKING_PATH} className={c.booking}/>
  else if(meta.key==="airbnb")icon=<BrandIcon path={AIRBNB_PATH} className={c.airbnb}/>
  else if(meta.key==="expedia")icon=<BrandIcon path={EXPEDIA_PATH} className={c.expedia}/>
  else if(meta.key==="whatsapp")icon=<BrandIcon path={WHATSAPP_PATH} className={c.whatsapp}/>
  else if(meta.key==="despegar")icon=<img src="https://dl.svgcdn.com/svg/arcticons/despegar.svg" alt="" className={c.despegar} draggable="false"/>
  else if(meta.key==="phone")icon=<PhoneIcon/>
  else if(meta.key==="motor")icon=<MotorIcon/>
  else if(meta.key==="agency")icon=<AgencyIcon/>
  else if(meta.key==="walkin")icon=<WalkInIcon/>
  else icon=<OtherIcon/>
  return <span className={`${c.badge} ${c[meta.key]||c.other}`} title={meta.label} aria-label={meta.label}>{icon}</span>
}
