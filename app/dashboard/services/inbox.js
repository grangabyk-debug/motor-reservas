import{supabase}from"../../../lib/supabase"
import{requirePropertyId}from"../data/tenant"

export async function loadInboxConversations({propertyId,limit=150}){
  const pid=requirePropertyId(propertyId),{data,error}=await supabase.from("inbox_conversations").select("*").eq("property_id",pid).order("last_message_at",{ascending:false}).limit(Math.max(1,Math.min(250,Number(limit)||150)))
  if(error)throw error
  return data||[]
}

export async function loadInboxMessages({propertyId,conversationId}){
  const pid=requirePropertyId(propertyId)
  const{data:conversation,error:conversationError}=await supabase.from("inbox_conversations").select("*").eq("property_id",pid).eq("id",conversationId).single()
  if(conversationError)throw conversationError
  const{data:messages,error}=await supabase.from("inbox_messages").select("*").eq("conversation_id",conversation.id).order("occurred_at",{ascending:true}).limit(500)
  if(error)throw error
  return{conversation,messages:messages||[]}
}

export async function markInboxRead({propertyId,conversationId}){
  const pid=requirePropertyId(propertyId),{data,error}=await supabase.from("inbox_conversations").update({unread_count:0,updated_at:new Date().toISOString()}).eq("property_id",pid).eq("id",conversationId).select("*").single()
  if(error)throw error
  return data
}
