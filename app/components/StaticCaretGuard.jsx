"use client"

export default function StaticCaretGuard(){
  return <style>{`
    body *:not(input):not(textarea):not([contenteditable="true"]):not([role="textbox"]){caret-color:transparent!important}
    input,textarea,[contenteditable="true"],[role="textbox"]{caret-color:auto!important}
  `}</style>
}
