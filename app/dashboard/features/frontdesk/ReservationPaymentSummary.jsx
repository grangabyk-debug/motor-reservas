import{money}from"../../core/formatters"
import ReservationFinanceDocuments from"./ReservationFinanceDocuments"
import ReservationHistory from"./ReservationHistory"
import s from"./reservation-payment-summary.module.css"

const isParking=item=>item?.resource_category==="parking"||item?.kind==="parking"
const amount=item=>Number(item?.total??item?.amount??0)

function detail(item,currency){
  const quantity=Number(item?.quantity||0),unit=Number(item?.unit_price||0)
  if(quantity>1&&unit>0)return`${quantity} × ${money(unit,currency)}`
  return item?.charge_mode==="per_night"?"Por noche":item?.charge_mode==="per_day"?"Por día":item?.charge_mode==="per_person"?"Por persona":"Cargo"
}

export default function ReservationPaymentSummary({draft,totals,paid,balance}){
  const currency=draft?.currency||"ARS",lines=[],dayUse=draft?.stayType==="day_use",units=Number(totals?.billingUnits||0)
  const stay=units*Number(totals?.rate||0)
  if(stay>0){
    if(dayUse)lines.push({key:"stay",label:`Day Use · ${totals.arrivalTime||""} → ${totals.departureTime||""}`,detail:"Tarifa por uso diurno",value:stay})
    else lines.push({key:"stay",label:`Estadía · ${totals.nights} ${Number(totals.nights)===1?"noche":"noches"}`,detail:`${money(totals.rate,currency)} por noche`,value:stay})
  }

  const extras=draft?.extras||[],parkingLines=extras.filter(isParking)
  if(parkingLines.length){
    parkingLines.forEach((item,index)=>{const value=amount(item);if(value>0)lines.push({key:`parking-${index}`,label:item.name||"Cochera",detail:detail(item,currency),value})})
  }else if(Number(totals?.parking||0)>0){
    lines.push({key:"parking-manual",label:"Cochera",detail:"Cargo de cochera",value:Number(totals.parking)})
  }

  ;(draft?.pets||[]).forEach((pet,index)=>{const value=Number(pet?.amount||0);if(value>0)lines.push({key:`pet-${index}`,label:pet?.name?`Mascota · ${pet.name}`:"Mascota",detail:pet?.resource_category?"Servicio para mascota":"Cargo de mascota",value})})

  extras.filter(item=>!isParking(item)).forEach((item,index)=>{const value=amount(item);if(value>0)lines.push({key:`extra-${index}`,label:item?.name||"Cargo extra",detail:detail(item,currency),value})})

  return <section className={s.wrap} aria-label="Resumen de cuenta del huésped">
    <div className={s.metrics}>
      <article className={s.total}><span>Total cuenta</span><strong>{money(totals?.total||0,currency)}</strong></article>
      <article><span>Pagado</span><strong>{money(paid||0,currency)}</strong></article>
      <article className={balance>.01?s.pending:s.clear}><span>Saldo pendiente</span><strong>{money(balance||0,currency)}</strong></article>
    </div>
    <div className={s.breakdown}>
      <header><div><small>CUENTA DEL HUÉSPED</small><h4>Detalle de cargos</h4></div><strong>{money(totals?.total||0,currency)}</strong></header>
      <div className={s.lines}>
        {lines.map(line=><div className={s.line} key={line.key}><span><b>{line.label}</b><small>{line.detail}</small></span><strong>{money(line.value,currency)}</strong></div>)}
        {!lines.length&&<div className={s.empty}>Completá la estadía o agregá extras para ver el desglose de la cuenta.</div>}
      </div>
    </div>
    {draft?.id&&<ReservationFinanceDocuments draft={draft} totals={totals}/>} 
    {draft?.id&&<ReservationHistory reservationId={draft.id} guestIdentity={{document:draft.document,email:draft.email,phone:draft.phone}}/>}
  </section>
}