"use client"

import s from"./propertyRooms.module.css"

export function RoomSwitch({checked,disabled,onChange}){return <button type="button" role="switch" aria-checked={checked} className={`${s.switch} ${checked?s.switchOn:""}`} disabled={disabled} onClick={onChange}><i/></button>}
export function RoomSection({title,subtitle,children}){return <section className={s.section}><header><h3>{title}</h3><p>{subtitle}</p></header>{children}</section>}
export function RoomField({label,children}){return <label className={s.field}><span>{label}</span>{children}</label>}
export function RoomToggleCard({title,text,checked,disabled,onChange}){return <div className={`${s.toggleCard} ${checked?s.toggleCardOn:""}`}><div><b>{title}</b><small>{text}</small></div><RoomSwitch checked={checked} disabled={disabled} onChange={()=>onChange(!checked)}/></div>}
