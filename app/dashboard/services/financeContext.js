import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"
import{commerceRegion,regionalCashMethods}from"../core/regionalCommerce"

export async function loadFinanceContext({propertyId}){
  const property=requirePropertyId(propertyId),{data,error}=await supabase.from("hotel_os_settings").select("operational_settings").eq("property_id",property).maybeSingle();if(error)throw error
  const ops=data?.operational_settings&&typeof data.operational_settings==="object"?data.operational_settings:{},region=commerceRegion(ops)
  return{...region,cashMethods:regionalCashMethods(ops),paymentProviderPreference:ops?.commerce?.payment_provider_preference||region.payments[0]||"",fiscalProvider:ops?.commerce?.fiscal_provider||region.fiscal}
}
