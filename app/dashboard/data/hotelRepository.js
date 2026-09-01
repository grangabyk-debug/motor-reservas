import { requirePropertyId } from "./tenant"

export function createHotelRepository(client,propertyId){
  const tenant=requirePropertyId(propertyId)
  const scoped=(table)=>client.from(table).select("*").eq("property_id",tenant)

  return {
    tenant,
    async frontDeskSnapshot(){
      const results=await Promise.all([
        scoped("habitaciones").order("sort_order").order("id"),
        scoped("hotel_floors").order("sort_order").order("name"),
        scoped("reservas").order("fecha_entrada"),
        scoped("pagos").order("created_at",{ascending:false}),
        scoped("bloqueos").order("fecha_desde"),
        scoped("hotel_charge_catalog").order("sort_order").order("name"),
        scoped("hotel_channel_connections"),
        scoped("hotel_key_issues").order("created_at",{ascending:false}).limit(100),
        scoped("hotel_packages").eq("active",true).order("sort_order").order("name"),
      ])
      const error=results.find(result=>result.error)?.error
      if(error)throw error
      const [rooms,floors,reservations,payments,blocks,charges,channels,keyIssues,packages]=results.map(result=>result.data||[])
      return {rooms,floors,reservations,payments,blocks,charges,channels,keyIssues,packages}
    },
    async guestCRM(){const {data,error}=await scoped("hotel_guest_profiles").order("last_stay_at",{ascending:false}).limit(250);if(error)throw error;return data||[]},
    async partners(){const {data,error}=await scoped("hotel_partners").eq("active",true).order("name");if(error)throw error;return data||[]},
    async groups(){const {data,error}=await scoped("hotel_groups").order("arrival_date",{ascending:false}).limit(250);if(error)throw error;return data||[]},
    async operations(){
      const [housekeeping,maintenance,resources]=await Promise.all([
        scoped("hotel_housekeeping_tasks").order("scheduled_for",{ascending:false}).limit(300),
        scoped("hotel_maintenance_tickets").order("created_at",{ascending:false}).limit(300),
        scoped("hotel_resources").eq("active",true).order("category").order("name"),
      ])
      const error=[housekeeping,maintenance,resources].find(result=>result.error)?.error;if(error)throw error
      return {housekeeping:housekeeping.data||[],maintenance:maintenance.data||[],resources:resources.data||[]}
    },
    async commercial(){
      const [rates,upsells,packages]=await Promise.all([
        scoped("hotel_rate_calendar").order("stay_date").limit(1000),
        scoped("hotel_upsell_catalog").eq("active",true).order("sort_order").order("name"),
        scoped("hotel_packages").order("sort_order").order("name"),
      ])
      const error=[rates,upsells,packages].find(result=>result.error)?.error;if(error)throw error
      return {rates:rates.data||[],upsells:upsells.data||[],packages:packages.data||[]}
    },
    async finance(){
      const [documents,sessions,movements]=await Promise.all([
        scoped("hotel_finance_documents").order("created_at",{ascending:false}).limit(300),
        scoped("hotel_cash_sessions").order("opened_at",{ascending:false}).limit(100),
        scoped("hotel_cash_movements").order("created_at",{ascending:false}).limit(500),
      ])
      const error=[documents,sessions,movements].find(result=>result.error)?.error;if(error)throw error
      return {documents:documents.data||[],sessions:sessions.data||[],movements:movements.data||[]}
    },
  }
}
