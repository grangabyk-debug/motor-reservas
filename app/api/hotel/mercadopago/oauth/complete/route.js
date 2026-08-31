import{authContext,canManage,errorResponse,exchangeCode,memberRole,platformReady,readOAuthState,safeConnection,seal}from"../../_lib"

export async function POST(request){
  try{
    if(!platformReady())return Response.json({error:"Mercado Pago todavía no está activado en Habitación Llena."},{status:503})
    const{client,user}=await authContext(request),body=await request.json().catch(()=>({})),code=String(body?.code||""),state=String(body?.state||"");if(!code||!state)return Response.json({error:"Faltan datos para completar la conexión."},{status:400})
    const context=readOAuthState(state);if(String(context.user_id)!==String(user.id))return Response.json({error:"Esta autorización pertenece a otro usuario."},{status:403})
    const role=await memberRole(client,user.id,context.property_id);if(!canManage(role))return Response.json({error:"Tu rol ya no puede administrar esta integración."},{status:403})
    const token=await exchangeCode({code,verifier:context.verifier}),expiresIn=Math.max(60,Number(token.expires_in||15552000)),now=new Date(),expiresAt=new Date(now.getTime()+expiresIn*1000).toISOString(),aad=`mp:${context.property_id}`
    const row={property_id:context.property_id,provider:"mercadopago",external_user_id:token.user_id==null?null:String(token.user_id),public_key:token.public_key||null,access_token_encrypted:seal(token.access_token,aad),refresh_token_encrypted:token.refresh_token?seal(token.refresh_token,aad):null,token_expires_at:expiresAt,scope:token.scope||null,live_mode:!!token.live_mode,status:"connected",connected_by:user.id,metadata:{connected_at:now.toISOString(),token_type:token.token_type||"bearer"},updated_at:now.toISOString()}
    const{data,error}=await client.from("hotel_payment_connections").upsert(row,{onConflict:"property_id"}).select("*").single();if(error)throw error
    return Response.json({ok:true,property_id:context.property_id,connection:safeConnection(data,role)})
  }catch(error){return errorResponse(error)}
}