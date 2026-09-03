const DB_NAME="habitacion-llena-local"
const DB_VERSION=1
const STORE="reservationDrafts"
const MAX_AGE_MS=7*24*60*60*1000
const keyFor=propertyId=>`new-reservation:${String(propertyId||"hotel")}`
const fallbackKey=propertyId=>`hl:${keyFor(propertyId)}`

function openDb(){
  if(typeof indexedDB==="undefined")return Promise.reject(new Error("IndexedDB no disponible"))
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION)
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"key"})}
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error||new Error("No se pudo abrir el guardado local"))
  })
}
function run(mode,work){return openDb().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE),request=work(store);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error("No se pudo acceder al borrador"));tx.oncomplete=()=>db.close();tx.onabort=()=>{db.close();reject(tx.error||new Error("No se pudo guardar el borrador"))}}))}
function fallbackDraft(draft){return{...draft,pendingDocuments:(draft?.pendingDocuments||[]).map(({file,...item})=>({...item,file:null,fileName:file?.name||item.fileName||"",fileType:file?.type||item.fileType||""}))}}
function readFallback(propertyId){if(typeof localStorage==="undefined")return null;try{return JSON.parse(localStorage.getItem(fallbackKey(propertyId))||"null")}catch{return null}}
function writeFallback(propertyId,record){if(typeof localStorage==="undefined")return;try{localStorage.setItem(fallbackKey(propertyId),JSON.stringify({...record,draft:fallbackDraft(record.draft)}))}catch{}}
function clearFallback(propertyId){if(typeof localStorage==="undefined")return;try{localStorage.removeItem(fallbackKey(propertyId))}catch{}}

export function hasMeaningfulReservationDraft(draft){
  if(!draft||draft.id)return false
  const text=[draft.guest,draft.email,draft.phone,draft.document,draft.address,draft.city,draft.notes,draft.vehiclePlate,draft.vehicleType].some(value=>String(value||"").trim())
  const stay=Boolean(draft.roomId||draft.rate||(draft.start&&draft.end))
  const lists=[draft.additionalRooms,draft.companions,draft.extras,draft.pets,draft.initialPayments,draft.pendingDocuments].some(items=>Array.isArray(items)&&items.length)
  return text||stay||lists
}

export async function loadReservationDraft(propertyId){
  const key=keyFor(propertyId)
  let record=null
  try{record=await run("readonly",store=>store.get(key))}catch{record=readFallback(propertyId)}
  if(!record)return null
  if(!record.savedAt||Date.now()-Number(record.savedAt)>MAX_AGE_MS||!hasMeaningfulReservationDraft(record.draft)){await clearReservationDraft(propertyId);return null}
  return record
}

export async function saveReservationDraft(propertyId,draft,tab){
  if(!hasMeaningfulReservationDraft(draft))return null
  const record={key:keyFor(propertyId),savedAt:Date.now(),tab:tab||"guest",draft}
  try{await run("readwrite",store=>store.put(record));clearFallback(propertyId)}catch{writeFallback(propertyId,record)}
  return record
}

export async function clearReservationDraft(propertyId){
  clearFallback(propertyId)
  try{await run("readwrite",store=>store.delete(keyFor(propertyId)))}catch{}
}
