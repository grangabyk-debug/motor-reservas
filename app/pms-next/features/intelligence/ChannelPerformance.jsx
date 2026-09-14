"use client"

import{useMemo,useState}from"react"
import{money}from"../../core/formatters"
import s from"./channel-performance.module.css"

const DAY=86400000
const asDate=value=>new Date(`${String(value).slice(0,10)}T12:00:00Z`)
const diff=(a,b)=>Math.max(0,Math.round((asDate(b)-asDate(a))/DAY))
const overlap=(r,start,end)=>String(r.fecha_entrada||"")<end&&String(r.fecha_salida||"")>start
const status=r=>String(r.estado||"").toLowerCase()
const isCancelled=r=>status(r)==="cancelada"||Boolean(r.no_show)
const safeArray=value=>{if(Array.isArray(value))return value;try{const parsed=JSON.parse(value||"[]");return Array.isArray(parsed)?parsed:[]}catch{return[]}}
const roomIds=r=>[...new Set([r.habitacion_id,...(Array.isArray(r.habitaciones_ids)?r.habitaciones_ids:[])].map(String).filter(Boolean))]
const channelName=r=>String(r.canal_reserva||"Directa").trim()||"Directa"
const channelType=name=>/booking|expedia|airbnb|despegar|agoda|hotelbeds/i.test(name)?"OTA":/agencia|agency|operador|tour/i.test(name)?"Agencia":"Directo"
function nightlyRoomRevenue(r){const details=safeArray(r.habitaciones_detalle),rates=details.map(x=>Number(x?.tarifa_noche??x?.rate??0)).filter(x=>x>0);if(rates.length)return rates.reduce((a,b)=>a+b,0);const count=Math.max(1,roomIds(r).length),rate=Number(r.tarifa_noche||0);if(rate>0)return rate*count;return Number(r.precio_total||0)/Math.max(1,diff(r.fecha_entrada,r.fecha_salida))}

