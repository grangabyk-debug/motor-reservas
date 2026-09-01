export const DAY_MS=86400000
const MONEY_META={
  ARS:{locale:"es-AR",prefix:"$",decimals:0},USD:{locale:"en-US",prefix:"US$",decimals:2},BRL:{locale:"pt-BR",prefix:"R$",decimals:2},CLP:{locale:"es-CL",prefix:"CLP $",decimals:0},COP:{locale:"es-CO",prefix:"COP $",decimals:0},PEN:{locale:"es-PE",prefix:"S/",decimals:2},UYU:{locale:"es-UY",prefix:"$U",decimals:0},MXN:{locale:"es-MX",prefix:"MX$",decimals:2},EUR:{locale:"es-ES",prefix:"€",decimals:2}
}
export function isoDate(date=new Date()){const d=new Date(date);d.setHours(12,0,0,0);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
export function addDays(value,amount){const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+Number(amount));return isoDate(d)}
export function nightsBetween(start,end){if(!start||!end)return 0;return Math.max(1,Math.round((new Date(`${end}T12:00:00`)-new Date(`${start}T12:00:00`))/DAY_MS))}
export function money(value,currency="ARS",locale){const n=Number(value||0),code=String(currency||"ARS").toUpperCase(),meta=MONEY_META[code];if(meta){const rendered=n.toLocaleString(locale||meta.locale,{minimumFractionDigits:0,maximumFractionDigits:meta.decimals});return`${meta.prefix} ${rendered}`}try{return new Intl.NumberFormat(locale||"es",{style:"currency",currency:code,maximumFractionDigits:2}).format(n)}catch{return`${code} ${n.toLocaleString(locale||"es",{maximumFractionDigits:2})}`}}
export function shortDate(value){return value?new Date(`${value}T12:00:00`).toLocaleDateString("es-AR",{day:"2-digit",month:"short"}):"—"}
export function initials(name="Hotel"){return String(name).split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")||"HL"}
export function safeJson(value,fallback){if(!value)return fallback;if(typeof value==="object")return value;try{return JSON.parse(value)}catch{return fallback}}
