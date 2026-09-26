export const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))
export const normalize=value=>String(value||"").trim().toLowerCase()
export const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)
export const roomIds=item=>[...new Set([item?.habitacion_id,...(item?.habitaciones_ids||[])].filter(Boolean).map(Number))]
export const detailFor=(item,roomId)=>(Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]).find(row=>Number(row?.habitacion_id)===Number(roomId))||{}
export const roomStart=(item,roomId)=>{const value=detailFor(item,roomId)?.fecha_entrada;return validDate(value)?String(value):item?.fecha_entrada}
export const roomPlannedEnd=(item,roomId)=>{const value=detailFor(item,roomId)?.fecha_salida;return validDate(value)?String(value):item?.fecha_salida}
export const roomEnd=(item,roomId)=>{const planned=roomPlannedEnd(item,roomId),release=item?.room_checkout_dates?.[String(roomId)];return validDate(release)&&String(release)<planned?String(release):planned}
export const round=value=>Math.round((Number(value)||0)*100)/100
export const prettyDate=value=>{if(!validDate(value))return value||"—";const[y,m,d]=String(value).split("-");return`${d}/${m}/${y}`}
export const inHouseState=value=>["alojado","inhouse","in_house","in house"].includes(normalize(value))
