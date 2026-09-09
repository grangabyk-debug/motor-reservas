const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim()
const clean=value=>String(value||"").trim().replace(/^["“”'‘’]+|["“”'‘’.!?]+$/g,"").trim()
const stripArticle=value=>clean(value).replace(/^(?:la|el|las|los|un|una|unos|unas)\s+/i,"").trim()

export function extractTenantTeaching(question){
  const text=String(question||"").trim()
  const patterns=[
    /^(?:acá|aca|aquí|aqui)(?:\s+en\s+(?:este|el)\s+hotel)?\s+(?:le\s+)?decimos\s+["“]?(.+?)["”]?\s+a\s+["“]?(.+?)["”]?[.!]?$/i,
    /^(?:cuando|si)\s+(?:digo|decimos|dicen)\s+["“]?(.+?)["”]?\s+(?:me\s+refiero\s+a|nos\s+referimos\s+a|queremos\s+decir|significa)\s+["“]?(.+?)["”]?[.!]?$/i,
    /^["“]?(.+?)["”]?\s+(?:significa|quiere\s+decir|es\s+como\s+decir)\s+["“]?(.+?)["”]?[.!]?$/i,
  ]
  for(const pattern of patterns){
    const match=text.match(pattern)
    if(!match)continue
    const phrase=stripArticle(match[1]),meaning=stripArticle(match[2])
    if(phrase.length>=2&&phrase.length<=80&&meaning.length>=2&&meaning.length<=140&&normalize(phrase)!==normalize(meaning))return{phrase,meaning}
  }
  return null
}

export async function loadTenantMemory(client,propertyId){
  const{data,error}=await client.from("hotel_olivia_memory")
    .select("memory_type,example_text,meaning,action_type,assigned_area,confidence,positive_count,negative_count,is_active,last_seen_at")
    .eq("property_id",propertyId).eq("is_active",true)
    .order("confidence",{ascending:false}).order("last_seen_at",{ascending:false}).limit(40)
  if(error){console.warn("OlivIA tenant memory read failed:",error.message);return[]}
  return Array.isArray(data)?data:[]
}

export async function rememberTenantTeaching(client,propertyId,question){
  const teaching=extractTenantTeaching(question)
  if(!teaching)return null
  const{error}=await client.rpc("hl_olivia_remember_term",{p_property_id:propertyId,p_phrase:teaching.phrase,p_meaning:teaching.meaning})
  if(error){console.warn("OlivIA tenant teaching failed:",error.message);return{...teaching,error:true}}
  return{...teaching,error:false}
}

function phrasePresent(text,phrase){
  const hay=` ${normalize(text)} `,needle=` ${normalize(phrase)} `
  return needle.trim().length>1&&hay.includes(needle)
}

export function applyTenantTerminology(question,memories=[]){
  let expanded=String(question||"")
  const terms=memories.filter(row=>row?.is_active!==false&&row?.memory_type==="terminology"&&Number(row?.confidence||0)>=0.65)
    .sort((a,b)=>String(b.example_text||"").length-String(a.example_text||"").length)
  for(const row of terms){
    const phrase=clean(row.example_text),meaning=clean(row.meaning)
    if(!phrase||!meaning||!phrasePresent(expanded,phrase))continue
    const escaped=phrase.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")
    const regex=new RegExp(escaped,"giu")
    const replaced=expanded.replace(regex,meaning)
    expanded=replaced===expanded?`${expanded} [En este hotel, “${phrase}” significa “${meaning}”.]`:replaced
  }
  return expanded
}

export function tenantMemoryPrompt(memories=[]){
  const rows=memories.filter(row=>row?.is_active!==false&&Number(row?.confidence||0)>=0.5).slice(0,24)
  if(!rows.length)return"Todavía no hay vocabulario o ejemplos aprendidos para esta propiedad."
  return rows.map(row=>{
    const confidence=Math.round(Number(row.confidence||0)*100)
    if(row.memory_type==="terminology")return`- Vocabulario: “${clean(row.example_text)}” = “${clean(row.meaning)}” (${confidence}% confianza).`
    const area=row.assigned_area?` → ${row.assigned_area}`:""
    return`- Ejemplo validado: “${clean(row.example_text)}” = ${clean(row.meaning)}${area} (${confidence}% confianza).`
  }).join("\n")
}