export default function ChannelPerformance({reservations=[],start,end,currency="ARS",costs=[],canManage=false,onSaveCost}){
  const[editing,setEditing]=useState(false),[drafts,setDrafts]=useState({}),[saving,setSaving]=useState("")
  const costMap=useMemo(()=>new Map(costs.filter(c=>String(c.currency||"ARS").toUpperCase()===currency&&c.active!==false).map(c=>[String(c.channel_name),c])),[costs,currency])
  const rowsMap=new Map(),eligible=reservations.filter(r=>overlap(r,start,end)&&String(r.moneda||"ARS").toUpperCase()===currency&&!r.merged_into_id)
  eligible.forEach(r=>{
    const name=channelName(r),row=rowsMap.get(name)||{name,type:channelType(name),reservations:0,cancellations:0,roomNights:0,revenue:0,leadTotal:0,leadCount:0}
    if(isCancelled(r)){row.cancellations+=1;rowsMap.set(name,row);return}
    const from=r.fecha_entrada>start?r.fecha_entrada:start,to=r.fecha_salida<end?r.fecha_salida:end,nights=Math.max(0,diff(from,to)),rooms=Math.max(1,roomIds(r).length)
    row.reservations+=1;row.roomNights+=nights*rooms;row.revenue+=nights*nightlyRoomRevenue(r)
    const created=String(r.created_at||"").slice(0,10);if(created&&r.fecha_entrada){row.leadTotal+=Math.max(0,diff(created,r.fecha_entrada));row.leadCount+=1}
    rowsMap.set(name,row)
  })
  const rows=[...rowsMap.values()].map(row=>{const cost=costMap.get(row.name),commission=Number(cost?.commission_percent||0),fixed=Number(cost?.fixed_fee_per_reservation||0),configured=Boolean(cost),distributionCost=configured?row.revenue*commission/100+row.reservations*fixed:0;return{...row,adr:row.roomNights?row.revenue/row.roomNights:0,lead:row.leadCount?row.leadTotal/row.leadCount:0,cancelRate:(row.reservations+row.cancellations)?row.cancellations/(row.reservations+row.cancellations)*100:0,commission,fixed,configured,distributionCost,netRevenue:row.revenue-distributionCost}}).sort((a,b)=>b.revenue-a.revenue)
  const totalRevenue=rows.reduce((a,r)=>a+r.revenue,0),totalNet=rows.reduce((a,r)=>a+(r.configured?r.netRevenue:r.revenue),0),totalCosts=rows.reduce((a,r)=>a+r.distributionCost,0),totalNights=rows.reduce((a,r)=>a+r.roomNights,0),directRevenue=rows.filter(r=>r.type==="Directo").reduce((a,r)=>a+r.revenue,0),otaRevenue=rows.filter(r=>r.type==="OTA").reduce((a,r)=>a+r.revenue,0),configuredCount=rows.filter(r=>r.configured).length
  const draftFor=row=>drafts[row.name]||{commission_percent:String(row.commission||""),fixed_fee_per_reservation:String(row.fixed||"")}
  const change=(row,key,value)=>setDrafts(current=>({...current,[row.name]:{...draftFor(row),[key]:value}}))
  async function save(row){if(!onSaveCost)return;const draft=draftFor(row);setSaving(row.name);try{const saved=await onSaveCost({channel_name:row.name,currency,commission_percent:Number(draft.commission_percent||0),fixed_fee_per_reservation:Number(draft.fixed_fee_per_reservation||0),active:true});if(saved)setDrafts(current=>({...current,[row.name]:{commission_percent:String(saved.commission_percent??draft.commission_percent),fixed_fee_per_reservation:String(saved.fixed_fee_per_reservation??draft.fixed_fee_per_reservation)}}))}finally{setSaving("")}}
  return <section className={s.card}>
    <header><div><small>DISTRIBUCIÓN</small><h2>Rendimiento por canal</h2><p>Producción, ADR, cancelación, anticipación y costo real de adquisición cuando está configurado.</p></div><div className={s.headerRight}><div className={s.summary}><span><b>{totalNights}</b><small>noches</small></span><span><b>{totalRevenue?Math.round(directRevenue/totalRevenue*100):0}%</b><small>venta directa</small></span><span><b>{totalRevenue?Math.round(otaRevenue/totalRevenue*100):0}%</b><small>OTA</small></span></div>{canManage&&<button className={s.costButton} type="button" onClick={()=>setEditing(value=>!value)}>{editing?"Cerrar costos":"Configurar costos"}</button>}</div></header>
    {configuredCount>0&&<div className={s.netSummary}><span><small>Producción bruta</small><b>{money(totalRevenue,currency)}</b></span><span><small>Costo distribución conocido</small><b>{money(totalCosts,currency)}</b></span><span><small>Ingreso neto estimado</small><b>{money(totalNet,currency)}</b></span><em>{configuredCount}/{rows.length} canales con costo configurado</em></div>}
    <div className={s.tableWrap}><table><thead><tr><th>Canal</th><th>Tipo</th><th className={s.num}>Reservas</th><th className={s.num}>Noches</th><th className={s.num}>Producción</th><th className={s.num}>ADR</th><th className={s.num}>Cancelación</th><th className={s.num}>Lead time</th><th className={s.num}>Costo canal</th><th className={s.num}>Neto</th><th>Participación</th></tr></thead><tbody>{rows.map(row=>{const share=totalRevenue?row.revenue/totalRevenue*100:0,draft=draftFor(row);return <tr key={row.name}><td><b>{row.name}</b>{editing&&canManage&&<div className={s.costEditor}><label><span>%</span><input inputMode="decimal" value={draft.commission_percent} onChange={e=>change(row,"commission_percent",e.target.value)} placeholder="0"/></label><label><span>Fijo</span><input inputMode="decimal" value={draft.fixed_fee_per_reservation} onChange={e=>change(row,"fixed_fee_per_reservation",e.target.value)} placeholder="0"/></label><button type="button" disabled={saving===row.name} onClick={()=>save(row)}>{saving===row.name?"…":"Guardar"}</button></div>}</td><td><span className={s.type} data-type={row.type}>{row.type}</span></td><td className={s.num}>{row.reservations}</td><td className={s.num}>{row.roomNights}</td><td className={s.num}><b>{money(row.revenue,currency)}</b></td><td className={s.num}>{money(row.adr,currency)}</td><td className={s.num}><span data-alert={row.cancelRate>=20?"high":row.cancelRate>=10?"mid":"low"}>{row.cancelRate.toFixed(1)}%</span></td><td className={s.num}>{row.lead.toFixed(1)} días</td><td className={s.num}>{row.configured?<><b>{money(row.distributionCost,currency)}</b><small className={s.costMeta}>{row.commission}%{row.fixed>0?` + ${money(row.fixed,currency)}/res.`:""}</small></>:<span className={s.unconfigured}>Sin configurar</span>}</td><td className={s.num}>{row.configured?<b className={s.net}>{money(row.netRevenue,currency)}</b>:<span className={s.unconfigured}>—</span>}</td><td><div className={s.share}><i style={{width:`${Math.min(100,share)}%`}}/><span>{share.toFixed(1)}%</span></div></td></tr>})}{!rows.length&&<tr><td colSpan="11" className={s.empty}>No hay reservas de {currency} dentro de este período.</td></tr>}</tbody></table></div>
    <footer><span>La tabla conserva el nombre original del canal para detectar duplicados como Teléfono/Telefónica o Motor web/Motor directo.</span><b>El neto sólo aparece cuando ese canal tiene un costo configurado; nunca se inventan comisiones.</b></footer>
  </section>
}
