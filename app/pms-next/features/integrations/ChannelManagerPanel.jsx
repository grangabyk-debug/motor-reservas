"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import ChannelConnectDrawer from"./ChannelConnectDrawer"
import s from"./channelManager.module.css"

const OTAS=[
  {id:"booking",name:"Booking.com",mark:"B",aliases:["booking","booking.com"]},
  {id:"airbnb",name:"Airbnb",mark:"A",aliases:["airbnb"]},
  {id:"expedia",name:"Expedia",mark:"E",aliases:["expedia"]},
  {id:"despegar",name:"Despegar",mark:"D",aliases:["despegar","decolar"]},
  {id:"agoda",name:"Agoda",mark:"Ag",aliases:["agoda"]},
  {id:"hotelbeds",name:"Hotelbeds",mark:"H",aliases:["hotelbeds"]},
]
const STATUS={not_connected:"Disponible",sandbox:"En configuración",connected:"Conectado",error:"Revisar",paused:"Pausado"}
const norm=value=>String(value||"").trim().toLowerCase()
const fmt=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"Sin sincronizar"

export default function ChannelManagerPanel({propertyId,property,connections=[],mappings=[],onReload,onMessage}){
  const[roomTypes,setRoomTypes]=useState([]),[editor,setEditor]=useState(null),[saving,setSaving]=useState(false),[menu,setMenu]=useState(null),[error,setError]=useState("")
  const canManage=["owner","manager"].includes(property?.role),canDelete=property?.role==="owner"

  useEffect(()=>{let alive=true;supabase.from("hotel_room_types").select("id,name,code,capacity,active").eq("property_id",propertyId).order("sort_order").order("name").then(({data,error:e})=>{if(!alive)return;if(e)setError(e.message);else setRoomTypes(data||[])});return()=>{alive=false}},[propertyId])
  useEffect(()=>{if(!menu)return;const close=()=>setMenu(null);window.addEventListener("click",close);return()=>window.removeEventListener("click",close)},[menu])

  const cards=useMemo(()=>OTAS.map(ota=>{
    const connection=connections.find(item=>ota.aliases.some(alias=>norm(item.provider).includes(alias)))||null
    const related=mappings.filter(item=>item.connection_id===connection?.id)
    return{...ota,connection,status:connection?.status||"not_connected",mappingCount:related.filter(item=>item.mapping_type==="room_type").length}
  }),[connections,mappings])
  const metrics={connected:cards.filter(c=>c.status==="connected").length,configuring:cards.filter(c=>c.status==="sandbox").length,issues:cards.filter(c=>c.status==="error").length,available:cards.filter(c=>c.status==="not_connected").length}

  function openEditor(card){
    setMenu(null);setError("")
    const typeRows=roomTypes.filter(type=>type.active!==false).map(type=>({...type,mapping:mappings.find(item=>item.connection_id===card.connection?.id&&item.mapping_type==="room_type"&&String(item.local_key)===String(type.id))||null}))
    setEditor({provider:card.name,connection:card.connection,roomTypes:typeRows})
  }

  async function saveConnection(form){
    if(!canManage)return setError("Sólo Propietario o Gerencia pueden configurar canales.")
    setSaving(true);setError("")
    try{
      const diagnostics={...(editor?.connection?.diagnostics||{}),sync:form.sync,rate_adjustment:Number(form.rate_adjustment)||0,configuration_complete:Boolean(form.external_property_id||form.account_ref)}
      let connectionId=editor?.connection?.id
      if(connectionId){
        const status=["connected","paused","error"].includes(editor.connection.status)?editor.connection.status:"sandbox"
        const{error:e}=await supabase.from("hotel_channel_connections").update({account_ref:form.account_ref.trim()||null,external_property_id:form.external_property_id.trim()||null,diagnostics,status,updated_at:new Date().toISOString()}).eq("id",connectionId).eq("property_id",propertyId);if(e)throw e
      }else{
        const{data,error:e}=await supabase.from("hotel_channel_connections").insert({property_id:propertyId,provider:form.provider,status:"sandbox",mode:"sandbox",transport:"legacy",account_ref:form.account_ref.trim()||null,external_property_id:form.external_property_id.trim()||null,mapping:{},diagnostics}).select("id").single();if(e)throw e;connectionId=data.id
      }
      const{error:deleteError}=await supabase.from("hotel_channel_mappings").delete().eq("property_id",propertyId).eq("connection_id",connectionId).eq("mapping_type","room_type");if(deleteError)throw deleteError
      const rows=roomTypes.map(type=>({property_id:propertyId,connection_id:connectionId,mapping_type:"room_type",local_key:String(type.id),channel_code:form.provider,external_id:String(form.mappings[type.id]||"").trim(),metadata:{provider:form.provider,room_type_name:type.name}})).filter(row=>row.external_id)
      if(rows.length){const{error:e}=await supabase.from("hotel_channel_mappings").insert(rows);if(e)throw e}
      setEditor(null);await onReload?.();onMessage?.(`${form.provider} quedó preparado. Falta autorizar el conector real para sincronizar.`)
    }catch(err){setError(err?.message||"No se pudo guardar la configuración del canal.")}
    finally{setSaving(false)}
  }

  async function setStatus(card,status){
    if(!canManage||!card.connection)return
    setMenu(null);setSaving(true);setError("")
    try{const{error:e}=await supabase.from("hotel_channel_connections").update({status,updated_at:new Date().toISOString()}).eq("id",card.connection.id).eq("property_id",propertyId);if(e)throw e;await onReload?.();onMessage?.(status==="paused"?`${card.name} quedó pausado.`:`${card.name} volvió a configuración.`)}
    catch(err){setError(err?.message||"No se pudo actualizar el canal.")}
    finally{setSaving(false)}
  }

  async function remove(card){
    if(!canDelete||!card.connection)return
    setMenu(null);if(!window.confirm(`¿Desconectar ${card.name}? Se borrarán sus mapeos, pero no las reservas ya importadas.`))return
    setSaving(true);setError("")
    try{const{error:e}=await supabase.from("hotel_channel_connections").delete().eq("id",card.connection.id).eq("property_id",propertyId);if(e)throw e;await onReload?.();onMessage?.(`${card.name} fue desconectado.`)}
    catch(err){setError(err?.message||"No se pudo desconectar el canal.")}
    finally{setSaving(false)}
  }

  return <div className={s.wrap}>
    <header className={s.hero}><div><small>CHANNEL MANAGER</small><h2>Canales de venta</h2><p>Disponibilidad, tarifas, restricciones y reservas desde un único inventario.</p></div>{canManage?<button className={s.primary} onClick={()=>openEditor({...OTAS[0],connection:null})}>＋ Agregar OTA</button>:null}</header>
    <div className={s.metrics}><article className={s.metric} data-tone="green"><span>Conectados</span><b>{metrics.connected}</b></article><article className={s.metric} data-tone="gold"><span>En configuración</span><b>{metrics.configuring}</b></article><article className={s.metric} data-tone="red"><span>Requieren atención</span><b>{metrics.issues}</b></article><article className={s.metric}><span>Disponibles</span><b>{metrics.available}</b></article></div>
    {error&&<div className={s.alert}><span>{error}</span><button onClick={()=>setError("")}>×</button></div>}
    <div className={s.cards}>{cards.map(card=>{const connection=card.connection,menuOpen=menu===card.id;return <article className={s.card} key={card.id}><div className={s.cardTop}><div className={s.brand}><span className={s.mark}>{card.mark}</span><div><small>CANAL DE VENTA</small><h3>{card.name}</h3></div></div><span className={s.state} data-state={card.status}>{STATUS[card.status]||card.status}</span></div><div className={s.info}><div><small>Última sync</small><b>{fmt(connection?.last_sync_at)}</b></div><div><small>Mapeos</small><b>{card.mappingCount}</b></div><div><small>Ajuste tarifa</small><b>{Number(connection?.diagnostics?.rate_adjustment||0)>0?"+":""}{Number(connection?.diagnostics?.rate_adjustment||0)}%</b></div></div>{connection?.last_error?<div className={s.errorBox}>{connection.last_error}</div>:null}<div className={s.actions}><button data-main={Boolean(connection)} onClick={()=>openEditor(card)}>{connection?"Administrar":"Preparar conexión"}</button>{connection?<div className={s.moreWrap} onClick={e=>e.stopPropagation()}><button className={s.more} onClick={e=>{e.stopPropagation();setMenu(menuOpen?null:card.id)}}>⋯</button>{menuOpen?<div className={s.menu}><button onClick={()=>openEditor(card)}>Editar configuración</button><button onClick={()=>setStatus(card,card.status==="paused"?"sandbox":"paused")}>{card.status==="paused"?"Reanudar configuración":"Pausar"}</button>{canDelete?<button className={s.danger} onClick={()=>remove(card)}>Desconectar</button>:null}</div>:null}</div>:null}</div></article>})}</div>
    {editor?<ChannelConnectDrawer otas={OTAS} connection={editor.connection} initialProvider={editor.provider} roomTypes={editor.roomTypes} saving={saving} onClose={()=>setEditor(null)} onSave={saveConnection}/>:null}
  </div>
}
