export function requirePropertyId(propertyId){
  const value=String(propertyId||"").trim()
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw new Error("Tenant context missing or invalid")
  return value
}

export function tenantQuery(client,table,propertyId){
  const tenant=requirePropertyId(propertyId)
  return client.from(table).select("*").eq("property_id",tenant)
}

export function tenantMutation(payload,propertyId){
  const tenant=requirePropertyId(propertyId)
  return {...payload,property_id:tenant}
}
