import{supabase}from"../../../../lib/supabase"
import{formatCurrency}from"../../core/currency"
import{convertRatePlans,normalizeRatePlans}from"../../core/ratePlans"

const iso=date=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10)

export default async function changeRatePlanCurrency({propertyId,target,isOwner,pricing,effectiveFx,fx,propertySettings,setPropertySettings,load,setSaving,setError}){
  if(!isOwner||target===pricing.rateCurrency)return
  if(!effectiveFx){setError("Falta una cotización USD/ARS válida.");return}
  const message=`Convertir tarifas y calendario de ${pricing.rateCurrency} a ${target} con 1 USD = ${formatCurrency(effectiveFx,"ARS")}. Las reservas existentes no cambian. ¿Continuar?`
  if(typeof window!=="undefined"&&!window.confirm(message))return
  setSaving("currency");setError("")
  try{
    const factor=pricing.rateCurrency==="ARS"&&target==="USD"?1/effectiveFx:effectiveFx,convertedPlans=convertRatePlans(normalizeRatePlans(propertySettings),factor)
    const{data,error:rpcError}=await supabase.rpc("hl_change_rate_currency_with_plans",{p_property_id:propertyId,p_target_currency:target,p_usd_ars_rate:effectiveFx,p_rate_plans:convertedPlans,p_fx_source:pricing.fxMode==="manual"?"Manual":fx?.source||"Banco Nación · dólar billete venta",p_fx_as_of:pricing.fxMode==="manual"?iso(new Date()):fx?.asOf||iso(new Date())})
    if(rpcError)throw rpcError
    const next={...propertySettings,pricing:{...(propertySettings.pricing||{}),...(data||{})},rate_plans:convertedPlans}
    setPropertySettings(next);await load()
    if(typeof window!=="undefined"){window.dispatchEvent(new CustomEvent("hl:property-settings-updated",{detail:{propertyId,settings:next}}));window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{title:`Tarifas en ${target}`,message:`Cambio guardado con 1 USD = ${formatCurrency(effectiveFx,"ARS")}. Los ajustes por régimen se convirtieron junto con el calendario.`}}))}
  }catch(err){setError(err?.message||"No se pudo cambiar la moneda base.")}
  finally{setSaving("")}
}
