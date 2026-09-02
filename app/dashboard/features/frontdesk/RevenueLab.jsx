"use client"

import{useMemo,useState}from"react"
import{money}from"../../core/formatters"
import lab from"./revenue-lab.module.css"

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value))
const round100=value=>Math.round(Number(value||0)/100)*100

export default function RevenueLab({occupancy=0,occupied=0,roomCount=0,todayRevenue=0,currency="ARS"}){
  const currentAdr=occupied?todayRevenue/occupied:0
  const[targetOccupancy,setTargetOccupancy]=useState(clamp(Math.max(occupancy,70),20,100))
  const[rateDelta,setRateDelta]=useState(0)
  const scenario=useMemo(()=>{
    const rooms=Math.min(roomCount,Math.max(0,Math.round(roomCount*targetOccupancy/100)))
    const adr=currentAdr*(1+rateDelta/100)
    const projected=rooms*adr
    const delta=projected-todayRevenue
    const revPar=roomCount?projected/roomCount:0
    const currentRevPar=roomCount?todayRevenue/roomCount:0
    return{rooms,adr,projected,delta,revPar,currentRevPar}
  },[roomCount,targetOccupancy,currentAdr,rateDelta,todayRevenue])
  const presets={conservative:{occ:clamp(Math.max(occupancy,65),20,100),rate:-5},balanced:{occ:clamp(Math.max(occupancy+8,75),20,100),rate:5},bold:{occ:clamp(Math.max(occupancy+15,85),20,100),rate:12}}
  const applyPreset=id=>{const next=presets[id];setTargetOccupancy(next.occ);setRateDelta(next.rate)}
  const signal=scenario.delta>todayRevenue*.08?"up":scenario.delta<0?"down":"flat"
  const chartMax=Math.max(1,todayRevenue,scenario.projected),currentHeight=Math.max(8,Math.round(todayRevenue/chartMax*100)),scenarioHeight=Math.max(8,Math.round(scenario.projected/chartMax*100))
  return <section className={lab.lab}>
    <header><div><small>HL LAB · WHAT-IF</small><h3>Simulador de ingreso</h3><p>Probá ocupación y tarifa antes de tocar una sola reserva.</p></div><span className={lab.live}>NO MODIFICA DATOS</span></header>
    <div className={lab.presets}><button onClick={()=>applyPreset("conservative")}>Cuidar ocupación</button><button onClick={()=>applyPreset("balanced")}>Equilibrado</button><button onClick={()=>applyPreset("bold")}>Empujar tarifa</button></div>
    <div className={lab.controls}>
      <label><span><b>Ocupación objetivo</b><strong>{targetOccupancy}%</strong></span><input type="range" min="20" max="100" step="1" value={targetOccupancy} onChange={e=>setTargetOccupancy(Number(e.target.value))}/><small>Hoy: {occupancy}% · escenario: {scenario.rooms}/{roomCount} habitaciones</small></label>
      <label><span><b>Cambio de tarifa</b><strong>{rateDelta>0?"+":""}{rateDelta}%</strong></span><input type="range" min="-20" max="30" step="1" value={rateDelta} onChange={e=>setRateDelta(Number(e.target.value))}/><small>ADR actual estimado: {money(round100(currentAdr),currency)}</small></label>
    </div>

    <div className={lab.visualBlock}>
      <div className={lab.chartHead}><div><small>IMPACTO VISUAL</small><b>Ingreso por noche</b></div><span data-signal={signal}>{scenario.delta>=0?"+":""}{money(round100(scenario.delta),currency)}</span></div>
      <div className={lab.comparisonChart} role="img" aria-label={`Ingreso actual ${money(round100(todayRevenue),currency)} versus escenario ${money(round100(scenario.projected),currency)}`}>
        <div className={lab.chartBar}><span><i style={{height:`${currentHeight}%`}}/></span><b>{money(round100(todayRevenue),currency)}</b><small>Hoy · {occupancy}%</small></div>
        <div className={`${lab.chartBar} ${lab.chartScenario}`}><span><i style={{height:`${scenarioHeight}%`}}/></span><b>{money(round100(scenario.projected),currency)}</b><small>Escenario · {targetOccupancy}%</small></div>
        <div className={lab.chartInsight}><small>LECTURA</small><strong>{signal==="up"?"Más ingreso estimado":signal==="down"?"Menos ingreso estimado":"Escenario estable"}</strong><p>{scenario.rooms} habitaciones ocupadas con ADR de {money(round100(scenario.adr),currency)}.</p></div>
      </div>
    </div>

    <div className={lab.result} data-signal={signal}>
      <div><small>INGRESO PROYECTADO / NOCHE</small><b>{money(round100(scenario.projected),currency)}</b><span>{scenario.delta>=0?"+":""}{money(round100(scenario.delta),currency)} vs. hoy</span></div>
      <div><small>ADR ESCENARIO</small><b>{money(round100(scenario.adr),currency)}</b><span>{rateDelta>=0?"sube":"baja"} {Math.abs(rateDelta)}%</span></div>
      <div><small>REVPAR</small><b>{money(round100(scenario.revPar),currency)}</b><span>hoy {money(round100(scenario.currentRevPar),currency)}</span></div>
    </div>
    <footer>{signal==="up"?"Este escenario mejora el ingreso estimado, pero conviene validar demanda antes de aplicarlo.":signal==="down"?"El escenario sacrifica ingreso estimado; puede servir si la prioridad es acelerar ocupación.":"El escenario queda cerca del resultado actual. Ajustá tarifa u ocupación para explorar alternativas."}</footer>
  </section>
}
