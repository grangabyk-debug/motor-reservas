import{headers}from"next/headers"
import MarketingHome from"./marketing/MarketingHome"
import HotelSite from"./hotel/[slug]/HotelSite"
import refinements from"./marketing/landing-refinements.module.css"
import{getPublicHotelConfig,resolvePublicHotelSlug}from"../lib/publicHotelDomain"

const marketingMetadata={title:"Habitación Llena | PMS hotelero para operar, vender y recibir mejor",description:"PMS hotelero para recepción, reservas, huéspedes, habitaciones, housekeeping, ingresos, migración y venta directa desde una sola operación.",keywords:["PMS hotelero","software hotelero","sistema para hoteles","motor de reservas","housekeeping hotel","revenue management hotel"],alternates:{canonical:"https://www.habitacionllena.com/"},openGraph:{title:"Habitación Llena · Hotel Operating System",description:"Un PMS moderno que se adapta al hotel, no al revés.",type:"website"}}
async function context(){const h=await headers(),host=h.get("x-forwarded-host")||h.get("host")||"",slug=await resolvePublicHotelSlug(host);return{host,slug}}
export async function generateMetadata(){const{host,slug}=await context();if(!slug)return marketingMetadata;const data=await getPublicHotelConfig(slug);if(!data)return marketingMetadata;const canonical=data.website_seo_canonical_url||`https://${String(host).split(":")[0]}/`,title=data.seo_title||`${data.name} | Sitio oficial`,description=data.seo_description||data.description||`Reservas directas en ${data.name}.`;return{title,description,alternates:{canonical},robots:{index:data.website_seo_indexable!==false,follow:data.website_seo_indexable!==false},openGraph:{title,description,type:"website",url:canonical,images:data.hero_url?[{url:data.hero_url}]:undefined}}}
export default async function Home(){const{slug}=await context();if(slug)return <HotelSite slug={slug}/>;return <div className={refinements.scope}><MarketingHome/></div>}
