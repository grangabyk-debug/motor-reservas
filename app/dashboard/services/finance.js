import{ supabase }from"../../../lib/supabase"
import{ requirePropertyId }from"../data/tenant"

const tenant=id=>requirePropertyId(id)

export async function openCashSession({propertyId,userId,openingAmount=0,notes=""}){
  const property=tenant(propertyId),{data:open,error:readError}=await supabase.from("hotel_cash_sessions").select("id").eq("property_id",property).eq("status","open").maybeSingle();if(readError)throw readError;if(open)throw new Error("Ya hay una caja abierta para esta propiedad.")
  const{error}=await supabase.from("hotel_cash_sessions").insert({property_id:property,opened_by:userId,opening_amount:Math.max(0,Number(openingAmount||0)),status:"open",notes:notes||null});if(error)throw error
}

export async function saveCashMovement({propertyId,userId,sessionId,reservationId=null,movementType="income",method="Efectivo",amount,concept,reference="",currency="ARS"}){
  const property=tenant(propertyId),value=Number(amount||0);if(!sessionId)throw new Error("No hay caja abierta.");if(value<=0)throw new Error("Ingresá un monto válido.");if(!String(concept||"").trim())throw new Error("Ingresá el concepto del movimiento.")
  const{data:session,error:sessionError}=await supabase.from("hotel_cash_sessions").select("id,status").eq("id",sessionId).eq("property_id",property).single();if(sessionError||session?.status!=="open")throw new Error("La caja ya no está abierta.")
  const{error}=await supabase.from("hotel_cash_movements").insert({property_id:property,session_id:sessionId,reservation_id:reservationId?Number(reservationId):null,movement_type:movementType,method,amount:value,currency,concept:String(concept).trim(),reference:reference||null,created_by:userId});if(error)throw error
}

export async function closeCashSession({propertyId,userId,sessionId,closingAmount,notes=""}){
  const property=tenant(propertyId),{data:session,error:sessionError}=await supabase.from("hotel_cash_sessions").select("*").eq("id",sessionId).eq("property_id",property).single();if(sessionError||!session)throw new Error("Caja no encontrada.");if(session.status!=="open")throw new Error("La caja ya está cerrada.")
  const{data:moves,error:movesError}=await supabase.from("hotel_cash_movements").select("movement_type,amount").eq("property_id",property).eq("session_id",sessionId);if(movesError)throw movesError
  const expected=(moves||[]).reduce((sum,m)=>sum+(m.movement_type==="expense"?-Number(m.amount||0):Number(m.amount||0)),Number(session.opening_amount||0)),closing=Number(closingAmount||0)
  const{error}=await supabase.from("hotel_cash_sessions").update({closed_by:userId,closed_at:new Date().toISOString(),closing_amount:closing,expected_amount:expected,status:"closed",notes:notes||session.notes||null}).eq("id",sessionId).eq("property_id",property);if(error)throw error;return{expected,closing,difference:closing-expected}
}

export async function saveFinanceDocument({propertyId,userId,draft}){
  const property=tenant(propertyId),items=Array.isArray(draft.items)?draft.items:[],subtotal=items.reduce((a,x)=>a+Number(x.total??Number(x.quantity||1)*Number(x.unit_price||0)),0),tax=Math.max(0,Number(draft.tax||0)),total=Math.max(0,Number(draft.total||subtotal+tax)),row={property_id:property,reservation_id:draft.reservation_id?Number(draft.reservation_id):null,group_id:draft.group_id||null,partner_id:draft.partner_id||null,document_type:draft.document_type||"receipt",number:draft.number||null,status:draft.status||"draft",currency:draft.currency||"ARS",subtotal,tax,total,balance:Math.max(0,Number(draft.balance??total)),billing_to:draft.billing_to||{},items,issued_at:draft.issued_at||null,due_at:draft.due_at||null,external_ref:draft.external_ref||null,notes:draft.notes||null,created_by:userId,updated_at:new Date().toISOString()}
  const query=draft.id?supabase.from("hotel_finance_documents").update(row).eq("id",draft.id).eq("property_id",property):supabase.from("hotel_finance_documents").insert(row);const{error}=await query;if(error)throw error
}

export async function issueInternalDocument({propertyId,id}){
  const property=tenant(propertyId),number=`HL-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;const{error}=await supabase.from("hotel_finance_documents").update({status:"issued",number,issued_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).eq("property_id",property);if(error)throw error;return number
}

export function buildFrontDeskReport(type,date,{reservations=[],rooms=[],payments=[],housekeeping=[]}){
  const roomName=id=>rooms.find(r=>String(r.id)===String(id))?.nombre||id,paid=new Map();payments.forEach(p=>paid.set(String(p.reserva_id),(paid.get(String(p.reserva_id))||0)+Number(p.monto||0)))
  const live=reservations.filter(r=>r.estado!=="cancelada"&&!r.no_show),inhouse=live.filter(r=>r.fecha_entrada<=date&&r.fecha_salida>date&&r.estado!=="finalizada")
  if(type==="arrivals")return{columns:["Reserva","Huésped","Habitación","Estado","Contacto"],rows:live.filter(r=>r.fecha_entrada===date).map(r=>[r.numero_reserva||r.id,r.nombre_huesped,roomName(r.habitacion_id),r.estado,r.telefono_huesped||r.email_huesped||""])}
  if(type==="departures")return{columns:["Reserva","Huésped","Habitación","Estado","Saldo"],rows:live.filter(r=>r.fecha_salida===date).map(r=>[r.numero_reserva||r.id,r.nombre_huesped,roomName(r.habitacion_id),r.estado,Math.max(0,Number(r.precio_total||0)-(paid.get(String(r.id))||0))])}
  if(type==="inhouse")return{columns:["Huésped","Habitación","Salida","Pax","Canal"],rows:inhouse.map(r=>[r.nombre_huesped,roomName(r.habitacion_id),r.fecha_salida,r.cantidad_huespedes||1,r.canal_reserva||"Directa"])}
  if(type==="housekeeping")return{columns:["Habitación","Tarea","Prioridad","Estado","Programada"],rows:housekeeping.filter(t=>!t.scheduled_for||String(t.scheduled_for).slice(0,10)===date).map(t=>[roomName(t.room_id),t.task_type,t.priority,t.status,t.scheduled_for?new Date(t.scheduled_for).toLocaleString("es-AR"):""])}
  if(type==="balances")return{columns:["Reserva","Huésped","Total","Pagado","Saldo"],rows:live.map(r=>{const p=paid.get(String(r.id))||0,s=Math.max(0,Number(r.precio_total||0)-p);return[r.numero_reserva||r.id,r.nombre_huesped,Number(r.precio_total||0),p,s]}).filter(r=>r[4]>.01)}
  return{columns:["Reserva","Huésped","Habitación","Entrada","Salida","Estado"],rows:live.filter(r=>r.fecha_entrada<=date&&r.fecha_salida>=date).map(r=>[r.numero_reserva||r.id,r.nombre_huesped,roomName(r.habitacion_id),r.fecha_entrada,r.fecha_salida,r.estado])}
}
