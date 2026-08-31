import{authContext,canManage,errorResponse,loadConnection,memberRole,platformReady,safeConnection}from"../_lib"

export async function GET(request){
  try{
    const{client,user}=await authContext(request),url=new URL(request.url),propertyId=url.searchParams.get("property_id");if(!propertyId)return Response.json({error:"Falta la propiedad."},{status:400})
    const role=await memberRole(client,user.id,propertyId),connection=await loadConnection(client,propertyId)
    return Response.json({platform_ready:platformReady(),connection:safeConnection(connection,role),can_manage:canManage(role)})
  }catch(error){return errorResponse(error)}
}

export async function DELETE(request){
  try{
    const{client,user}=await authContext(request),body=await request.json().catch(()=>({})),propertyId=body?.property_id;if(!propertyId)return Response.json({error:"Falta la propiedad."},{status:400})
    const role=await memberRole(client,user.id,propertyId);if(!canManage(role))return Response.json({error:"Solo un propietario o administrador puede desconectar Mercado Pago."},{status:403})
    const{error}=await client.from("hotel_payment_connections").update({status:"revoked",access_token_encrypted:null,refresh_token_encrypted:null,public_key:null,token_expires_at:null,updated_at:new Date().toISOString()}).eq("property_id",propertyId);if(error)throw error
    return Response.json({ok:true,connection:{connected:false,status:"revoked",can_manage:true}})
  }catch(error){return errorResponse(error)}
}