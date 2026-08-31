import{authContext,authorizationUrl,canManage,createOAuthState,errorResponse,memberRole,platformReady}from"../../_lib"

export async function POST(request){
  try{
    if(!platformReady())return Response.json({error:"La integración está preparada, pero faltan las credenciales de la aplicación Mercado Pago de Habitación Llena."},{status:503})
    const{client,user}=await authContext(request),body=await request.json().catch(()=>({})),propertyId=body?.property_id;if(!propertyId)return Response.json({error:"Falta la propiedad."},{status:400})
    const role=await memberRole(client,user.id,propertyId);if(!canManage(role))return Response.json({error:"Solo un propietario o administrador puede vincular Mercado Pago."},{status:403})
    const{state,challenge}=createOAuthState({propertyId,userId:user.id})
    return Response.json({url:authorizationUrl({state,challenge})})
  }catch(error){return errorResponse(error)}
}