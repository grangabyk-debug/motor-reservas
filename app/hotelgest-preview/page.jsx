"use client"

import Preview from "./page-v2"
import fix from "./preview-fix.module.css"

export default function HotelgestPreviewPage(){
  return <div className={fix.previewFix}><Preview/></div>
}
