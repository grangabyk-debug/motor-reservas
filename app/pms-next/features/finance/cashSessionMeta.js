const PREFIX="HL_CASH_META_V1:"
const SHIFTS=["Mañana","Tarde","Noche"]

export function suggestedCashShift(date=new Date()){
  const hour=date.getHours()
  return hour<13?"Mañana":hour<20?"Tarde":"Noche"
}

export function parseCashSessionMeta(value){
  const raw=String(value||"")
  if(!raw.startsWith(PREFIX))return{openerName:"",shift:"",closeNote:raw}
  try{
    const data=JSON.parse(raw.slice(PREFIX.length))
    return{
      openerName:String(data?.openerName||"").trim(),
      shift:String(data?.shift||"").trim(),
      closeNote:String(data?.closeNote||"").trim(),
    }
  }catch{return{openerName:"",shift:"",closeNote:raw}}
}

export function serializeCashSessionMeta({openerName="",shift="",closeNote=""}={}){
  const safeShift=SHIFTS.includes(shift)?shift:String(shift||"").trim().slice(0,40)
  return PREFIX+JSON.stringify({
    openerName:String(openerName||"").trim().slice(0,120),
    shift:safeShift,
    closeNote:String(closeNote||"").trim().slice(0,1000),
  })
}
