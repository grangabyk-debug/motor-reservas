import{NextResponse}from"next/server"

export const runtime="nodejs"

const BNA_URLS=["https://www.bna.com.ar/Personas","https://www.bna.com.ar/Empresas"]

function textFromHtml(html){
  return String(html||"")
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;|&#160;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&oacute;/gi,"ó")
    .replace(/\s+/g," ")
    .trim()
}

function numberAr(value){return Number(String(value||"").replace(/\./g,"").replace(",","."))}
function isoDate(value){const match=String(value||"").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);return match?`${match[3]}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}`:null}
function parseBna(html){
  const text=textFromHtml(html)
  const row=text.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+Compra\s+Venta\s+D[oó]lar\s+U\.?S\.?A\.?\s+([\d.,]+)\s+([\d.,]+)/i)
  if(!row)throw new Error("No se encontró la cotización de dólar billete")
  const buyRate=numberAr(row[2]),rate=numberAr(row[3])
  if(!Number.isFinite(rate)||rate<=0)throw new Error("Cotización BNA inválida")
  const updatedAtLocal=text.match(/Hora\s+Actualizaci[oó]n:\s*(\d{1,2}:\d{2})/i)?.[1]||null
  return{rate,buyRate,asOf:isoDate(row[1]),updatedAtLocal}
}

export async function GET(){
  let lastError=null
  for(const url of BNA_URLS){
    try{
      const response=await fetch(url,{headers:{accept:"text/html,application/xhtml+xml","user-agent":"Mozilla/5.0 HabitacionLlena/1.0"},next:{revalidate:300}})
      if(!response.ok)throw new Error(`Banco Nación ${response.status}`)
      const quote=parseBna(await response.text())
      return NextResponse.json({pair:"USDARS",base:"USD",quote:"ARS",...quote,source:"Banco Nación · dólar billete venta",sourceUrl:"https://www.bna.com.ar/Personas",fetchedAt:new Date().toISOString()},{headers:{"Cache-Control":"public, s-maxage=300, stale-while-revalidate=1800"}})
    }catch(error){lastError=error}
  }
  return NextResponse.json({error:"No se pudo obtener la cotización del dólar venta del Banco Nación.",detail:lastError?.message||"Banco Nación no disponible"},{status:502,headers:{"Cache-Control":"no-store"}})
}
