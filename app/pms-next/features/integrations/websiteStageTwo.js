export const SECTION_CATALOG=[
  {id:"hero",name:"Portada",help:"Foto, nombre y llamada principal",required:true},
  {id:"about",name:"El hotel",help:"Presentación y propuesta del alojamiento"},
  {id:"benefits",name:"Reserva directa",help:"Beneficios de reservar sin intermediarios"},
  {id:"gallery",name:"Galería",help:"Fotos cargadas desde el estudio"},
  {id:"booking",name:"Reservas",help:"Buscador conectado al inventario real",required:true},
  {id:"contact",name:"Contacto",help:"Teléfono, email y pie del sitio"}
]
export const LANGUAGES=[{id:"es",name:"Español"},{id:"en",name:"English"},{id:"pt",name:"Português"}]
export function normalizeSections(value){const input=Array.isArray(value)?value:[],known=new Map(input.map(item=>[item?.id,item]));const base=SECTION_CATALOG.map(item=>({...item,...(known.get(item.id)||{}),id:item.id,enabled:item.required?true:known.get(item.id)?.enabled!==false}));const order=new Map(input.map((item,index)=>[item?.id,index]));return base.sort((a,b)=>(order.has(a.id)?order.get(a.id):999)-(order.has(b.id)?order.get(b.id):999))}
export function normalizeLanguages(value){const allowed=new Set(LANGUAGES.map(item=>item.id)),items=(Array.isArray(value)?value:[]).filter(item=>allowed.has(item));return items.length?[...new Set(items)]:["es"]}
export function makeWebsiteSnapshot(draft,websiteDraft,description){return{engine:{...draft},website:{...websiteDraft,sections:normalizeSections(websiteDraft?.sections),languages:normalizeLanguages(websiteDraft?.languages)},description:String(description||"")}}
