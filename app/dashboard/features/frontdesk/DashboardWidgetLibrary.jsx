"use client"

import{DASHBOARD_PRESETS,DASHBOARD_WIDGETS,layoutForWidget}from"./DashboardWidgetLayout"

export function WidgetSlot({widget,size,editing,onDragStart,onDrop,onSize,children,slotClass,editingClass,handleClass}){
  const layout=layoutForWidget(widget,size)
  return <div className={`${slotClass} ${editing?editingClass:""}`} data-widget-size={layout.size} style={{"--widget-span":layout.span,"--widget-rows":layout.rows}} draggable={editing} onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",widget.id);onDragStart(widget.id)}} onDragOver={e=>{if(editing){e.preventDefault();e.dataTransfer.dropEffect="move"}}} onDrop={e=>{if(!editing)return;e.preventDefault();onDrop(widget.id)}}>
    {editing&&<div className={handleClass}><span>⠿</span><b>{widget.label}</b><div className="hlWidgetSizeControls" onMouseDown={e=>e.stopPropagation()} onDragStart={e=>{e.preventDefault();e.stopPropagation()}}>{widget.sizes.map(option=><button type="button" draggable={false} key={option} className={layout.size===option?"hlWidgetSizeActive":""} onClick={e=>{e.preventDefault();e.stopPropagation();onSize(widget.id,option)}}>{option.replace("x","×")}</button>)}</div><small>Arrastrar</small></div>}
    {children}
  </div>
}

export function DashboardCustomizer({hidden,activePreset,onPreset,onToggle,onReset,onDone,customizerClass,introClass,togglesClass,onClass,offClass,actionsClass,doneClass}){
  return <section className={customizerClass}>
    <div className={introClass}><span>PERSONALIZAR PANEL</span><b>Tu panel, como trabaja tu hotel.</b><small>Elegí una vista rápida o armala a mano. Podés mover, ocultar y cambiar el tamaño de cada widget.</small></div>
    <div className="hlWidgetPresetBar"><span>VISTAS RÁPIDAS</span><div>{Object.entries(DASHBOARD_PRESETS).map(([id,preset])=><button type="button" key={id} className={activePreset===id?"hlWidgetPresetActive":""} onClick={()=>onPreset(id)}><b>{preset.label}</b><small>{preset.description}</small></button>)}</div></div>
    <div className={togglesClass}>{DASHBOARD_WIDGETS.map(widget=><button type="button" key={widget.id} className={hidden.includes(widget.id)?offClass:onClass} onClick={()=>onToggle(widget.id)}>{hidden.includes(widget.id)?"＋":"✓"} {widget.label}</button>)}</div>
    <div className={actionsClass}><button type="button" onClick={onReset}>Restablecer</button><button type="button" className={doneClass} onClick={onDone}>Listo</button></div>
  </section>
}
