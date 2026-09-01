export const REGIONAL_COMMERCE={
  AR:{country:"AR",name:"Argentina",currency:"ARS",locale:"es-AR",timezone:"America/Argentina/Buenos_Aires",payments:["mercadopago"],fiscal:"arca",stripe:"country"},
  BR:{country:"BR",name:"Brasil",currency:"BRL",locale:"pt-BR",timezone:"America/Sao_Paulo",payments:["mercadopago","stripe"],fiscal:"local",stripe:"available"},
  CL:{country:"CL",name:"Chile",currency:"CLP",locale:"es-CL",timezone:"America/Santiago",payments:["mercadopago"],fiscal:"local",stripe:"country"},
  CO:{country:"CO",name:"Colombia",currency:"COP",locale:"es-CO",timezone:"America/Bogota",payments:["mercadopago"],fiscal:"local",stripe:"country"},
  PE:{country:"PE",name:"Perú",currency:"PEN",locale:"es-PE",timezone:"America/Lima",payments:["mercadopago"],fiscal:"local",stripe:"country"},
  UY:{country:"UY",name:"Uruguay",currency:"UYU",locale:"es-UY",timezone:"America/Montevideo",payments:["mercadopago"],fiscal:"local",stripe:"country"},
  MX:{country:"MX",name:"México",currency:"MXN",locale:"es-MX",timezone:"America/Mexico_City",payments:["mercadopago","stripe"],fiscal:"local",stripe:"available"},
  ES:{country:"ES",name:"España",currency:"EUR",locale:"es-ES",timezone:"Europe/Madrid",payments:["stripe"],fiscal:"local",stripe:"available"},
  US:{country:"US",name:"Estados Unidos",currency:"USD",locale:"en-US",timezone:"America/New_York",payments:["stripe"],fiscal:"local",stripe:"available"},
  OTHER:{country:"OTHER",name:"Otro país",currency:"USD",locale:"es",timezone:"UTC",payments:[],fiscal:"local",stripe:"country"},
}

export const REGIONAL_COUNTRIES=Object.values(REGIONAL_COMMERCE)
export const SUPPORTED_CURRENCIES=["ARS","BRL","CLP","COP","PEN","UYU","MXN","EUR","USD"]

export function commerceRegion(ops={}){
  const code=String(ops?.region?.country||"AR").toUpperCase()
  const base=REGIONAL_COMMERCE[code]||REGIONAL_COMMERCE.OTHER
  return {...base,currency:ops.currency||base.currency,locale:ops?.region?.locale||base.locale,timezone:ops?.region?.timezone||base.timezone}
}

export function regionalProviderState(provider,ops={}){
  const region=commerceRegion(ops)
  if(provider==="mercadopago")return region.payments.includes("mercadopago")?"available":"region"
  if(provider==="stripe")return region.stripe
  if(provider==="arca")return region.country==="AR"?"available":"region"
  return"available"
}

export function regionalProviderLabel(provider,ops={}){
  const region=commerceRegion(ops)
  if(provider==="mercadopago")return region.payments.includes("mercadopago")?`Recomendado en ${region.name}`:`No es la base recomendada para ${region.name}`
  if(provider==="stripe")return region.stripe==="available"?`Disponible para comercios en ${region.name}`:"Disponibilidad según país y modalidad de alta"
  if(provider==="arca")return region.country==="AR"?"Base fiscal Argentina":"ARCA aplica únicamente a Argentina"
  return region.name
}

export function regionalPatch(country,ops={}){
  const next=REGIONAL_COMMERCE[String(country||"").toUpperCase()]||REGIONAL_COMMERCE.OTHER
  return{region:{...(ops.region||{}),country:next.country,locale:next.locale,timezone:next.timezone},currency:next.currency,commerce:{...(ops.commerce||{}),payment_provider_preference:next.payments[0]||"",fiscal_provider:next.country==="AR"?"arca":"local"}}
}
