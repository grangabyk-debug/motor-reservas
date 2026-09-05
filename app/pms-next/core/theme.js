export const THEME_STORAGE_KEY="habitacion-llena:pms-next-theme"

export function readTheme(){
  if(typeof window==="undefined")return"light"
  try{
    const requested=new URL(window.location.href).searchParams.get("theme")
    if(requested==="light"||requested==="dark")return requested
    const saved=window.localStorage.getItem(THEME_STORAGE_KEY)
    if(saved==="light"||saved==="dark")return saved
  }catch{}
  return"light"
}

export function persistTheme(theme){
  if(typeof window==="undefined")return
  try{window.localStorage.setItem(THEME_STORAGE_KEY,theme)}catch{}
}
