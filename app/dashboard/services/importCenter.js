import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"

export async function loadImportContext(propertyId){
  const property=requirePropertyId(propertyId)
  const[{data:rooms,error:roomsError},{data:batches,error:batchesError}]=await Promise.all([
    supabase.from("habitaciones").select("id,nombre,tipo,capacidad,alojamiento_id,activa").eq("property_id",property).eq("activa",true).order("sort_order").order("nombre"),
    supabase.from("hotel_import_batches").select("id,property_id,source_system,file_name,status,stats,validated_at,imported_at,created_at").eq("property_id",property).order("created_at",{ascending:false}).limit(12),
  ])
  if(roomsError)throw roomsError;if(batchesError)throw batchesError
  return{rooms:rooms||[],batches:batches||[]}
}

export async function loadImportBatch({propertyId,batchId}){
  const property=requirePropertyId(propertyId)
  const[{data:batch,error:batchError},{data:rows,error:rowsError}]=await Promise.all([
    supabase.from("hotel_import_batches").select("*").eq("property_id",property).eq("id",batchId).single(),
    supabase.from("hotel_import_rows").select("id,row_number,raw_data,normalized_data,validation,import_status,imported_reservation_id").eq("property_id",property).eq("batch_id",batchId).order("row_number").limit(2500),
  ])
  if(batchError)throw batchError;if(rowsError)throw rowsError
  return{batch,rows:rows||[]}
}

export async function stageImportBatch({propertyId,userId,sourceSystem,fileName,mapping,rows}){
  const property=requirePropertyId(propertyId)
  if(!Array.isArray(rows)||!rows.length)throw new Error("El archivo no tiene filas para importar.")
  if(rows.length>2500)throw new Error("El archivo supera 2500 filas. Dividilo en partes.")
  const{data:batch,error:batchError}=await supabase.from("hotel_import_batches").insert({property_id:property,entity_type:"reservations",source_system:String(sourceSystem||"PMS anterior").slice(0,120),file_name:String(fileName||"import.csv").slice(0,180),mapping:mapping||{},created_by:userId||null}).select("*").single()
  if(batchError)throw batchError
  const payload=rows.map((row,index)=>({batch_id:batch.id,property_id:property,row_number:index+1,raw_data:row.raw||{},normalized_data:row.normalized||{}}))
  for(let i=0;i<payload.length;i+=200){const{error}=await supabase.from("hotel_import_rows").insert(payload.slice(i,i+200));if(error)throw error}
  await validateImportBatch(batch.id)
  return loadImportBatch({propertyId:property,batchId:batch.id})
}

export async function validateImportBatch(batchId){const{data,error}=await supabase.rpc("hl_import_validate_batch",{p_batch_id:batchId});if(error)throw error;return data}
export async function commitImportBatch(batchId){const{data,error}=await supabase.rpc("hl_import_commit_batch",{p_batch_id:batchId});if(error)throw error;return data}
