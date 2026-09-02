export const WIDGET_LAYOUTS={
  "1x1":{span:3,rows:1,label:"1×1"},
  "2x1":{span:6,rows:1,label:"2×1"},
  "2x2":{span:6,rows:2,label:"2×2"},
}

export const DASHBOARD_WIDGETS=[
  {id:"turn-pulse",label:"Resumen del turno",defaultSize:"2x1",sizes:["2x1","2x2"]},
  {id:"occupancy",label:"Ocupación y tendencia",defaultSize:"2x1",sizes:["2x1","2x2"]},
  {id:"revenue-lab",label:"HL Revenue Lab",defaultSize:"2x1",sizes:["2x1","2x2"]},
  {id:"priorities",label:"Tareas prioritarias",defaultSize:"2x1",sizes:["2x1","2x2"]},
  {id:"kpi-occupancy",label:"Ocupación hoy",defaultSize:"1x1",sizes:["1x1","2x1"]},
  {id:"kpi-production",label:"Producción",defaultSize:"1x1",sizes:["1x1","2x1"]},
  {id:"kpi-reservations",label:"Reservas",defaultSize:"1x1",sizes:["1x1","2x1"]},
  {id:"kpi-housekeeping",label:"Housekeeping",defaultSize:"1x1",sizes:["1x1","2x1"]},
  {id:"channels",label:"Origen de reservas",defaultSize:"1x1",sizes:["1x1","2x1","2x2"]},
  {id:"reservation-metrics",label:"Métricas de reservas",defaultSize:"1x1",sizes:["1x1","2x1","2x2"]},
  {id:"cleaning",label:"Estado de habitaciones",defaultSize:"1x1",sizes:["1x1","2x1","2x2"]},
  {id:"arrivals",label:"Llegadas",defaultSize:"1x1",sizes:["1x1","2x1","2x2"]},
  {id:"inhouse",label:"Huéspedes en casa",defaultSize:"1x1",sizes:["1x1","2x1","2x2"]},
  {id:"departures",label:"Salidas",defaultSize:"1x1",sizes:["1x1","2x1","2x2"]},
]

export const DEFAULT_WIDGET_ORDER=DASHBOARD_WIDGETS.map(widget=>widget.id)
export const DEFAULT_WIDGET_SIZES=Object.fromEntries(DASHBOARD_WIDGETS.map(widget=>[widget.id,widget.defaultSize]))

export const DASHBOARD_PRESETS={
  reception:{
    label:"Recepción",
    description:"Llegadas, huéspedes y pendientes al frente.",
    order:["turn-pulse","priorities","arrivals","inhouse","departures","occupancy","revenue-lab","kpi-occupancy","kpi-reservations","kpi-production","kpi-housekeeping","cleaning","channels","reservation-metrics"],
    hidden:[],
    sizes:{"turn-pulse":"2x1","priorities":"2x1","arrivals":"2x1","inhouse":"2x1","departures":"2x1","occupancy":"2x2","revenue-lab":"2x1"},
  },
  management:{
    label:"Dirección",
    description:"Ocupación, producción y canales sin ruido operativo.",
    order:["occupancy","revenue-lab","kpi-occupancy","kpi-production","kpi-reservations","channels","reservation-metrics","turn-pulse","cleaning","kpi-housekeeping","priorities","arrivals","inhouse","departures"],
    hidden:["priorities","arrivals","inhouse","departures"],
    sizes:{occupancy:"2x2","revenue-lab":"2x2",channels:"2x1","reservation-metrics":"2x1","turn-pulse":"2x1"},
  },
  housekeeping:{
    label:"Housekeeping",
    description:"Habitaciones, salidas y prioridades de operación.",
    order:["cleaning","kpi-housekeeping","departures","arrivals","priorities","turn-pulse","occupancy","kpi-occupancy","inhouse","revenue-lab","kpi-reservations","kpi-production","channels","reservation-metrics"],
    hidden:["revenue-lab","kpi-production","channels","reservation-metrics"],
    sizes:{cleaning:"2x1",departures:"2x1",arrivals:"2x1",priorities:"2x1","turn-pulse":"2x1"},
  },
}

export function normalizeWidgetSizes(saved={}){
  const result={...DEFAULT_WIDGET_SIZES}
  for(const widget of DASHBOARD_WIDGETS){
    const candidate=saved?.[widget.id]
    if(widget.sizes.includes(candidate))result[widget.id]=candidate
  }
  return result
}

export function normalizeWidgetOrder(saved=[]){
  if(!Array.isArray(saved))return [...DEFAULT_WIDGET_ORDER]
  const known=saved.filter((id,index)=>DEFAULT_WIDGET_ORDER.includes(id)&&saved.indexOf(id)===index)
  const missing=DEFAULT_WIDGET_ORDER.filter(id=>!known.includes(id))
  return [...known,...missing]
}

export function layoutForWidget(widget,size){
  const safeSize=widget?.sizes?.includes(size)?size:widget?.defaultSize||"1x1"
  return {size:safeSize,...(WIDGET_LAYOUTS[safeSize]||WIDGET_LAYOUTS["1x1"])}
}

export function presetLayout(id){
  const preset=DASHBOARD_PRESETS[id]
  if(!preset)return null
  const order=normalizeWidgetOrder(preset.order)
  const hidden=preset.hidden.filter(widgetId=>DEFAULT_WIDGET_ORDER.includes(widgetId))
  const sizes=normalizeWidgetSizes({...DEFAULT_WIDGET_SIZES,...preset.sizes})
  return {order,hidden,sizes,preset:id}
}
