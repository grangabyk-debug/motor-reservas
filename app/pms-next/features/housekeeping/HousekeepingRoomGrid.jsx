"use client"

import HousekeepingMyDay from"./HousekeepingMyDay"
import HousekeepingRoomGridCore from"./HousekeepingRoomGridCore"

export default function HousekeepingRoomGrid(props){
  return <><HousekeepingMyDay visible={props.visible} saving={props.saving} onAdvanceTask={props.onAdvanceTask} onAdvanceRoom={props.onAdvanceRoom}/><HousekeepingRoomGridCore {...props}/></>
}
