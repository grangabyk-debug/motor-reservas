import{NextResponse}from"next/server"
import{createHash,randomUUID}from"node:crypto"
import{createClient}from"@supabase/supabase-js"

const json=(body,status=200)=>NextResponse.json(body,{status})
const TYPES={"image/jpeg":"jpg","image/png":"png","application/pdf":"pdf"}
const MAX_BYTES=5*1024*1024

export async function POST(request,{params}){
  try{
    const resolved=await params,token=String(resolved?.token||"").trim()
    if(token.length<32||token.length>128)return json({error:"Enlace de check-in inválido."},400)
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY
    if(!url||!secret)return json({error:"La carga segura no está disponible en este momento."},503)
    const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}}),tokenHash=createHash("sha256").update(token).digest("hex")
    const{data:checkin,error:checkError}=await admin.from("hotel_web_checkins").select("id,property_id,reservation_id,status,expires_at").eq("token_hash",tokenHash).order("created_at",{ascending:false}).limit(1).maybeSingle()
    if(checkError)throw checkError
    if(!checkin||["cancelled","expired"].includes(checkin.status)||new Date(checkin.expires_at).getTime()<=Date.now())return json({error:"Este enlace venció o ya no está disponible."},410)
    if(checkin.status==="completed")return json({error:"El check-in ya fue completado. Contactá al alojamiento si necesitás reemplazar un documento."},409)

    const form=await request.formData(),file=form.get("file"),side=String(form.get("side")||"").trim().toLowerCase()
    if(!file||typeof file.arrayBuffer!=="function")return json({error:"Seleccioná un archivo."},400)
    if(!["front","back"].includes(side))return json({error:"Indicá frente o dorso del documento."},400)
    const ext=TYPES[file.type]
    if(!ext)return json({error:"Usá una foto JPG/PNG o un PDF."},415)
    if(!file.size||file.size>MAX_BYTES)return json({error:"El archivo debe pesar menos de 5 MB."},413)

    const{count,error:countError}=await admin.from("hotel_reservation_documents").select("id",{count:"exact",head:true}).eq("property_id",checkin.property_id).eq("reserva_id",checkin.reservation_id).eq("kind","identity_document").contains("metadata",{web_checkin_id:checkin.id})
    if(countError)throw countError
    if(Number(count||0)>=4)return json({error:"Ya recibimos los archivos previstos para este check-in. Contactá al alojamiento si necesitás reemplazarlos."},409)

    const{data:reservation,error:reservationError}=await admin.from("reservas").select("nombre_huesped,guest_profile_id").eq("id",checkin.reservation_id).eq("property_id",checkin.property_id).maybeSingle()
    if(reservationError)throw reservationError
    const storagePath=`${checkin.property_id}/${checkin.reservation_id}/web-checkin/${randomUUID()}-${side}.${ext}`,bytes=Buffer.from(await file.arrayBuffer())
    const{error:uploadError}=await admin.storage.from("hotel-reservation-documents").upload(storagePath,bytes,{contentType:file.type,upsert:false,cacheControl:"3600"})
    if(uploadError)throw uploadError
    const row={property_id:checkin.property_id,reserva_id:checkin.reservation_id,kind:"identity_document",file_name:String(file.name||`documento-${side}.${ext}`).slice(0,180),storage_path:storagePath,mime_type:file.type,original_size_bytes:file.size,stored_size_bytes:file.size,uploaded_by:null,guest_profile_id:reservation?.guest_profile_id||null,holder_role:"primary_guest",holder_name:reservation?.nombre_huesped||null,passenger_index:0,metadata:{source:"web_checkin",side,validation_status:"pending",web_checkin_id:checkin.id}}
    const{error:insertError}=await admin.from("hotel_reservation_documents").insert(row)
    if(insertError){await admin.storage.from("hotel-reservation-documents").remove([storagePath]).catch(()=>{});throw insertError}
    return json({ok:true,side,file_name:row.file_name,status:"pending_validation"})
  }catch(error){
    console.error("WEB CHECKIN DOCUMENT UPLOAD ERROR",error)
    return json({error:"No pudimos guardar el documento de forma segura. Probá nuevamente."},500)
  }
}
