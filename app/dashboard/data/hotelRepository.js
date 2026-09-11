import { requirePropertyId } from "./tenant"

export function createHotelRepository(client,propertyId){
  const tenant=requirePropertyId(propertyId)
  const scoped=(table)=>client.from(table).select("*").eq("property_id",tenant)

  return {
    tenant,
    async frontDeskSnapshot(){
      const {data:auth}=await client.auth.getUser()
      const currentUserId=auth?.user?.id||""
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
        scoped("hotel_reservation_events").order("created_at",{ascending:false}).limit(160),
        scoped("hotel_automation_events").order("created_at",{ascending:false}).limit(160),
        scoped("inbox_conversations").order("last_message_at",{ascending:false}).limit(100),
        scoped("hotel_housekeeping_tasks").order("scheduled_for",{ascending:false}).limit(180),
        scoped("hotel_maintenance_tickets").order("created_at",{ascending:false}).limit(120),
        client.from("hotel_operational_notifications").select("*").eq("property_id",tenant).order("created_at",{ascending:false}).limit(100),
        currentUserId?client.from("hotel_notification_reads").select("notification_id,user_id,read_at").eq("user_id",currentUserId).order("read_at",{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
      ])
      const error=results.find(result=>result.error)?.error
      if(error)throw error
      const [rooms,floors,reservations,payments,blocks,charges,channels,keyIssues,packages,reservationEvents,automationEvents,inboxConversations,housekeepingTasks,maintenanceTickets,otaNotifications,notificationReads]=results.map(result=>result.data||[])
      const readIds=new Set((notificationReads||[]).map(item=>String(item.notification_id)))
      const unreadOta=(otaNotifications||[]).filter(item=>!readIds.has(String(item.id))).map(item=>({
        id:item.id,
        event_type:`ota_${item.event_type}`,
        message:item.detail,
        title:item.title,
        reservation_id:item.reservation_id,
        created_at:item.created_at,
        status:"pending",
        _ota_notification_id:item.id,
        _ota_provider:item.provider_name,
        _ota_channel_code:item.channel_code,
        _ota_metadata:item.metadata||{},
      }))
      return {rooms,floors,reservations,payments,blocks,charges,channels,keyIssues,packages,reservationEvents,automationEvents:[...(automationEvents||[]),...unreadOta],inboxConversations,housekeepingTasks,maintenanceTickets,otaNotifications}
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
    async analytics(){
      await client.rpc("capture_hotel_analytics_snapshot",{p_property_id:tenant}).then(result=>{if(result.error)throw result.error})
      const from=new Date();from.setUTCDate(from.getUTCDate()-35)
      const [snapshots,costs]=await Promise.all([
        scoped("hotel_analytics_daily_snapshots").gte("captured_on",from.toISOString().slice(0,10)).order("captured_on",{ascending:false}).order("stay_date").limit(5000),
        scoped("hotel_channel_costs").eq("active",true).order("channel_name"),
      ])
      const error=[snapshots,costs].find(result=>result.error)?.error;if(error)throw error
      return {snapshots:snapshots.data||[],channelCosts:costs.data||[]}
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