const HISTORY_ROLES=new Set(["previous_room","transient_room","cancelled_room","no_show_room"])
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))
const todayKey=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())

export function roomCheckoutPresentation(item,roomingRows=[],assigned=[],fallbackRoom=null){
  const details=Array.isArray(item?.habitaciones_detalle)?item.habitaciones_detalle:[]
  const logicalIds=new Set(details.filter(detail=>detail?.habitacion_id&&!HISTORY_ROLES.has(String(detail?.segment_role||"").toLowerCase())).map(detail=>Number(detail.habitacion_id)).filter(Number.isFinite))
  if(!logicalIds.size)for(const row of roomingRows){const id=Number(row?.roomId);if(Number.isFinite(id))logicalIds.add(id)}
  if(!logicalIds.size)for(const room of assigned){const id=Number(room?.id);if(Number.isFinite(id))logicalIds.add(id)}
  const dates={}
  const today=todayKey()
  for(const id of logicalIds){const value=item?.room_checkout_dates?.[String(id)];if(validDate(value)&&String(value)<=today)dates[String(id)]=String(value)}
  const names=[...logicalIds].map(id=>roomingRows.find(row=>Number(row.roomId)===id)?.name||assigned.find(room=>Number(room.id)===id)?.nombre||String(id))
  const total=logicalIds.size||1,count=Object.keys(dates).length
  const summary=total>1?`${total} habitaciones · ${names.slice(0,4).join(", ")}${names.length>4?` +${names.length-4}`:""}`:names[0]?`Habitación ${names[0]}`:fallbackRoom?.nombre?`Habitación ${fallbackRoom.nombre}`:"Sin habitación"
  return{count,total,dates,summary}
}

export function RoomCheckoutHeroBadge({count,total,finalized=false}){
  if(!count||finalized)return null
  return <span style={{padding:"5px 9px",border:"1px solid color-mix(in srgb,#2e9b61 32%,var(--line))",borderRadius:999,background:"color-mix(in srgb,#2e9b61 9%,var(--panelSolid))",color:"#26794d",fontSize:10.5,fontWeight:900}}>✓ {count} de {total} hab. con check-out</span>
}
export function RoomCheckoutFact({count}){return count?<span style={{display:"block",marginTop:2,fontSize:10,color:"#26794d",fontWeight:850}}>✓ {count} con check-out</span>:null}
export function RoomCheckoutHeader({count,hasMore,expanded,totalRows,onToggle}){
  if(!count&&!hasMore)return null
  return <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>{count?<span style={{padding:"5px 8px",border:"1px solid color-mix(in srgb,#2e9b61 28%,var(--line))",borderRadius:999,background:"color-mix(in srgb,#2e9b61 8%,var(--panelSolid))",color:"#26794d",fontSize:10,fontWeight:900}}>✓ {count} check-out</span>:null}{hasMore?<button type="button" onClick={onToggle} aria-expanded={expanded}>{expanded?"Ver menos":`Ver todas (${totalRows})`} {expanded?"▴":"▾"}</button>:null}</div>
}
