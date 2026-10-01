const EPS=.009
const round=value=>Math.round((Number(value)||0)*100)/100
const day=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||"").slice(0,10))?String(value).slice(0,10):""
const nextDay=value=>{const d=new Date(value+"T12:00:00");d.setDate(d.getDate()+1);return d.toISOString().slice(0,10)}
const validPayment=row=>!["anulado","cancelado","void","rechazado","cancelled"].includes(String(row?.estado||"").trim().toLowerCase())
const originFromNote=payment=>String(payment?.nota||"").match(/Cargos:\s*(.+)$/i)?.[1]?.trim()||""

function roomDetail(reservation,roomId){return(Array.isArray(reservation?.habitaciones_detalle)?reservation.habitaciones_detalle:[]).find(row=>String(row?.habitacion_id||"")===String(roomId||""))||{}}
function roomName(item,detail){return String(detail?.nombre||item?.description||item?.room_id||"").replace(/^Alojamiento\s*·\s*Habitación\s*/i,"").split("·")[0].trim()}
function splitLodging(item,reservation){
  const detail=roomDetail(reservation,item.room_id),name=roomName(item,detail),taxRate=Math.max(0,Number(item.tax_rate)||0),nights=Array.isArray(detail?.occupancy_nights)?[...detail.occupancy_nights].filter(n=>day(n?.date)).sort((a,b)=>day(a.date).localeCompare(day(b.date))):[]
  let rows=[]
  if(nights.length){
    rows=nights.map((night,index)=>{const date=day(night.date),gross=round(Number(night.final_rate)||0),net=round(Number(night.net_rate)||gross/(1+taxRate/100)),plan=String(night.rate_plan_name||detail.rate_plan_name||reservation?.regimen||"Alojamiento"),guests=Math.max(1,Number(night.guests)||1);return{...item,id:item.id+"::"+date,billing_parent_id:item.id,billing_segment_key:"lodging:"+String(item.room_id)+":"+date,description:"Alojamiento · Habitación "+name+" · "+plan,detail:date+" → "+nextDay(date)+" · "+guests+" huésped"+(guests===1?"":"es"),service_date:date,quantity:1,unit_price:net,subtotal:net,tax:round(gross-net),total:gross,_segment_index:index,_segment_count:nights.length}})
  }else{
    const count=Math.max(1,Math.round(Number(item.quantity)||1)),start=day(item.service_date)
    if(count>1&&start){const perGross=round(Number(item.total||0)/count),perNet=round(Number(item.subtotal||0)/count);for(let i=0;i<count;i++){let date=start;for(let x=0;x<i;x++)date=nextDay(date);rows.push({...item,id:item.id+"::"+date,billing_parent_id:item.id,billing_segment_key:"lodging:"+String(item.room_id)+":"+date,description:item.description,detail:date+" → "+nextDay(date)+(item.detail?" · "+item.detail:""),service_date:date,quantity:1,unit_price:perNet,subtotal:perNet,tax:round(perGross-perNet),total:perGross,_segment_index:i,_segment_count:count})}}
  }
  if(!rows.length)return[{...item,billing_parent_id:item.id,billing_segment_key:null}]
  const target=round(item.total),sum=round(rows.reduce((acc,row)=>acc+Number(row.total||0),0)),delta=round(target-sum)
  if(Math.abs(delta)>EPS){const last=rows[rows.length-1];last.total=round(last.total+delta);last.tax=round(last.total-last.subtotal)}
  return rows
}

function distributePayments(rows,itemAllocations,payments){
  const payMap=new Map((payments||[]).filter(validPayment).map(payment=>[Number(payment.id),payment])),byParent=new Map()
  for(const row of rows){const key=String(row.billing_parent_id||row.id);if(!byParent.has(key))byParent.set(key,[]);row.payment_parts=[];row.paid=0;row.remaining=Math.max(0,Number(row.total)||0);byParent.get(key).push(row)}
  for(const list of byParent.values())list.sort((a,b)=>String(a.service_date||"").localeCompare(String(b.service_date||""))||Number(a._segment_index||0)-Number(b._segment_index||0))
  const ordered=[...(itemAllocations||[])].sort((a,b)=>{const pa=payMap.get(Number(a.payment_id)),pb=payMap.get(Number(b.payment_id));return new Date(pa?.created_at||a.created_at||0)-new Date(pb?.created_at||b.created_at||0)||String(a.id||"").localeCompare(String(b.id||""))})
  for(const allocation of ordered){const payment=payMap.get(Number(allocation.payment_id));if(!payment)continue;const list=byParent.get(String(allocation.folio_item_id||""))||[];let left=Math.max(0,Number(allocation.amount)||0);for(const row of list){if(left<=EPS)break;const capacity=Math.max(0,Number(row.total||0)-Number(row.paid||0));if(capacity<=EPS)continue;const amount=round(Math.min(capacity,left)),origin=originFromNote(payment),current=String(row.description||""),sameOrigin=!origin||origin.includes(current)||current.includes(origin);row.payment_parts.push({payment_id:Number(payment.id),method:payment.metodo||"Pago",amount,currency:payment.moneda||row.currency||"ARS",created_at:payment.created_at||"",origin:sameOrigin?"":origin});row.paid=round(Number(row.paid||0)+amount);row.remaining=round(Math.max(0,Number(row.total||0)-row.paid));left=round(left-amount)}}
  return rows
}

export function buildFolioBillingRows({items=[],reservation,itemAllocations=[],payments=[]}={}){
  const rows=[]
  for(const item of items.filter(row=>row?.status==="active")){if(String(item.source_type||"").toLowerCase()==="lodging")rows.push(...splitLodging(item,reservation));else rows.push({...item,billing_parent_id:item.id,billing_segment_key:null})}
  return distributePayments(rows,itemAllocations,payments)
}

export function billingRowParentId(row){return row?.billing_parent_id||row?.id}
export function billingRowSegmentKey(row){return row?.billing_segment_key||null}
