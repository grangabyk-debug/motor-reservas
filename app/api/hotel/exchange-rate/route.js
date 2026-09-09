import{NextResponse}from"next/server"

export const runtime="nodejs"

export async function GET(){
  try{
    const response=await fetch("https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD",{headers:{accept:"application/json"},next:{revalidate:1800}})
    if(!response.ok)throw new Error(`BCRA ${response.status}`)
    const payload=await response.json(),result=Array.isArray(payload?.results)?payload.results[0]:null,detail=Array.isArray(result?.detalle)?result.detalle.find(item=>item?.codigoMoneda==="USD")||result.detalle[0]:null,rate=Number(detail?.tipoCotizacion)
    if(!Number.isFinite(rate)||rate<=0)throw new Error("Cotización USD inválida")
    return NextResponse.json({pair:"USDARS",base:"USD",quote:"ARS",rate,source:"BCRA",asOf:result?.fecha||null,fetchedAt:new Date().toISOString()},{headers:{"Cache-Control":"public, s-maxage=1800, stale-while-revalidate=21600"}})
  }catch(error){return NextResponse.json({error:"No se pudo obtener la cotización oficial del dólar.",detail:error?.message||"BCRA no disponible"},{status:502,headers:{"Cache-Control":"no-store"}})}
}
