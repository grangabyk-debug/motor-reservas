import{ supabase }from"../../../lib/supabase"

export async function completeMercadoPagoOAuth({code,state}){
  const{data:{session},error}=await supabase.auth.getSession()
  if(error)throw error
  if(!session?.access_token)throw new Error("Volvé a iniciar sesión para completar la conexión.")
  const response=await fetch("/api/hotel/mercadopago/oauth/complete",{
    method:"POST",
    headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},
    body:JSON.stringify({code,state}),
  })
  const data=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(data?.error||"No se pudo completar la conexión.")
  return data
}
