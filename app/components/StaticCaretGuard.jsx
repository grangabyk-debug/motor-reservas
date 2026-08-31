"use client"

import{useEffect}from"react"

const EDITABLE_SELECTOR='input,textarea,[contenteditable="true"],[role="textbox"]'

function editableTarget(node){
  const element=node?.nodeType===1?node:node?.parentElement
  return !!element?.closest?.(EDITABLE_SELECTOR)
}

export default function StaticCaretGuard(){
  useEffect(()=>{
    const clearStaticCaret=()=>{
      const selection=window.getSelection?.()
      if(!selection||!selection.isCollapsed||!selection.anchorNode)return
      if(editableTarget(selection.anchorNode))return
      selection.removeAllRanges()
    }
    document.addEventListener("selectionchange",clearStaticCaret)
    document.addEventListener("pointerup",clearStaticCaret,true)
    return()=>{
      document.removeEventListener("selectionchange",clearStaticCaret)
      document.removeEventListener("pointerup",clearStaticCaret,true)
    }
  },[])

  return <style>{`
    body *:not(input):not(textarea):not([contenteditable="true"]):not([role="textbox"]){caret-color:transparent!important}
    input,textarea,[contenteditable="true"],[role="textbox"]{caret-color:auto!important}
  `}</style>
}
