import{configuredAmountToNet,netAmountToFinal,ratePlanBasis,ratePlanSignedAdjustment}from"../../core/ratePlans"

function quoteFxFactor(quote){
  const property=String(quote?.property_currency||"ARS").toUpperCase(),reservation=String(quote?.reservation_currency||property).toUpperCase(),fx=Math.max(0,Number(quote?.fx_rate)||0)
  if(property===reservation||!fx)return 1
  if(property==="ARS"&&reservation==="USD")return 1/fx
  if(property==="USD"&&reservation==="ARS")return fx
  return 1
}

export function quotePlanAmounts(plan,guests,quote,taxes){
  const basis=ratePlanBasis(plan),configuredValue=ratePlanSignedAdjustment(plan),netPropertyValue=configuredAmountToNet(configuredValue,taxes),fx=quoteFxFactor(quote),netValue=netPropertyValue*fx,finalValue=netAmountToFinal(netValue,taxes),bookedValue=quote?.tax_breakdown?netValue:finalValue,pax=Math.max(0,Number(guests)||0),units=basis==="per_room"?1:pax,bookedPerNight=bookedValue*units,finalPerNight=finalValue*units
  return{basis,configuredValue,netValue,finalValue,bookedValue,bookedPerNight,finalPerNight,configuredPerPerson:basis==="per_person"?configuredValue:0,bookedPerPerson:basis==="per_person"?bookedValue:0,finalPerPerson:basis==="per_person"?finalValue:0}
}
