"use client"

import{DASHBOARD_PRESETS,DASHBOARD_WIDGETS,layoutForWidget}from"./DashboardWidgetLayout"

export function WidgetSlot({widget,size,editing,onDragStart,onDrop,onSize,onNudge,children,slotClass,editingClass,handleClass,nudgeClass}){
  const layout=layoutForWidget(widget,size)
  return <div className={`${slotClass} ${editing?editingClass:""}`} data-widget-id={widget.id} data-widget-size={layout.size} style={{"--widget-span":layout.span,"--widget-rows":layout.rows}} draggable aria-grabbed="false" onDragStart={e=>{e.currentTarget.setAttribute("aria-grabbed","true");e.currentTarget.classList.add("hlWidgetDragging");e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",widget.id);onDragStart(widget.id)}} onDragEnd={e=>{e.currentTarget.setAttribute("aria-grabbed","false");e.currentTarget.classList.remove("hlWidgetDragging")}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";e.currentTarget.classList.add("hlWidgetDropTarget")}} onDragLeave={e=>e.currentTarget.classList.remove("hlWidgetDropTarget")} onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove("hlWidgetDropTarget");onDrop(widget.id)}}>
    <div className={`${handleClass} ${editing?"hlWidgetHandleEditing":"hlWidgetHandleIdle"}`} title="Arrastrá para mover este widget">
      <span aria-hidden="true">⠿</span>
      {editing&&<><b>{widget.label}</b><div className="hlWidgetSizeControls" onPointerDown={e=>e.stopPropagation()} onDragStart={e=>{e.preventDefault();e.stopPropagation()}}>{widget.sizes.map(option=><button type="button" draggable={false} key={option} className={layout.size===option?"hlWidgetSizeActive":""} onClick={e=>{e.preventDefault();e.stopPropagation();onSize(widget.id,option)}}>{option.replace("x","×")}</button>)}</div><div className={nudgeClass||"hlWidgetNudge"} onPointerDown={e=>e.stopPropagation()} onDragStart={e=>{e.preventDefault();e.stopPropagation()}}><button type="button" draggable={false} aria-label={`Subir ${widget.label}`} onClick={e=>{e.preventDefault();e.stopPropagation();onNudge?.(widget.id,-1)}}>↑</button><button type="button" draggable={false} aria-label={`Bajar ${widget.label}`} onClick={e=>{e.preventDefault();e.stopPropagation();onNudge?.(widget.id,1)}}>↓</button></div><small>Mover</small></>}
    </div>
    {children}
  </div>
}

export function DashboardCustomizer({hidden,activePreset,onPreset,onToggle,onReset,onDone,customizerClass,introClass,togglesClass,onClass,offClass,actionsClass,doneClass}){
  return <section className={customizerClass}>
    <div className={introClass}><span>PERSONALIZAR PANEL</span><b>Tu panel, como trabaja tu hotel.</b><small>Los widgets se pueden arrastrar siempre. En tablet o móvil también podés reordenarlos con ↑ y ↓.</small></div>
    <div className="hlWidgetPresetBar"><span>VISTAS RÁPIDAS</span><div>{Object.entries(DASHBOARD_PRESETS).map(([id,preset])=><button type="button" key={id} className={activePreset===id?"hlWidgetPresetActive":""} onClick={()=>onPreset(id)}><b>{preset.label}</b><small>{preset.description}</small></button>)}</div></div>
    <div className={togglesClass}>{DASHBOARD_WIDGETS.map(widget=><button type="button" key={widget.id} className={hidden.includes(widget.id)?offClass:onClass} onClick={()=>onToggle(widget.id)}>{hidden.includes(widget.id)?"＋":"✓"} {widget.label}</button>)}</div>
    <div className={actionsClass}><button type="button" onClick={onReset}>Restablecer</button><button type="button" className={doneClass} onClick={onDone}>Listo</button></div>
  </section>
}
