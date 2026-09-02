"use client"

import{VIEW_META}from"../../core/navigation"
import{addDays,isoDate,money}from"../../core/formatters"
import CommandCenter from"../../features/frontdesk/CommandCenter"
import{Reservations,GuestCRM}from"../../features/frontdesk/FrontDeskViews"
import DashboardExperience from"../../features/frontdesk/DashboardExperience"
import QuoteBuilder from"../../features/frontdesk/QuoteBuilder"
import LobbyTentativeStrip from"../../features/frontdesk/LobbyTentativeStrip"
import{RoomsView,MaintenanceView,ResourcesView,DigitalTwinView}from"../../features/operations/OperationsViews"
import HousekeepingPremium from"../../features/operations/HousekeepingPremium"
import{RevenueView,PartnersView,UpsellingView}from"../../features/commercial/CommercialViews"
import ChannelHubPremium from"../../features/commercial/ChannelHubPremium"
import PackagesView from"../../features/commercial/PackagesView"
import GroupsPremium from"../../features/commercial/GroupsPremium"
import{CashView,BillingView,ReportsView}from"../../features/finance/FinanceViews"
import{KeysView,TeamView,AutomationsView,IntelligenceView}from"../../features/hotel/HotelViews"
import IntegrationMarketplace from"../../features/hotel/IntegrationMarketplace"
import SettingsWorkspace from"../../features/hotel/SettingsWorkspace"
import SupportView from"../../features/hotel/SupportView"
import{saveFloor,saveRoom,updateRoomStatus,saveHousekeepingTask,setHousekeepingStatus,saveMaintenanceTicket,setMaintenanceStatus,saveResource}from"../../services/operations"
import{saveRateCell,saveRateRange,savePartner,saveUpsell}from"../../services/commercial"
import{savePackage,setPackageActive}from"../../services/packages"
import{openCashSession,saveCashMovement,closeCashSession,saveFinanceDocument,issueInternalDocument}from"../../services/finance"
import{updateMemberRole,saveRolePermission,saveAutomation,toggleAutomation,deleteAutomation,resolveAutomationEvent,saveHotelSettings,prepareKey,revokeKey,askIntelligence}from"../../services/hotel"
import ui from"../../v2.module.css"

