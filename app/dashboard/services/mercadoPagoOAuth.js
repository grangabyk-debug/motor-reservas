import{ supabase }from"../../../lib/supabase"

export async function mercadoPagoAuthFetch(url,options={}){
  const{data:{session},error}=await supabase.auth.getSession()
  if(error)throw error
  if(!session?.access_token)throw new Error("Tu sesión venció. Volvé a iniciar sesión.")
  const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${session.access_token}`,...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})}})
  const data=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(data?.error||"No se pudo completar la operación.")
  return data
}

export async function completeMercadoPagoOAuth({code,state}){
  return mercadoPagoAuthFetch("/api/hotel/mercadopago/oauth/complete",{method:"POST",body:JSON.stringify({code,state})})
}
