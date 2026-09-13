"use client"

import{useRef,useState}from"react"

export default function useReportColumnDrag(order,onReorder){
  const stateRef=useRef(null)
  const[dragging,setDragging]=useState("")
  const[drop,setDrop]=useState({key:"",side:"before"})
  function clear(){stateRef.current=null;setDragging("");setDrop({key:"",side:"before"})}
  function finish(){const state=stateRef.current;if(state?.active&&state.target&&state.target!==state.key){const next=order.filter(key=>key!==state.key),targetIndex=next.indexOf(state.target);if(targetIndex>=0){next.splice(targetIndex+(state.side==="after"?1:0),0,state.key);onReorder(next)}}clear()}
  function props(key){return{
    "data-column-key":key,
    "data-dragging":dragging===key?"true":undefined,
    "data-drop-side":drop.key===key?drop.side:undefined,
    onPointerDown:event=>{if(event.pointerType==="mouse"&&event.button!==0)return;stateRef.current={key,startX:event.clientX,startY:event.clientY,active:false,target:"",side:"before"};event.currentTarget.setPointerCapture?.(event.pointerId)},
    onPointerMove:event=>{const state=stateRef.current;if(!state||state.key!==key)return;const distance=Math.hypot(event.clientX-state.startX,event.clientY-state.startY);if(!state.active){if(distance<6)return;state.active=true;setDragging(key)}event.preventDefault();const target=document.elementFromPoint(event.clientX,event.clientY)?.closest?.("[data-column-key]");const targetKey=target?.getAttribute?.("data-column-key");if(!targetKey)return;const rect=target.getBoundingClientRect(),side=event.clientX>rect.left+rect.width/2?"after":"before";state.target=targetKey;state.side=side;setDrop({key:targetKey,side})},
    onPointerUp:finish,
    onPointerCancel:clear,
  }}
  return props
}
