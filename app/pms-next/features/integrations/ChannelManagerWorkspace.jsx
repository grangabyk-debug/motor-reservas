"use client"

import ChannelHubPanel from"./ChannelHubPanel"
import s from"./channelWorkspace.module.css"

export default function ChannelManagerWorkspace({propertyId,property}){
  return <section className={s.page}>
    <ChannelHubPanel propertyId={propertyId} property={property}/>
  </section>
}
