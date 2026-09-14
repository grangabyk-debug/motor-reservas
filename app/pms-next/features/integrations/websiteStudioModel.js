export const COMPONENT_CATALOG=[
  {id:"hero",name:"Portada",category:"Layout",help:"Hero fotográfico con buscador siempre visible",required:true,defaultEnabled:true,icon:"▣"},
  {id:"rooms",name:"Habitaciones",category:"Ventas",help:"Categorías y precios desde el PMS",defaultEnabled:true,icon:"▤"},
  {id:"about",name:"El hotel",category:"Contenido",help:"Historia y propuesta del alojamiento",defaultEnabled:true,icon:"Aa"},
  {id:"promo",name:"Promociones",category:"Ventas",help:"Ofertas y vouchers activos",defaultEnabled:true,icon:"%"},
  {id:"benefits",name:"Reserva directa",category:"Ventas",help:"Beneficios de reservar sin intermediarios",defaultEnabled:true,icon:"✓"},
  {id:"gallery",name:"Galería",category:"Contenido",help:"Grilla editorial de fotografías",defaultEnabled:true,icon:"▦"},
  {id:"services",name:"Servicios",category:"Contenido",help:"Servicios destacados configurables",defaultEnabled:false,icon:"✦"},
  {id:"testimonials",name:"Opiniones",category:"Contenido",help:"Testimonios seleccionados del hotel",defaultEnabled:false,icon:"❝"},
  {id:"location",name:"Ubicación",category:"Contenido",help:"Ciudad, dirección y acceso al mapa",defaultEnabled:true,icon:"⌖"},
  {id:"faq",name:"Preguntas frecuentes",category:"Contenido",help:"Respuestas rápidas antes de reservar",defaultEnabled:false,icon:"?"},
  {id:"booking",name:"Motor de reservas",category:"Ventas",help:"Motor completo conectado al inventario",required:true,defaultEnabled:true,icon:"⌕"},
  {id:"contact",name:"Contacto y pie",category:"Layout",help:"Contacto, redes y cierre del sitio",defaultEnabled:true,icon:"↗"}
]

export const LANGUAGES=[{id:"es",name:"Español"},{id:"en",name:"English"},{id:"pt",name:"Português"}]
export const FONT_OPTIONS=[
  {id:"editorial",name:"Editorial",stack:'"DM Serif Display",Georgia,"Times New Roman",serif'},
  {id:"elegant",name:"Elegante",stack:'"Cormorant Garamond",Georgia,serif'},
  {id:"modern",name:"Moderna",stack:'Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif'},
  {id:"geometric",name:"Geométrica",stack:'"Montserrat",Inter,ui-sans-serif,system-ui,sans-serif'}
]

export const defaultStudioConfig=()=>({
  hero:{eyebrow:"Sitio oficial",title:"",subtitle:"",secondary_cta:"Ver habitaciones"},
  theme:{heading_font:"editorial",body_font:"modern",radius:"soft",nav_style:"glass",search_style:"floating",image_tone:"natural"},
  services:[],
  testimonials:[],
  faq:[],
  location:{address:"",maps_url:""},
  popup:{enabled:false,title:"",text:"",cta_label:"Reservar ahora",delay_seconds:5},
  migration:{source_url:"",status:"not_started"}
})

const cleanText=(value,max=180)=>String(value||"").trim().slice(0,max)
export function normalizeSections(value){
  const input=Array.isArray(value)?value:[],known=new Map(input.map(item=>[item?.id,item])),order=new Map(input.map((item,index)=>[item?.id,index]))
  return COMPONENT_CATALOG.map(item=>({...item,...(known.get(item.id)||{}),id:item.id,enabled:item.required?true:(known.has(item.id)?known.get(item.id)?.enabled!==false:item.defaultEnabled!==false)})).sort((a,b)=>(order.has(a.id)?order.get(a.id):999)-(order.has(b.id)?order.get(b.id):999))
}
export function normalizeLanguages(value){const allowed=new Set(LANGUAGES.map(item=>item.id)),items=(Array.isArray(value)?value:[]).filter(item=>allowed.has(item));return items.length?[...new Set(items)]:["es"]}
export function normalizeStudioConfig(value){
  const base=defaultStudioConfig(),raw=value&&typeof value==="object"?value:{}
  const services=Array.isArray(raw.services)?raw.services.slice(0,12).map((item,index)=>({id:String(item?.id||`service-${index}`),title:cleanText(item?.title,60),text:cleanText(item?.text,180)})).filter(item=>item.title):[]
  const testimonials=Array.isArray(raw.testimonials)?raw.testimonials.slice(0,8).map((item,index)=>({id:String(item?.id||`testimonial-${index}`),name:cleanText(item?.name,60),text:cleanText(item?.text,280)})).filter(item=>item.text):[]
  const faq=Array.isArray(raw.faq)?raw.faq.slice(0,10).map((item,index)=>({id:String(item?.id||`faq-${index}`),question:cleanText(item?.question,120),answer:cleanText(item?.answer,360)})).filter(item=>item.question&&item.answer):[]
  return{
    hero:{...base.hero,...(raw.hero||{}),eyebrow:cleanText(raw?.hero?.eyebrow||base.hero.eyebrow,42),title:cleanText(raw?.hero?.title,120),subtitle:cleanText(raw?.hero?.subtitle,260),secondary_cta:cleanText(raw?.hero?.secondary_cta||base.hero.secondary_cta,42)},
    theme:{...base.theme,...(raw.theme||{}),heading_font:FONT_OPTIONS.some(x=>x.id===raw?.theme?.heading_font)?raw.theme.heading_font:base.theme.heading_font,body_font:FONT_OPTIONS.some(x=>x.id===raw?.theme?.body_font)?raw.theme.body_font:base.theme.body_font,radius:["square","soft","round"].includes(raw?.theme?.radius)?raw.theme.radius:base.theme.radius,nav_style:["glass","solid","overlay"].includes(raw?.theme?.nav_style)?raw.theme.nav_style:base.theme.nav_style,search_style:["floating","bar","compact"].includes(raw?.theme?.search_style)?raw.theme.search_style:base.theme.search_style,image_tone:["natural","warm","cool","mono"].includes(raw?.theme?.image_tone)?raw.theme.image_tone:base.theme.image_tone},
    services,testimonials,faq,
    location:{...base.location,...(raw.location||{}),address:cleanText(raw?.location?.address,180),maps_url:cleanText(raw?.location?.maps_url,500)},
    popup:{...base.popup,...(raw.popup||{}),enabled:Boolean(raw?.popup?.enabled),title:cleanText(raw?.popup?.title,90),text:cleanText(raw?.popup?.text,260),cta_label:cleanText(raw?.popup?.cta_label||base.popup.cta_label,42),delay_seconds:Math.min(30,Math.max(0,Number(raw?.popup?.delay_seconds)||5))},
    migration:{...base.migration,...(raw.migration||{}),source_url:cleanText(raw?.migration?.source_url,500),status:["not_started","reviewing","ready","done"].includes(raw?.migration?.status)?raw.migration.status:"not_started"}
  }
}
export function makeWebsiteSnapshot(draft,websiteDraft,description){return{engine:{...draft},website:{...websiteDraft,sections:normalizeSections(websiteDraft?.sections),languages:normalizeLanguages(websiteDraft?.languages),studio_config:normalizeStudioConfig(websiteDraft?.studio_config)},description:String(description||"")}}
