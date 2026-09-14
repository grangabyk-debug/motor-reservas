export const ROOM_PALETTE=["#5B6CF3","#2EA7A0","#9A6BDF","#D59B48","#4A8FD8","#D56F8A","#5A9B68","#8A6E5A"]
export const EMPTY_ROOM={nombre:"",room_type_id:"",color:"",capacidad:2,precio:0,activa:true,online_bookable:true,floor_id:"",housekeeping_zone:"",descripcion:"",sort_order:0}
export const EMPTY_TYPE={name:"",code:"",color:ROOM_PALETTE[0],capacity:2,adults:2,children:0,beds:1,base_price:0,description:"",amenities:[],active:true,online_bookable:true,sort_order:0}
export const roomMoney=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value)||0)
