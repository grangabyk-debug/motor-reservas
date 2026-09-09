"use client"

import{useCallback,useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const CONVERSATION_SELECT="id,connection_id,channel,external_thread_id,external_contact_id,contact_name,contact_email,contact_phone,last_message_at,last_message_text,unread_count,status,guest_profile_id,reservation_id,room_id,context_link_source,context_linked_at,created_at,updated_at"

export default function useInboxData(propertyId){
  const[conversations,setConversations]=useState([])
  const[messages,setMessages]=useState([])
  const[contexts,setContexts]=useState({})
  const[contextLoading,setContextLoading]=useState({})
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState("")

  const load=useCallback(async()=>{
    if(!propertyId)return
    setLoading(true);setError("")
    try{
      const{data:convs,error:convError}=await supabase.from("inbox_conversations").select(CONVERSATION_SELECT).eq("property_id",propertyId).order("last_message_at",{ascending:false,nullsFirst:false})
      if(convError)throw convError
      const ids=(convs||[]).map(item=>item.id)
      let msg=[]
      if(ids.length){const{data,error:messageError}=await supabase.from("inbox_messages").select("id,conversation_id,external_message_id,direction,sender_external_id,text,payload,occurred_at,created_at").in("conversation_id",ids).order("occurred_at",{ascending:true});if(messageError)throw messageError;msg=data||[]}
      setConversations(convs||[]);setMessages(msg)
    }catch(err){setError(err?.message||"No se pudo cargar la bandeja de mensajes.")}
    finally{setLoading(false)}
  },[propertyId])

  useEffect(()=>{setContexts({});setContextLoading({});load()},[load])

  const messagesByConversation=useMemo(()=>{
    const map=new Map();for(const message of messages){const list=map.get(message.conversation_id)||[];list.push(message);map.set(message.conversation_id,list)}return map
  },[messages])

  const loadContext=useCallback(async id=>{
    if(!propertyId||!id)return null
    setContextLoading(current=>({...current,[id]:true}));setError("")
    try{
      const{data,error:contextError}=await supabase.rpc("hl_get_inbox_operational_context",{p_property_id:propertyId,p_conversation_id:id})
      if(contextError)throw contextError
      setContexts(current=>({...current,[id]:data||null}))
      return data||null
    }catch(err){setError(err?.message||"No se pudo resolver el contexto operativo de esta conversación.");return null}
    finally{setContextLoading(current=>({...current,[id]:false}))}
  },[propertyId])

  const setConversationStatus=useCallback(async(id,status)=>{
    const{data,error:updateError}=await supabase.from("inbox_conversations").update({status,updated_at:new Date().toISOString()}).eq("id",id).eq("property_id",propertyId).select(CONVERSATION_SELECT).single();if(updateError)throw updateError
    setConversations(list=>list.map(item=>item.id===data.id?data:item));return data
  },[propertyId])

  const markRead=useCallback(async id=>{
    const{data,error:updateError}=await supabase.from("inbox_conversations").update({unread_count:0,updated_at:new Date().toISOString()}).eq("id",id).eq("property_id",propertyId).select(CONVERSATION_SELECT).single();if(updateError)throw updateError
    setConversations(list=>list.map(item=>item.id===data.id?data:item));return data
  },[propertyId])

  return{conversations,messagesByConversation,contexts,contextLoading,loading,error,setError,load,loadContext,setConversationStatus,markRead}
}
