export const DAY_MS=86400000
export function isoDate(date=new Date()){const d=new Date(date);d.setHours(12,0,0,0);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
export function addDays(value,amount){const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+Number(amount));return isoDate(d)}
export function nightsBetween(start,end){if(!start||!end)return 0;return Math.max(1,Math.round((new Date(`${end}T12:00:00`)-new Date(`${start}T12:00:00`))/DAY_MS))}
export function money(value,currency="ARS"){const n=Number(value||0);return currency==="USD"?`US$ ${n.toLocaleString("es-AR",{maximumFractionDigits:2})}`:`$ ${Math.round(n).toLocaleString("es-AR")}`}
export function shortDate(value){return value?new Date(`${value}T12:00:00`).toLocaleDateString("es-AR",{day:"2-digit",month:"short"}):"—"}
export function initials(name="Hotel"){return String(name).split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")||"HL"}
export function safeJson(value,fallback){if(!value)return fallback;if(typeof value==="object")return value;try{return JSON.parse(value)}catch{return fallback}}
