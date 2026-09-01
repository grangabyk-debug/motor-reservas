import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"

const BUCKET="hotel-reservation-documents"
const MAX_BYTES=12*1024*1024
const ALLOWED=new Set(["image/jpeg","image/png","image/webp","application/pdf"])
const HOLDER_ROLES=new Set(["reservation","primary","companion","company"])

function extFor(file){const fromName=String(file.name||"").split(".").pop()?.toLowerCase();if(fromName&&/^[a-z0-9]{2,5}$/.test(fromName))return fromName;return file.type==="application/pdf"?"pdf":file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg"}
async function imageBitmap(file){if("createImageBitmap"in window)return createImageBitmap(file);return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=e=>{URL.revokeObjectURL(url);reject(e)};img.src=url})}

export async function compressReservationDocument(file){
  if(!ALLOWED.has(file.type))throw new Error("Usá JPG, PNG, WEBP o PDF.")
  if(file.size>MAX_BYTES)throw new Error("El archivo supera 12 MB.")
  if(!file.type.startsWith("image/"))return file
  const bitmap=await imageBitmap(file),maxSide=1800,scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height)),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale)),canvas=document.createElement("canvas")
  canvas.width=width;canvas.height=height;canvas.getContext("2d",{alpha:false}).drawImage(bitmap,0,0,width,height);bitmap.close?.()
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.78))
  if(!blob||blob.size>=file.size)return file
  return new File([blob],`${String(file.name||"documento").replace(/\.[^.]+$/,"" )}.jpg`,{type:"image/jpeg",lastModified:Date.now()})
}

export async function listReservationDocuments({propertyId,reservationId}){
  const{data,error}=await supabase.from("hotel_reservation_documents").select("*").eq("property_id",requirePropertyId(propertyId)).eq("reserva_id",Number(reservationId)).order("created_at",{ascending:false});if(error)throw error;return data||[]
}

export async function uploadReservationDocuments({propertyId,reservationId,userId,items=[]}){
  const pid=requirePropertyId(propertyId),created=[]
  for(const item of items){const file=item.file||item,kind=item.kind||"documento",holderRole=HOLDER_ROLES.has(item.holderRole)?item.holderRole:"reservation",holderName=String(item.holderName||"").trim()||null,guestProfileId=item.guestProfileId||null,passengerIndex=Number.isInteger(item.passengerIndex)?item.passengerIndex:null,metadata=item.metadata&&typeof item.metadata==="object"&&!Array.isArray(item.metadata)?item.metadata:{},safeName=String(file.name||"documento").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-90),path=`${pid}/${Number(reservationId)}/${crypto.randomUUID()}-${safeName}`
    const{error:uploadError}=await supabase.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false,cacheControl:"3600"});if(uploadError)throw uploadError
    const{data,error}=await supabase.from("hotel_reservation_documents").insert({property_id:pid,reserva_id:Number(reservationId),guest_profile_id:guestProfileId,holder_role:holderRole,holder_name:holderName,passenger_index:passengerIndex,metadata,kind,file_name:file.name||safeName,storage_path:path,mime_type:file.type||"application/octet-stream",original_size_bytes:Number(item.originalSize??file.size),stored_size_bytes:Number(file.size),uploaded_by:userId}).select("*").single()
    if(error){await supabase.storage.from(BUCKET).remove([path]);throw error}created.push(data)
  }
  return created
}

export async function updateReservationDocumentHolder({propertyId,documentId,holderRole="reservation",holderName=null,passengerIndex=null,guestProfileId=null}){
  const pid=requirePropertyId(propertyId),role=HOLDER_ROLES.has(holderRole)?holderRole:"reservation",row={holder_role:role,holder_name:String(holderName||"").trim()||null,passenger_index:Number.isInteger(passengerIndex)?passengerIndex:null,guest_profile_id:role==="primary"?guestProfileId||null:null}
  const{data,error}=await supabase.from("hotel_reservation_documents").update(row).eq("id",documentId).eq("property_id",pid).select("*").single();if(error)throw error;return data
}

export async function openReservationDocument(document){const{data,error}=await supabase.storage.from(BUCKET).createSignedUrl(document.storage_path,90);if(error)throw error;window.open(data.signedUrl,"_blank","noopener,noreferrer")}

export async function deleteReservationDocument({propertyId,document}){const pid=requirePropertyId(propertyId);const{error}=await supabase.from("hotel_reservation_documents").delete().eq("id",document.id).eq("property_id",pid);if(error)throw error;const{error:storageError}=await supabase.storage.from(BUCKET).remove([document.storage_path]);if(storageError)console.warn("No se pudo eliminar el objeto del storage",storageError.message)}
