"use client"

import{useEffect,useRef,useState}from"react"
import{clearReservationDraft,hasMeaningfulReservationDraft,loadReservationDraft,saveReservationDraft}from"../../services/reservationDraftCache"

export default function useReservationDraftSafety({draft,setDraft,tab,setTab,initial,propertyId}){
  const[recovery,setRecovery]=useState(null),[ready,setReady]=useState(!!initial?.id),[state,setState]=useState("saved"),[lastSavedAt,setLastSavedAt]=useState(null)
  const submitted=useRef(false),mounted=useRef(true),latestDraft=useRef(draft),latestTab=useRef(tab)
  latestDraft.current=draft
  latestTab.current=tab

  useEffect(()=>()=>{mounted.current=false;if(initial?.id||!propertyId)return;if(submitted.current)clearReservationDraft(propertyId);else if(hasMeaningfulReservationDraft(latestDraft.current))saveReservationDraft(propertyId,latestDraft.current,latestTab.current)},[initial?.id,propertyId])
  useEffect(()=>{let active=true;submitted.current=false;setRecovery(null);if(initial?.id||!propertyId){setReady(true);return()=>{active=false}}setReady(false);loadReservationDraft(propertyId).then(record=>{if(!active)return;if(record){setRecovery(record);setLastSavedAt(record.savedAt);setState("saved")}else setReady(true)}).catch(()=>active&&setReady(true));return()=>{active=false}},[initial?.id,propertyId])
  useEffect(()=>{if(!ready||recovery||!draft||draft.id||!propertyId||!hasMeaningfulReservationDraft(draft))return;setState("saving");const timer=setTimeout(()=>{saveReservationDraft(propertyId,draft,tab).then(record=>{if(!mounted.current)return;setState("saved");setLastSavedAt(record?.savedAt||Date.now())}).catch(()=>mounted.current&&setState("error"))},500);return()=>clearTimeout(timer)},[draft,tab,propertyId,ready,recovery])

  function recoverDraft(){if(!recovery)return;setDraft({...initial,...recovery.draft,id:null});if(recovery.tab)setTab(recovery.tab);setRecovery(null);setReady(true);setState("saved")}
  async function discardDraft(){await clearReservationDraft(propertyId);if(!mounted.current)return;setRecovery(null);setReady(true);setState("saved");setLastSavedAt(null)}
  async function commitDraft(onSave){submitted.current=true;await onSave(draft);if(mounted.current)submitted.current=false}

  return{recovery,recoverDraft,discardDraft,commitDraft,state,setState,lastSavedAt,ready}
}