export default function HotelViewRouter({view,data,session,settings,permissions,role,live,committed,activeRooms,packages,search,setSearch,allowed,action,changeView,openReservation,openReservationTab,newReservation,newReservationAction,move,resize,setBlockDraft,onMenu,onCommand,hotelName}){
  const today=isoDate()
  if(view==="lobby")return <><LobbyTentativeStrip reservations={live} rooms={data.rooms} onOpen={openReservation}/><DashboardExperience settings={settings} rooms={data.rooms} reservations={committed} payments={data.payments} onView={changeView} onOpen={openReservation} search={search} onSearch={setSearch} onNewReservation={newReservationAction} onMenu={onMenu} onCommand={onCommand} userId={session.user?.id}/></>
  if(view==="quote")return <QuoteBuilder rooms={activeRooms} resources={data.operations.resources||[]} settings={settings} onBack={()=>changeView("lobby")}/>
  if(view==="calendar")return <CommandCenter rooms={activeRooms} reservations={live} payments={data.payments} blocks={data.blocks} floors={data.floors} onMove={move} onResize={resize} onOpen={openReservation} onOpenExternal={openReservationTab} onNew={(room,day)=>newReservation(room.id,day)} onBlock={(room,day)=>setBlockDraft({roomId:String(room.id),start:day,end:addDays(day,1),reason:"Bloqueo operativo",detail:""})}/>
  if(view==="reservations")return <Reservations reservations={data.reservations} rooms={data.rooms} search={search} onOpen={openReservation}/>
  if(view==="guests")return <GuestCRM guests={data.guests} search={search}/>
  if(view==="keys")return <KeysView reservations={live} rooms={data.rooms} issues={data.keyIssues||[]} settings={settings} onPrepare={(reservation,room,encoder,count)=>action(()=>prepareKey({propertyId:session.propertyId,userId:session.user.id,reservation,room,encoder,count}),r=>r?.physical?"Llave codificada.":"Emisión registrada; falta confirmación física.")} onRevoke={issue=>action(()=>revokeKey({propertyId:session.propertyId,id:issue.id}),"Llave revocada en el PMS.")}/>
  if(view==="rooms")return <RoomsView rooms={data.rooms} floors={data.floors} canManage={allowed("operations.rooms.manage")} onSaveFloor={draft=>action(()=>saveFloor({propertyId:session.propertyId,draft}),"Piso guardado.")} onSaveRoom={draft=>action(()=>saveRoom({propertyId:session.propertyId,draft}),"Habitación guardada.")} onBlock={room=>setBlockDraft({roomId:String(room.id),start:today,end:addDays(today,1),reason:"Mantenimiento",detail:""})}/>
  if(view==="housekeeping")return <HousekeepingPremium rooms={activeRooms} floors={data.floors} reservations={live} tasks={data.operations.housekeeping||[]} onRoomStatus={(room,status)=>action(()=>updateRoomStatus({propertyId:session.propertyId,roomId:room.id,status}),"Estado actualizado.")} onSaveTask={draft=>action(()=>saveHousekeepingTask({propertyId:session.propertyId,userId:session.user.id,draft}),"Tarea creada.")} onTaskStatus={(task,status)=>action(()=>setHousekeepingStatus({propertyId:session.propertyId,id:task.id,status}),"Tarea actualizada.")}/>
  if(view==="maintenance")return <MaintenanceView rooms={activeRooms} resources={data.operations.resources||[]} tickets={data.operations.maintenance||[]} onSave={draft=>action(()=>saveMaintenanceTicket({propertyId:session.propertyId,userId:session.user.id,draft}),"Ticket creado.")} onStatus={(ticket,status)=>action(()=>setMaintenanceStatus({propertyId:session.propertyId,id:ticket.id,status}),"Mantenimiento actualizado.")}/>
  if(view==="resources")return <ResourcesView resources={data.operations.resources||[]} onSave={draft=>action(()=>saveResource({propertyId:session.propertyId,draft}),"Recurso guardado.")}/>
  if(view==="twin")return <DigitalTwinView rooms={activeRooms} floors={data.floors} reservations={live}/>
  if(view==="rates")return <RevenueView rooms={activeRooms} reservations={committed} rates={data.commercial.rates||[]} canManage={allowed("commercial.rates.manage")} onSaveCell={draft=>action(()=>saveRateCell({propertyId:session.propertyId,draft}),"Tarifa actualizada.")} onBulk={draft=>action(()=>saveRateRange({propertyId:session.propertyId,roomId:draft.roomId,start:draft.start,end:draft.end,price:draft.price,minStay:draft.minStay,stopSell:draft.stopSell,cta:draft.cta,ctd:draft.ctd,existingRates:data.commercial.rates||[],fallbackPrice:draft.fallbackPrice}),n=>`${n||0} días tarifarios actualizados.`)}/>
  if(view==="packages")return <PackagesView packages={data.commercial.packages||packages} rooms={activeRooms} canManage={allowed("commercial.rates.manage")} onSave={draft=>action(()=>savePackage({propertyId:session.propertyId,userId:session.user.id,draft}),"Pack guardado.")} onToggle={(item,active)=>action(()=>setPackageActive({propertyId:session.propertyId,id:item.id,active}),active?"Pack activado.":"Pack pausado.")}/>
  if(view==="partners")return <PartnersView partners={data.commercial.partners||[]} canManage={allowed("commercial.partners.manage")} onSave={draft=>action(()=>savePartner({propertyId:session.propertyId,draft}),"Empresa / agencia guardada.")}/>
  if(view==="groups")return <GroupsPremium propertyId={session.propertyId} userId={session.user?.id} partners={data.commercial.partners||[]} rooms={activeRooms} canManage={allowed("commercial.groups.manage")} onOpenPlanning={()=>changeView("calendar")}/>
  if(view==="upselling")return <UpsellingView items={data.commercial.upsells||[]} canManage={allowed("commercial.upsell")} onSave={draft=>action(()=>saveUpsell({propertyId:session.propertyId,draft}),"Upsell guardado.")}/>
  if(view==="distribution")return <ChannelHubPremium propertyId={session.propertyId} userId={session.user?.id} canManage={allowed("commercial.rates.manage")||allowed("hotel.settings")}/>
  if(view==="cash")return <CashView sessions={data.finance.sessions||[]} movements={data.finance.movements||[]} reservations={live} canManage={allowed("finance.cash")} onOpen={draft=>action(()=>openCashSession({propertyId:session.propertyId,userId:session.user.id,openingAmount:draft.openingAmount,notes:draft.notes}),"Caja abierta.")} onMovement={draft=>action(()=>saveCashMovement({propertyId:session.propertyId,userId:session.user.id,sessionId:draft.sessionId,reservationId:draft.reservationId,movementType:draft.movementType,method:draft.method,amount:draft.amount,concept:draft.concept,reference:draft.reference,currency:draft.currency}),"Movimiento registrado.")} onClose={draft=>action(()=>closeCashSession({propertyId:session.propertyId,userId:session.user.id,sessionId:draft.sessionId,closingAmount:draft.closingAmount,notes:draft.notes}),r=>`Caja cerrada · diferencia ${money(r?.difference||0)}`)}/>
  if(view==="billing")return <BillingView documents={data.finance.documents||[]} reservations={live} partners={data.commercial.partners||[]} groups={data.commercial.groups||[]} canManage={allowed("finance.folios")} onSave={draft=>action(()=>saveFinanceDocument({propertyId:session.propertyId,userId:session.user.id,draft}),"Documento guardado.")} onIssue={doc=>action(()=>issueInternalDocument({propertyId:session.propertyId,id:doc.id}),number=>`Documento interno emitido: ${number}`)}/>
  if(view==="reports")return <ReportsView reservations={data.reservations} rooms={data.rooms} payments={data.payments} housekeeping={data.operations.housekeeping||[]}/>
  if(view==="team")return <TeamView members={data.hotel.members||[]} permissions={permissions} currentRole={role} onRole={(member,nextRole)=>action(()=>updateMemberRole({propertyId:session.propertyId,userId:member.user_id,role:nextRole}),"Rol actualizado.")} onPermission={(targetRole,permission,value)=>action(()=>saveRolePermission({propertyId:session.propertyId,role:targetRole,permission,allowed:value}),"Permiso actualizado.")}/>
  if(view==="automations")return <AutomationsView rules={data.hotel.automations||[]} events={data.hotel.events||[]} canManage={allowed("hotel.automations")} onSave={draft=>action(()=>saveAutomation({propertyId:session.propertyId,userId:session.user.id,draft}),"Automatización guardada.")} onToggle={(rule,enabled)=>action(()=>toggleAutomation({propertyId:session.propertyId,id:rule.id,enabled}),enabled?"Automatización activada.":"Automatización pausada.")} onDelete={rule=>action(()=>deleteAutomation({propertyId:session.propertyId,id:rule.id}),"Automatización eliminada.")} onResolve={event=>action(()=>resolveAutomationEvent({propertyId:session.propertyId,id:event.id}),"Evento resuelto.")}/>
  if(view==="intelligence")return <IntelligenceView settings={settings} rooms={activeRooms} reservations={live} payments={data.payments} onAsk={(question,context)=>askIntelligence({question,context})}/>
  if(view==="integrations")return <IntegrationMarketplace settings={settings} channels={data.channels||[]}/>
  if(view==="settings")return <SettingsWorkspace settings={settings} canManage={allowed("hotel.settings")} onSave={draft=>action(()=>saveHotelSettings({propertyId:session.propertyId,draft}),"Configuración guardada.")}/>
  if(view==="support")return <SupportView propertyId={session.propertyId} hotelName={hotelName}/>
  return <ModuleBridge view={view}/>
}
function ModuleBridge({view}){return <div className={ui.content}><section className={ui.placeholder}><div><span>MIGRACIÓN MODULAR SEGURA</span><h2>{VIEW_META[view]?.label||"Módulo"}</h2><p>Este dominio todavía está en migración y no se simula funcionalidad.</p></div></section></div>}
