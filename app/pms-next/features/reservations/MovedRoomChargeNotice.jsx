"use client"

import s from"./reservationFolioBilling.module.css"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)

export default function MovedRoomChargeNotice({selected,items,folios}){
  if(!selected?.room_id)return null
  const rows=(items||[]).filter(row=>row.status==="active"&&Number(row.room_id)===Number(selected.room_id)&&row.folio_id!==selected.id).map(row=>({...row,target:folios.find(folio=>folio.id===row.folio_id)})).filter(row=>row.target)
  if(!rows.length)return null
  return <div className={s.redirect}>{rows.map(row=><p key={row.id}><b>{row.description} · {money(row.total,row.currency)}</b><span>Trasladado a {row.target.label}. Los pagos se muestran allí.</span></p>)}</div>
}
