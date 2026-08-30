import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"

export const INVITABLE_ROLES=["manager","reception","housekeeping","admin","revenue","maintenance","night_audit"]

export async function loadPropertyUsers(propertyId){
  const property=requirePropertyId(propertyId)
  const{data:members,error}=await supabase.from("property_members").select("user_id,role,created_at").eq("property_id",property).order("created_at")
  if(error)throw error
  const ids=(members||[]).map(row=>row.user_id)
  if(!ids.length)return[]
  const{data:profiles,error:profilesError}=await supabase.from("profiles").select("id,full_name,role").in("id",ids)
  if(profilesError)throw profilesError
  return(members||[]).map(member=>({...member,profile:(profiles||[]).find(profile=>profile.id===member.user_id)||null}))
}

export async function invitePropertyUser({propertyId,email,fullName,role}){
  const property=requirePropertyId(propertyId),normalized=String(email||"").trim().toLowerCase()
  if(!normalized)throw new Error("Ingresá un email.")
  if(!INVITABLE_ROLES.includes(role))throw new Error("Elegí un rol válido.")
  const{data:{session}}=await supabase.auth.getSession()
  if(!session?.access_token)throw new Error("La sesión expiró.")
  const response=await fetch("/api/users/invite",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({email:normalized,fullName:String(fullName||"").trim(),role,propertyId:property})})
  const data=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(data?.error||"No se pudo invitar al usuario.")
  return data
}
