import{apiHeaders,authorizeApiRequest}from"../_auth"

const dateOk=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))
const cleanStatus=value=>String(value||"").trim().toLowerCase().slice(0,40)

export async function GET(request){
  const auth=await authorizeApiRequest(request,"reservations:read");if(auth.response)return auth.response
  const context=auth.context,url=new URL(request.url),from=url.searchParams.get("from"),to=url.searchParams.get("to"),status=cleanStatus(url.searchParams.get("status")),limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit"))||50)),afterId=Number(url.searchParams.get("after_id"))||0
  if(from&&!dateOk(from)){await context.log(400);return Response.json({error:"El parámetro from debe usar YYYY-MM-DD."},{status:400,headers:apiHeaders(context)})}
  if(to&&!dateOk(to)){await context.log(400);return Response.json({error:"El parámetro to debe usar YYYY-MM-DD."},{status:400,headers:apiHeaders(context)})}
  try{
    let query=context.admin.from("reservas").select("id,numero_reserva,nombre_huesped,email_huesped,telefono_huesped,fecha_entrada,fecha_salida,estado,no_show,precio_total,moneda,canal_reserva,habitacion_id,habitaciones_ids,cantidad_huespedes,hora_llegada_estimada,hora_salida_estimada,created_at,updated_at").eq("property_id",context.key.property_id).order("id",{ascending:true}).limit(limit)
    if(from)query=query.gte("fecha_entrada",from);if(to)query=query.lte("fecha_entrada",to);if(status)query=query.eq("estado",status);if(afterId>0)query=query.gt("id",afterId)
    const{data,error}=await query;if(error)throw error;const rows=data||[],nextAfter=rows.length===limit?rows[rows.length-1]?.id:null
    await context.log(200)
    return Response.json({data:rows,meta:{count:rows.length,limit,next_after_id:nextAfter,filters:{from:from||null,to:to||null,status:status||null}}},{headers:apiHeaders(context)})
  }catch(error){await context.log(500);return Response.json({error:"No se pudieron consultar las reservas."},{status:500,headers:apiHeaders(context)})}
}
