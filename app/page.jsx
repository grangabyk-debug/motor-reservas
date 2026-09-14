import{headers}from"next/headers"
import PublicMaintenance from"./marketing/PublicMaintenance"
import HotelSite from"./hotel/[slug]/HotelSite"
import{getPublicHotelConfig,resolvePublicHotelSlug}from"../lib/publicHotelDomain"

const maintenanceMetadata={title:"Habitación Llena | En preparación",description:"Estamos preparando la próxima versión de Habitación Llena.",alternates:{canonical:"https://www.habitacionllena.com/"},robots:{index:false,follow:false},openGraph:{title:"Habitación Llena · En preparación",description:"Estamos preparando la próxima versión de Habitación Llena.",type:"website"}}
async function context(){const h=await headers(),host=h.get("x-forwarded-host")||h.get("host")||"",slug=await resolvePublicHotelSlug(host);return{host,slug}}
export async function generateMetadata(){const{host,slug}=await context();if(!slug)return maintenanceMetadata;const data=await getPublicHotelConfig(slug);if(!data)return maintenanceMetadata;const canonical=data.website_seo_canonical_url||`https://${String(host).split(":")[0]}/`,title=data.seo_title||`${data.name} | Sitio oficial`,description=data.seo_description||data.description||`Reservas directas en ${data.name}.`;return{title,description,alternates:{canonical},robots:{index:data.website_seo_indexable!==false,follow:data.website_seo_indexable!==false},openGraph:{title,description,type:"website",url:canonical,images:data.hero_url?[{url:data.hero_url}]:undefined}}}
export default async function Home(){const{slug}=await context();if(slug)return <HotelSite slug={slug}/>;return <PublicMaintenance/>}
