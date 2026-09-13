import{ supabase }from"../../../lib/supabase"
import{buildModuleAccess}from"../core/modules"

export async function loadModuleAccess(propertyId){
  if(!propertyId)return buildModuleAccess()
  const[subscription,entitlements,catalog,planModules]=await Promise.all([
    supabase.from("hotel_subscriptions").select("*").eq("property_id",propertyId).order("created_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("hotel_feature_entitlements").select("*").eq("property_id",propertyId),
    supabase.from("hotel_module_catalog").select("*").eq("active",true).order("sort_order"),
    supabase.from("hotel_plan_modules").select("plan_code,module_code,enabled"),
  ])
  const failed=[subscription,entitlements,catalog,planModules].find(x=>x.error);if(failed?.error)throw failed.error
  return buildModuleAccess({subscription:subscription.data||null,entitlements:entitlements.data||[],catalog:catalog.data||[],planModules:planModules.data||[]})
}

export function subscribeModuleAccess({propertyId,onChange}){
  if(!propertyId)return()=>{}
  const filter=`property_id=eq.${propertyId}`
  const channel=supabase.channel(`hl-module-access-${propertyId}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"hotel_subscriptions",filter},onChange)
    .on("postgres_changes",{event:"*",schema:"public",table:"hotel_feature_entitlements",filter},onChange)
    .subscribe()
  return()=>supabase.removeChannel(channel)
}
